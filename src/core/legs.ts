import { pacingError, timeAt } from "./distribute.ts";
import { energyCost } from "./pace.ts";
import { sum } from "./sum.ts";
import type {
  AidStation,
  FixedSpan,
  RawLeg,
  Runner,
  TimedPoint,
} from "./type.ts";

const JOULES_PER_KCAL = 4184;

/**
 * Les ravitos réellement sur le parcours, dans l'ordre. Ce qui tombe au départ,
 * à l'arrivée ou au-delà n'en est pas un.
 *
 * `movingTimeS`, `fixedSpans` et `splitByAidStation` s'appuient tous les trois
 * dessus : filtrer différemment d'un côté ou de l'autre ferait retrancher du
 * temps visé un arrêt que le découpage n'applique jamais, et l'arrivée
 * manquerait l'objectif sans que rien ne le dise.
 */
function onCourse(aidStations: AidStation[], endM: number): AidStation[] {
  return [...aidStations]
    .filter((r) => r.distanceM > 0 && r.distanceM < endM)
    .sort((a, b) => a.distanceM - b.distanceM);
}

/**
 * Les portées de ravitaillement, en indices de secteurs. Chacune va d'une
 * borne qui réapprovisionne à la suivante : ce qu'on y prend doit tenir
 * jusqu'au bout de la portée.
 *
 * Une borne qui ne fournit pas ne rouvre rien — la portée la franchit et
 * continue. Le départ, lui, fournit toujours : on part avec ses flasques
 * pleines et son sac fait.
 *
 * @param provides Ce qu'on cherche à la borne : de l'eau, ou de quoi manger.
 */
export function carrySpans(
  aidStations: AidStation[],
  totalDistanceM: number,
  legCount: number,
  provides: (station: AidStation) => boolean | undefined,
): number[][] {
  const bounds = onCourse(aidStations, totalDistanceM);
  const spans: number[][] = [];

  for (let l = 0; l < legCount; l++) {
    // Le secteur `l` part de la borne `l - 1`.
    const at = l === 0 ? undefined : bounds[l - 1];
    const opens = at === undefined || provides(at) !== false;

    if (opens || spans.length === 0) spans.push([l]);
    else spans[spans.length - 1].push(l);
  }

  return spans;
}

/** L'arrêt d'un ravito, en secondes. Absent ou négatif vaut zéro. */
function stopOf(aidStation: AidStation | null): number {
  return Math.max(aidStation?.stopS ?? 0, 0);
}

/**
 * Le temps de mouvement : le temps visé, arrêts déduits. **C'est lui qu'il
 * faut passer à `distributeTime`**, jamais le temps visé brut.
 *
 * Dix minutes de ravito demandent d'aller plus vite entre les ravitos, pas
 * partout un peu moins vite. Répartir le temps total revient pourtant à ça :
 * les arrêts se diluent sur toute la trace, chaque secteur reçoit une durée
 * légèrement excédentaire, les horaires de passage dérivent d'autant, et les
 * besoins d'un secteur se calculent sur du temps passé debout à une table.
 *
 * @param totalDistanceM Longueur du parcours, pour ignorer les ravitos qui
 *   n'y tombent pas — le même filtre que `splitByAidStation`.
 */
export function movingTimeS(
  targetTimeS: number,
  aidStations: AidStation[],
  totalDistanceM: number,
): number {
  const stops = sum(onCourse(aidStations, totalDistanceM), (r) => stopOf(r));

  // Un objectif entièrement mangé par les arrêts n'a pas de solution plus
  // lente : il n'en a aucune. Le taire donnerait une allure nulle ou négative
  // qui contaminerait toute la trace en silence.
  if (stops >= targetTimeS) {
    throw pacingError(
      { code: "stops-above-target", stopS: stops, targetTimeS },
      "Aid station stops leave no time to move",
    );
  }

  return targetTimeS - stops;
}

