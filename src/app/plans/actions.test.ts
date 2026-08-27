import { eq } from "drizzle-orm";
import { afterEach, expect, test, vi } from "vitest";
import { db } from "@/db";
import { plans } from "@/db/schema/plans";
import { computePlan, importTrack, loadPlan, savePlan } from "./actions";
import { newPlan as input } from "./newPlan.fixture";

const written: string[] = [];

afterEach(async () => {
  while (written.length > 0) {
    await db.delete(plans).where(eq(plans.accessId, written.pop() as string));
  }
});

test("importer une trace ouvre un plan et rend son identifiant", async () => {
  const result = await importTrack({ ...input.track, name: "Saverne Trail" });

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  written.push(result.value);

  const relu = await loadPlan(result.value);
  expect(relu).toEqual({
    ok: true,
    value: {
      track: input.track,
      settings: {
        massKg: undefined,
        targetTimeS: undefined,
        climbIntensity: 0.25,
        paceSplit: 0,
        raceDate: undefined,
        startTime: undefined,
        targets: { carbsGH: 30, fluidMlH: 500, sodiumMgL: 500 },
      },
      flasks: [],
      aidStations: [],
      legOverrides: [],
      productCodes: [],
    },
  });
});

test("un identifiant de travers ne descend pas jusqu'à la base", async () => {
  // Sans le garde, Postgres répondrait « invalid input syntax for type uuid ».
  expect(await loadPlan("pas-un-uuid")).toEqual({
    ok: false,
    error: "Unknown plan: pas-un-uuid",
  });
});

test("un plan introuvable est un refus, pas une panne", async () => {
  expect(await savePlan("00000000-0000-0000-0000-000000000000", {})).toEqual({
    ok: false,
    error: "Unknown plan: 00000000-0000-0000-0000-000000000000",
  });
});

test("un refus de validation remonte son message à l'écran", async () => {
  const created = await importTrack({ ...input.track, name: "Saverne" });
  if (!created.ok) throw new Error(created.error);
  written.push(created.value);

  expect(
    await savePlan(created.value, {
      aidStations: [
        { name: "A", distanceM: 9800 },
        { name: "B", distanceM: 10000 },
      ],
    }),
  ).toEqual({
    ok: false,
    error: "Aid stations too close: 9800 m et 10000 m (minimum 1000 m)",
  });
});

test("calculer un plan sans poids ni chrono est refusé, pas planté", async () => {
  const created = await importTrack({ ...input.track, name: "Saverne" });
  if (!created.ok) throw new Error(created.error);
  written.push(created.value);

  expect(await computePlan(created.value)).toEqual({
    ok: false,
    error: "Plan not ready: missing mass or target time",
  });
});

test("un bug ne raconte pas le schéma au client", async () => {
  const bruit = vi.spyOn(console, "error").mockImplementation(() => {});

  // `tracks_ascent_positive_or_zero` : une erreur Postgres, qu'aucune
  // validation ne couvre — donc un bug de notre côté, pas un refus prévu.
  const result = await importTrack({ ...input.track, ascentM: -1 });

  expect(result).toEqual({
    ok: false,
    error: "Une erreur inattendue est survenue.",
  });
  expect(bruit).toHaveBeenCalled();
  bruit.mockRestore();
});

test("parcours complet : import, écrans, calcul", async () => {
  const created = await importTrack({ ...input.track, name: "Saverne Trail" });
  if (!created.ok) throw new Error(created.error);
  const accessId = created.value;
  written.push(accessId);

  await savePlan(accessId, {
    settings: { massKg: 70, targetTimeS: 13500 },
    aidStations: input.aidStations,
  });
  await savePlan(accessId, {
    settings: { targets: input.settings.targets, paceSplit: 0.05 },
    flasks: input.flasks,
  });
  const saved = await savePlan(accessId, {
    productCodes: input.productCodes,
  });

  expect(saved.ok && saved.value.settings.massKg).toBe(70);
  expect(await computePlan(accessId)).toEqual({ ok: true, value: null });

  const [row] = await db
    .select()
    .from(plans)
    .where(eq(plans.accessId, accessId));
  expect(row.generatedAt).not.toBeNull();
});

/**
 * Une trace réelle ne tombe pas sur des mètres ronds : `analyzeTrack` rend
 * 28 350,401 m pour Saverne, et les colonnes sont des entiers.
 */
test("une trace aux mesures fractionnaires s'écrit quand même", async () => {
  const created = await importTrack({
    ...input.track,
    name: "Saverne Trail",
    distanceM: 28350.401004093896,
    ascentM: 1314.4472135955,
  });

  expect(created.ok).toBe(true);
  if (!created.ok) return;
  written.push(created.value);

  const relu = await loadPlan(created.value);
  expect(relu.ok && relu.value.track).toMatchObject({
    distanceM: 28350,
    ascentM: 1314,
  });
});
