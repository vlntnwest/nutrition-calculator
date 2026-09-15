/**
 * Le cadrage d'un fond de carte statique, en projection Web Mercator.
 *
 * Ce module ne charge rien et ne dessine rien : il dit quel zoom retenir,
 * quelles tuiles demander, où les poser, et où tombe un point de la trace sur
 * le cadre. Voir `docs/pdf-du-roadbook.md`, section 3.1.
 *
 * Tout y est en **pixels de tuile**, jamais en points PDF. Le cadre se
 * demande au double de sa taille sur le papier, et c'est celui qui dessine
 * qui réduit : une tuile agrandie est floue à l'impression, une tuile réduite
 * ne l'est pas.
 */

export const TAILLE_TUILE = 256;

/** Le zoom le plus fin que sert OpenStreetMap. */
export const ZOOM_MAX = 19;

export type Point = { lat: number; lon: number };
export type Cadre = { largeurPx: number; hauteurPx: number };

/** Une tuile, et le décalage de son coin haut-gauche dans le cadre. */
export type Tuile = { z: number; x: number; y: number; dx: number; dy: number };

export type Cadrage = {
  zoom: number;
  cadre: Cadre;
  /** Le coin haut-gauche du cadre, en pixels du monde au zoom retenu. */
  origine: { x: number; y: number };
};

/**
 * Un point du globe en pixels du monde entier, au zoom donné. Le monde fait
 * `256 × 2^zoom` pixels de côté, et il double donc à chaque zoom.
 */
export function worldPx(
  { lat, lon }: Point,
  zoom: number,
): {
  x: number;
  y: number;
} {
  const taille = TAILLE_TUILE * 2 ** zoom;
  const phi = (lat * Math.PI) / 180;

  return {
    x: ((lon + 180) / 360) * taille,
    // Mercator étire les hautes latitudes : l'ordonnée n'est pas
    // proportionnelle à la latitude, et le nord est en haut.
    y:
      (0.5 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / (2 * Math.PI)) *
      taille,
  };
}

/** Les bornes de la trace, sans étaler le tableau sur la pile d'appels. */
function bbox(points: Point[]) {
  return points.reduce(
    (b, p) => ({
      minLat: Math.min(b.minLat, p.lat),
      maxLat: Math.max(b.maxLat, p.lat),
      minLon: Math.min(b.minLon, p.lon),
      maxLon: Math.max(b.maxLon, p.lon),
    }),
    {
      minLat: Number.POSITIVE_INFINITY,
      maxLat: Number.NEGATIVE_INFINITY,
      minLon: Number.POSITIVE_INFINITY,
      maxLon: Number.NEGATIVE_INFINITY,
    },
  );
}

/**
 * Le plus grand zoom auquel la trace tient encore dans le cadre, et la
 * position du cadre qui la centre.
 *
 * Le centre se prend sur les coins **projetés**, pas sur la latitude moyenne :
 * en Mercator, le milieu de deux latitudes ne se projette pas au milieu des
 * deux ordonnées, et une trace nord-sud arriverait décentrée.
 */
export function cadrageOf(
  points: Point[],
  cadre: Cadre,
  zoomMax = ZOOM_MAX,
): Cadrage {
  const { minLat, maxLat, minLon, maxLon } = bbox(points);
  const coins = (zoom: number) => ({
    // Le coin haut-gauche est au nord et à l'ouest : latitude maximale.
    a: worldPx({ lat: maxLat, lon: minLon }, zoom),
    b: worldPx({ lat: minLat, lon: maxLon }, zoom),
  });

  let zoom = 0;
  for (let z = zoomMax; z >= 0; z--) {
    const { a, b } = coins(z);
    if (b.x - a.x <= cadre.largeurPx && b.y - a.y <= cadre.hauteurPx) {
      zoom = z;
      break;
    }
  }

  const { a, b } = coins(zoom);

  return {
    zoom,
    cadre,
    origine: {
      x: (a.x + b.x) / 2 - cadre.largeurPx / 2,
      y: (a.y + b.y) / 2 - cadre.hauteurPx / 2,
    },
  };
}

/**
 * Les tuiles qui recouvrent le cadre, débordements compris : une tuile à
 * cheval sur le bord se demande entière et se coupe au dessin.
 *
 * Au-delà des pôles il n'existe pas de tuile, et la ligne est sautée. En
 * longitude le damier s'enroule, d'où le modulo : une trace qui enjambe
 * l'antiméridien redemande les tuiles de l'autre bord plutôt que des
 * inexistantes.
 */
export function tuilesOf({ zoom, cadre, origine }: Cadrage): Tuile[] {
  const cotes = 2 ** zoom;
  const tuiles: Tuile[] = [];

  const xMin = Math.floor(origine.x / TAILLE_TUILE);
  const xMax = Math.floor((origine.x + cadre.largeurPx) / TAILLE_TUILE);
  const yMin = Math.floor(origine.y / TAILLE_TUILE);
  const yMax = Math.floor((origine.y + cadre.hauteurPx) / TAILLE_TUILE);

  for (let x = xMin; x <= xMax; x++) {
    for (let y = yMin; y <= yMax; y++) {
      if (y < 0 || y >= cotes) continue;

      tuiles.push({
        z: zoom,
        x: ((x % cotes) + cotes) % cotes,
        y,
        dx: x * TAILLE_TUILE - origine.x,
        dy: y * TAILLE_TUILE - origine.y,
      });
    }
  }

  return tuiles;
}

/** Où tombe un point du globe dans le cadre, en pixels depuis son coin. */
export function projeter(
  cadrage: Cadrage,
  point: Point,
): {
  x: number;
  y: number;
} {
  const { x, y } = worldPx(point, cadrage.zoom);

  return { x: x - cadrage.origine.x, y: y - cadrage.origine.y };
}

/**
 * Le serveur canonique d'OpenStreetMap. Les sous-domaines `a/b/c` que porte
 * encore `RouteMap` sont dépréciés, et un seul hôte suffit ici : une feuille
 * demande une dizaine de tuiles, pas une carte qu'on fait glisser.
 */
export function tuileUrl({ z, x, y }: Tuile): string {
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

/**
 * Le point de la trace qui porte une abscisse donnée : c'est ainsi qu'un
 * ravito, posé sur un kilomètre, retrouve ses coordonnées pour se marquer sur
 * la carte.
 *
 * Le plus proche, jamais une interpolation : les points sont déjà simplifiés
 * pour l'affichage, et un ravito marqué à quelques mètres de sa borne exacte
 * ne se voit pas à l'échelle d'une A4.
 */
export function pointADistance<T extends { d: number }>(
  points: T[],
  distanceM: number,
): T | null {
  if (points.length === 0) return null;

  return points.reduce((proche, point) =>
    Math.abs(point.d - distanceM) < Math.abs(proche.d - distanceM)
      ? point
      : proche,
  );
}
