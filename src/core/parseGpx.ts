import { XMLParser } from "fast-xml-parser";
import type {
  GpxPoint,
  GpxRoot,
  GpxRte,
  GpxSource,
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

function toSource(
  name: string | number | undefined,
  kind: GpxSource["kind"],
  raw: GpxPoint[],
): GpxSource {
  // `skipped` est déduit, jamais incrémenté : un compteur entretenu à la main
  // peut se désynchroniser du tableau, une soustraction non.
  const candidates = raw.map(toRawPoint); // (RawPoint | null)[]
  const points = candidates.filter((p) => p !== null); // RawPoint[]

  return {
    name: name?.toString() ?? null,
    kind,
    points,
    skipped: candidates.length - points.length,
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
  const trackSources = traces.map((trace: GpxTrk) =>
    toSource(
      trace.name,
      "track",
      (trace.trkseg ?? []).flatMap((seg: GpxTrkseg) => seg.trkpt ?? []),
    ),
  );

  const routeSources = routes.map((route: GpxRte) =>
    toSource(route.name, "route", route.rtept ?? []),
  );

  // Une source se retient sur ce qu'elle donne de **lisible**, pas sur ce
  // qu'elle contient : un <trk> peuplé de points sans coordonnées est aussi
  // inexploitable qu'un <trkseg> vide, et le tester par sa longueur
  // condamnerait un <rte> parfaitement lisible du même fichier.
  const readable = (s: GpxSource) => s.points.length > 0;
  const fromTracks = trackSources.filter(readable);

  // Les traces l'emportent sur les itinéraires — donnée mesurée, plus dense,
  // plus fidèle au relief. Les deux ne se mélangent jamais.
  const sources =
    fromTracks.length > 0 ? fromTracks : routeSources.filter(readable);

  // Écarter quelques points est normal ; les écarter tous signifie qu'on n'a
  // pas su lire le fichier. Second et dernier refus du parseur, avec la racine
  // <gpx> manquante plus haut : tous deux portent sur le fichier entier, jamais
  // sur un point isolé.
  if (sources.length === 0) {
    throw new Error("No valid points found in GPX file");
  }

  // La première source, et elle seule. Souder les suivantes fabriquerait un
  // tronçon fantôme entre l'arrivée de l'une et le départ de l'autre — ADR 008.
  // Le nom vient d'elle, puis des métadonnées du fichier ; jamais d'une source
  // qu'on n'a pas retenue.
  const [first] = sources;

  return {
    name: first.name ?? parsed.gpx.metadata?.name?.toString() ?? null,
    points: first.points,
    skipped: first.skipped,
    sources,
  };
}

/**
 * Soude toutes les sources en une seule trace — le choix « tout combiner »
 * qu'on propose à l'utilisateur quand le fichier en contient plusieurs.
 *
 * À n'appeler que s'il l'a demandé. La ligne droite qui relie deux sources n'a
 * jamais été parcourue : la distance et le D+ qu'elle porte sont une fiction,
 * et `resample` l'interpolera comme n'importe quel autre intervalle.
 */
export function combineSources(sources: GpxSource[]): RawPoint[] {
  return sources.flatMap((s) => s.points);
}
