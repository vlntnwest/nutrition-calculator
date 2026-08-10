import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parseGpx } from "./parseGpx";

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

test("extrait lat/lon/ele d'un trk mono-segment", () => {
  expect(parseGpx(fixture("minimal.gpx"))).toEqual({
    name: "SaintéLyon 2025",
    points: [
      { lat: 45.764, lon: 4.8357, ele: 172.4 },
      { lat: 45.7641, lon: 4.8359, ele: 173.1 },
      { lat: 45.7642, lon: 4.836, ele: 174.0 },
    ],
    skipped: 0,
  });
});

test("concatène les segments dans l'ordre", () => {
  expect(parseGpx(fixture("multi-segment.gpx"))).toEqual({
    name: "UTDP 2026",
    points: [
      { lat: 45.764, lon: 4.8357, ele: 172.4 },
      { lat: 45.7641, lon: 4.8359, ele: 173.1 },
      { lat: 45.7642, lon: 4.836, ele: 174.0 },
      { lat: 45.7644, lon: 4.8362, ele: 175.0 },
    ],
    skipped: 0,
  });
});

test("distingue une altitude absente (null) d'une altitude nulle (0)", () => {
  expect(parseGpx(fixture("no-ele.gpx"))).toEqual({
    name: "SaintéLyon 2025",
    points: [
      { lat: 45.764, lon: 4.8357, ele: 172.4 },
      { lat: 45.7641, lon: 4.8359, ele: null },
      { lat: 45.7642, lon: 4.836, ele: 0 },
    ],
    skipped: 0,
  });
});

test("rejette les fichiers non GPX", () => {
  expect(() => parseGpx("<html><body>nope</body></html>")).toThrow(
    "Invalid GPX file: <gpx> root element not found",
  );
});

test.each([
  { lat: "", reason: "attribut vide" },
  { lat: "   ", reason: "blancs seuls" },
  { lat: "N/A", reason: "valeur non numérique" },
  { lat: "91.5", reason: "latitude hors bornes" },
  { lat: "0", lon: "0", reason: "Null Island (0, 0)" },
])("écarte un point et le compte — $reason", ({ lat, lon = "4.8359" }) => {
  const xml = `<gpx><trk><trkseg>
    <trkpt lat="45.764" lon="4.8357"><ele>172.4</ele></trkpt>
    <trkpt lat="${lat}" lon="${lon}"><ele>173.1</ele></trkpt>
  </trkseg></trk></gpx>`;

  expect(parseGpx(xml)).toEqual({
    name: null,
    points: [{ lat: 45.764, lon: 4.8357, ele: 172.4 }],
    skipped: 1,
  });
});

test("rejette un GPX sans aucun point valide", () => {
  const xml = `<gpx><trk><trkseg></trkseg></trk></gpx>`;
  expect(() => parseGpx(xml)).toThrow("No valid points found in GPX file");
});

test("rejette un GPX dont tous les points sont écartés", () => {
  const xml = `<gpx><trk><trkseg>
    <trkpt lat="N/A" lon="4.8357"><ele>172.4</ele></trkpt>
    <trkpt lat="" lon="4.8359"><ele>173.1</ele></trkpt>
  </trkseg></trk></gpx>`;

  expect(() => parseGpx(xml)).toThrow("No valid points found in GPX file");
});

test("extrait les points d'un <rte> quand il n'y a pas de <trk>", () => {
  expect(parseGpx(fixture("route.gpx"))).toEqual({
    // <rte><name> l'emporte sur <metadata><name>
    name: "SaintéLyon 2025",
    points: [
      { lat: 45.764, lon: 4.8357, ele: 172.4 },
      { lat: 45.7641, lon: 4.8359, ele: 173.1 },
      { lat: 45.7642, lon: 4.836, ele: 174.0 },
    ],
    skipped: 0,
  });
});

test("préfère le <trk> quand le fichier contient les deux", () => {
  // Coordonnées volontairement éloignées : une concaténation des deux sources
  // sauterait de Lyon à Genève et se verrait immédiatement.
  const xml = `<gpx>
    <trk><name>Trace enregistrée</name><trkseg>
      <trkpt lat="45.764" lon="4.8357"><ele>172.4</ele></trkpt>
    </trkseg></trk>
    <rte><name>Itinéraire planifié</name>
      <rtept lat="46.2044" lon="6.1432"><ele>375</ele></rtept>
    </rte>
  </gpx>`;

  expect(parseGpx(xml)).toEqual({
    name: "Trace enregistrée",
    points: [{ lat: 45.764, lon: 4.8357, ele: 172.4 }],
    skipped: 0,
  });
});

test("retombe sur le <rte> quand le <trk> est présent mais vide", () => {
  // Planificateurs qui écrivent les deux balises et n'en
  // remplissent qu'une : tester l'existence du <trk> ne suffirait pas.
  const xml = `<gpx>
    <trk><trkseg></trkseg></trk>
    <rte><name>Itinéraire planifié</name>
      <rtept lat="45.764" lon="4.8357"><ele>172.4</ele></rtept>
    </rte>
  </gpx>`;

  expect(parseGpx(xml)).toEqual({
    name: "Itinéraire planifié",
    points: [{ lat: 45.764, lon: 4.8357, ele: 172.4 }],
    skipped: 0,
  });
});

test("prends <metadata><name> si pas de <trk><name>", () => {
  const xml = `<gpx><metadata><name>UTDP 2026</name></metadata><trk><trkseg>
    <trkpt lat="45.764" lon="4.8357"><ele>172.4</ele></trkpt>
  </trkseg></trk></gpx>`;
  expect(parseGpx(xml)).toEqual({
    name: "UTDP 2026",
    points: [{ lat: 45.764, lon: 4.8357, ele: 172.4 }],
    skipped: 0,
  });
});
