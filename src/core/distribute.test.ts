import fc from "fast-check";
import { expect, test } from "vitest";
import { distributeTime, timeAt, timeSegments } from "./distribute";
import type { PacingProfile, ResolvedPoint, Segment, TimedPoint } from "./type";

const EVEN: PacingProfile = { climbIntensity: 0, split: 0 };

/** Une trace à pas de 10 m, à partir d'une liste d'altitudes. */
function trace(altitudes: number[]): ResolvedPoint[] {
  return altitudes.map((ele, i) => ({ lat: 0, lon: 0, d: i * 10, ele }));
}

test("une trace vide ou d'un seul point", () => {
  expect(distributeTime([], 3600, EVEN)).toEqual([]);
  expect(distributeTime(trace([100]), 3600, EVEN)).toEqual([
    { lat: 0, lon: 0, d: 0, ele: 100, t: 0 },
  ]);
});

test("le plat se répartit proportionnellement à la distance", () => {
  const points = distributeTime(trace([0, 0, 0, 0, 0]), 400, EVEN);

  expect(points.map((p) => p.t)).toEqual([0, 100, 200, 300, 400]);
});

test("une montée reçoit plus de temps qu'une descente de même longueur", () => {
  // Deux segments de 10 m : +5 m puis −5 m.
  const points = distributeTime(trace([0, 5, 0]), 100, EVEN);
  const climb = points[1].t - points[0].t;
  const descent = points[2].t - points[1].t;

  expect(climb).toBeGreaterThan(descent);
});

test("l'intensité maximale égalise la montée et le plat", () => {
  const points = distributeTime(trace([0, 5, 5]), 100, {
    climbIntensity: 1,
    split: 0,
  });

  expect(points[1].t).toBeCloseTo(50, 9);
});

test("le positive split ralentit la seconde moitié", () => {
  const flatTrack = trace([0, 0, 0, 0, 0]);
  const positive = distributeTime(flatTrack, 400, {
    climbIntensity: 0,
    split: 0.2,
  });
  const negative = distributeTime(flatTrack, 400, {
    climbIntensity: 0,
    split: -0.2,
  });

  // Le point de mi-parcours est atteint plus tôt quand on part vite.
  expect(positive[2].t).toBeLessThan(200);
  expect(negative[2].t).toBeGreaterThan(200);
});

test("l'arrivée vaut exactement le temps visé, au dernier bit", () => {
  const points = distributeTime(trace([0, 12, 7, 40, 3, 3, 91]), 55800, {
    climbIntensity: 0.25,
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
  const result = distributeTime(points, 100, EVEN);

  expect(result[1].t).toBe(0);
  expect(result[2].t).toBe(100);
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
      (altitudes, targetTime, climbIntensity, split) => {
        const points = distributeTime(trace(altitudes), targetTime, {
          climbIntensity,
          split,
        });

        expect(points).toHaveLength(altitudes.length);
        expect(points[0].t).toBe(0);
        expect(points[points.length - 1].t).toBe(targetTime);

        for (let i = 1; i < points.length; i++) {
          expect(points[i].t).toBeGreaterThanOrEqual(points[i - 1].t);
        }
      },
    ),
  );
});

/**
 * La dérive se lit sur la progression dans la trace fournie, pas sur `d` en
 * valeur absolue. Un secteur découpé au ravito commence au km 50 et doit se
 * répartir comme s'il commençait à zéro.
 */
test("une trace qui ne part pas de zéro dérive comme les autres", () => {
  const profile: PacingProfile = { climbIntensity: 0.25, split: 0.3 };
  const base = trace([0, 10, 20, 5, 0, 15, 30]);
  const shifted = base.map((p) => ({ ...p, d: p.d + 50_000 }));

  const fromZero = distributeTime(base, 3600, profile);
  const fromFar = distributeTime(shifted, 3600, profile);

  for (const [i, p] of fromZero.entries()) {
    expect(fromFar[i].t).toBeCloseTo(p.t, 9);
  }
});

