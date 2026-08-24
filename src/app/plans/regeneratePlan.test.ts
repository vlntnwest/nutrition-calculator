import { eq } from "drizzle-orm";
import { afterEach, expect, test } from "vitest";
import { db } from "@/db";
import { fill } from "@/db/schema/fill";
import { legs } from "@/db/schema/legs";
import { plans } from "@/db/schema/plans";
import { servings } from "@/db/schema/servings";
import { warnings } from "@/db/schema/warnings";
import { createPlan } from "./createPlan";
import { newPlan as input } from "./newPlan.fixture";
import { regeneratePlan } from "./regeneratePlan";

const written: string[] = [];

afterEach(async () => {
  while (written.length > 0) {
    const id = written.pop() as string;
    await db.delete(legs).where(eq(legs.planId, id));
    await db.delete(plans).where(eq(plans.accessId, id));
  }
});

async function planRegenere() {
  const accessId = await createPlan(input);
  written.push(accessId);
  await regeneratePlan(accessId);

  return accessId;
}

test("un tronçon par secteur, le dernier ouvert sur l'arrivée", async () => {
  const accessId = await planRegenere();

  const rows = await db
    .select()
    .from(legs)
    .where(eq(legs.planId, accessId))
    .orderBy(legs.rank);

  // Deux ravitos découpent la course en trois secteurs.
  expect(rows).toHaveLength(3);
  expect(rows.map((l) => l.endAidStationM)).toEqual([9800, 20800, null]);
  expect(rows.every((l) => l.durationS > 0)).toBe(true);
});

test("la somme des durées vaut le temps de mouvement visé", async () => {
  const accessId = await planRegenere();

  const rows = await db.select().from(legs).where(eq(legs.planId, accessId));
  const stops = input.aidStations.reduce((s, a) => s + (a.stopS ?? 0), 0);

  expect(rows.reduce((s, l) => s + l.durationS, 0)).toBe(
    input.settings.targetTimeS - stops,
  );
});

test("chaque tronçon reçoit ses rations et ses remplissages", async () => {
  const accessId = await planRegenere();

  const rations = await db
    .select()
    .from(servings)
    .where(eq(servings.planId, accessId));
  const remplissages = await db
    .select()
    .from(fill)
    .where(eq(fill.planId, accessId));

  expect(rations.length).toBeGreaterThan(0);
  expect(rations.every((r) => Number(r.quantity) > 0)).toBe(true);

  // Deux flasques déclarées, dont une réservée à l'eau claire : le
  // remplissage sans produit doit être représentable.
  expect(remplissages.length).toBeGreaterThan(0);
  expect(remplissages.some((f) => f.productSnapshotId === null)).toBe(true);
});

test("régénérer deux fois ne double rien", async () => {
  const accessId = await planRegenere();
  await regeneratePlan(accessId);

  expect(
    await db.select().from(legs).where(eq(legs.planId, accessId)),
  ).toHaveLength(3);
});

test("la date de génération est posée", async () => {
  const accessId = await planRegenere();

  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.accessId, accessId));

  expect(plan.generatedAt).not.toBeNull();
});

test("les avertissements sont écrits, globaux comme par secteur", async () => {
  // 120 g/h dépasse le repère de 90 et 1200 mL/h celui de 800 ; le liquide
  // dépasse en plus le litre déclaré aux flasques.
  const accessId = await createPlan({
    ...input,
    settings: {
      ...input.settings,
      targets: { carbsGH: 120, fluidMlH: 1200, sodiumMgL: 600 },
    },
  });
  written.push(accessId);
  await regeneratePlan(accessId);

  const rows = await db
    .select()
    .from(warnings)
    .where(eq(warnings.planId, accessId));

  const codes = rows.map((w) => w.code);
  expect(codes).toContain("carbs-above-guide");
  expect(codes).toContain("fluid-above-guide");

  const global = rows.find((w) => w.code === "carbs-above-guide");
  expect(global?.legRank).toBeNull();
  expect(global?.payload).toMatchObject({ carbsGH: 120, guideGH: 90 });

  const parSecteur = rows.filter((w) => w.legRank !== null);
  expect(parSecteur.length).toBeGreaterThan(0);
  expect(parSecteur.every((w) => w.legRank !== null && w.legRank >= 1)).toBe(
    true,
  );
});

test("le dernier secteur accepte une durée imposée", async () => {
  const accessId = await createPlan({
    ...input,
    settings: { ...input.settings, finishDurationOverrideS: 3600 },
  });
  written.push(accessId);
  await regeneratePlan(accessId);

  const rows = await db
    .select()
    .from(legs)
    .where(eq(legs.planId, accessId))
    .orderBy(legs.rank);
  const stops = input.aidStations.reduce((s, a) => s + (a.stopS ?? 0), 0);

  // La consigne est tenue, et le reste de la course s'ajuste autour : la
  // somme vaut toujours le temps de mouvement.
  expect(rows.at(-1)?.durationS).toBe(3600);
  expect(rows.reduce((s, l) => s + l.durationS, 0)).toBe(
    input.settings.targetTimeS - stops,
  );
});
