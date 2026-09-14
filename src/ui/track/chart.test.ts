import { expect, test } from "vitest";
import type { ProfilePoint } from "@/core/type";
import { chartData, paceSeries } from "./chartData";
import { chartOptions } from "./chartOptions";
import { PILE } from "./chartTheme";
import type { PaceBand } from "./chartTypes";

/** Un profil en bosse : 2 km de plat, 2 de montée, 2 de plat. */
const points: ProfilePoint[] = [
  ...Array.from({ length: 20 }, (_, i) => ({ d: i * 100, ele: 0 })),
  ...Array.from({ length: 20 }, (_, i) => ({ d: 2000 + i * 100, ele: i * 15 })),
  ...Array.from({ length: 21 }, (_, i) => ({ d: 4000 + i * 100, ele: 300 })),
];

const BANDE: PaceBand = {
  segments: [
    { startM: 0, endM: 2000, sPerKm: 300 },
    { startM: 2000, endM: 4000, sPerKm: 480 },
    { startM: 4000, endM: 6000, sPerKm: 330 },
  ],
  meanSPerKm: 370,
  slowestSPerKm: 480,
  fastestSPerKm: 300,
};

const relief = points.map((p) => ({ x: p.d / 1000, y: p.ele }));
const origine = points.map((_, i) => i);

function options(patch: Partial<Parameters<typeof chartOptions>[0]> = {}) {
  return chartOptions({
    traces: points,
    origine,
    allures: null,
    etroit: false,
    onResize: () => {},
    ...patch,
  });
}

test("une trace de moins de deux points ne se trace pas", () => {
  expect(options({ traces: points.slice(0, 1) })).toBeNull();
  expect(
    chartData({ traces: points.slice(0, 1), relief: [], allures: null }),
  ).toBeNull();
});

test("sans bande d'allure, l'axe des allures reste éteint", () => {
  const o = options();

  expect(o?.scales?.yPace?.display).toBe(false);
  expect(o?.scales?.y?.position).toBe("left");
});

/**
 * L'allure prend l'axe de gauche et renvoie l'altitude à droite : le relief
 * est ce que la course impose, l'allure ce que le coureur y répond.
 */
test("une bande d'allure allume son axe et renvoie l'altitude à droite", () => {
  const o = options({ paceBand: BANDE, allures: paceSeries(points, BANDE) });

  expect(o?.scales?.yPace?.display).toBe(true);
  expect(o?.scales?.y?.position).toBe("right");
  // Le rapide en haut du cadre, comme un sommet est un maximum.
  expect(o?.scales?.yPace?.reverse).toBe(true);
});

/**
 * Sous `LARGEUR_SUPERPOSITION`, les deux cessent de se superposer : l'allure
 * prend le tiers haut du cadre, le relief les deux tiers du bas, et les axes
 * se partagent le bord gauche.
 */
test("un cadre étroit empile l'allure au-dessus du relief", () => {
  const empile = options({
    paceBand: BANDE,
    allures: paceSeries(points, BANDE),
    etroit: true,
  });

  expect(empile?.scales?.y?.stack).toBe(PILE);
  expect(empile?.scales?.yPace?.stack).toBe(PILE);
  // Les deux échelles reviennent à gauche : c'est la condition de l'empilement.
  expect(empile?.scales?.y?.position).toBe("left");

  const superpose = options({
    paceBand: BANDE,
    allures: paceSeries(points, BANDE),
    etroit: false,
  });

  expect(superpose?.scales?.y?.stack).toBeUndefined();
});

test("une largeur encore inconnue ne décide pas d'empiler", () => {
  const o = options({
    paceBand: BANDE,
    allures: paceSeries(points, BANDE),
    etroit: null,
  });

  expect(o?.scales?.y?.stack).toBeUndefined();
});

test("sans bande, le relief porte sa pente ; avec, il redevient silhouette", () => {
  const nu = chartData({ traces: points, relief, allures: null });
  const sous = chartData({
    traces: points,
    relief,
    allures: paceSeries(points, BANDE),
    paceBand: BANDE,
  });

  // Deux jeux pour le relief seul, quatre avec la moyenne et les marches.
  expect(nu?.datasets).toHaveLength(2);
  expect(sous?.datasets).toHaveLength(4);
  // La couleur par segment ne sert que là où l'allure ne prend pas le cadre.
  expect(nu?.datasets[1]).toHaveProperty("segment");
  expect(sous?.datasets[1]).not.toHaveProperty("segment");
});

/**
 * Tous les jeux partagent la grille du relief : le mode `index` de Chart.js
 * lit l'indice du jeu le plus proche du curseur puis va chercher cet
 * indice-là dans tous les autres.
 */
test("les marches d'allure suivent point par point la grille du relief", () => {
  const allures = paceSeries(points, BANDE);

  expect(allures).toHaveLength(points.length);
  expect(allures[0]).toBe(300);
  expect(allures.at(-1)).toBe(330);

  const jeux = chartData({ traces: points, relief, allures, paceBand: BANDE });

  for (const jeu of jeux?.datasets ?? []) {
    expect(jeu.data).toHaveLength(relief.length);
  }
});

test("l'axe d'allure imposé l'emporte sur celui de la bande du moment", () => {
  const libre = options({
    paceBand: BANDE,
    allures: paceSeries(points, BANDE),
  });
  const borne = options({
    paceBand: BANDE,
    allures: paceSeries(points, BANDE),
    paceAxisRange: { slowestSPerKm: 520, fastestSPerKm: 280 },
  });

  expect(borne?.scales?.yPace?.min).not.toBe(libre?.scales?.yPace?.min);
  expect(borne?.scales?.yPace?.max).not.toBe(libre?.scales?.yPace?.max);
});
