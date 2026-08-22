import { eq } from "drizzle-orm";
import { afterEach, expect, test } from "vitest";
import { db } from "../../db";
import { aidStations } from "../../db/schema/aidStations";
import { flasks } from "../../db/schema/flasks";
import { planSettings } from "../../db/schema/planSettings";
import { plans } from "../../db/schema/plans";
import { tracks } from "../../db/schema/tracks";
import { createPlan } from "./createPlan";
import { newPlan as input } from "./newPlan.fixture";

const written: string[] = [];

afterEach(async () => {
  while (written.length > 0) {
    await db.delete(plans).where(eq(plans.accessId, written.pop() as string));
  }
});

test("écrire un plan rend son identifiant d'accès", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);

  const rows = await db
    .select()
    .from(plans)
    .where(eq(plans.accessId, accessId));

  expect(rows).toHaveLength(1);
});

test("la trace est écrite avec le plan, points compris", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);

  const [track] = await db
    .select()
    .from(tracks)
    .where(eq(tracks.planId, accessId));

  expect(track).toMatchObject({
    name: "Saverne Trail",
    distanceM: 28350,
    ascentM: 1314,
  });
  expect(track.points).toEqual(input.track.points);
});

test("les réglages sont écrits, les trois cibles à plat", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);

  const [settings] = await db
    .select()
    .from(planSettings)
    .where(eq(planSettings.planId, accessId));

  expect(settings).toMatchObject({
    massKg: 70,
    targetTimeS: 13500,
    climbIntensity: 0.25,
    paceSplit: 0.05,
    raceDate: "2026-10-11",
    startTime: "08:00:00",
    targetCarbsGH: 60,
    targetFluidMlH: 490,
    targetSodiumMgL: 600,
  });
  expect(settings.ascentOverrideM).toBeNull();
});

test("les flasques prennent leur rang dans l'ordre où elles arrivent", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);

  const rows = await db
    .select()
    .from(flasks)
    .where(eq(flasks.planId, accessId))
    .orderBy(flasks.rank);

  expect(rows).toMatchObject([
    { rank: 1, volumeMl: 500, onlyWater: false },
    { rank: 2, volumeMl: 500, onlyWater: true },
  ]);
});

test("les ravitos sont situés en mètres, l'arrêt et la durée imposée séparés", async () => {
  const accessId = await createPlan({
    ...input,
    aidStations: [
      { name: "Ravito Haberacker", distanceM: 9800, stopS: 300 },
      {
        name: "Ravito Ochsenstein",
        distanceM: 20800,
        stopS: 240,
        legDurationS: 4920,
      },
    ],
  });
  written.push(accessId);

  const rows = await db
    .select()
    .from(aidStations)
    .where(eq(aidStations.planId, accessId))
    .orderBy(aidStations.positionM);

  expect(rows).toMatchObject([
    {
      positionM: 9800,
      name: "Ravito Haberacker",
      stopDurationS: 300,
      durationOverrideS: null,
    },
    {
      positionM: 20800,
      name: "Ravito Ochsenstein",
      stopDurationS: 240,
      durationOverrideS: 4920,
    },
  ]);
});

test("un plan sans ravito ni flasque s'écrit quand même", async () => {
  const accessId = await createPlan({ ...input, flasks: [], aidStations: [] });
  written.push(accessId);

  expect(
    await db.select().from(flasks).where(eq(flasks.planId, accessId)),
  ).toHaveLength(0);
  expect(
    await db.select().from(aidStations).where(eq(aidStations.planId, accessId)),
  ).toHaveLength(0);
  expect(
    await db.select().from(tracks).where(eq(tracks.planId, accessId)),
  ).toHaveLength(1);
});

test("un réglage refusé par la base n'écrit aucune ligne", async () => {
  const before = await db.select().from(plans);

  await expect(
    createPlan({ ...input, settings: { ...input.settings, massKg: 0 } }),
  ).rejects.toThrow();

  expect(await db.select().from(plans)).toHaveLength(before.length);
});

test("un plan expire six mois après la course, pas après son enregistrement", async () => {
  const accessId = await createPlan({
    ...input,
    settings: { ...input.settings, raceDate: "2027-04-11" },
  });
  written.push(accessId);

  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.accessId, accessId));

  expect(plan.expiresAt.toISOString().slice(0, 10)).toBe("2027-10-11");
});

test("une course déjà passée garde six mois à compter de l'enregistrement", async () => {
  const accessId = await createPlan({
    ...input,
    settings: { ...input.settings, raceDate: "2020-01-01" },
  });
  written.push(accessId);

  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.accessId, accessId));

  expect(plan.expiresAt.getTime()).toBeGreaterThan(Date.now());
});
