import { asc, eq, getTableColumns } from "drizzle-orm";
import { db } from "@/db";
import { aidStations } from "@/db/schema/aidStations";
import { fill } from "@/db/schema/fill";
import { flasks } from "@/db/schema/flasks";
import { legOverrides } from "@/db/schema/legOverrides";
import { legs } from "@/db/schema/legs";
import { planSettings } from "@/db/schema/planSettings";
import { plans } from "@/db/schema/plans";
import { productSnapshots } from "@/db/schema/productSnapshots";
import { servings } from "@/db/schema/servings";
import { tracks } from "@/db/schema/tracks";
import { warnings } from "@/db/schema/warnings";
import { resolveTargets } from "./targets";

export type RoadbookServing = {
  /** Ce que l'écran renvoie pour désigner la ration qu'il retouche. */
  productSnapshotId: string;
  name: string;
  brandName: string | null;
  quantity: number;
  /** Le pas de retouche : 1 pour ce qui ne se coupe pas, 2 pour le reste. */
  divisibleBy: number;
  formatLabel: string;
  carbsG: number;
  sodiumMg: number;
  weightG: number;
};

export type RoadbookFill = {
  flaskRank: number;
  /** Absent : de l'eau claire. */
  product: string | null;
  productSnapshotId: string | null;
  volumeMl: number;
};

/** Ce que les rations apportent réellement. */
export type Supply = {
  carbsG: number;
  energyKcal: number;
  sodiumMg: number;
  fluidMl: number;
};

export type RoadbookLeg = {
  rank: number;
  /** L'abscisse où le secteur s'achève. Nul pour l'arrivée. */
  endPositionM: number | null;
  /** Le ravito qui clôt le secteur. Nul à l'arrivée, que rien ne clôt. */
  endName: string | null;
  /** La durée imposée à ce secteur, si le coureur en a posé une. */
  imposedDurationS: number | null;
  /** La cible de glucides imposée à ce secteur, le cas échéant. */
  imposedCarbsGH: number | null;
  ascentM: number;
  descentM: number;
  durationS: number;
  /** L'arrêt prévu à la borne qui clôt le secteur. Nul s'il n'y en a pas. */
  stopS: number | null;
  /**
   * Le temps écoulé depuis le départ à l'arrivée sur la borne : les durées de
   * mouvement des secteurs parcourus, plus les arrêts déjà faits. L'arrêt de
   * cette borne-ci n'y est pas — on arrive avant de s'arrêter.
   */
  elapsedS: number;
  servings: RoadbookServing[];
  fills: RoadbookFill[];
  /**
   * Le secteur ouvre-t-il une portée de liquide ? On ne remplit ses flasques
   * qu'au départ ou en repartant d'une borne qui fournit de l'eau : ailleurs,
   * il n'y a rien à verser. Même règle que `carrySpans`, côté noyau.
   */
  opensLiquidSpan: boolean;
  /**
   * Le secteur ouvre-t-il une portée de solide ? Même règle, sur les ravitos
   * qui donnent à manger. Un secteur qui n'en ouvre pas mange ce qu'il a
   * emporté : sa nourriture se prend au dernier qui en ouvrait une.
   */
  opensSolidSpan: boolean;
  supply: Supply;
  /** Les glucides visés sur ce secteur : la cible horaire fois sa durée. */
  needG: number;
  /**
   * Ce qu'il faut **boire** sur le secteur. À ne pas confondre avec les
   * volumes des flasques, qui partent pleines : on emporte souvent plus.
   */
  needFluidMl: number;
  /** Le sodium visé sur le secteur : la concentration ciblée fois `needFluidMl`. */
  needSodiumMg: number;
  /**
   * L'écart aux glucides visés, **signé** : un secteur peut passer sous son
   * besoin propre, la répartition se faisant sur toute la course.
   */
  marginG: number;
  warnings: { code: string; payload: unknown }[];
};

