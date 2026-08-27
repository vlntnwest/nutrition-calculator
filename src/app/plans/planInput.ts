import { eq, inArray } from "drizzle-orm";
import type { Flask, ResolvedPoint, Targets } from "@/core/type";
import type { Tx } from "@/db";
import { brands } from "@/db/schema/brands";
import { formats } from "@/db/schema/formats";
import type { planSettings } from "@/db/schema/planSettings";
import { productSnapshots } from "@/db/schema/productSnapshots";
import { products } from "@/db/schema/products";
import { PlanError } from "./planError";

/** Un ravito, tel qu'il se saisit. Ce qu'il impose au secteur est à part. */
export type NewAidStation = {
  name: string;
  distanceM: number;
  /** L'arrêt sur place, en secondes. */
  stopS?: number;
  /** Y trouve-t-on de l'eau ? Absent vaut oui. */
  providesLiquid?: boolean;
  /** Y trouve-t-on de quoi manger ? Absent vaut oui. */
  providesSolid?: boolean;
};

/**
 * Ce qui est imposé au secteur se terminant à `endPositionM` — la position
 * d'un ravito, ou la distance totale pour l'arrivée, que rien ne clôt.
 */
export type LegOverride = {
  endPositionM: number;
  durationS?: number;
};

/** Le côté saisie d'un plan. Le calculé naît de la régénération. */
export type NewPlan = {
  track: {
    name: string;
    distanceM: number;
    ascentM: number;
    points: ResolvedPoint[];
  };
  settings: {
    massKg?: number;
    targetTimeS?: number;
    /** Absent : le défaut de la base, 0,25. */
    climbIntensity?: number;
    /** La dérive d'allure. Absent : 0, l'allure plate. */
    paceSplit?: number;
    /** `AAAA-MM-JJ` */
    raceDate?: string;
    /** `HH:MM` */
    startTime?: string;
    /** Un bloc : les trois cibles bougent ensemble. Absent : les défauts. */
    targets?: Targets;
  };
  flasks: Flask[];
  aidStations: NewAidStation[];
  /** Ce qui est imposé aux secteurs. Voir `LegOverride`. */
  legOverrides: LegOverride[];
  /** Les `code_seed` des produits retenus — « naak-gel-ultra ». */
  productCodes: string[];
};

/** Arrondit ce qui existe, laisse absent ce qui l'est. */
function whole(value: number | undefined): number | undefined {
  return value === undefined ? undefined : Math.round(value);
}

/**
 * Ramène aux entiers ce que la base stocke en entiers.
 *
 * Mètres, secondes et millilitres : une trace réelle ne tombe pas sur des
 * mètres ronds — `analyzeTrack` rend 28 350,401 m pour Saverne — et un
 * ravito posé au clic sur le profil pas davantage.
 *
 * Se fait **avant** la validation, jamais après : deux ravitos à 9 800,4 et
 * 10 000,2 s'écriraient à mille mètres l'un de l'autre, il serait absurde de
 * les refuser sur un écart de 999,8.
 */
export function normalise(input: NewPlan): NewPlan {
  return {
    track: {
      ...input.track,
      distanceM: Math.round(input.track.distanceM),
      ascentM: Math.round(input.track.ascentM),
    },
    settings: {
      ...input.settings,
      targetTimeS: whole(input.settings.targetTimeS),
      targets: input.settings.targets && {
        carbsGH: Math.round(input.settings.targets.carbsGH),
        fluidMlH: Math.round(input.settings.targets.fluidMlH),
        sodiumMgL: Math.round(input.settings.targets.sodiumMgL),
      },
    },
    flasks: input.flasks.map((flask) => ({
      ...flask,
      volumeMl: Math.round(flask.volumeMl),
    })),
    aidStations: input.aidStations.map((aid) => ({
      ...aid,
      distanceM: Math.round(aid.distanceM),
      stopS: whole(aid.stopS),
    })),
    legOverrides: input.legOverrides.map((o) => ({
      ...o,
      endPositionM: Math.round(o.endPositionM),
      durationS: whole(o.durationS),
    })),
    productCodes: input.productCodes,
  };
}

/**
 * L'écart minimal entre deux bornes d'un secteur, en mètres.
 *
 * Deux ravitos collés fabriquent un secteur qui s'arrondit à zéro seconde et
 * viole `legs_duration_positive` à la régénération. On refuse ici plutôt que
 * de laisser remonter une erreur Postgres brute — et un secteur de quelques
 * mètres n'a de toute façon aucun sens pour un coureur.
 */
