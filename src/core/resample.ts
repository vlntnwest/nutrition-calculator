import type { ResolvedPoint } from "./type";

export function resample(points: ResolvedPoint[], stepM = 10): ResolvedPoint[] {
  if (!Number.isFinite(stepM) || stepM <= 0) {
    throw new Error("Step must be a finite positive number");
  }

  if (points.length === 0) {
    throw new Error("File without points");
  }

  if (points.length === 1) {
    return points.map((p) => ({ ...p }));
  }

  const result: ResolvedPoint[] = [];
  const last = points[points.length - 1];
  let k = 0;

  for (let target = 0; target <= last.d; target += stepM) {
    while (k < points.length - 2 && points[k + 1].d < target) {
      k++;
    }
    const a = points[k];
    const b = points[k + 1];
    let t: number;

    if (b.d - a.d === 0) t = 0;
    else t = (target - a.d) / (b.d - a.d);

    result.push({
      d: target,
      lat: a.lat + t * (b.lat - a.lat),
      lon: a.lon + t * (b.lon - a.lon),
      ele: a.ele + t * (b.ele - a.ele),
    });
  }

  if (result[result.length - 1].d === last.d) {
    result[result.length - 1] = { ...last };
  } else {
    result.push({ ...last });
  }

  return result;
}
