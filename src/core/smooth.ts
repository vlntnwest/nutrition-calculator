import type { ElevatedPoint } from "./type";

export function medianFilter(
  points: ElevatedPoint[],
  windowM = 30,
): ElevatedPoint[] {
  if (points.length < 2) {
    return points.map((p) => ({ ...p }));
  }

  const step = points[1].d - points[0].d;
  const nbPoints = Math.floor(windowM / step);
  const half = Math.floor(nbPoints / 2);

  const result: ElevatedPoint[] = [];

  for (let i = 0; i < points.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(points.length - 1, i + half);

    const segment = points.slice(start, end + 1);
    segment.sort((a, b) => a.ele - b.ele);

    const median = Math.floor(segment.length / 2);

    let value: number;
    if (segment.length % 2 !== 0) {
      value = segment[median].ele;
    } else {
      value = (segment[median - 1].ele + segment[median].ele) / 2;
    }
    result.push({ ...points[i], ele: value });
  }

  return result;
}

export function meanFilter(
  points: ElevatedPoint[],
  windowM = 50,
): ElevatedPoint[] {
  if (points.length < 2) {
    return points.map((p) => ({ ...p }));
  }

  const step = points[1].d - points[0].d;
  const nbPoints = Math.floor(windowM / step);
  const half = Math.floor(nbPoints / 2);

  const result: ElevatedPoint[] = [];

  for (let i = 0; i < points.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(points.length - 1, i + half);

    const segment = points.slice(start, end + 1);
    const sum = segment.reduce((acc, p) => acc + p.ele, 0);
    const mean = sum / segment.length;
    result.push({ ...points[i], ele: mean });
  }

  return result;
}

export function smooth(
  points: ElevatedPoint[],
  medianM = 30,
  meanM = 0,
): ElevatedPoint[] {
  const filtre = medianFilter(points, medianM);
  return meanM > 0 ? meanFilter(filtre, meanM) : filtre;
}
