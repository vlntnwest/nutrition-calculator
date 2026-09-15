import { describe, expect, test } from "vitest";
import { newPlan } from "@/app/plans/newPlan.fixture";
import { bornesOf } from "./sheetMapData";
import {
  cadrageOf,
  pointADistance,
  projeter,
  TAILLE_TUILE,
  tuilesOf,
  tuileUrl,
  worldPx,
} from "./staticMap";

const TRACE = newPlan.track.points.map((p) => ({ lat: p.lat, lon: p.lon }));
const CADRE = { largeurPx: 1020, hauteurPx: 400 };

describe("worldPx", () => {
  test("place le point zéro au centre du monde", () => {
    expect(worldPx({ lat: 0, lon: 0 }, 0)).toEqual({ x: 128, y: 128 });
  });

  test("double les coordonnées à chaque zoom", () => {
    const z3 = worldPx({ lat: 48.74, lon: 7.36 }, 3);
    const z4 = worldPx({ lat: 48.74, lon: 7.36 }, 4);

    expect(z4.x).toBeCloseTo(z3.x * 2, 6);
    expect(z4.y).toBeCloseTo(z3.y * 2, 6);
  });

  test("met le nord en haut", () => {
    const nord = worldPx({ lat: 60, lon: 0 }, 5);
    const sud = worldPx({ lat: 40, lon: 0 }, 5);

    expect(nord.y).toBeLessThan(sud.y);
  });
});

describe("cadrageOf", () => {
  test("fait tenir toute la trace dans le cadre", () => {
    const cadrage = cadrageOf(TRACE, CADRE);

    for (const point of TRACE) {
      const { x, y } = projeter(cadrage, point);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(CADRE.largeurPx);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(CADRE.hauteurPx);
    }
  });

  test("retient le plus grand zoom qui tienne, pas un de moins", () => {
    const cadrage = cadrageOf(TRACE, CADRE);
    const serre = { ...cadrage, zoom: cadrage.zoom + 1 };
    const deborde = TRACE.some((point) => {
      const { x, y } = projeter(
        {
          ...serre,
          origine: origineAu(serre.zoom),
        },
        point,
      );

      return x < 0 || x > CADRE.largeurPx || y < 0 || y > CADRE.hauteurPx;
    });

    expect(deborde).toBe(true);
  });

  test("agrandit le zoom quand le cadre grandit", () => {
    const petit = cadrageOf(TRACE, { largeurPx: 256, hauteurPx: 256 });
    const grand = cadrageOf(TRACE, { largeurPx: 2048, hauteurPx: 2048 });

    expect(grand.zoom).toBeGreaterThan(petit.zoom);
  });

  test("ne diverge pas sur une trace réduite à un point", () => {
    const cadrage = cadrageOf([{ lat: 48.74, lon: 7.36 }], CADRE);
    const { x, y } = projeter(cadrage, { lat: 48.74, lon: 7.36 });

    expect(cadrage.zoom).toBe(19);
    expect(x).toBeCloseTo(CADRE.largeurPx / 2, 6);
    expect(y).toBeCloseTo(CADRE.hauteurPx / 2, 6);
  });
});

/** Le même calcul d'origine que `cadrageOf`, pour éprouver le zoom d'après. */
function origineAu(zoom: number) {
  const lats = TRACE.map((p) => p.lat);
  const lons = TRACE.map((p) => p.lon);
  const a = worldPx({ lat: Math.max(...lats), lon: Math.min(...lons) }, zoom);
  const b = worldPx({ lat: Math.min(...lats), lon: Math.max(...lons) }, zoom);

  return {
    x: (a.x + b.x) / 2 - CADRE.largeurPx / 2,
    y: (a.y + b.y) / 2 - CADRE.hauteurPx / 2,
  };
}

