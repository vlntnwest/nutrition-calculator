import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parseGpx } from "./parseGpx";

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

/**
 * La trace, sans l'inventaire des sources ni des jointures — ceux-ci ont leurs
 * propres tests plus bas. Garde les assertions de forme strictes plutôt que de
 * les relâcher en `toMatchObject`.
 */
const withoutSources = (xml: string) => {
  const { sources: _s, joins: _j, ...track } = parseGpx(xml);

  return track;
};

test("extrait lat/lon/ele d'un trk mono-segment", () => {
  expect(withoutSources(fixture("minimal.gpx"))).toEqual({
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
  expect(withoutSources(fixture("multi-segment.gpx"))).toEqual({
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
  expect(withoutSources(fixture("no-ele.gpx"))).toEqual({
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

  expect(withoutSources(xml)).toEqual({
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
  expect(withoutSources(fixture("route.gpx"))).toEqual({
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

  expect(withoutSources(xml)).toEqual({
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

  expect(withoutSources(xml)).toEqual({
    name: "Itinéraire planifié",
    points: [{ lat: 45.764, lon: 4.8357, ele: 172.4 }],
    skipped: 0,
  });
});

test("retombe sur le <rte> quand aucun <trkpt> n'est exploitable", () => {
  // Le <trk> est peuplé — le tester par sa longueur suffirait à le retenir —
  // mais aucun de ses points n'a de coordonnées. Le fichier reste lisible.
  const xml = `<gpx>
    <trk><name>Trace enregistrée</name><trkseg>
      <trkpt><ele>172.4</ele></trkpt>
      <trkpt lat="abc" lon="4.8357"><ele>180</ele></trkpt>
    </trkseg></trk>
    <rte><name>Itinéraire planifié</name>
      <rtept lat="45.764" lon="4.8357"><ele>172.4</ele></rtept>
    </rte>
  </gpx>`;

  expect(withoutSources(xml)).toEqual({
    // Le nom suit la source retenue, pas le <trk> qu'on a abandonné.
    name: "Itinéraire planifié",
    points: [{ lat: 45.764, lon: 4.8357, ele: 172.4 }],
    // Les <trkpt> illisibles n'ont pas été « écartés » : on ne les a pas lus.
    skipped: 0,
  });
});

test("un <trk> partiellement lisible reste la source", () => {
  // Un point invalide sur deux ne disqualifie pas la trace : il est écarté et
  // compté, et le <rte> n'est pas consulté.
  const xml = `<gpx>
    <trk><name>Trace enregistrée</name><trkseg>
      <trkpt><ele>172.4</ele></trkpt>
      <trkpt lat="45.764" lon="4.8357"><ele>180</ele></trkpt>
    </trkseg></trk>
    <rte><name>Itinéraire planifié</name>
      <rtept lat="46.2044" lon="6.1432"><ele>375</ele></rtept>
    </rte>
  </gpx>`;

  expect(withoutSources(xml)).toEqual({
    name: "Trace enregistrée",
    points: [{ lat: 45.764, lon: 4.8357, ele: 180 }],
    skipped: 1,
  });
});

test("le nom ne vient jamais de la source abandonnée", () => {
  // Le <trk> fournit les points mais n'a pas de nom. Prendre celui du <rte>
  // baptiserait une trace enregistrée d'après un itinéraire sans rapport ; les
  // métadonnées, elles, désignent bien ce fichier.
  const xml = `<gpx>
    <metadata><name>Sortie du dimanche</name></metadata>
    <trk><trkseg>
      <trkpt lat="45.764" lon="4.8357"><ele>172.4</ele></trkpt>
    </trkseg></trk>
    <rte><name>Itinéraire planifié</name>
      <rtept lat="46.2044" lon="6.1432"><ele>375</ele></rtept>
    </rte>
  </gpx>`;

  expect(parseGpx(xml).name).toBe("Sortie du dimanche");
});

test("prends <metadata><name> si pas de <trk><name>", () => {
  const xml = `<gpx><metadata><name>UTDP 2026</name></metadata><trk><trkseg>
    <trkpt lat="45.764" lon="4.8357"><ele>172.4</ele></trkpt>
  </trkseg></trk></gpx>`;
  expect(withoutSources(xml)).toEqual({
    name: "UTDP 2026",
    points: [{ lat: 45.764, lon: 4.8357, ele: 172.4 }],
    skipped: 0,
  });
});

/**
 * Le cas dominant d'un fichier d'activité à plusieurs `<trk>` est un
 * enregistrement scindé — pause, batterie, transition multisport. On combine
 * donc, et la jointure est mesurée : c'est à elle qu'on reconnaît l'autre cas,
 * deux parcours sans rapport dans un même fichier. ADR 009.
 */
test("les traces sont combinées, et la jointure est mesurée", () => {
  // Lyon puis Genève : la jointure doit annoncer la centaine de kilomètres.
  const xml = `<gpx>
    <trk><name>Boucle du matin</name><trkseg>
      <trkpt lat="45.764" lon="4.8357"><ele>172</ele></trkpt>
      <trkpt lat="45.7641" lon="4.8359"><ele>173</ele></trkpt>
    </trkseg></trk>
    <trk><name>Boucle du soir</name><trkseg>
      <trkpt lat="46.2044" lon="6.1432"><ele>375</ele></trkpt>
    </trkseg></trk>
  </gpx>`;

  const track = parseGpx(xml);

  expect(track.sources.map((s) => [s.name, s.kind, s.points.length])).toEqual([
    ["Boucle du matin", "track", 2],
    ["Boucle du soir", "track", 1],
  ]);

  // Tout est là, dans l'ordre du fichier.
  expect(track.points).toHaveLength(3);
  expect(track.name).toBe("Boucle du matin");

  // Une jointure pour deux sources, et elle ne passe pas inaperçue.
  expect(track.joins).toHaveLength(1);
  expect(track.joins[0].afterSource).toBe(0);
  expect(track.joins[0].gapM).toBeGreaterThan(100_000);
});

test("un enregistrement scindé se recolle sans jointure suspecte", () => {
  // Reprise après pause : quelques mètres, le parcours est continu.
  const xml = `<gpx>
    <trk><name>Avant la pause</name><trkseg>
      <trkpt lat="48.5853" lon="7.6703"><ele>149</ele></trkpt>
    </trkseg></trk>
    <trk><name>Après la pause</name><trkseg>
      <trkpt lat="48.58539" lon="7.67035"><ele>149</ele></trkpt>
      <trkpt lat="48.5860" lon="7.6710"><ele>151</ele></trkpt>
    </trkseg></trk>
  </gpx>`;

  const track = parseGpx(xml);

  expect(track.points).toHaveLength(3);
  expect(track.joins[0].gapM).toBeLessThan(50);
});

test("une trace illisible ne figure pas parmi les sources", () => {
  const xml = `<gpx>
    <trk><name>Vide</name><trkseg>
      <trkpt><ele>172</ele></trkpt>
    </trkseg></trk>
    <trk><name>Lisible</name><trkseg>
      <trkpt lat="45.764" lon="4.8357"><ele>172</ele></trkpt>
    </trkseg></trk>
  </gpx>`;

  const track = parseGpx(xml);

  expect(track.sources.map((s) => s.name)).toEqual(["Lisible"]);
  expect(track.name).toBe("Lisible");
  // Le point illisible appartenait à une source écartée : il n'a jamais été lu.
  expect(track.skipped).toBe(0);
  expect(track.joins).toEqual([]);
});

test("`skipped` additionne les sources retenues", () => {
  const xml = `<gpx>
    <trk><name>Une</name><trkseg>
      <trkpt lat="45.764" lon="4.8357"><ele>172</ele></trkpt>
      <trkpt lat="N/A" lon="4.8359"><ele>173</ele></trkpt>
    </trkseg></trk>
    <trk><name>Deux</name><trkseg>
      <trkpt lat="45.765" lon="4.8360"><ele>174</ele></trkpt>
      <trkpt lat="" lon="4.8361"><ele>175</ele></trkpt>
    </trkseg></trk>
  </gpx>`;

  const track = parseGpx(xml);

  expect(track.points).toHaveLength(2);
  expect(track.skipped).toBe(2);
  expect(track.sources.map((s) => s.skipped)).toEqual([1, 1]);
});

test("un fichier à source unique expose cette source, sans jointure", () => {
  const track = parseGpx(fixture("minimal.gpx"));

  expect(track.sources).toHaveLength(1);
  expect(track.sources[0].kind).toBe("track");
  expect(track.sources[0].points).toEqual(track.points);
  expect(track.joins).toEqual([]);

  const route = parseGpx(fixture("route.gpx"));
  expect(route.sources[0].kind).toBe("route");
});
