import { describe, expect, test } from "vitest";
import type { ProfilePoint } from "@/core/type";
import { axe, courbe, echantillonne, figureOf } from "./profile";

const CADRE = { largeur: 1000, hauteur: 300 };

/** Une trace à pas constant, dont on donne les altitudes. */
function trace(eles: number[], pasM = 100): ProfilePoint[] {
  return eles.map((ele, i) => ({ d: i * pasM, ele }));
}

describe("courbe", () => {
  test("part du premier point et finit sur le dernier", () => {
    const d = courbe([
      { x: 0, y: 10 },
      { x: 50, y: 40 },
      { x: 100, y: 20 },
    ]);

    expect(d.startsWith("M 0 10")).toBe(true);
    expect(d.trimEnd().endsWith("100 20")).toBe(true);
  });

  test("lisse par des courbes, pas par des segments droits", () => {
    const d = courbe([
      { x: 0, y: 0 },
      { x: 10, y: 30 },
      { x: 20, y: 0 },
    ]);

    expect(d).toContain("C");
    expect(d).not.toContain("NaN");
  });

  test("ne rend rien sous deux points", () => {
    expect(courbe([])).toBe("");
    expect(courbe([{ x: 0, y: 0 }])).toBe("");
  });
});

describe("axe", () => {
  const textes = (min: number, max: number, cible: number) =>
    axe(min, max, cible).map((g) => g.texte);

  test("écrit assez de décimales pour distinguer deux graduations", () => {
    // Un pas de 2,5 km écrit en entiers donnait « 0 3 5 8 10 13 » : le trait
    // étiqueté 3 tombait à 2,5 km.
    // Uniformément décimées, comme tout axe gradué : « 0 2,5 5 » mélange
    // deux écritures sur la même règle.
    expect(textes(0, 13, 6)).toEqual([
      "0,0",
      "2,5",
      "5,0",
      "7,5",
      "10,0",
      "12,5",
    ]);
  });

  test("n'en écrit aucune quand le pas est entier", () => {
    expect(textes(0, 132.2, 6)).toEqual(["0", "25", "50", "75", "100", "125"]);
    expect(textes(400, 1200, 4)).toEqual(["400", "600", "800", "1000", "1200"]);
  });

  test("ne répète jamais deux fois la même étiquette", () => {
    for (const [min, max, cible] of [
      [0, 5, 6],
      [0, 13, 6],
      [0, 0.8, 6],
      [400, 403, 4],
    ] as const) {
      const vus = textes(min, max, cible);
      expect(new Set(vus).size).toBe(vus.length);
    }
  });

  test("n'écrit pas de séparateur de milliers", () => {
    // Les polices intégrées n'ont pas l'espace fine insécable, et `pdfSafe`
    // ne passe pas sur le profil : voir la section 5.1 du document.
    expect(textes(0, 4000, 4).join("")).not.toMatch(/[\u2009\u202f\u00a0]/);
  });
});

