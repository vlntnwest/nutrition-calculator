import { expect, test } from "vitest";
import { paceDrift, paceModel } from "./pace";

/** Recopiée de pace.ts : le creux du U, que les tests doivent pouvoir viser. */
const DESCENT_OPTIMUM = 0.072;

test("le plat vaut 1", () => {
  expect(paceModel(0)).toBe(1);
});

test("la descente suit un U", () => {
  const dip = paceModel(-DESCENT_OPTIMUM);

  expect(dip).toBeLessThan(1);
  expect(dip).toBeLessThan(paceModel(-0.03));
  expect(dip).toBeLessThan(paceModel(-0.15));
  expect(paceModel(-0.19)).toBeGreaterThan(1);
});

test("la montée est monotone", () => {
  expect(paceModel(0.05)).toBeGreaterThan(1);
  expect(paceModel(0.15)).toBeGreaterThan(paceModel(0.05));
  expect(paceModel(0.3)).toBeGreaterThan(paceModel(0.15));
});

test("l'effort allège la montée sans jamais l'aplatir", () => {
  expect(paceModel(0.1, 0.4)).toBeLessThan(paceModel(0.1));
  expect(paceModel(0.1, -0.4)).toBeGreaterThan(paceModel(0.1));
  expect(paceModel(-0.1, 0.4)).toBe(paceModel(-0.1, -0.4));
});

test("l'effort est écrêté à ±40 %", () => {
  expect(paceModel(0.3, 5)).toBe(paceModel(0.3, 0.4));
  expect(paceModel(0.3, -5)).toBe(paceModel(0.3, -0.4));
});

// Le tronçon le plus raide doit rester le plus lent où qu'aille le curseur.
// Quand la pente ne coûtait plus rien, les montées tombaient toutes sur la
// même allure et se réordonnaient sur leurs micro-descentes.
test("la montée reste ordonnée par la pente aux deux bouts du curseur", () => {
  for (const effort of [-0.4, 0, 0.4]) {
    expect(paceModel(0.3, effort)).toBeGreaterThan(paceModel(0.15, effort));
    expect(paceModel(0.15, effort)).toBeGreaterThan(paceModel(0.05, effort));
  }
});

test("la pente est écrêtée à ±45 %", () => {
  expect(paceModel(0.9)).toBe(paceModel(0.45));
  expect(paceModel(-0.9)).toBe(paceModel(-0.45));
  expect(paceModel(Number.POSITIVE_INFINITY)).toBe(paceModel(0.45));
});

// Le lien entre les constantes et leur source : le modèle reproduit-il encore
// les mesures sur lesquelles il a été ajusté ? Provenance sur Notion.
test.each([
  [0.21, 1.499],
  [0.165, 1.426],
  [0.104, 1.288],
  [0.048, 1.13],
  [-0.052, 0.919],
  [-0.065, 0.915],
  [-0.105, 0.945],
  [-0.151, 1.034],
  [-0.191, 1.126],
])("reste à moins de 3 %% de PacePro à %f", (slope, mesure) => {
  expect(Math.abs(paceModel(slope) / mesure - 1)).toBeLessThan(0.03);
});

test("la dérive est centrée sur le milieu de course", () => {
  for (const split of [-0.2, -0.05, 0, 0.05, 0.2]) {
    expect(paceDrift(0.5, split)).toBe(1);
  }
});

test("le positive split ralentit, le negative accélère", () => {
  expect(paceDrift(0, 0.1)).toBeLessThan(paceDrift(1, 0.1));
  expect(paceDrift(0, -0.1)).toBeGreaterThan(paceDrift(1, -0.1));
  expect(paceDrift(1, 0.1) - paceDrift(0, 0.1)).toBeCloseTo(0.1, 10);
});

test("un split nul donne une allure régulière", () => {
  for (const x of [0, 0.25, 0.5, 0.75, 1]) {
    expect(paceDrift(x, 0)).toBe(1);
  }
});
