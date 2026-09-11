import { expect, test } from "vitest";
import { storedPlan } from "@/app/plans/newPlan.fixture";
import type { StoredPlan } from "@/app/plans/planInput";
import { calculable, destinations } from "./destinations";

/** Le plan de la fixture, une section remplacée. */
function avec(patch: Partial<StoredPlan>): StoredPlan {
  return { ...storedPlan, ...patch };
}

/** Le même, un réglage changé. */
function reglages(patch: Partial<StoredPlan["settings"]>): StoredPlan {
  return { ...storedPlan, settings: { ...storedPlan.settings, ...patch } };
}

const etat = (plan: StoredPlan, roadbookCalcule = false) =>
  Object.fromEntries(
    destinations(plan, roadbookCalcule).map((d) => [d.segment, d.etat]),
  );

test("un plan complet est calculable", () => {
  expect(calculable(storedPlan)).toBe(true);
});

test.each([
  ["sans chrono", reglages({ targetTimeS: undefined })],
  ["sans poids", reglages({ massKg: undefined })],
  ["le sac vide", avec({ productCodes: [] })],
])("%s, le plan n'est pas calculable", (_, plan) => {
  expect(calculable(plan)).toBe(false);
});

test("les quatre destinations sortent dans l'ordre du rail", () => {
  expect(destinations(storedPlan, false).map((d) => d.segment)).toEqual([
    "",
    "cibles",
    "produits",
    "roadbook",
  ]);
});

test("un plan réduit à sa trace n'a rien de rempli", () => {
  const nu = avec({
    settings: {},
    flasks: [],
    aidStations: [],
    productCodes: [],
  });

  expect(etat(nu)).toEqual({
    "": "vide",
    cibles: "vide",
    produits: "vide",
    roadbook: "vide",
  });
});

test("chaque écran se remplit de ce qui le concerne, et de rien d'autre", () => {
  expect(etat(storedPlan)).toMatchObject({
    "": "rempli",
    cibles: "rempli",
    produits: "rempli",
  });
  expect(etat(reglages({ targets: undefined }))).toMatchObject({
    "": "rempli",
    cibles: "vide",
  });
  expect(etat(avec({ productCodes: [] }))).toMatchObject({
    cibles: "rempli",
    produits: "vide",
  });
});

/**
 * Les trois états du carnet. « À reprendre » n'existe que pour un plan à qui
 * il ne manque plus rien : sinon le rail enverrait sur un calcul impossible.
 */
test("le carnet distingue le calculé, le périmé et l'incomplet", () => {
  expect(etat(storedPlan, true).roadbook).toBe("rempli");
  expect(etat(storedPlan, false).roadbook).toBe("perime");
  expect(etat(avec({ productCodes: [] }), false).roadbook).toBe("vide");
});

test("le carnet dit ce qu'il reste à faire", () => {
  const mention = (plan: StoredPlan, calcule: boolean) =>
    destinations(plan, calcule).find((d) => d.segment === "roadbook")?.mention;

  expect(mention(storedPlan, true)).toBeUndefined();
  expect(mention(storedPlan, false)).toBe("à calculer");
  expect(mention(avec({ productCodes: [] }), false)).toBe("incomplet");
});

test("les comptes s'accordent en nombre", () => {
  const mention = (plan: StoredPlan, segment: string) =>
    destinations(plan, false).find((d) => d.segment === segment)?.mention;

  expect(mention(storedPlan, "")).toBe("2 ravitos");
  expect(mention(avec({ aidStations: [storedPlan.aidStations[0]] }), "")).toBe(
    "1 ravito",
  );
  expect(mention(avec({ aidStations: [] }), "")).toBe("aucun ravito");

  expect(mention(storedPlan, "cibles")).toBe("2 flasques");
  expect(mention(avec({ flasks: [storedPlan.flasks[0]] }), "cibles")).toBe(
    "1 flasque",
  );
  expect(mention(avec({ flasks: [] }), "cibles")).toBe("aucune flasque");

  expect(mention(storedPlan, "produits")).toBe("2 dans le sac");
  expect(mention(avec({ productCodes: [] }), "produits")).toBe("sac vide");
});
