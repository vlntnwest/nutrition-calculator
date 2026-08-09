import { expect, test } from "vitest";
import { decoupeParPente } from "./decoupe";
import type { ResolvedPoint } from "./type";

/** Une rampe de `nombre` points espacés de 10 m, montant de `penteM` par point. */
function rampe(depart: ResolvedPoint, nombre: number, penteM: number) {
  const points: ResolvedPoint[] = [];
  for (let i = 1; i <= nombre; i++) {
    points.push({
      lat: 0,
      lon: 0,
      d: depart.d + i * 10,
      ele: depart.ele + i * penteM,
    });
  }

  return points;
}

const depart: ResolvedPoint = { lat: 0, lon: 0, d: 0, ele: 100 };

test("une trace vide ou d'un seul point ne donne aucun tronçon", () => {
  expect(decoupeParPente([])).toEqual([]);
  expect(decoupeParPente([depart])).toEqual([]);
});

test("une pente constante donne un seul tronçon", () => {
  const points = [depart, ...rampe(depart, 100, 0.5)];
  const troncons = decoupeParPente(points);

  expect(troncons).toHaveLength(1);
  expect(troncons[0]).toMatchObject({
    debutM: 0,
    finM: 1000,
    longueurM: 1000,
    type: "montee",
  });
  expect(troncons[0].penteMoyenne).toBeCloseTo(0.05, 10);
});

test("un sommet sépare la montée de la descente", () => {
  const montee = rampe(depart, 100, 0.5);
  const sommet = montee[montee.length - 1];
  const points = [depart, ...montee, ...rampe(sommet, 100, -0.5)];

  const troncons = decoupeParPente(points);

  expect(troncons.map((t) => t.type)).toEqual(["montee", "descente"]);
  expect(troncons[0].denivelePositifM).toBeCloseTo(50, 6);
  expect(troncons[0].deniveleNegatifM).toBe(0);
  expect(troncons[1].deniveleNegatifM).toBeCloseTo(50, 6);
});

test("le plat est classé roulant", () => {
  const points = [depart, ...rampe(depart, 100, 0.05)]; // 0,5 %
  const troncons = decoupeParPente(points);

  expect(troncons).toHaveLength(1);
  expect(troncons[0].type).toBe("roulant");
});

// C'est la propriété que Douglas-Peucker seul ne donne pas : il ne voit que
// l'écart à la corde, jamais la longueur.
test("aucun tronçon ne passe sous le plancher", () => {
  const montee = rampe(depart, 100, 0.5);
  const bosse = montee[montee.length - 1];
  // Une micro-descente de 100 m, franche mais bien trop courte pour compter.
  const creux = rampe(bosse, 10, -1);
  const reprise = creux[creux.length - 1];

  const points = [depart, ...montee, ...creux, ...rampe(reprise, 100, 0.5)];
  const troncons = decoupeParPente(points, 30, 300);

  for (const t of troncons) expect(t.longueurM).toBeGreaterThanOrEqual(300);
});

test("les tronçons sont jointifs et couvrent toute la trace", () => {
  const montee = rampe(depart, 60, 0.8);
  const sommet = montee[montee.length - 1];
  const descente = rampe(sommet, 80, -0.6);
  const bas = descente[descente.length - 1];
  const points = [depart, ...montee, ...descente, ...rampe(bas, 50, 0.4)];

  const troncons = decoupeParPente(points);

  expect(troncons[0].debutM).toBe(0);
  expect(troncons[troncons.length - 1].finM).toBe(points[points.length - 1].d);

  for (let i = 1; i < troncons.length; i++) {
    expect(troncons[i].debutM).toBe(troncons[i - 1].finM);
  }
});

test("une tolérance plus grossière donne moins de tronçons", () => {
  const points: ResolvedPoint[] = [depart];
  // Cinq bosses de 40 m d'amplitude sur 4 km.
  for (let i = 0; i < 5; i++) {
    const bas = points[points.length - 1];
    const haut = rampe(bas, 40, 1);
    points.push(...haut, ...rampe(haut[haut.length - 1], 40, -1));
  }

  const fin = decoupeParPente(points, 5, 100);
  const grossier = decoupeParPente(points, 30, 100);

  expect(grossier.length).toBeLessThan(fin.length);
});
