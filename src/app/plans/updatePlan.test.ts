import { eq, sql } from "drizzle-orm";
import { afterEach, expect, test } from "vitest";
import { db } from "@/db";
import { fill } from "@/db/schema/fill";
import { legs } from "@/db/schema/legs";
import { plans } from "@/db/schema/plans";
import { productSnapshots } from "@/db/schema/productSnapshots";
import { servings } from "@/db/schema/servings";
import { createPlan } from "./createPlan";
import { getPlan } from "./getPlan";
import { newPlan as input, storedPlan } from "./newPlan.fixture";
import { regeneratePlan } from "./regeneratePlan";
import { updatePlan } from "./updatePlan";

const written: string[] = [];

afterEach(async () => {
  while (written.length > 0) {
    await db.delete(plans).where(eq(plans.accessId, written.pop() as string));
  }
});

/** Ce que `getPlan` rend d'un plan intact : l'ordre des produits près. */
function asRead(plan = storedPlan) {
  return { ...plan, productCodes: [...plan.productCodes].sort() };
}

test("un réglage modifié laisse tout le reste en place", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);

  await updatePlan(accessId, { settings: { massKg: 62 } });

  expect(await getPlan(accessId)).toEqual({
    ...asRead(),
    settings: { ...input.settings, massKg: 62 },
  });
});

test("corriger un plan modèle ne lui rend pas de péremption", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);
  await db
    .update(plans)
    .set({ expiresAt: sql`null` })
    .where(eq(plans.accessId, accessId));

  await updatePlan(accessId, { settings: { massKg: 62 } });

  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.accessId, accessId));

  expect(plan.expiresAt).toBeNull();
});

/**
 * `legs_end_position_fkey` retient les ravitos et n'a pas de cascade : sans
 * les secteurs supprimés d'abord, Postgres refuse d'en déplacer un.
 */
test("déplacer un ravito sur un plan déjà calculé passe", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);
  await regeneratePlan(accessId);

  await updatePlan(accessId, {
    aidStations: [
      { name: "Ravito Haberacker", distanceM: 9800, stopS: 300 },
      { name: "Ravito déplacé", distanceM: 21500, stopS: 240 },
    ],
  });

  const plan = await getPlan(accessId);
  expect(plan?.aidStations).toEqual([
    { name: "Ravito Haberacker", distanceM: 9800, stopS: 300 },
    {
      name: "Ravito déplacé",
      distanceM: 21500,
      stopS: 240,
      providesLiquid: undefined,
      providesSolid: undefined,
    },
  ]);
});

/**
 * Zéro est une consigne — « je passe sans m'arrêter » — et non une absence de
 * consigne. `aid_stations_stop_duration_positive` l'interdisait, alors que
 * l'écran l'accepte et que `toRow` arrondit à la minute : un arrêt de vingt
 * secondes s'affiche « 0 » et se réenregistre à zéro.
 */
test("un arrêt de zéro minute s'enregistre", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);

  await updatePlan(accessId, {
    aidStations: [
      { name: "Ravito Haberacker", distanceM: 9800, stopS: 0 },
      { name: "Ravito Ochsenstein", distanceM: 20800, stopS: 240 },
    ],
  });

  const plan = await getPlan(accessId);
  expect(plan?.aidStations.map((a) => a.stopS)).toEqual([0, 240]);
});

test("mettre à jour jette le calcul devenu faux", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);
  await regeneratePlan(accessId);

  await updatePlan(accessId, { settings: { targetTimeS: 15000 } });

  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.accessId, accessId));

  expect(plan.generatedAt).toBeNull();
  expect(
    await db.select().from(legs).where(eq(legs.planId, accessId)),
  ).toHaveLength(0);
});

test("une section vide efface", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);

  await updatePlan(accessId, { flasks: [], aidStations: [] });

  const plan = await getPlan(accessId);
  expect(plan?.flasks).toEqual([]);
  expect(plan?.aidStations).toEqual([]);
});

