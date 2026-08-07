import type { ElevatedPoint, RoutePoint } from "./type";

export function fillMissingElevation(points: RoutePoint[]): ElevatedPoint[] {
  if (points.length === 0) {
    throw new Error("File without points");
  }
  if (points.every((point) => point.ele === null)) {
    throw new Error("File without elevation data");
  }

  const result = points.map((p) => ({ ...p }));

  let i = 0;

  while (i < result.length) {
    if (result[i].ele !== null) {
      i++;
      continue;
    }

    const start = i;

    while (i < result.length && result[i].ele === null) {
      i++;
    }

    const before = result[start - 1];
    const after = result[i];

    const beforeEle = before?.ele ?? null;
    const afterEle = after?.ele ?? null;

    for (let j = start; j < i; j++) {
      if (beforeEle === null) {
        result[j].ele = afterEle;
      } else if (afterEle === null) {
        result[j].ele = beforeEle;
      } else {
        const beforeDist = before?.d;
        const afterDist = after?.d;
        if (afterDist - beforeDist === 0) {
          result[j].ele = beforeEle;
        } else {
          const t = (result[j].d - beforeDist) / (afterDist - beforeDist);
          result[j].ele = beforeEle + t * (afterEle - beforeEle);
        }
      }
    }
  }
  return result as ElevatedPoint[];
}

export function elevationGain(points: ElevatedPoint[], threshold = 3): number {
  // Suppose une distance constante entre les points
  if (points.length === 0) {
    throw new Error("File without points");
  }
  let ref = points[0].ele;
  let totalGain = 0;

  for (let i = 1; i < points.length; i++) {
    const delta = points[i].ele - ref;
    if (delta > threshold) {
      totalGain += delta;
      ref = points[i].ele;
    } else if (delta < -threshold) {
      ref = points[i].ele;
    }
  }
  return totalGain;
}
