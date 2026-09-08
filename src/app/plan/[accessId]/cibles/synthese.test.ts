import { expect, test } from "vitest";
import { synthetiser } from "./synthese";

const CIBLES = { carbsGH: 60, fluidMlH: 500, sodiumMgL: 700 };

test("multiplie les cibles horaires par la durée visée", () => {
  const s = synthetiser(CIBLES, [], 13500);

  expect(s.carbsG).toBe(225);
  expect(s.fluidMl).toBe(1875);
});

test("sans flasque, la question du remplissage ne se pose pas", () => {
  expect(synthetiser(CIBLES, [], 13500).remplissages).toBeNull();
});

test("compte les remplissages en partant flasques pleines", () => {
  const flasques = [
    { volumeMl: 500, onlyWater: false },
    { volumeMl: 500, onlyWater: true },
  ];
  // 1 875 mL à boire, 1 000 mL portés : le départ en couvre 1 000, un seul
  // remplissage suffit pour les 875 restants.
  expect(synthetiser(CIBLES, flasques, 13500).remplissages).toBe(1);
});

test("un contenant qui couvre toute la course ne demande aucun remplissage", () => {
  const flasques = [{ volumeMl: 2000, onlyWater: false }];

  expect(synthetiser(CIBLES, flasques, 13500).remplissages).toBe(0);
});