/**
 * Les portions de trace dont la durée est **imposée**, dans l'ordre : chacune
 * va de la borne qui la précède — le ravito d'avant, ou le départ — au ravito
 * qui porte la consigne.
 *
 * Un ravito sans `legDurationS` n'en ouvre aucune, mais il borne quand même
 * celle qui suit : c'est le découpage en secteurs qui commande, pas la liste
 * des consignes.
 *
 * @param finishLegDurationS Le dernier secteur n'est clos par aucun ravito :
 *   sa consigne ne peut pas voyager sur un `AidStation` et arrive donc à part.
 *   Sans elle, il serait le seul secteur à ne pas pouvoir être réglé.
 */
export function fixedSpans(
  aidStations: AidStation[],
  totalDistanceM: number,
  finishLegDurationS?: number,
): FixedSpan[] {
  const spans: FixedSpan[] = [];
  let startM = 0;

  for (const ravito of onCourse(aidStations, totalDistanceM)) {
    if (ravito.legDurationS !== undefined) {
      spans.push({
        startM,
        endM: ravito.distanceM,
        durationS: ravito.legDurationS,
      });
    }
    startM = ravito.distanceM;
  }

  if (finishLegDurationS !== undefined) {
    spans.push({
      startM,
      endM: totalDistanceM,
      durationS: finishLegDurationS,
    });
  }

  return spans;
}

/**
 * Découpe la trace aux ravitos. Le premier secteur part du départ, le dernier
 * arrive à l'arrivée : un roadbook sans ravito donne donc un secteur unique.
 *
 * `points` porte le temps de **mouvement** — c'est ce que `distributeTime`
 * répartit. Les arrêts sont réintroduits ici, en décalant les horaires de
 * passage de tout ce qui a été perdu en amont, sans jamais toucher aux durées.
 */
export function splitByAidStation(
  points: TimedPoint[],
  aidStations: AidStation[],
  runner: Runner,
): RawLeg[] {
  if (points.length < 2) return [];

  const endM = points[points.length - 1].d;
  const bounds = onCourse(aidStations, endM);

  const legs: RawLeg[] = [];
  let startM = 0;
  // `null` aux deux bouts : « Départ » et « Arrivée » sont des mots, donc
  // l'affaire de l'affichage. Le nom d'un ravito, lui, vient du roadbook.
  let from: string | null = null;
  let i = 1;
  /** Tout ce qui a été perdu aux ravitos en amont du secteur courant. */
  let stoppedS = 0;

  for (const [k, ravito] of [...bounds, null].entries()) {
    const boundM = ravito?.distanceM ?? endM;
    const to = ravito?.name ?? null;

    let ascentM = 0;
    let descentM = 0;
    let joules = 0;

    // Curseur qui n'avance jamais en arrière : la boucle reste linéaire sur
    // l'ensemble des secteurs.
    while (i < points.length && points[i].d <= boundM) {
      const length = points[i].d - points[i - 1].d;
      if (length > 0) {
        const delta = points[i].ele - points[i - 1].ele;
        if (delta > 0) ascentM += delta;
        else descentM -= delta;
        joules += energyCost(delta / length) * length;
      }
      i++;
    }

    // Les deux bornes reçoivent le même décalage, donc `durationS` reste du
    // temps de mouvement pur : l'arrêt d'un ravito sépare l'arrivée d'un
    // secteur du départ du suivant, il ne rallonge aucun des deux.
    const startS = timeAt(points, startM) + stoppedS;
    const arrivalS = timeAt(points, boundM) + stoppedS;
    const stopS = stopOf(ravito);

    legs.push({
      from,
      to,
      startM,
      endM: boundM,
      lengthM: boundM - startM,
      ascentM,
      descentM,
      startS,
      arrivalS,
      durationS: arrivalS - startS,
      stopS,
      expenditureKcal: (joules * runner.massKg) / JOULES_PER_KCAL,
    });

    stoppedS += stopS;
    startM = boundM;
    from = to;
    if (k === bounds.length) break;
  }

  return legs;
}
