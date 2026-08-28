import fc from "fast-check";
import { expect, test } from "vitest";
import {
  distributeTime,
  pacingIssue,
  timeAt,
  timeSegments,
} from "./distribute";
import type {
  FixedSpan,
  PacingProfile,
  ResolvedPoint,
  Segment,
  TimedPoint,
} from "./type";

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
    expect(p.d).toBe(points[i].d);
    expect(p.ele).toBe(points[i].ele);
  }
});

/** Une trace plate de `km` kilomètres, parcourue en `heures`. */
function flatTrack(km: number, hours: number): TimedPoint[] {
  const points: TimedPoint[] = [];
  for (let i = 0; i <= km * 100; i++) {
    points.push({
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
  const alone: TimedPoint[] = [{ d: 0, ele: 100, t: 42 }];

  expect(timeAt(alone, 0)).toBe(42);
  expect(timeAt(alone, 5000)).toBe(42);
  expect(timeAt([], 5000)).toBe(0);

  const [s] = timeSegments(alone, [segment(0, 0, 0)]);
  expect(s.durationS).toBe(0);
});

// ───────────────────────────────────────────────── Les durées imposées

/** Une trace plate de `km` kilomètres, au pas de 10 m. */
function flat(km: number): ResolvedPoint[] {
  return trace(new Array(km * 100 + 1).fill(0));
}

test("une durée imposée est servie exactement, le reste s'accélère", () => {
  // 40 km en 4 h, dont 1 h 30 imposée sur les dix premiers : il reste 2 h 30
  // pour trente kilomètres, soit 50 min par tranche de 10 km.
  const points = distributeTime(flat(40), 4 * 3600, EVEN, [
    { startM: 0, endM: 10_000, durationS: 5400 },
  ]);

  expect(points[1000].t).toBeCloseTo(5400, 6);
  expect(points[2000].t).toBeCloseTo(5400 + 3000, 6);
  expect(points[3000].t).toBeCloseTo(5400 + 6000, 6);
  expect(points[4000].t).toBe(4 * 3600);
});

test("deux portions imposées non contiguës cohabitent", () => {
  const points = distributeTime(flat(40), 4 * 3600, EVEN, [
    { startM: 0, endM: 10_000, durationS: 3600 },
    { startM: 20_000, endM: 30_000, durationS: 1800 },
  ]);

  // 20 km libres pour 14 400 − 5 400 = 9 000 s, soit 4 500 s les 10 km.
  expect(points[1000].t).toBeCloseTo(3600, 6);
  expect(points[2000].t).toBeCloseTo(3600 + 4500, 6);
  expect(points[3000].t).toBeCloseTo(3600 + 4500 + 1800, 6);
  expect(points[4000].t).toBe(4 * 3600);
});

test("sans portion imposée, rien ne change", () => {
  const points = trace([0, 40, 30, 90, 10, 10, 60]);
  const profile: PacingProfile = { climbIntensity: 0.3, split: 0.15 };

  expect(distributeTime(points, 3600, profile, [])).toEqual(
    distributeTime(points, 3600, profile),
  );
});

/**
 * Le piège de la fonctionnalité : découper la trace puis répartir chaque
 * portion isolément ferait repartir `paceDrift` de zéro à chaque ravito, et la
 * dérive d'allure disparaîtrait sans le dire. Les poids restent donc calculés
 * sur la trace entière, seule l'allure appliquée change d'une portion à
 * l'autre — la portion libre garde ses proportions internes.
 */
test("une portion imposée ne réinitialise pas la dérive d'allure", () => {
  const points = flat(40);
  const profile: PacingProfile = { climbIntensity: 0, split: 0.4 };
  const share = (timed: TimedPoint[]) =>
    (timed[3000].t - timed[1000].t) / (timed[4000].t - timed[1000].t);

  const free = distributeTime(points, 4 * 3600, profile);
  const fixed = distributeTime(points, 4 * 3600, profile, [
    { startM: 0, endM: 10_000, durationS: 5400 },
  ]);

  expect(share(fixed)).toBeCloseTo(share(free), 9);

  // Et la dérive est bien là : la seconde moitié du libre est plus lente.
  expect(fixed[3000].t - fixed[2000].t).toBeGreaterThan(
    fixed[2000].t - fixed[1000].t,
  );
});

test("des durées imposées au-delà de l'objectif sont refusées", () => {
  const spans: FixedSpan[] = [
    { startM: 0, endM: 10_000, durationS: 5400 },
    { startM: 10_000, endM: 20_000, durationS: 12_600 },
  ];

  expect(() => distributeTime(flat(40), 4 * 3600, EVEN, spans)).toThrow();
});

test("tout imposer sans tomber sur l'objectif est refusé", () => {
  // Aucune portion libre pour rattraper : l'arrivée manquerait l'objectif de
  // 1 h sans que rien ne le signale.
  const spans: FixedSpan[] = [
    { startM: 0, endM: 20_000, durationS: 5400 },
    { startM: 20_000, endM: 40_000, durationS: 5400 },
  ];

  expect(() => distributeTime(flat(40), 4 * 3600, EVEN, spans)).toThrow();

  spans[1].durationS = 9000;
  expect(distributeTime(flat(40), 4 * 3600, EVEN, spans)[2000].t).toBeCloseTo(
    5400,
    6,
  );
});

test("chaque secteur peut être réglé, le dernier compris", () => {
  // Quatre secteurs de 10 km, trois réglés : 1 h, 30 min et 45 min. Le
  // quatrième prend ce qui reste, soit 1 h 45.
  const points = distributeTime(flat(40), 4 * 3600, EVEN, [
    { startM: 0, endM: 10_000, durationS: 3600 },
    { startM: 10_000, endM: 20_000, durationS: 1800 },
    { startM: 30_000, endM: 40_000, durationS: 2700 },
  ]);

  expect(points[1000].t).toBeCloseTo(3600, 6);
  expect(points[2000].t).toBeCloseTo(5400, 6);
  expect(points[3000].t).toBeCloseTo(5400 + 6300, 6);
  expect(points[4000].t).toBe(4 * 3600);
});

test("tout régler est possible, à condition de tomber sur l'objectif", () => {
  const spans: FixedSpan[] = [
    { startM: 0, endM: 10_000, durationS: 3600 },
    { startM: 10_000, endM: 25_000, durationS: 5400 },
    { startM: 25_000, endM: 40_000, durationS: 5400 },
  ];
  const points = distributeTime(flat(40), 4 * 3600, EVEN, spans);

  expect(points[1000].t).toBeCloseTo(3600, 6);
  expect(points[2500].t).toBeCloseTo(9000, 6);
  expect(points[4000].t).toBe(4 * 3600);
});

test("un plan infaisable porte ses chiffres, pas une phrase", () => {
  // C'est ce qui permet à l'appelant de proposer la correction — caler
  // l'objectif sur la somme saisie — au lieu de relayer un message.
  const tooLong = [{ startM: 0, endM: 10_000, durationS: 20_000 }];
  const missed = [
    { startM: 0, endM: 20_000, durationS: 5400 },
    { startM: 20_000, endM: 40_000, durationS: 5400 },
  ];

  expect(
    pacingIssue(catchOf(() => distributeTime(flat(40), 14_400, EVEN, tooLong))),
  ).toEqual({
    code: "fixed-above-target",
    fixedS: 20_000,
    targetTimeS: 14_400,
  });

  expect(
    pacingIssue(catchOf(() => distributeTime(flat(40), 14_400, EVEN, missed))),
  ).toEqual({ code: "fixed-miss-target", fixedS: 10_800, targetTimeS: 14_400 });

  // Une exception ordinaire n'est pas un plan infaisable.
  expect(pacingIssue(new Error("boum"))).toBeNull();
  expect(pacingIssue("boum")).toBeNull();
});

/** Ce que lève `run`, pour l'examiner. */
function catchOf(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }

  throw new Error("Rien n'a été levé");
}