const MIN_LEG_M = 1000;

/**
 * Les bornes trop rapprochées, s'il y en a. Le départ et l'arrivée en font
 * partie : un ravito collé à l'un des deux fabrique le même secteur nul.
 */
function tooClose(input: NewPlan): [number, number] | null {
  const bounds = [
    0,
    ...input.aidStations.map((aid) => aid.distanceM).sort((a, b) => a - b),
    input.track.distanceM,
  ];

  for (let i = 1; i < bounds.length; i++) {
    if (bounds[i] - bounds[i - 1] < MIN_LEG_M)
      return [bounds[i - 1], bounds[i]];
  }

  return null;
}

/**
 * Ce qu'aucune contrainte de la base ne peut tenir. Les deux écritures s'y
 * soumettent, sur un plan entier : une mise à jour partielle se fusionne avec
 * l'existant avant de passer ici.
 */
export function assertValid(input: NewPlan): void {
  const collees = tooClose(input);
  if (collees) {
    throw new PlanError(
      `Aid stations too close: ${collees[0]} m et ${collees[1]} m ` +
        `(minimum ${MIN_LEG_M} m)`,
    );
  }

  // Une borne inconnue serait ignorée sans bruit à la régénération : aucune
  // clé étrangère ne peut la tenir, l'arrivée n'étant pas un ravito.
  const bornes = new Set([
    ...input.aidStations.map((aid) => aid.distanceM),
    input.track.distanceM,
  ]);
  const perdus = input.legOverrides.filter((o) => !bornes.has(o.endPositionM));

  if (perdus.length > 0) {
    throw new PlanError(
      `Leg overrides at unknown boundaries: ${perdus
        .map((o) => o.endPositionM)
        .join(", ")}`,
    );
  }
}

/**
 * Les réglages en colonnes, les trois cibles mises à plat.
 *
 * `undefined` n'est pas écrit : la colonne est omise, et son défaut
 * s'applique à l'insertion comme sa valeur se garde à la mise à jour. D'où
 * le `?? null` sur ce qui s'efface vraiment.
 */
export function settingsColumns(
  settings: NewPlan["settings"],
): Omit<typeof planSettings.$inferInsert, "planId"> {
  return {
    massKg: settings.massKg ?? null,
    targetTimeS: settings.targetTimeS ?? null,
    climbIntensity: settings.climbIntensity,
    paceSplit: settings.paceSplit,
    raceDate: settings.raceDate ?? null,
    startTime: settings.startTime ?? null,
    targetCarbsGH: settings.targets?.carbsGH,
    targetFluidMlH: settings.targets?.fluidMlH,
    targetSodiumMgL: settings.targets?.sodiumMgL,
  };
}

/**
 * Fige les produits demandés dans le plan.
 *
 * Figés à la sélection : corriger le catalogue ne réécrit jamais un plan
 * enregistré. `divisibleBy` et `multiTransportable` en font partie, ils
 * entrent tous deux dans le calcul.
 */
export async function insertSnapshots(
  tx: Tx,
  planId: string,
  codes: string[],
): Promise<void> {
  if (codes.length === 0) return;

  const catalogue = await tx
    .select()
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(formats, eq(products.formatId, formats.id))
    .where(inArray(products.codeSeed, codes));

  if (catalogue.length !== codes.length) {
    const connus = new Set(catalogue.map((r) => r.products.codeSeed));
    const manquants = codes.filter((c) => !connus.has(c));

    throw new PlanError(`Unknown product codes: ${manquants.join(", ")}`);
  }

  await tx.insert(productSnapshots).values(
    catalogue.map(({ products: p, brands: b, formats: f }) => ({
      planId,
      productId: p.id,
      name: p.name,
      brandName: b.name,
      formatLabel: f.label,
      energyKcal: p.energyKcal,
      carbsG: p.carbsG,
      proteinG: p.proteinG,
      fatG: p.fatG,
      fiberG: p.fiberG,
      sugarG: p.sugarG,
      sodiumMg: p.sodiumMg,
      caffeineMg: p.caffeineMg,
      fluidMl: p.fluidMl,
      weightG: p.weightG,
      divisibleBy: p.divisibleBy,
      multiTransportable: p.multiTransportable,
    })),
  );
}