export type Roadbook = {
  legs: RoadbookLeg[];
  /** L'heure de départ, `HH:MM`, ou nulle tant qu'elle n'est pas renseignée. */
  startTime: string | null;
  /**
   * Les produits retenus pour ce plan — de quoi poser ce que le calcul n'a
   * pas proposé, et de quoi recalculer un apport à l'écran sans attendre
   * l'enregistrement (voir `liveSupply`, côté Roadbook).
   */
  catalogue: {
    id: string;
    name: string;
    brandName: string | null;
    divisibleBy: number;
    /** Le libellé du noyau — `gel`, `bar`, `drink`. Traduit à l'affichage. */
    formatLabel: string;
    carbsG: number;
    energyKcal: number;
    sodiumMg: number;
    fluidMl: number;
    weightG: number;
  }[];
  /** Les contenants déclarés, pour retoucher les remplissages. */
  flasks: { rank: number; volumeMl: number; onlyWater: boolean }[];
  /** Le plan a été retouché à la main depuis son dernier calcul. */
  edited: boolean;
  /** Quand le calcul a tourné. C'est lui qui fait foi sur sa fraîcheur. */
  generatedAt: Date;
  /** La distance totale, pour borner le dernier secteur. */
  totalM: number;
  /** Le sac complet, et ce qu'il apporte. */
  total: Supply & {
    marginG: number;
    /** Ce que le sac pèse au départ, tous produits confondus. */
    weightG: number;
    units: { name: string; brandName: string | null; quantity: number }[];
  };
  /** Ceux qui ne visent aucun secteur — ils portent `leg_rank` à null. */
  warnings: { code: string; payload: unknown }[];
};

const EMPTY: Supply = { carbsG: 0, energyKcal: 0, sodiumMg: 0, fluidMl: 0 };

/**
 * Le côté calculé d'un plan, ou null s'il n'a jamais été calculé.
 *
 * `generated_at` fait foi : une mise à jour l'efface en même temps qu'elle
 * supprime les secteurs, il ne peut donc pas désigner un calcul périmé.
 *
 * L'apport se resomme depuis les rations plutôt que de se stocker : c'est la
 * somme des instantanés retenus, elle ne peut pas diverger de ce qui est
 * affiché juste au-dessus.
 */
