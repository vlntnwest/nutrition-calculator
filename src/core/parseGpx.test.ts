import { test, expect } from "vitest";
import { parseGpx } from "./parseGpx";
import { readFileSync } from "node:fs";

const minimalGpx = readFileSync(
  new URL("./fixtures/minimal.gpx", import.meta.url),
  "utf8",
);

test(" 3 points, voici leurs lat/lon/ele", () => {
  expect(parseGpx(minimalGpx)).toEqual({
    name: "SaintéLyon 2025",
    points: [
      { lat: 45.764, lon: 4.8357, ele: 172.4 },
      { lat: 45.7641, lon: 4.8359, ele: 173.1 },
      { lat: 45.7642, lon: 4.836, ele: 174.0 },
    ],
  });
});
