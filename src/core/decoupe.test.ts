import { expect, test } from "vitest";
import { splitBySlope } from "./decoupe";
import type { ResolvedPoint } from "./type";

/** Une rampe de `nombre` points espacés de 10 m, montant de `penteM` par point. */
function ramp(start: ResolvedPoint, count: number, slopePerPoint: number) {
  const points: ResolvedPoint[] = [];
  for (let i = 1; i <= count; i++) {
    points.push({
      lat: 0,
      lon: 0,
      d: start.d + i * 10,
      ele: start.ele + i * slopePerPoint,
    });
  }

  return points;
}

const start: ResolvedPoint = { lat: 0, lon: 0, d: 0, ele: 100 };

test("une trace vide ou d'un seul point ne donne aucun tronçon", () => {
  expect(splitBySlope([])).toEqual([]);
  expect(splitBySlope([start])).toEqual([]);
});

test("une pente constante donne un seul tronçon", () => {
  const points = [start, ...ramp(start, 100, 0.5)];
  const segments = splitBySlope(points);

  expect(segments).toHaveLength(1);
  expect(segments[0]).toMatchObject({
    startM: 0,
    endM: 1000,
    lengthM: 1000,
    type: "climb",
  });
  expect(segments[0].meanSlope).toBeCloseTo(0.05, 10);
});

test("un sommet sépare la montée de la descente", () => {
  const climb = ramp(start, 100, 0.5);
  const summit = climb[climb.length - 1];
  const points = [start, ...climb, ...ramp(summit, 100, -0.5)];

  const segments = splitBySlope(points);

  expect(segments.map((t) => t.type)).toEqual(["climb", "descent"]);
  expect(segments[0].ascentM).toBeCloseTo(50, 6);
  expect(segments[0].descentM).toBe(0);
  expect(segments[1].descentM).toBeCloseTo(50, 6);
});

test("le plat est classé roulant", () => {
  const points = [start, ...ramp(start, 100, 0.05)]; // 0,5 %
  const segments = splitBySlope(points);

  expect(segments).toHaveLength(1);
  expect(segments[0].type).toBe("flat");
});

// C'est la propriété que Douglas-Peucker seul ne donne pas : il ne voit que
// l'écart à la corde, jamais la longueur.
test("aucun tronçon ne passe sous le plancher", () => {
  const climb = ramp(start, 100, 0.5);
  const bump = climb[climb.length - 1];
  // Une micro-descente de 100 m, franche mais bien trop courte pour compter.
  const dip = ramp(bump, 10, -1);
  const resumed = dip[dip.length - 1];

  const points = [start, ...climb, ...dip, ...ramp(resumed, 100, 0.5)];
  const segments = splitBySlope(points, 30, 300);

  for (const t of segments) expect(t.lengthM).toBeGreaterThanOrEqual(300);
});

test("les tronçons sont jointifs et couvrent toute la trace", () => {
  const climb = ramp(start, 60, 0.8);
  const summit = climb[climb.length - 1];
  const descent = ramp(summit, 80, -0.6);
  const low = descent[descent.length - 1];
  const points = [start, ...climb, ...descent, ...ramp(low, 50, 0.4)];

  const segments = splitBySlope(points);

  expect(segments[0].startM).toBe(0);
  expect(segments[segments.length - 1].endM).toBe(points[points.length - 1].d);

  for (let i = 1; i < segments.length; i++) {
    expect(segments[i].startM).toBe(segments[i - 1].endM);
  }
});

test("une tolérance plus grossière donne moins de tronçons", () => {
  const points: ResolvedPoint[] = [start];
  // Cinq bosses de 40 m d'amplitude sur 4 km.
  for (let i = 0; i < 5; i++) {
    const low = points[points.length - 1];
    const high = ramp(low, 40, 1);
    points.push(...high, ...ramp(high[high.length - 1], 40, -1));
  }

  const fine = splitBySlope(points, 5, 100);
  const coarse = splitBySlope(points, 30, 100);

  expect(coarse.length).toBeLessThan(fine.length);
});
