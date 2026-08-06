import { XMLParser } from "fast-xml-parser";
import type {
  GpxPoint,
  GpxRoot,
  GpxRte,
  GpxTrk,
  GpxTrkseg,
  RawPoint,
  RawTrack,
} from "./type";

// null = attribut absent, vide ou non numérique. Un point isolé ne fait pas
// échouer l'import : parseGpx le compte dans `skipped`.
function toCoordinate(raw: string | undefined): number | null {
  if (!raw || raw.trim() === "") {
    return null;
  }
  const n = Number(raw);

  if (!Number.isFinite(n)) {
    return null;
  }

  return n;
}

function toRawPoint(tp: GpxPoint): RawPoint | null {
  const lat = toCoordinate(tp["@_lat"]);
  const lon = toCoordinate(tp["@_lon"]);

  if (lat === null || lon === null) {
    return null;
  }

  if (lat < -90 || lat > 90) {
    return null;
  }

  if (lon < -180 || lon > 180) {
    return null;
  }

  // (0, 0) = "Null Island", dans le golfe de Guinée : la valeur par défaut
  // que produisent la plupart des systèmes géo quand la position est manquante.
  // Aucune course n'y passe — c'est une donnée absente, pas une coordonnée.
  if (lat === 0 && lon === 0) {
    return null;
  }

  // ?? et non || : <ele>0</ele> est une altitude valide (niveau de la mer).
  let ele = tp.ele ?? null;

  // Number.isFinite et non Number.isNaN : <ele>N/A</ele> arrive ici en chaîne,
  // que Number.isNaN laisserait passer. Une altitude illisible vaut absente —
  // elle sera interpolée plus tard, contrairement à une coordonnée manquante.
  if (ele !== null && !Number.isFinite(ele)) {
    ele = null;
  }

  return {
    lat,
    lon,
    ele,
  };
}

export function parseGpx(xml: string): RawTrack {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true, // <gpx:trk> → <trk> : les exports Garmin, Suunto,
    // Coros et Strava déclarent des namespaces différents, parfois non déclarés
    isArray: (name) =>
      ["trk", "trkseg", "trkpt", "rte", "rtept"].includes(name),
    // toujours un tableau, même à un seul élément — sinon le code marche sur un
    // fichier mono-segment et casse sur les autres
  });
  const parsed = parser.parse(xml) as GpxRoot;

  // Absence anormale : sans racine <gpx>, ce n'est pas un fichier GPX.
  if (!parsed?.gpx) {
    throw new Error("Invalid GPX file: <gpx> root element not found");
  }

  const traces = parsed.gpx.trk ?? [];
  const routes = parsed.gpx.rte ?? [];

  // Absences normales : un <trk> sans <trkseg> ou un <trkseg> vide existent
  // dans la nature (perte de signal, pause). Ils contribuent zéro point.
  // Les segments d'une même trace se concatènent bout à bout : on veut une
  // seule ligne continue, la coupure sera traitée par resample().
  const fromTrk = traces.flatMap((trace: GpxTrk) =>
    (trace.trkseg ?? []).flatMap((seg: GpxTrkseg) => seg.trkpt ?? []),
  );

  const fromRte = routes.flatMap((route: GpxRte) => route.rtept ?? []);

  const trkpts = fromTrk.length > 0 ? fromTrk : fromRte;

  // `skipped` est déduit, jamais incrémenté : un compteur entretenu à la main
  // peut se désynchroniser du tableau, une soustraction non.
  const candidates = trkpts.map(toRawPoint); // (RawPoint | null)[]
  const points = candidates.filter((p) => p !== null); // RawPoint[]
  const skipped = candidates.length - points.length;

  // Écarter quelques points est normal ; les écarter tous signifie qu'on n'a
  // pas su lire le fichier. Second et dernier refus du parseur, avec la racine
  // <gpx> manquante plus haut : tous deux portent sur le fichier entier, jamais
  // sur un point isolé.
  if (points.length === 0) {
    throw new Error("No valid points found in GPX file");
  }

  const name =
    traces[0]?.name?.toString() ??
    routes[0]?.name?.toString() ??
    parsed.gpx.metadata?.name?.toString() ??
    null;

  return {
    name,
    points,
    skipped,
  };
}