test("une section absente n'est pas touchée", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);

  await updatePlan(accessId, {});

  expect(await getPlan(accessId)).toEqual(asRead());
});

/**
 * On préfère refuser : une consigne saisie par le coureur ne se jette pas
 * sans le dire. À l'écran d'envoyer les deux sections ensemble.
 */
test("déplacer un ravito sans sa consigne est refusé", async () => {
  const accessId = await createPlan({
    ...input,
    legOverrides: [{ endPositionM: 20800, durationS: 4920 }],
  });
  written.push(accessId);

  await expect(
    updatePlan(accessId, {
      aidStations: [{ name: "Ailleurs", distanceM: 21500 }],
    }),
  ).rejects.toThrow("Leg overrides at unknown boundaries: 20800");
});

test("deux ravitos rapprochés par une mise à jour sont refusés", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);

  await expect(
    updatePlan(accessId, {
      aidStations: [
        { name: "A", distanceM: 9800 },
        { name: "B", distanceM: 10000 },
      ],
    }),
  ).rejects.toThrow("Aid stations too close: 9800 m et 10000 m");
});

test("une mise à jour refusée ne laisse rien à moitié écrit", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);
  await regeneratePlan(accessId);

  await expect(
    updatePlan(accessId, {
      flasks: [],
      aidStations: [{ name: "Collé", distanceM: 100 }],
    }),
  ).rejects.toThrow();

  // La validation précède la transaction : ni les flasques ni le calcul
  // n'ont bougé.
  expect(await getPlan(accessId)).toEqual(asRead());
  expect(
    await db.select().from(legs).where(eq(legs.planId, accessId)),
  ).not.toHaveLength(0);
});

/**
 * Le §7 tient : corriger le catalogue ne réécrit pas un plan enregistré. On
 * compare les identifiants, pas les valeurs — un instantané refait porterait
 * les mêmes nombres mais un autre `id`.
 */
test("changer la sélection laisse les instantanés gardés intacts", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);

  const avant = await db
    .select()
    .from(productSnapshots)
    .where(eq(productSnapshots.planId, accessId));
  const garde = avant.find((s) => s.name.includes("ISO+"));

  await updatePlan(accessId, {
    productCodes: ["decathlon-iso-plus", "naak-bar-ultra"],
  });

  const apres = await db
    .select()
    .from(productSnapshots)
    .where(eq(productSnapshots.planId, accessId));

  expect(apres.map((s) => s.id)).toContain(garde?.id);
  expect(apres).toHaveLength(2);
  expect(await getPlan(accessId)).toMatchObject({
    productCodes: ["decathlon-iso-plus", "naak-bar-ultra"],
  });
});

/**
 * Une boisson glucidique n'a nulle part où aller si aucune flasque ne
 * l'accepte : elle sort du sac avec les flasques, dans la même mise à jour.
 */
test("plus aucune flasque acceptant la boisson en retire la boisson glucidique des produits", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);

  await updatePlan(accessId, {
    flasks: [{ volumeMl: 500, onlyWater: true }],
  });

  expect((await getPlan(accessId))?.productCodes.sort()).toEqual([
    "naak-gel-ultra",
  ]);
});

test("retirer toutes les flasques retire pareillement la boisson glucidique", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);

  await updatePlan(accessId, { flasks: [] });

  expect((await getPlan(accessId))?.productCodes.sort()).toEqual([
    "naak-gel-ultra",
  ]);
});

test("un code produit inconnu refuse la mise à jour entière", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);

  await expect(
    updatePlan(accessId, { productCodes: ["gel-imaginaire"] }),
  ).rejects.toThrow("gel-imaginaire");

  expect(await getPlan(accessId)).toEqual(asRead());
});

