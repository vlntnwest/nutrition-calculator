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

test("le lien public rend le plan modèle, et rien pour un lien inconnu", async () => {
  const planId = await publier("cimes-2026");

  expect(await officialRacePlanId("cimes-2026")).toBe(planId);
  expect(await officialRacePlanId("course-fantome")).toBeUndefined();
});
