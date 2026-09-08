import type { Roadbook, Supply } from "@/app/plans/getRoadbook";
import type { RoadbookEdit } from "@/app/plans/saveRoadbook";
import { CARBS_OVERSHOOT_MAX } from "@/core/nutrition";
import { km } from "@/format/number";
import type { PaceBand } from "@/ui/track/ElevationChart";

const APPORT_VIDE: Supply = {
  carbsG: 0,
  energyKcal: 0,
  sodiumMg: 0,
  fluidMl: 0,
};

/**
 * L'apport d'un secteur recalculé depuis les retouches, sans attendre
 * l'enregistrement — la même somme que fait `assemble()` au noyau, sur les
 * mêmes instantanés. Un produit disparu du catalogue (jamais le cas en
 * pratique, la retouche ne peut poser que ce que le catalogue liste) ne
 * compte pour rien plutôt que de faire planter la carte.
 */
export function liveSupply(
  rations: RoadbookEdit["servings"][number],
  catalogue: Roadbook["catalogue"],
): Supply {
  return rations.reduce((s, r) => {
    const produit = catalogue.find((p) => p.id === r.productSnapshotId);
    if (!produit) return s;

    return {
      carbsG: s.carbsG + r.quantity * produit.carbsG,
      energyKcal: s.energyKcal + r.quantity * produit.energyKcal,
      sodiumMg: s.sodiumMg + r.quantity * produit.sodiumMg,
      fluidMl: s.fluidMl + r.quantity * produit.fluidMl,
    };
  }, APPORT_VIDE);
}

/**
 * Le liquide réellement porté à l'ouverture d'une portée : le volume des
 * flasques, versées d'eau claire ou de boisson. Un millilitre d'eau reste un
 * millilitre, mélangé ou non — l'addition ne regarde pas le contenu.
 *
 * `supply.fluidMl` ne dit pas ce qu'on porte mais ce que les rations dosent,
 * et c'est ce que `PackSummary` affiche sous « boisson ». L'ajouter ici
 * recompterait la boisson déjà versée dans une flasque.
 *
 * `remplissages` n'existe qu'à l'ouverture d'une portée (voir `editOf` dans
 * `RoadbookEditor`) : ailleurs il est vide, et un secteur au milieu d'une
 * portée ne porte rien — ses flasques ont été préparées en amont.
 */
export function liveCarriedMl(
  remplissages: RoadbookEdit["fills"][number],
): number {
  return remplissages.reduce((t, f) => t + f.volumeMl, 0);
}

/**
 * Ce qu'il y a à boire sur toute la portée qu'ouvre un secteur : son besoin,
 * plus celui des secteurs suivants jusqu'au prochain remplissage.
 *
 * Les flasques se remplissent à l'ouverture et doivent tenir jusqu'au ravito
 * suivant qui donne de l'eau. Comparer ce qu'elles portent au besoin du seul
 * secteur d'ouverture rassurerait à tort : un litre paraît suffire quand la
 * portée en réclame deux.
 */
export function spanFluidNeedMl(legs: Roadbook["legs"], index: number): number {
  return spanIndexes(legs, index).reduce((t, i) => t + legs[i].needFluidMl, 0);
}

/**
 * Les secteurs que couvre la portée ouverte en `index` : lui-même, puis ceux
 * qui suivent tant qu'ils ne rouvrent pas. Une boisson versée à l'ouverture
 * se boit sur tous — c'est le périmètre où flasques et rations doivent
 * s'accorder.
 */
export function spanIndexes(legs: Roadbook["legs"], index: number): number[] {
  const portee = [index];
  for (let i = index + 1; i < legs.length && !legs[i].opensLiquidSpan; i++) {
    portee.push(i);
  }

  return portee;
}

/**
 * Le secteur qui ouvre la portée où tombe `index` : lui-même s'il rouvre, le
 * dernier remplissage en amont sinon. C'est là que sont les flasques d'un
 * secteur qui n'en montre aucune.
 */
export function spanStart(legs: Roadbook["legs"], index: number): number {
  let i = index;
  while (i > 0 && !legs[i].opensLiquidSpan) i--;

  return i;
}

/**
 * La dose que représentent les flasques versées d'un produit : leur volume
 * rapporté à celui d'une dose, arrondi au pas de retouche.
 *
 * Une flasque se remplit à ras bord et le noyau y verse des doses entières,
 * sans jamais couper une flasque en deux — le rapport retombe donc juste dès
 * que la dose et la flasque font le même volume, le cas courant. Le plancher
 * d'un pas évite la ration nulle qu'une flasque minuscule produirait, et que
 * la base refuserait.
 */
export function pouredUnits(
  snapshotId: string,
  remplissages: RoadbookEdit["fills"][number],
  catalogue: Roadbook["catalogue"],
): number {
  const produit = catalogue.find((p) => p.id === snapshotId);
  if (!produit || produit.fluidMl <= 0) return 1;

  const volumeMl = remplissages
    .filter((f) => f.productSnapshotId === snapshotId)
    .reduce((t, f) => t + f.volumeMl, 0);
  const pas = 1 / produit.divisibleBy;

  return Math.max(pas, Math.round(volumeMl / produit.fluidMl / pas) * pas);
}

