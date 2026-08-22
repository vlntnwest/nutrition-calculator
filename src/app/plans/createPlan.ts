import type {
  AidStation,
  Flask,
  ResolvedPoint,
  Targets,
} from "../../core/type";
import { db } from "../../db";
import { aidStations } from "../../db/schema/aidStations";
import { flasks } from "../../db/schema/flasks";
import { planSettings } from "../../db/schema/planSettings";
import { plans } from "../../db/schema/plans";
import { tracks } from "../../db/schema/tracks";

/**
 * Ce qu'il faut fournir pour créer un plan : le parcours importé et les
 * réglages, c'est-à-dire tout le côté **saisie** du modèle. Le côté calculé —
 * tronçons, rations, remplissages, avertissements — n'est pas ici : il naît de
 * la régénération, jamais d'un appelant.
 *
 * Les types viennent du noyau plutôt que d'être redéclarés : c'est la même
 * flasque et le même ravitaillement des deux côtés de la frontière.
 */
export type NewPlan = {
  track: {
    name: string;
    distanceM: number;
    ascentM: number;
    points: ResolvedPoint[];
  };
  settings: {
    massKg: number;
    targetTimeS: number;
    /** Le D+ corrigé à la main. Absent, celui de la trace fait foi. */
    ascentOverrideM?: number;
    climbIntensity: number;
    paceSplit: number;
    /** En `AAAA-MM-JJ` : une date de calendrier, sans heure ni fuseau. */
    raceDate: string;
    /** En `HH:MM`. Absente, les passages sont donnés en temps écoulé. */
    startTime?: string;
    targets: Targets;
  };
  flasks: Flask[];
  aidStations: AidStation[];
};

/**
 * Écrit un plan et rend son identifiant d'accès — l'UUID qui ira dans l'URL.
 *
 * Tout part dans une seule transaction : un plan sans sa trace ou sans ses
 * réglages n'est pas un plan à moitié écrit, c'est une ligne qu'aucun écran ne
 * sait afficher.
 */
export async function createPlan(input: NewPlan): Promise<string> {
  return db.transaction(async (tx) => {
    const [plan] = await tx
      .insert(plans)
      .values({})
      .returning({ accessId: plans.accessId });

    await tx.insert(tracks).values({
      planId: plan.accessId,
      name: input.track.name,
      distanceM: input.track.distanceM,
      ascentM: input.track.ascentM,
      points: input.track.points,
    });

    // Les trois cibles voyagent groupées dans le noyau — c'est un réglage
    // unique — mais s'écrivent à plat : la base ne sait pas imbriquer, et
    // `check` ne porte que sur des colonnes.
    await tx.insert(planSettings).values({
      planId: plan.accessId,
      massKg: input.settings.massKg,
      targetTimeS: input.settings.targetTimeS,
      ascentOverrideM: input.settings.ascentOverrideM ?? null,
      climbIntensity: input.settings.climbIntensity,
      paceSplit: input.settings.paceSplit,
      raceDate: input.settings.raceDate,
      startTime: input.settings.startTime ?? null,
      targetCarbsGH: input.settings.targets.carbsGH,
      targetFluidMlH: input.settings.targets.fluidMlH,
      targetSodiumMgL: input.settings.targets.sodiumMgL,
    });

    // Les deux tableaux qui suivent peuvent être vides : l'autonomie complète
    // et la contenance non déclarée sont des cas nominaux, pas des anomalies
    // — §3. Drizzle refusant `values([])`, le vide s'écarte avant l'appel.
    //
    // Le noyau numérote les flasques par leur position dans le tableau, ce que
    // `Fill.flaskIndex` désigne. La base part de 1, `flasks_rank_positive`
    // l'exigeant. Le décalage se fait ici, une fois.
    if (input.flasks.length > 0) {
      await tx.insert(flasks).values(
        input.flasks.map((flask, i) => ({
          planId: plan.accessId,
          rank: i + 1,
          volumeMl: flask.volumeMl,
          onlyWater: flask.onlyWater,
        })),
      );
    }

    // `distanceM` devient `position_m` : des mètres entiers, et la moitié de
    // la clé primaire. L'arrêt sur place et la durée imposée au tronçon qui
    // s'achève ici sont deux choses distinctes, et deux colonnes.
    if (input.aidStations.length > 0) {
      await tx.insert(aidStations).values(
        input.aidStations.map((aid) => ({
          planId: plan.accessId,
          positionM: aid.distanceM,
          name: aid.name,
          stopDurationS: aid.stopS ?? null,
          durationOverrideS: aid.legDurationS ?? null,
        })),
      );
    }

    return plan.accessId;
  });
}
