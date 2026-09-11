import type { Roadbook, Supply } from "./roadbook";
import { getRoadbookHead, getRoadbookRows } from "./roadbookRows";
import { resolveTargets } from "./targets";

export type {
  Roadbook,
  RoadbookFill,
  RoadbookLeg,
  RoadbookServing,
  Supply,
} from "./roadbook";

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
  const row = await getRoadbookHead(accessId);

  const settings = row?.settings;
  if (!row?.generatedAt || !settings?.targetTimeS || settings.massKg === null) {
    return null;
  }

  const {
    legRows,
    servingRows,
    fillRows,
    warningRows,
    flaskRows,
    overrideRows,
    stationRows,
    catalogue,
  } = await getRoadbookRows(accessId);

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