/**
 * Le sac complet recalculé depuis les retouches de tous les secteurs, dans la
 * même forme que `Roadbook["total"]` : c'est ce qui permet à `PackSummary` de
 * ne pas savoir si ce qu'on lui donne vient du serveur ou de la saisie en
 * cours.
 */
export function liveTotal(
  servings: RoadbookEdit["servings"],
  needsG: number[],
  catalogue: Roadbook["catalogue"],
): Roadbook["total"] {
  const supplies = servings.map((rations) => liveSupply(rations, catalogue));
  const carbsG = supplies.reduce((t, s) => t + s.carbsG, 0);

  const unites = new Map<
    string,
    { brandName: string | null; quantity: number }
  >();
  let weightG = 0;
  for (const rations of servings) {
    for (const r of rations) {
      const produit = catalogue.find((p) => p.id === r.productSnapshotId);
      if (!produit) continue;

      weightG += r.quantity * produit.weightG;
      const vu = unites.get(produit.name);
      unites.set(produit.name, {
        brandName: produit.brandName,
        quantity: (vu?.quantity ?? 0) + r.quantity,
      });
    }
  }

  return {
    carbsG,
    energyKcal: supplies.reduce((t, s) => t + s.energyKcal, 0),
    sodiumMg: supplies.reduce((t, s) => t + s.sodiumMg, 0),
    fluidMl: supplies.reduce((t, s) => t + s.fluidMl, 0),
    marginG: carbsG - needsG.reduce((t, n) => t + n, 0),
    weightG,
    units: [...unites].map(([name, v]) => ({ name, ...v })),
  };
}

/** Là où le secteur s'achève, nommé quand un ravito le clôt. */
export function bound(leg: Roadbook["legs"][number], totalM: number): string {
  return leg.endPositionM === null
    ? `arrivée, ${km(totalM)} km`
    : `${km(leg.endPositionM)} km`;
}

/**
 * L'écart mérite-t-il d'être signalé ?
 *
 * Seulement vers le haut : un secteur sous son besoin propre est prévu par
 * l'ADR 007, les solides se comptant sur la course puis se plaçant. Le seuil
 * est celui du contrôle global — mesuré, un plan calculé reste sous 1,1 quand
 * une retouche peut tripler.
 */
export function excessive(supplyG: number, needG: number): boolean {
  return needG > 0 && supplyG > needG * CARBS_OVERSHOOT_MAX;
}

/** L'abscisse où le secteur commence : la borne qui clôt le précédent. */
export function startOf(legs: Roadbook["legs"], index: number): number {
  return index === 0 ? 0 : (legs[index - 1].endPositionM ?? 0);
}

/**
 * L'allure moyenne d'un secteur, en secondes par kilomètre. C'est du temps de
 * mouvement : les arrêts au ravito ne sont pas dedans.
 */
export function legPaceSPerKm(
  legs: Roadbook["legs"],
  index: number,
  totalM: number,
): number | null {
  const leg = legs[index];
  const distanceM = (leg.endPositionM ?? totalM) - startOf(legs, index);

  return distanceM > 0 && leg.durationS > 0
    ? leg.durationS / (distanceM / 1000)
    : null;
}

/**
 * L'allure des secteurs, dans la forme que `paceBand` produit sur l'écran
 * Course — même dégradé sur le relief, même moyenne. `null` si aucun secteur
 * n'a d'allure lisible (une trace sans distance, par exemple).
 */
export function legPaceBand(
  legs: Roadbook["legs"],
  totalM: number,
): PaceBand | null {
  const segments = legs.flatMap((leg, i) => {
    const sPerKm = legPaceSPerKm(legs, i, totalM);

    return sPerKm === null
      ? []
      : [
          {
            startM: startOf(legs, i),
            endM: leg.endPositionM ?? totalM,
            sPerKm,
          },
        ];
  });

  if (segments.length === 0 || totalM <= 0) return null;

  const paces = segments.map((s) => s.sPerKm);
  const movingS = legs.reduce((t, l) => t + l.durationS, 0);

  return {
    segments,
    meanSPerKm: movingS / (totalM / 1000),
    slowestSPerKm: Math.max(...paces),
    fastestSPerKm: Math.min(...paces),
  };
}

/**
 * Ce qui se verse dans une flasque.
 *
 * Une flasque contient une boisson, et rien d'autre : une poudre à diluer, un
 * liquide à couper. Un gel, une barre, une gaufre se mangent — les proposer
 * au remplissage laissait poser une barre dans cinq cents millilitres, et le
 * calcul comptait alors ses glucides comme bus. Une capsule ne s'y verse pas
 * davantage : elle s'avale avec l'eau, elle ne la prépare pas.
 *
 * La liste nomme ce qui passe plutôt que ce qui ne passe pas, sur les
 * libellés du noyau (`src/format/produit.ts`) : un format nouveau ne se
 * retrouve pas versable par oubli.
 */
const VERSABLES = new Set(["drink"]);

export function estVersable(formatLabel: string): boolean {
  return VERSABLES.has(formatLabel);
}