describe("tuilesOf", () => {
  test("couvre le cadre de bord à bord", () => {
    const tuiles = tuilesOf(cadrageOf(TRACE, CADRE));
    const gauche = Math.min(...tuiles.map((t) => t.dx));
    const droite = Math.max(...tuiles.map((t) => t.dx)) + TAILLE_TUILE;
    const haut = Math.min(...tuiles.map((t) => t.dy));
    const bas = Math.max(...tuiles.map((t) => t.dy)) + TAILLE_TUILE;

    expect(gauche).toBeLessThanOrEqual(0);
    expect(droite).toBeGreaterThanOrEqual(CADRE.largeurPx);
    expect(haut).toBeLessThanOrEqual(0);
    expect(bas).toBeGreaterThanOrEqual(CADRE.hauteurPx);
  });

  test("ne demande aucune tuile hors du damier du zoom", () => {
    const cadrage = cadrageOf(TRACE, CADRE);
    const cotes = 2 ** cadrage.zoom;

    for (const tuile of tuilesOf(cadrage)) {
      expect(tuile.x).toBeGreaterThanOrEqual(0);
      expect(tuile.x).toBeLessThan(cotes);
      expect(tuile.y).toBeGreaterThanOrEqual(0);
      expect(tuile.y).toBeLessThan(cotes);
    }
  });
});

describe("tuileUrl", () => {
  test("vise le serveur canonique d'OpenStreetMap", () => {
    expect(tuileUrl({ z: 12, x: 2130, y: 1430, dx: 0, dy: 0 })).toBe(
      "https://tile.openstreetmap.org/12/2130/1430.png",
    );
  });
});

describe("pointADistance", () => {
  const TRACE_D = newPlan.track.points;

  test("rend le point de la trace le plus proche de la distance visée", () => {
    expect(pointADistance(TRACE_D, 14175)).toMatchObject({ d: 14175 });
  });

  test("s'arrête au point le plus proche quand rien ne tombe juste", () => {
    expect(pointADistance(TRACE_D, 14000)).toMatchObject({ d: 14175 });
  });

  test("retombe sur le départ et sur l'arrivée aux deux bouts", () => {
    expect(pointADistance(TRACE_D, -500)).toMatchObject({ d: 0 });
    expect(pointADistance(TRACE_D, 999999)).toMatchObject({ d: 28350 });
  });

  test("rend null sur une trace vide", () => {
    expect(pointADistance([], 0)).toBeNull();
  });
});

describe("bornesOf", () => {
  /** Une trace, et le cadrage qui la porte : les repères se mesurent dessus. */
  function bornes(
    points: { lat: number; lon: number; d: number }[],
    aidStations: { distanceM: number }[] = [],
  ) {
    return bornesOf(cadrageOf(points, CADRE), points, aidStations).map(
      (b) => b.label,
    );
  }

  test("marque le départ, chaque ravito dans l'ordre, puis l'arrivée", () => {
    expect(
      bornes(
        [
          { lat: 48.0, lon: 7.0, d: 0 },
          { lat: 48.2, lon: 7.2, d: 5000 },
          { lat: 48.4, lon: 7.4, d: 10000 },
        ],
        // Posés dans le désordre : c'est la course qui donne les rangs.
        [{ distanceM: 10000 }, { distanceM: 5000 }],
      ),
    ).toEqual(["D", "1", "2", "A"]);
  });

  test("ne marque pas deux fois le même endroit sur une boucle", () => {
    // Départ et arrivée au même point : un seul repère, celui du départ.
    expect(
      bornes([
        { lat: 48.0, lon: 7.0, d: 0 },
        { lat: 48.2, lon: 7.2, d: 5000 },
        { lat: 48.0, lon: 7.0, d: 10000 },
      ]),
    ).toEqual(["D"]);
  });

  test("marque les deux bouts quand la trace n'est pas une boucle", () => {
    expect(
      bornes([
        { lat: 48.0, lon: 7.0, d: 0 },
        { lat: 48.1, lon: 7.1, d: 5000 },
      ]),
    ).toEqual(["D", "A"]);
  });

  test("juge le recouvrement sur le cadre, pas sur des degrés", () => {
    // Deux traces de forme identique, à deux échelles. Sur l'une comme sur
    // l'autre, l'arrivée est au centième de la trace : elle recouvre le
    // départ dans les deux cas, quel que soit le zoom retenu.
    const forme = (echelle: number) => [
      { lat: 48.0, lon: 7.0, d: 0 },
      { lat: 48.0 + echelle, lon: 7.0 + echelle, d: 5000 },
      { lat: 48.0 + echelle / 100, lon: 7.0, d: 10000 },
    ];

    expect(bornes(forme(0.02))).toEqual(["D"]);
    expect(bornes(forme(2))).toEqual(["D"]);
  });
});
