export type RoutePoint = RawPoint & { d: number };

export type RawPoint = {
  lat: number;
  lon: number;
  ele: number | null; // null = absent, JAMAIS 0
};

export type RawTrack = {
  name: string | null; // <trk><name> ou <metadata><name> ou <rte><name>
  points: RawPoint[];
  skipped: number; // <trkpt> écartés faute de coordonnées exploitables
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

export type ElevatedPoint = RoutePoint & { ele: number };
