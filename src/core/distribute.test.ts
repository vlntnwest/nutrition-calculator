import fc from "fast-check";
import { expect, test } from "vitest";
import { distributeTime, type ProfilCoureur } from "./distribute";
import type { ResolvedPoint } from "./type";

const REGULIER: ProfilCoureur = { intensiteMontee: 0, split: 0 };

/** Une trace à pas de 10 m, à partir d'une liste d'altitudes. */
function trace(altitudes: number[]): ResolvedPoint[] {
  return altitudes.map((ele, i) => ({ lat: 0, lon: 0, d: i * 10, ele }));
}

test("une trace vide ou d'un seul point", () => {
  expect(distributeTime([], 3600, REGULIER)).toEqual([]);
  expect(distributeTime(trace([100]), 3600, REGULIER)).toEqual([
    { lat: 0, lon: 0, d: 0, ele: 100, t: 0 },
  ]);
});

test("le plat se répartit proportionnellement à la distance", () => {
  const points = distributeTime(trace([0, 0, 0, 0, 0]), 400, REGULIER);

  expect(points.map((p) => p.t)).toEqual([0, 100, 200, 300, 400]);
});

test("une montée reçoit plus de temps qu'une descente de même longueur", () => {
  // Deux segments de 10 m : +5 m puis −5 m.
  const points = distributeTime(trace([0, 5, 0]), 100, REGULIER);
  const montee = points[1].t - points[0].t;
  const descente = points[2].t - points[1].t;

  expect(montee).toBeGreaterThan(descente);
});

test("l'intensité maximale égalise la montée et le plat", () => {
  const points = distributeTime(trace([0, 5, 5]), 100, {
    intensiteMontee: 1,
    split: 0,
  });

  expect(points[1].t).toBeCloseTo(50, 9);
});

test("le positive split ralentit la seconde moitié", () => {
  const plat = trace([0, 0, 0, 0, 0]);
  const positif = distributeTime(plat, 400, { intensiteMontee: 0, split: 0.2 });
  const negatif = distributeTime(plat, 400, {
    intensiteMontee: 0,
    split: -0.2,
  });

  // Le point de mi-parcours est atteint plus tôt quand on part vite.
  expect(positif[2].t).toBeLessThan(200);
  expect(negatif[2].t).toBeGreaterThan(200);
});

test("l'arrivée vaut exactement le temps visé, au dernier bit", () => {
  const points = distributeTime(trace([0, 12, 7, 40, 3, 3, 91]), 55800, {
    intensiteMontee: 0.25,
    split: 0.1,
  });

  expect(points[points.length - 1].t).toBe(55800);
});

test("deux points confondus ne consomment aucun temps", () => {
  const points: ResolvedPoint[] = [
    { lat: 0, lon: 0, d: 0, ele: 0 },
    { lat: 0, lon: 0, d: 0, ele: 12 },
    { lat: 0, lon: 0, d: 10, ele: 12 },
  ];
  const resultat = distributeTime(points, 100, REGULIER);

  expect(resultat[1].t).toBe(0);
  expect(resultat[2].t).toBe(100);
});

/**
 * L'invariant de somme : quel que soit le parcours, le temps visé et les
 * réglages, les durées se resomment au temps visé et `t` ne recule jamais.
 */
test("invariant de somme et monotonie", () => {
  fc.assert(
    fc.property(
      fc.array(fc.double({ min: -200, max: 3000, noNaN: true }), {
        minLength: 2,
        maxLength: 300,
      }),
      fc.double({ min: 1, max: 200_000, noNaN: true }),
      fc.double({ min: 0, max: 1, noNaN: true }),
      fc.double({ min: -0.5, max: 0.5, noNaN: true }),
      (altitudes, tempsVise, intensiteMontee, split) => {
        const points = distributeTime(trace(altitudes), tempsVise, {
          intensiteMontee,
          split,
        });

        expect(points).toHaveLength(altitudes.length);
        expect(points[0].t).toBe(0);
        expect(points[points.length - 1].t).toBe(tempsVise);

        for (let i = 1; i < points.length; i++) {
          expect(points[i].t).toBeGreaterThanOrEqual(points[i - 1].t);
        }
      },
    ),
  );
});

test("la géométrie traverse la fonction sans être touchée", () => {
  const points = trace([0, 30, 10]);
  const resultat = distributeTime(points, 600, REGULIER);

  for (const [i, p] of resultat.entries()) {
    expect(p.lat).toBe(points[i].lat);
    expect(p.lon).toBe(points[i].lon);
    expect(p.d).toBe(points[i].d);
    expect(p.ele).toBe(points[i].ele);
  }
});
