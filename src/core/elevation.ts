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
