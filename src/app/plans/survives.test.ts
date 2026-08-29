import { expect, test } from "vitest";
import { newPlan } from "./newPlan.fixture";
import type { NewPlan } from "./planInput";
import { changed, survives } from "./survives";

/** Le même plan, une section remplacée. */
function avec(patch: Partial<NewPlan>): NewPlan {
  return { ...newPlan, ...patch };
}

/** Le même plan, un réglage changé. */
function reglages(patch: Partial<NewPlan["settings"]>): NewPlan {
  return { ...newPlan, settings: { ...newPlan.settings, ...patch } };
}

const [haberacker, ochsenstein] = newPlan.aidStations;

test("un plan qui n'a pas bougé garde son calcul", () => {
  expect(survives(newPlan, avec({}))).toBe(true);
});

test("renommer un ravito garde le calcul", () => {
  const renomme = avec({
    aidStations: [{ ...haberacker, name: "Chalet du Haberacker" }, ochsenstein],
  });

  expect(survives(newPlan, renomme)).toBe(true);
});

test("la date et l'heure de départ gardent le calcul", () => {
  const decale = reglages({ raceDate: "2027-04-03", startTime: "06:30" });

  expect(survives(newPlan, decale)).toBe(true);
});

test("le poids garde le calcul quand les cibles sont saisies", () => {
  expect(survives(newPlan, reglages({ massKg: 90 }))).toBe(true);
});

test("le poids condamne le calcul quand les cibles sont vides", () => {
  const sansCibles = reglages({ targets: undefined });
  const plusLourd = {
    ...sansCibles,
    settings: { ...sansCibles.settings, massKg: 90 },
  };

  expect(survives(sansCibles, plusLourd)).toBe(false);
});

/**
 * `getPlan` rend `providesSolid: undefined` là où un formulaire omet la clé.
 * Les deux disent la même chose : sans quoi toute relecture condamnerait.
 */
test("une clé absente et la même à `undefined` sont le même ravito", () => {
  const relu = avec({
    aidStations: newPlan.aidStations.map((aid) => ({
      ...aid,
      providesLiquid: undefined,
      providesSolid: undefined,
    })),
  });

  expect(survives(relu, newPlan)).toBe(true);
});

test("les ravitos réordonnés gardent le calcul", () => {
  expect(
    survives(newPlan, avec({ aidStations: [ochsenstein, haberacker] })),
  ).toBe(true);
});

test("les produits réordonnés gardent le calcul", () => {
  const inverse = avec({ productCodes: [...newPlan.productCodes].reverse() });

  expect(survives(newPlan, inverse)).toBe(true);
});

test("déplacer un ravito condamne le calcul", () => {
  const deplace = avec({
    aidStations: [haberacker, { ...ochsenstein, distanceM: 21500 }],
  });

  expect(survives(newPlan, deplace)).toBe(false);
});

test("allonger un arrêt condamne le calcul", () => {
  const arret = avec({
    aidStations: [{ ...haberacker, stopS: 900 }, ochsenstein],
  });

  expect(survives(newPlan, arret)).toBe(false);
});

test("un ravito qui cesse de fournir du solide condamne le calcul", () => {
  const sansSolide = avec({
    aidStations: [{ ...haberacker, providesSolid: false }, ochsenstein],
  });

  expect(survives(newPlan, sansSolide)).toBe(false);
});

test("retirer un ravito condamne le calcul", () => {
  expect(survives(newPlan, avec({ aidStations: [haberacker] }))).toBe(false);
});

test("changer une fiole condamne le calcul", () => {
  const plusGrande = avec({
    flasks: [{ volumeMl: 750, onlyWater: false }, newPlan.flasks[1]],
  });

  expect(survives(newPlan, plusGrande)).toBe(false);
});

test("changer les cibles condamne le calcul", () => {
  const plusHaut = reglages({
    targets: { ...newPlan.settings.targets, carbsGH: 90 },
  });

  expect(survives(newPlan, plusHaut)).toBe(false);
});

test("effacer les cibles condamne le calcul", () => {
  expect(survives(newPlan, reglages({ targets: undefined }))).toBe(false);
});

test("changer le chrono visé condamne le calcul", () => {
  expect(survives(newPlan, reglages({ targetTimeS: 15000 }))).toBe(false);
});

test("changer l'intensité en montée condamne le calcul", () => {
  expect(survives(newPlan, reglages({ climbIntensity: 0.4 }))).toBe(false);
});

test("changer la dérive d'allure condamne le calcul", () => {
  expect(survives(newPlan, reglages({ paceSplit: 0.12 }))).toBe(false);
});

test("ajouter un produit condamne le calcul", () => {
  const enPlus = avec({
    productCodes: [...newPlan.productCodes, "naak-bar-ultra"],
  });

  expect(survives(newPlan, enPlus)).toBe(false);
});

test("imposer une consigne de secteur condamne le calcul", () => {
  const impose = avec({
    legOverrides: [{ endPositionM: 20800, durationS: 4920 }],
  });

  expect(survives(newPlan, impose)).toBe(false);
});

test("un plan qui n'a pas bougé ne réécrit aucune section", () => {
  expect(changed(newPlan, avec({}))).toEqual({
    settings: false,
    flasks: false,
    aidStations: false,
    legOverrides: false,
    products: false,
  });
});

/** Le calcul survit, mais le nom doit bien s'écrire quelque part. */
test("renommer un ravito réécrit les ravitos, et eux seuls", () => {
  const renomme = avec({
    aidStations: [{ ...haberacker, name: "Chalet du Haberacker" }, ochsenstein],
  });

  expect(changed(newPlan, renomme)).toMatchObject({
    aidStations: true,
    settings: false,
    flasks: false,
  });
});

test("l'heure de départ réécrit les réglages, et eux seuls", () => {
  expect(changed(newPlan, reglages({ startTime: "06:30" }))).toMatchObject({
    settings: true,
    aidStations: false,
  });
});

/**
 * Réécrire pour rien coûte plus qu'un `UPDATE` inutile : supprimer une fiole
 * cascade sur `fill`, et laisserait des secteurs sans leur remplissage.
 */
test("des sections réordonnées ne se réécrivent pas", () => {
  const memes = avec({
    aidStations: [ochsenstein, haberacker],
    productCodes: [...newPlan.productCodes].reverse(),
  });

  expect(changed(newPlan, memes)).toMatchObject({
    aidStations: false,
    products: false,
  });
});

test("ajouter un produit réécrit la sélection", () => {
  const enPlus = avec({
    productCodes: [...newPlan.productCodes, "naak-bar-ultra"],
  });

  expect(changed(newPlan, enPlus)).toMatchObject({ products: true });
});
