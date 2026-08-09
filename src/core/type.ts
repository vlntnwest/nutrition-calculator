/**
 * Les trois types de points ne décrivent pas trois formes différentes, ils
 * décrivent trois **étapes du pipeline**. Chaque fonction déclare l'étape
 * qu'elle exige, et le compilateur impose donc l'ordre : `resample` ne peut
 * pas être appelée avant `fillMissingElevation`, faute de quoi ses `ele`
 * pourraient être `null`.
 *
 *   RawPoint       ele: number | null   —          sorti du fichier
 *   RoutePoint     ele: number | null   d: number  ancré sur la distance
 *   ResolvedPoint  ele: number          d: number  plus aucun trou d'altitude
 *
 * `ResolvedPoint` n'ajoute pas de champ : l'intersection avec `{ ele: number }`
 * **rétrécit** celui qui existe, `number & (number | null)` valant `number`.
 */

export type RawPoint = {
  lat: number;
  lon: number;
  ele: number | null; // null = absent, JAMAIS 0
};

export type RoutePoint = RawPoint & { d: number };

/** Toutes les altitudes sont renseignées : les trous ont été interpolés. */
export type ResolvedPoint = RoutePoint & { ele: number };

export type RawTrack = {
  name: string | null; // <trk><name> ou <metadata><name> ou <rte><name>
  points: RawPoint[];
  skipped: number; // <trkpt> ou <rtept> écartés faute de coordonnées exploitables
};

export type GpxPoint = { "@_lat"?: string; "@_lon"?: string; ele?: number };

export type GpxTrkseg = { trkpt?: GpxPoint[] };

export type GpxTrk = { name?: string | number; trkseg?: GpxTrkseg[] };

export type GpxRte = { name?: string | number; rtept?: GpxPoint[] };

export type GpxRoot = {
  gpx?: {
    metadata?: { name?: string | number };
    trk?: GpxTrk[];
    rte?: GpxRte[];
  };
};
