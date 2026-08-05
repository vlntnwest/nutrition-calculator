import { XMLParser } from "fast-xml-parser";

export type RawPoint = {
  lat: number;
  lon: number;
  ele: number | null; // null = absent, JAMAIS 0
};

export type RawTrack = {
  name: string | null; // <trk><name> ou <metadata><name>
  points: RawPoint[];
};

type GpxTrkpt = { "@_lat"?: string; "@_lon"?: string; ele?: number };

type GpxTrkseg = { trkpt?: GpxTrkpt[] };

type GpxTrk = { name?: string | number; trkseg?: GpxTrkseg[] };

type GpxRoot = {
  gpx?: {
    metadata?: { name?: string | number };
    trk?: GpxTrk[];
  };
};

function toRawPoint(tp: GpxTrkpt): RawPoint {
  const lat = Number(tp["@_lat"]);
  const lon = Number(tp["@_lon"]);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("Invalid lat/lon values");
  }

  if (lat < -90 || lat > 90) {
    throw new Error("Invalid latitude value");
  }

  if (lon < -180 || lon > 180) {
    throw new Error("Invalid longitude value");
  }

  // (0, 0) = "Null Island", dans le golfe de Guinée : la valeur par défaut
  // que produisent la plupart des systèmes géo quand la position est manquante.
  // Aucune course n'y passe — c'est une donnée absente, pas une coordonnée.
  if (lat === 0 && lon === 0) {
    throw new Error("Coordinates at Null Island (0, 0)");
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
    isArray: (name) => ["trk", "trkseg", "trkpt"].includes(name),
    // toujours un tableau, même à un seul élément — sinon le code marche sur un
    // fichier mono-segment et casse sur les autres
  });
  const parsed = parser.parse(xml) as GpxRoot;

  // Absence anormale : sans racine <gpx>, ce n'est pas un fichier GPX.
  if (!parsed?.gpx) {
    throw new Error("Invalid GPX file: <gpx> root element not found");
  }

  const traces = parsed.gpx.trk ?? [];

  // Absences normales : un <trk> sans <trkseg> ou un <trkseg> vide existent
  // dans la nature (perte de signal, pause). Ils contribuent zéro point.
  // Les segments d'une même trace se concatènent bout à bout : on veut une
  // seule ligne continue, la coupure sera traitée par resample().
  const trkpts = traces.flatMap((trace: GpxTrk) =>
    (trace.trkseg ?? []).flatMap((seg: GpxTrkseg) => seg.trkpt ?? []),
  );

  const points: RawPoint[] = trkpts.map(toRawPoint);

  if (points.length === 0) {
    throw new Error("No valid points found in GPX file");
  }

  const name =
    traces[0]?.name?.toString() ??
    parsed.gpx.metadata?.name?.toString() ??
    null;

  return {
    name,
    points,
  };
}
