import { expect, test } from "vitest";
import { storedPlan } from "@/app/plans/newPlan.fixture";
import type { StoredPlan } from "@/app/plans/planInput";
import type { ProfilePoint } from "@/core/type";
import { racePaceBand } from "./racePaceBand";
import { leg, roadbook } from "./roadbook.fixture";

/** Curseurs au neutre : seule la pente parle, et la consigne. */
const PLAN: StoredPlan = {
  ...storedPlan,
  settings: { ...storedPlan.settings, climbEffort: 0, paceSplit: 0 },
};

/** Dix kilomètres plats, puis dix kilomètres à 6 % : deux allures de modèle. */
const PROFIL: ProfilePoint[] = Array.from({ length: 201 }, (_, i) => ({
  d: i * 100,
  ele: i <= 100 ? 100 : 100 + (i - 100) * 6,
}));

/** Deux heures de mouvement sur vingt kilomètres, coupées à mi-parcours. */
function plan2h(imposedDurationS: number | null) {
  return roadbook({
    totalM: 20000,
    legs: [
      leg({ rank: 1, endPositionM: 10000, durationS: 4800, imposedDurationS }),
      leg({ rank: 2, endPositionM: null, durationS: 2400 }),
    ],
  });
}

test("la bande rend la durée imposée au secteur, pas celle du modèle de pente", () => {
  const impose = racePaceBand(PLAN, plan2h(4800), PROFIL);

  // Dix kilomètres plats en 4 800 s : 480 s/km d'un bout à l'autre du secteur.
  expect(impose?.segments[0]).toEqual({ startM: 0, endM: 10000, sPerKm: 480 });
  // Ce qui reste va au secteur libre : 2 400 s sur les dix derniers.
  expect(impose?.segments[1].sPerKm).toBeCloseTo(240, 6);

  // Sans la consigne, le modèle donne au plat une tout autre allure : c'est
  // l'écart que la bande peignait sur le profil.
  const libre = racePaceBand(PLAN, plan2h(null), PROFIL);

  expect(libre?.segments[0].sPerKm).toBeCloseTo(334.884, 2);
});

test("une consigne devenue infaisable retombe sur la bande sans consigne", () => {
  // 9 000 s imposées pour 7 200 s de mouvement : `distributeTime` lève.
  expect(racePaceBand(PLAN, plan2h(9000), PROFIL)).toEqual(
    racePaceBand(PLAN, plan2h(null), PROFIL),
  );
});
