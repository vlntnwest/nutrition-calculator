import { describe, expect, test } from "vitest";
import type { ProfilePoint } from "@/core/type";
import {
  couleurAllure,
  courbe,
  echantillonne,
  figureOf,
  graduations,
} from "./profile";

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

describe("graduations", () => {
  test("tombe sur des valeurs rondes", () => {
    expect(graduations(0, 1000, 4)).toEqual([0, 250, 500, 750, 1000]);
  });

  test("reste dans l'intervalle demandé", () => {
    for (const valeur of graduations(137, 892, 4)) {
      expect(valeur).toBeGreaterThanOrEqual(137);
      expect(valeur).toBeLessThanOrEqual(892);
    }
  });

  test("en pose au moins deux sur un intervalle étroit", () => {
    expect(graduations(100, 100.5, 4).length).toBeGreaterThanOrEqual(2);
  });

  test("ne diverge pas sur un intervalle nul", () => {
    expect(graduations(200, 200, 4)).toEqual([200]);
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

    // Deux paliers, et la contremarche qui les relie.
    expect(figure.allure?.segments).toHaveLength(3);
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
    const [rapide, , lent] = figure.allure?.segments ?? [];
    expect(rapide.y1).toBeLessThan(lent.y1);
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

describe("couleurAllure", () => {
  const BAND = {
    segments: [],
    meanSPerKm: 450,
    slowestSPerKm: 600,
    fastestSPerKm: 300,
  };

  test("pose le vert sur l'allure moyenne", () => {
    expect(couleurAllure(450, BAND)).toBe("#3f9e4d");
  });

  test("tient les deux bouts de la rampe", () => {
    expect(couleurAllure(600, BAND)).toBe("#2b7bd6");
    expect(couleurAllure(300, BAND)).toBe("#cf3b1f");
  });
});