test("la géométrie traverse la fonction sans être touchée", () => {
  const points = trace([0, 30, 10]);
  const result = distributeTime(points, 600, EVEN);

  for (const [i, p] of result.entries()) {
    expect(p.lat).toBe(points[i].lat);
    expect(p.lon).toBe(points[i].lon);
    expect(p.d).toBe(points[i].d);
    expect(p.ele).toBe(points[i].ele);
  }
});

/** Une trace plate de `km` kilomètres, parcourue en `heures`. */
function flatTrack(km: number, hours: number): TimedPoint[] {
  const points: TimedPoint[] = [];
  for (let i = 0; i <= km * 100; i++) {
    points.push({
      lat: 0,
      lon: 0,
      d: i * 10,
      ele: 0,
      t: (i / (km * 100)) * hours * 3600,
    });
  }

  return points;
}

test("timeAt interpole entre deux points", () => {
  const points = flatTrack(1, 1);

  expect(timeAt(points, 0)).toBe(0);
  expect(timeAt(points, 1000)).toBeCloseTo(3600, 6);
  expect(timeAt(points, 505)).toBeCloseTo(0.505 * 3600, 3);
});

function segment(startM: number, endM: number, ascentM: number): Segment {
  return {
    startM,
    endM,
    lengthM: endM - startM,
    ascentM,
    descentM: 0,
    meanSlope: ascentM / (endM - startM),
    type: ascentM > 0 ? "climb" : "flat",
  };
}

test("les tronçons se datent par soustraction", () => {
  // 10 km en 2 h, allure constante : 5 km/h, donc 12 min par kilomètre.
  const points = flatTrack(10, 2);
  const [first, second] = timeSegments(points, [
    segment(0, 3000, 300),
    segment(3000, 10_000, 0),
  ]);

  expect(first.startS).toBe(0);
  expect(first.arrivalS).toBeCloseTo(0.3 * 7200, 6);
  expect(first.durationS).toBeCloseTo(2160, 6);
  expect(first.speedKmh).toBeCloseTo(5, 9);
  expect(first.vamMH).toBeCloseTo(500, 6);

  // Les tronçons sont jointifs : l'arrivée de l'un est le départ du suivant.
  expect(second.startS).toBe(first.arrivalS);
  expect(second.vamMH).toBe(0);
});

test("les durées des tronçons se resomment à la durée totale", () => {
  const points = flatTrack(10, 2);
  const segments = [
    segment(0, 2500, 0),
    segment(2500, 6000, 120),
    segment(6000, 10_000, 0),
  ];
  const timedSegments = timeSegments(points, segments);
  const total = timedSegments.reduce((s, x) => s + x.durationS, 0);

  expect(total).toBeCloseTo(7200, 6);
});

test("un tronçon de durée nulle ne divise pas par zéro", () => {
  const points = flatTrack(10, 2);
  const [s] = timeSegments(points, [segment(5000, 5000, 0)]);

  expect(s.durationS).toBe(0);
  expect(s.speedKmh).toBe(0);
  expect(s.vamMH).toBe(0);
});

test("la géométrie du tronçon traverse sans être touchée", () => {
  const points = flatTrack(10, 2);
  const source = segment(1000, 4000, 200);
  const [s] = timeSegments(points, [source]);

  expect(s.startM).toBe(source.startM);
  expect(s.endM).toBe(source.endM);
  expect(s.lengthM).toBe(source.lengthM);
  expect(s.ascentM).toBe(source.ascentM);
  expect(s.meanSlope).toBe(source.meanSlope);
  expect(s.type).toBe(source.type);
});

/**
 * `distributeTime` protège la trace à un point chez elle, mais `timeAt` est
 * exportée et `timeSegments` l'appelle. Il faut deux points pour interpoler ;
 * avec un seul, la lecture de la borne haute levait une exception.
 */
test("timeAt survit à une trace d'un seul point", () => {
  const alone: TimedPoint[] = [{ lat: 0, lon: 0, d: 0, ele: 100, t: 42 }];

  expect(timeAt(alone, 0)).toBe(42);
  expect(timeAt(alone, 5000)).toBe(42);
  expect(timeAt([], 5000)).toBe(0);

  const [s] = timeSegments(alone, [segment(0, 0, 0)]);
  expect(s.durationS).toBe(0);
});
