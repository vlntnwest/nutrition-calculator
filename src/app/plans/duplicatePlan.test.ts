import { eq, sql } from "drizzle-orm";
import { afterEach, expect, test } from "vitest";
import { db } from "@/db";
import { flasks } from "@/db/schema/flasks";
import { plans } from "@/db/schema/plans";
import { productSnapshots } from "@/db/schema/productSnapshots";
import { tracks } from "@/db/schema/tracks";
import { createPlan } from "./createPlan";
import { duplicatePlan } from "./duplicatePlan";
import { getPlan } from "./getPlan";
import { newPlan as input } from "./newPlan.fixture";
import { PlanError } from "./planError";

const written: string[] = [];

afterEach(async () => {
  while (written.length > 0) {
    await db.delete(plans).where(eq(plans.accessId, written.pop() as string));
  }
});

async function modele() {
  const accessId = await createPlan(input);
  written.push(accessId);

  return accessId;
}

async function copie(sourceId: string) {
  const accessId = await duplicatePlan(sourceId);
  written.push(accessId);

  return accessId;
}

test("la copie est un plan neuf, pas le modèle", async () => {
  const source = await modele();
  const accessId = await copie(source);

  expect(accessId).not.toBe(source);
});

test("la copie porte la trace du modèle, points compris", async () => {
  const accessId = await copie(await modele());

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
  expect(track.profile).toEqual(input.track.profile);
});

test("la copie porte les ravitos du modèle", async () => {
  const plan = await getPlan(await copie(await modele()));

  expect(plan?.aidStations).toEqual(input.aidStations);
});

test("la copie ne prend ni les réglages, ni les flasques, ni les produits", async () => {
  const accessId = await copie(await modele());
  const plan = await getPlan(accessId);

  expect(plan?.settings).toEqual({ climbEffort: 0, paceSplit: 0 });
  expect(plan?.flasks).toEqual([]);
  expect(plan?.productCodes).toEqual([]);
  expect(plan?.legOverrides).toEqual([]);

  // Les tables elles-mêmes, et pas seulement ce que `getPlan` en rend.
  expect(
    await db.select().from(flasks).where(eq(flasks.planId, accessId)),
  ).toEqual([]);
  expect(
    await db
      .select()
      .from(productSnapshots)
      .where(eq(productSnapshots.planId, accessId)),
  ).toEqual([]);
});

/**
 * La fiche d'ouverture demande le chrono avant que la copie n'existe : il
 * s'écrit donc avec elle, et non en mise à jour derrière.
 */
test("le chrono demandé avant la copie part avec elle", async () => {
  const accessId = await duplicatePlan(await modele(), {
    settings: { targetTimeS: 13500 },
  });
  written.push(accessId);

  expect((await getPlan(accessId))?.settings).toEqual({
    climbEffort: 0,
    paceSplit: 0,
    targetTimeS: 13500,
  });
});

/**
 * La fiche d'ouverture laisse corriger le nom. Sans correction, la copie
 * garde celui du modèle : c'est le `coalesce` de `copyTrack`.
 */
test("le nom corrigé sur la fiche remplace celui du modèle", async () => {
  const source = await modele();

  const renomme = await duplicatePlan(source, { name: "Saverne, plan A" });
  written.push(renomme);
  const telQuel = await copie(source);

  expect((await getPlan(renomme))?.track.name).toBe("Saverne, plan A");
  expect((await getPlan(telQuel))?.track.name).toBe("Saverne Trail");
});

test("la copie périme dans six mois, même tirée d'un modèle qui ne périme pas", async () => {
  const source = await modele();
  await db
    .update(plans)
    .set({ expiresAt: sql`null` })
    .where(eq(plans.accessId, source));

  const accessId = await copie(source);
  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.accessId, accessId));

  expect(plan.expiresAt).not.toBeNull();
  // En jours : six mois valent de 181 à 184 selon la date de la copie.
  const jours = ((plan.expiresAt as Date).getTime() - Date.now()) / 86_400_000;
  expect(jours).toBeGreaterThan(179);
  expect(jours).toBeLessThan(186);
});

test("copier un plan inconnu est refusé", async () => {
  await expect(
    duplicatePlan("00000000-0000-0000-0000-000000000000"),
  ).rejects.toThrow(PlanError);
});
