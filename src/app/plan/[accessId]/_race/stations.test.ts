import { expect, test } from "vitest";
import {
  insererTriee,
  pointIndexAt,
  type Row,
  rangees,
  rowAt,
  survivingOverrides,
  toRow,
  toStations,
} from "./stations";

const LIGNE: Row = {
  id: "ligne-1",
  name: "Col de Saverne",
  km: "9,8",
  stopMin: "3",
  eau: true,
  solide: true,
};

test("une ligne saisie devient un ravito en mètres et en secondes", () => {
  const stations = toStations([LIGNE], 28400);

  expect(stations).toEqual([
    {
      name: "Col de Saverne",
      distanceM: 9800,
      stopS: 180,
      providesLiquid: true,
      providesSolid: true,
    },
  ]);
});

test("un ravito relu se réécrit à l'identique", () => {
  const aid = {
    name: "Kreuzweg",
    distanceM: 19200,
    stopS: 240,
    providesLiquid: false,
    providesSolid: true,
  };

  expect(toStations([toRow(aid)], 28400)).toEqual([aid]);
});

test("les ravitos se rangent sur l'abscisse, quel que soit l'ordre de saisie", () => {
  const tard = { ...LIGNE, name: "Kreuzweg", km: "19,2" };
  const stations = toStations([tard, LIGNE], 28400);

  expect(stations).toMatchObject([{ distanceM: 9800 }, { distanceM: 19200 }]);
});

test("un arrêt vide reste absent, il ne vaut pas zéro", () => {
  const stations = toStations([{ ...LIGNE, stopMin: "" }], 28400);

  expect(stations).toMatchObject([{ stopS: undefined }]);
});

test.each([
  [{ ...LIGNE, name: "  " }, "Donnez un nom"],
  [{ ...LIGNE, km: "" }, "indiquez sa distance"],
  [{ ...LIGNE, km: "0" }, "doit tomber sur la trace"],
  [{ ...LIGNE, km: "31" }, "doit tomber sur la trace"],
  [{ ...LIGNE, stopMin: "trois" }, "nombre de minutes"],
])("une saisie de travers rend un reproche lisible", (ligne, extrait) => {
  const resultat = toStations([ligne], 28400);

  expect(typeof resultat).toBe("string");
  expect(resultat as string).toContain(extrait);
});

test("deux bornes à moins d'un kilomètre sont refusées avant le serveur", () => {
  const resultat = toStations(
    [LIGNE, { ...LIGNE, name: "Doublon", km: "10,5" }],
    28400,
  );

  expect(resultat as string).toContain("se touchent");
});

test("un ravito collé à l'arrivée fabrique le même secteur nul", () => {
  const resultat = toStations([{ ...LIGNE, km: "28" }], 28400);

  expect(resultat as string).toContain("se touchent");
});

test("une borne posée au clic tombe au dixième de kilomètre", () => {
  expect(rowAt(9843.7, 3)).toMatchObject({ name: "Ravito 3", km: "9,8" });
});

test("une consigne perd sa borne quand le ravito qui la portait s'en va", () => {
  const gardees = survivingOverrides(
    [
      { endPositionM: 9800, durationS: 4500 },
      { endPositionM: 28400, durationS: 4000 },
    ],
    [{ name: "Kreuzweg", distanceM: 19200 }],
    28400,
  );

  expect(gardees).toEqual([{ endPositionM: 28400, durationS: 4000 }]);
});

test("le point de trace le plus proche d'une abscisse", () => {
  const points = [{ d: 0 }, { d: 5000 }, { d: 10000 }];

  expect(pointIndexAt(points, 9800)).toBe(2);
  expect(pointIndexAt(points, 400)).toBe(0);
});

test("une borne posée avant les autres prend leur rang, pas le dernier", () => {
  const { lignes, rang } = insererTriee(
    [
      { ...LIGNE, id: "a", km: "12" },
      { ...LIGNE, id: "b", km: "30" },
    ],
    8000,
  );

  expect(rang).toBe(1);
  expect(lignes.map((l) => l.km)).toEqual(["8,0", "12", "30"]);
});

test("une borne posée après toutes les autres reste en queue", () => {
  const { lignes, rang } = insererTriee(
    [
      { ...LIGNE, id: "a", km: "12" },
      { ...LIGNE, id: "b", km: "30" },
    ],
    40000,
  );

  expect(rang).toBe(3);
  expect(lignes.map((l) => l.km)).toEqual(["12", "30", "40,0"]);
});

test("une ligne dont la distance n'est pas lisible ne se fait pas ranger", () => {
  const { lignes } = insererTriee(
    [
      { ...LIGNE, id: "a", km: "12" },
      { ...LIGNE, id: "b", km: "" },
    ],
    8000,
  );

  expect(lignes.map((l) => l.km)).toEqual(["8,0", "12", ""]);
});

test("retoucher la position d'une borne la range à sa nouvelle place", () => {
  const rangs = rangees([
    { ...LIGNE, id: "a", km: "5" },
    { ...LIGNE, id: "b", km: "30" },
    { ...LIGNE, id: "c", km: "12" },
  ]);

  expect(rangs.map((l) => l.id)).toEqual(["a", "c", "b"]);
});

test("une ligne dont la distance n'est pas encore lisible reste en queue", () => {
  const rangs = rangees([
    { ...LIGNE, id: "a", km: "20" },
    { ...LIGNE, id: "b", km: "" },
    { ...LIGNE, id: "c", km: "5" },
  ]);

  expect(rangs.map((l) => l.id)).toEqual(["c", "a", "b"]);
});