test("un plan inconnu est refusé", async () => {
  await expect(
    updatePlan("00000000-0000-0000-0000-000000000000", {
      settings: { massKg: 62 },
    }),
  ).rejects.toThrow("Unknown plan");
});

/** Le calcul déjà écrit, en nombre de lignes de chaque côté du modèle. */
async function calcul(accessId: string) {
  const [secteurs, rations, remplissages] = await Promise.all([
    db.select().from(legs).where(eq(legs.planId, accessId)),
    db.select().from(servings).where(eq(servings.planId, accessId)),
    db.select().from(fill).where(eq(fill.planId, accessId)),
  ]);

  return {
    secteurs: secteurs.length,
    rations: rations.length,
    remplissages: remplissages.length,
  };
}

/**
 * Le nom d'un ravito n'entre dans aucun calcul : le jeter obligerait à
 * recalculer pour une faute de frappe. `legs_end_position_fkey` retient la
 * ligne, donc elle se met à jour sur place au lieu d'être refaite.
 */
test("renommer un ravito garde le calcul", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);
  await regeneratePlan(accessId);
  const avant = await calcul(accessId);

  await updatePlan(accessId, {
    aidStations: [
      { name: "Chalet du Haberacker", distanceM: 9800, stopS: 300 },
      { name: "Ravito Ochsenstein", distanceM: 20800, stopS: 240 },
    ],
  });

  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.accessId, accessId));

  expect(plan.generatedAt).not.toBeNull();
  expect(await calcul(accessId)).toEqual(avant);
  expect((await getPlan(accessId))?.aidStations[0].name).toBe(
    "Chalet du Haberacker",
  );
});

test("changer l'heure de départ garde le calcul", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);
  await regeneratePlan(accessId);
  const avant = await calcul(accessId);

  await updatePlan(accessId, { settings: { startTime: "06:30" } });

  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.accessId, accessId));

  expect(plan.generatedAt).not.toBeNull();
  expect(await calcul(accessId)).toEqual(avant);
  expect((await getPlan(accessId))?.settings.startTime).toBe("06:30");
});

/**
 * `fill_flask_fk` cascade : réécrire une fiole à l'identique emporterait les
 * remplissages de secteurs que le calcul, lui, a gardés.
 */
test("réenregistrer une section à l'identique ne touche à rien", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);
  await regeneratePlan(accessId);
  const avant = await calcul(accessId);

  await updatePlan(accessId, {
    flasks: input.flasks,
    aidStations: input.aidStations,
    productCodes: input.productCodes,
  });

  expect(await calcul(accessId)).toEqual(avant);
});

test("le poids seul garde le calcul quand les cibles sont saisies", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);
  await regeneratePlan(accessId);

  await updatePlan(accessId, { settings: { massKg: 90 } });

  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.accessId, accessId));

  expect(plan.generatedAt).not.toBeNull();
});

/** Marque le plan comme retouché, sans passer par l'enregistrement. */
async function retoucher(accessId: string) {
  await db
    .update(plans)
    .set({ editedAt: sql`now()` })
    .where(eq(plans.accessId, accessId));
}

test("un calcul jeté emporte la marque de retouche", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);
  await regeneratePlan(accessId);
  await retoucher(accessId);

  // L'effort en montée entre dans le calcul : il ne survit pas.
  await updatePlan(accessId, { settings: { climbEffort: -0.2 } });

  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.accessId, accessId));

  expect(plan.generatedAt).toBeNull();
  expect(plan.editedAt).toBeNull();
});

test("un calcul qui survit garde la marque de retouche", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);
  await regeneratePlan(accessId);
  await retoucher(accessId);

  // La date de course ne rentre pas dans le calcul : il survit, les
  // retouches avec.
  await updatePlan(accessId, { settings: { raceDate: "2027-06-12" } });

  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.accessId, accessId));

  expect(plan.generatedAt).not.toBeNull();
  expect(plan.editedAt).not.toBeNull();
});