describe("figureOf", () => {
  const POINTS = trace([100, 140, 300, 260, 180, 180, 220, 100]);

  test("couvre le cadre de bout en bout", () => {
    const figure = figureOf({
      points: POINTS,
      band: null,
      bornes: [],
      cadre: CADRE,
    });

    expect(figure.relief.aplat.endsWith("Z")).toBe(true);
    expect(figure.relief.crete.endsWith("Z")).toBe(false);
    expect(figure.graduations.length).toBeGreaterThanOrEqual(2);
    expect(figure.allure).toBeNull();
  });

  test("dessine l'escalier d'allure quand la bande existe", () => {
    const figure = figureOf({
      points: POINTS,
      band: {
        segments: [
          { startM: 0, endM: 350, sPerKm: 400 },
          { startM: 350, endM: 700, sPerKm: 500 },
        ],
        meanSPerKm: 450,
        slowestSPerKm: 500,
        fastestSPerKm: 400,
      },
      bornes: [],
      cadre: CADRE,
    });

    // Deux paliers, et la contremarche qui les relie, en un seul tracé.
    expect(figure.allure?.escalier.match(/Z/g)).toHaveLength(3);
  });

  test("met le rapide en haut du cadre, comme l'écran Course", () => {
    const figure = figureOf({
      points: POINTS,
      band: {
        segments: [
          { startM: 0, endM: 350, sPerKm: 400 },
          { startM: 350, endM: 700, sPerKm: 500 },
        ],
        meanSPerKm: 450,
        slowestSPerKm: 500,
        fastestSPerKm: 400,
      },
      bornes: [],
      cadre: CADRE,
    });

    // Le premier tronçon est le plus rapide : son palier est au-dessus.
    const [rapide, , lent] = (figure.allure?.escalier ?? "").split("Z");
    expect(Math.min(...ordonnees(rapide))).toBeLessThan(
      Math.min(...ordonnees(lent)),
    );
  });

  test("porte l'altitude et l'allure sur la même ligne de repère", () => {
    const figure = figureOf({
      points: POINTS,
      band: {
        segments: [{ startM: 0, endM: 700, sPerKm: 450 }],
        meanSPerKm: 450,
        slowestSPerKm: 500,
        fastestSPerKm: 400,
      },
      bornes: [],
      cadre: CADRE,
    });

    // Une seule suite de lignes : l'altitude se lit à droite, l'allure à
    // gauche, à la même hauteur. C'est ce qui permet de les superposer.
    for (const g of figure.graduations) {
      expect(g.altitude).not.toBe("");
      expect(g.allure).not.toBe("");
      expect(g.y).toBeGreaterThanOrEqual(0);
      expect(g.y).toBeLessThanOrEqual(CADRE.hauteur);
    }
  });

  test("laisse l'allure vide sur les repères quand il n'y a pas de bande", () => {
    const figure = figureOf({
      points: POINTS,
      band: null,
      bornes: [],
      cadre: CADRE,
    });

    expect(figure.graduations.every((g) => g.allure === "")).toBe(true);
  });

  test("gradue les distances en kilomètres, sans doublon", () => {
    // Une trace de 5 km : le pas rond en mètres valait 500, et les étiquettes
    // en kilomètres entiers donnaient « 0 1 1 2 2 3 3 4 4 5 5 ».
    const courte = trace([100, 120, 140, 130, 110, 100], 1000);
    const figure = figureOf({
      points: courte,
      band: null,
      bornes: [],
      cadre: CADRE,
    });
    const vus = figure.distances.map((g) => g.texte);

    expect(new Set(vus).size).toBe(vus.length);
  });

  test("pose les bornes à leur abscisse, dans le cadre", () => {
    const figure = figureOf({
      points: POINTS,
      band: null,
      bornes: [{ positionM: 350, repere: "1" }],
      cadre: CADRE,
    });

    expect(figure.bornes).toHaveLength(1);
    expect(figure.bornes[0].x).toBeGreaterThan(0);
    expect(figure.bornes[0].x).toBeLessThan(CADRE.largeur);
  });
});

describe("echantillonne", () => {
  const LONGUE = trace(
    Array.from({ length: 2000 }, (_, i) => i),
    10,
  );

  test("ramène une longue trace sous le plafond", () => {
    // Sans quoi les aplats de pente se moirent en code-barres : même raison
    // que `POINTS_TRACES` sur l'écran.
    expect(echantillonne(LONGUE, 400).length).toBeLessThanOrEqual(401);
  });

  test("garde le dernier point, qui porte la distance totale", () => {
    expect(echantillonne(LONGUE, 400).at(-1)).toEqual(LONGUE.at(-1));
  });

  test("ne touche pas à une trace déjà courte", () => {
    const courte = trace([100, 200, 300]);

    expect(echantillonne(courte, 400)).toEqual(courte);
  });
});

describe("le dégradé d'allure", () => {
  const POINTS = trace([100, 140, 300, 260, 180, 180, 220, 100]);
  const degradeDe = (meanSPerKm: number) =>
    figureOf({
      points: POINTS,
      band: {
        segments: [{ startM: 0, endM: 700, sPerKm: meanSPerKm }],
        meanSPerKm,
        slowestSPerKm: 600,
        fastestSPerKm: 300,
      },
      bornes: [],
      cadre: CADRE,
    }).allure?.degrade ?? [];
  const vert = (mean: number) =>
    degradeDe(mean).find((arret) => arret.color === "#3f9e4d")?.offset;

  test("va du plus lent en bas du cadre au plus rapide en haut", () => {
    const degrade = degradeDe(450);

    expect(degrade[0]).toEqual({ offset: 0, color: "#2b7bd6" });
    expect(degrade.at(-1)).toEqual({ offset: 1, color: "#cf3b1f" });
  });

  test("pose le vert sur l'allure moyenne, pas à mi-hauteur", () => {
    expect(vert(450)).toBeCloseTo(0.5, 3);
    // Une moyenne penchée du côté lent tire le vert vers le bas du cadre.
    expect(vert(550)).toBeCloseTo(0.2126, 3);
  });
});

/** Les ordonnées d'un sous-tracé, pour lire une hauteur sans la recalculer. */
function ordonnees(trace: string): number[] {
  return [...trace.matchAll(/-?[\d.]+\s+(-?[\d.]+)/g)].map((m) => Number(m[1]));
}