export async function getRoadbook(accessId: string): Promise<Roadbook | null> {
  // Projection explicite : `tracks` porte `points` et `profile`, dont on ne
  // veut ici que la distance totale. Voir `getPlan`.
  const [row] = await db
    .select({
      generatedAt: plans.generatedAt,
      editedAt: plans.editedAt,
      distanceM: tracks.distanceM,
      settings: getTableColumns(planSettings),
    })
    .from(plans)
    .innerJoin(planSettings, eq(planSettings.planId, plans.accessId))
    .innerJoin(tracks, eq(tracks.planId, plans.accessId))
    .where(eq(plans.accessId, accessId));

  const settings = row?.settings;
  if (!row?.generatedAt || !settings?.targetTimeS || settings.massKg === null) {
    return null;
  }

  const [
    legRows,
    servingRows,
    fillRows,
    warningRows,
    flaskRows,
    overrideRows,
    stationRows,
    catalogue,
  ] = await Promise.all([
    db
      .select()
      .from(legs)
      .where(eq(legs.planId, accessId))
      .orderBy(asc(legs.rank)),
    db
      .select({
        legRank: servings.legRank,
        quantity: servings.quantity,
        productSnapshotId: servings.productSnapshotId,
        divisibleBy: productSnapshots.divisibleBy,
        name: productSnapshots.name,
        brandName: productSnapshots.brandName,
        formatLabel: productSnapshots.formatLabel,
        carbsG: productSnapshots.carbsG,
        energyKcal: productSnapshots.energyKcal,
        sodiumMg: productSnapshots.sodiumMg,
        fluidMl: productSnapshots.fluidMl,
        weightG: productSnapshots.weightG,
      })
      .from(servings)
      .innerJoin(
        productSnapshots,
        eq(servings.productSnapshotId, productSnapshots.id),
      )
      .where(eq(servings.planId, accessId))
      .orderBy(asc(servings.legRank), asc(productSnapshots.name)),
    db
      .select({
        legRank: fill.legRank,
        flaskRank: fill.flaskRank,
        volumeMl: fill.volumeMl,
        productSnapshotId: fill.productSnapshotId,
        product: productSnapshots.name,
      })
      .from(fill)
      // `leftJoin` : un remplissage sans produit, c'est de l'eau claire.
      .leftJoin(
        productSnapshots,
        eq(fill.productSnapshotId, productSnapshots.id),
      )
      .where(eq(fill.planId, accessId))
      .orderBy(asc(fill.legRank), asc(fill.flaskRank)),
    db.select().from(warnings).where(eq(warnings.planId, accessId)),
    db.select().from(flasks).where(eq(flasks.planId, accessId)),
    db.select().from(legOverrides).where(eq(legOverrides.planId, accessId)),
    db.select().from(aidStations).where(eq(aidStations.planId, accessId)),
    db
      .select({
        id: productSnapshots.id,
        name: productSnapshots.name,
        brandName: productSnapshots.brandName,
        divisibleBy: productSnapshots.divisibleBy,
        formatLabel: productSnapshots.formatLabel,
        carbsG: productSnapshots.carbsG,
        energyKcal: productSnapshots.energyKcal,
        sodiumMg: productSnapshots.sodiumMg,
        fluidMl: productSnapshots.fluidMl,
        weightG: productSnapshots.weightG,
      })
      .from(productSnapshots)
      .where(eq(productSnapshots.planId, accessId))
      .orderBy(asc(productSnapshots.name)),
  ]);

  const runner = {
    massKg: settings.massKg,
    flasks: flaskRows.map((f) => ({
      volumeMl: f.volumeMl,
      onlyWater: f.onlyWater,
    })),
  };
  const targets = resolveTargets(settings, runner, settings.targetTimeS);
  // Les cibles imposées valent aussi ici : le besoin affiché doit être celui
  // que le calcul a visé, sans quoi l'écart montré serait faux.
  const imposed = new Map(
    overrideRows.map((o) => [
      o.endPositionM,
      {
        carbsGH: o.carbsOverrideG_H ?? targets.carbsGH,
        fluidMlH: o.fluidOverrideMl_L ?? targets.fluidMlH,
        sodiumMgL: o.sodiumOverrideMg_L ?? targets.sodiumMgL,
      },
    ]),
  );
  // Le dernier secteur s'achève à l'arrivée, qu'aucun ravito ne borne.
  const boundOf = (endPositionM: number | null) =>
    endPositionM ?? row.distanceM;

  const byLeg = <T extends { legRank: number }>(rows: T[], rank: number) =>
    rows.filter((r) => r.legRank === rank);

  // Le secteur `i` part de la borne qui clôt le secteur `i - 1`. Une borne
  // inconnue rouvre, comme au noyau.
  const liquidAt = new Map(
    stationRows.map((a) => [a.positionM, a.providesLiquid]),
  );
  const solidAt = new Map(
    stationRows.map((a) => [a.positionM, a.providesSolid]),
  );
  const nomAu = new Map(stationRows.map((a) => [a.positionM, a.name]));
  const arretAu = new Map(
    stationRows.map((a) => [a.positionM, a.stopDurationS]),
  );
  const consigneAu = new Map(overrideRows.map((o) => [o.endPositionM, o]));

  // Le temps de course accumulé au fil des secteurs : le mouvement de chacun,
  // puis l'arrêt de la borne qui le clôt, qui compte pour le suivant.
  let ecoule = 0;

  const legsOut = legRows.map((leg, i) => {
    const rations = byLeg(servingRows, leg.rank);
    const supply = rations.reduce(
      (s, r) => ({
        carbsG: s.carbsG + r.quantity * r.carbsG,
        energyKcal: s.energyKcal + r.quantity * r.energyKcal,
        sodiumMg: s.sodiumMg + r.quantity * r.sodiumMg,
        fluidMl: s.fluidMl + r.quantity * (r.fluidMl ?? 0),
      }),
      EMPTY,
    );
    const depuis = i === 0 ? null : legRows[i - 1].endPositionM;
    const cible = imposed.get(boundOf(leg.endPositionM)) ?? targets;
    const needG = (cible.carbsGH * leg.durationS) / 3600;
    const needFluidMl = (cible.fluidMlH * leg.durationS) / 3600;
    const needSodiumMg = (cible.sodiumMgL * needFluidMl) / 1000;
    const stopS =
      leg.endPositionM === null
        ? null
        : (arretAu.get(leg.endPositionM) ?? null);

    ecoule += leg.durationS;
    const elapsedS = ecoule;
    ecoule += stopS ?? 0;

    return {
      rank: leg.rank,
      endPositionM: leg.endPositionM,
      endName: nomAu.get(boundOf(leg.endPositionM)) ?? null,
      imposedDurationS:
        consigneAu.get(boundOf(leg.endPositionM))?.durationOverrideS ?? null,
      imposedCarbsGH:
        consigneAu.get(boundOf(leg.endPositionM))?.carbsOverrideG_H ?? null,
      ascentM: leg.ascentM,
      descentM: leg.descentM,
      durationS: leg.durationS,
      stopS,
      elapsedS,
      servings: rations.map((s) => ({
        productSnapshotId: s.productSnapshotId,
        name: s.name,
        brandName: s.brandName,
        quantity: s.quantity,
        divisibleBy: s.divisibleBy,
        formatLabel: s.formatLabel,
        carbsG: s.carbsG,
        sodiumMg: s.sodiumMg,
        weightG: s.weightG,
      })),
      opensLiquidSpan: depuis === null || (liquidAt.get(depuis) ?? true),
      opensSolidSpan: depuis === null || (solidAt.get(depuis) ?? true),
      fills: byLeg(fillRows, leg.rank).map((f) => ({
        flaskRank: f.flaskRank,
        product: f.product,
        productSnapshotId: f.productSnapshotId,
        volumeMl: f.volumeMl,
      })),
      supply,
      needG,
      needFluidMl,
      needSodiumMg,
      marginG: supply.carbsG - needG,
      warnings: warningRows
        .filter((w) => w.legRank === leg.rank)
        .map((w) => ({ code: w.code, payload: w.payload })),
    };
  });

  // Le sac : ce qu'on emporte au départ, tous secteurs confondus.
  const sac = new Map<string, { brandName: string | null; quantity: number }>();
  for (const r of servingRows) {
    const vu = sac.get(r.name);
    sac.set(r.name, {
      brandName: r.brandName,
      quantity: (vu?.quantity ?? 0) + r.quantity,
    });
  }

  return {
    legs: legsOut,
    // La colonne `time` de Postgres rend `HH:MM:SS` ; le roadbook n'affiche
    // que les heures et les minutes.
    startTime: settings.startTime?.slice(0, 5) ?? null,
    catalogue: catalogue.map((p) => ({ ...p, fluidMl: p.fluidMl ?? 0 })),
    flasks: flaskRows.map((f) => ({
      rank: f.rank,
      volumeMl: f.volumeMl,
      onlyWater: f.onlyWater,
    })),
    edited: row.editedAt !== null,
    generatedAt: row.generatedAt,
    totalM: row.distanceM,
    total: {
      carbsG: legsOut.reduce((t, l) => t + l.supply.carbsG, 0),
      energyKcal: legsOut.reduce((t, l) => t + l.supply.energyKcal, 0),
      sodiumMg: legsOut.reduce((t, l) => t + l.supply.sodiumMg, 0),
      fluidMl: legsOut.reduce((t, l) => t + l.supply.fluidMl, 0),
      marginG: legsOut.reduce((t, l) => t + l.marginG, 0),
      weightG: servingRows.reduce((t, r) => t + r.quantity * r.weightG, 0),
      units: [...sac].map(([name, v]) => ({ name, ...v })),
    },
    warnings: warningRows
      .filter((w) => w.legRank === null)
      .map((w) => ({ code: w.code, payload: w.payload })),
  };
}
