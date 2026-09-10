import { eq } from "drizzle-orm";
import { afterEach, expect, test } from "vitest";
import { db } from "@/db";
import { officialRaces } from "@/db/schema/officialRaces";
import { plans } from "@/db/schema/plans";
import { createPlan } from "./createPlan";
import { newPlan as input } from "./newPlan.fixture";
import { listOfficialRaces, officialRacePlanId } from "./officialRaces";

const written: string[] = [];

afterEach(async () => {
  while (written.length > 0) {
    const accessId = written.pop() as string;
    await db.delete(officialRaces).where(eq(officialRaces.planId, accessId));
    await db.delete(plans).where(eq(plans.accessId, accessId));
  }
});

async function publier(slug: string, rank = 0) {
  const planId = await createPlan(input);
  written.push(planId);

  await db.insert(officialRaces).values({
    slug,
    planId,
    photoPath: "/card-modele.webp",
    profilePath: "M0,150 L400,20",
    rank,
  });

  return planId;
}

test("une course publiée porte le relevé de son modèle", async () => {
  await publier("saverne-trail");

  const race = (await listOfficialRaces()).find(
    (r) => r.slug === "saverne-trail",
  );

  expect(race).toMatchObject({
    name: "Saverne Trail",
    distanceM: 28350,
    ascentM: 1314,
    aidStationCount: 2,
    photoPath: "/card-modele.webp",
    profilePath: "M0,150 L400,20",
  });
});

test("les cartes sortent dans l'ordre du rang", async () => {
  await publier("seconde-course", 2);
  await publier("premiere-course", 1);

  const slugs = (await listOfficialRaces())
    .map((race) => race.slug)
    .filter((slug) => slug.endsWith("-course"));

  expect(slugs).toEqual(["premiere-course", "seconde-course"]);
});

/**
 * L'accueil n'en montre que deux. La borne est dans la requête et non dans
 * un `slice` de l'appelant : sans elle, la page d'entrée lirait tout le
 * catalogue pour en jeter la fin.
 */
test("une borne rend les premières cartes du rang, pas le catalogue", async () => {
  await publier("borne-troisieme", 3);
  await publier("borne-premiere", 1);
  await publier("borne-seconde", 2);

  const deux = await listOfficialRaces(2);

  expect(deux).toHaveLength(2);
  expect(deux.map((race) => race.slug)).toEqual([
    "borne-premiere",
    "borne-seconde",
  ]);

  const toutes = (await listOfficialRaces())
    .map((race) => race.slug)
    .filter((slug) => slug.startsWith("borne-"));

  expect(toutes).toHaveLength(3);
});

test("le lien public rend le plan modèle, et rien pour un lien inconnu", async () => {
  const planId = await publier("cimes-2026");

  expect(await officialRacePlanId("cimes-2026")).toBe(planId);
  expect(await officialRacePlanId("course-fantome")).toBeUndefined();
});
