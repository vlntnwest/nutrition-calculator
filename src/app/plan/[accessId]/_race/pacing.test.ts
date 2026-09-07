import { expect, test } from "vitest";
import type { PacingProfile, ProfilePoint, Segment } from "@/core/type";
import { paceBand, paceSegments } from "./pacing";

const EVEN: PacingProfile = { climbIntensity: 0, split: 0 };

/** Un profil au pas de 10 m, à partir d'une liste d'altitudes. */
function profile(altitudes: number[]): ProfilePoint[] {
  return altitudes.map((ele, i) => ({ d: i * 10, ele }));
}

/** Une bosse : 2 km de plat, 2 km de montée, 2 km de plat. */
function bump(): ProfilePoint[] {
  const altitudes = [
    ...new Array(200).fill(0),
    ...Array.from({ length: 200 }, (_, i) => i * 1.5),
    ...new Array(201).fill(300),
  ];

  return profile(altitudes);
}

function segment(startM: number, endM: number): Segment {
  return {
    startM,
    endM,
    lengthM: endM - startM,
    ascentM: 0,
    descentM: 0,
    meanSlope: 0,
    type: "flat",
  };
}

test("un chrono absent ou nul ne trace rien", () => {
  const points = bump();
  const segments = paceSegments(points);

  expect(paceBand(points, segments, undefined, EVEN)).toBeNull();
  expect(paceBand(points, segments, 0, EVEN)).toBeNull();
  expect(paceBand(points, [], 3600, EVEN)).toBeNull();
  expect(paceBand([], [], 3600, EVEN)).toBeNull();
});

test("la moyenne est le chrono de mouvement sur la distance", () => {
  const points = bump();
  // 6 km en 45 min : 7:30 au kilomètre.
  const bande = paceBand(points, paceSegments(points), 2700, EVEN);

  expect(bande?.meanSPerKm).toBeCloseTo(450, 6);
});

/**
 * Le point du graphique : la montée doit sortir plus lente que le plat, et
 * l'écart doit se resserrer quand on monte l'effort en côte.
 */
test("la montée est plus lente que le plat, et le curseur la rapproche", () => {
  const points = bump();
  const segments = paceSegments(points);
  const paceOf = (climbIntensity: number) => {
    const bande = paceBand(points, segments, 2700, {
      climbIntensity,
      split: 0,
    });
    const montee = bande?.segments.find(
      (s) => s.startM >= 2000 && s.endM <= 4000,
    );

    return {
      plat: bande?.segments[0].sPerKm ?? 0,
      montee: montee?.sPerKm ?? 0,
    };
  };

  const cher = paceOf(0);
  const facile = paceOf(1);

  expect(cher.montee).toBeGreaterThan(cher.plat);
  // À `climbIntensity` de 1, la pente ne coûte plus rien : tout est à la même
  // allure, et le plat n'a plus à compenser la montée.
  expect(facile.montee).toBeCloseTo(facile.plat, 6);
  expect(facile.montee / facile.plat).toBeLessThan(cher.montee / cher.plat);
});

test("une dérive positive finit plus lentement qu'elle ne commence", () => {
  const plat = profile(new Array(1001).fill(0));
  const segments = [segment(0, 5000), segment(5000, 10_000)];
  const bande = paceBand(plat, segments, 3600, {
    climbIntensity: 0,
    split: 0.2,
  });
  const [debut, fin] = bande?.segments ?? [];

  expect(fin.sPerKm).toBeGreaterThan(debut.sPerKm);
  // La dérive ne change pas le total : la moyenne reste entre les deux.
  expect(bande?.meanSPerKm).toBeGreaterThan(debut.sPerKm);
  expect(bande?.meanSPerKm).toBeLessThan(fin.sPerKm);
});

test("les tronçons couvrent la trace sans trou", () => {
  const points = bump();
  const bande = paceBand(points, paceSegments(points), 2700, EVEN);
  const troncons = bande?.segments ?? [];

  expect(troncons[0].startM).toBe(0);
  expect(troncons[troncons.length - 1].endM).toBe(6000);
  for (let i = 1; i < troncons.length; i++) {
    expect(troncons[i].startM).toBe(troncons[i - 1].endM);
  }
});

test("la bande porte les deux allures extrêmes, la moyenne entre les deux", () => {
  const points = bump();
  const bande = paceBand(points, paceSegments(points), 2700, EVEN);
  const allures = bande?.segments.map((s) => s.sPerKm) ?? [];

  expect(bande?.fastestSPerKm).toBe(Math.min(...allures));
  expect(bande?.slowestSPerKm).toBe(Math.max(...allures));
  // La moyenne est une moyenne pondérée par la distance : elle tombe donc
  // toujours entre les deux, et le vert de la rampe ne sort jamais du cadre.
  expect(bande?.meanSPerKm).toBeGreaterThanOrEqual(bande?.fastestSPerKm ?? 0);
  expect(bande?.meanSPerKm).toBeLessThanOrEqual(bande?.slowestSPerKm ?? 0);
});
