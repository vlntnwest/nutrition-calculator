import { expect, test } from "vitest";
import { newPlan as input } from "./newPlan.fixture";
import { assertValid, normalise } from "./planInput";

/** Le plan de la fixture, dont on abîme la trace. */
const avec = (track: Partial<typeof input.track>) => ({
  ...input,
  track: { ...input.track, ...track },
});

test.each([
  ["un profil vide", { profile: [] }, "empty"],
  [
    "un profil qui n'est pas une suite d'objets",
    { profile: [42, null, "x"] as never },
    "profile",
  ],
  [
    "une altitude qui n'est pas un nombre",
    { profile: [{ d: 0, ele: "haut" }] as never },
    "profile",
  ],
  [
    "une distance non finie",
    {
      profile: [
        { d: 0, ele: 200 },
        { d: Number.NaN, ele: 210 },
      ],
    },
    "profile",
  ],
  [
    "un profil qui recule",
    {
      profile: [
        { d: 0, ele: 200 },
        { d: 5000, ele: 210 },
        { d: 3000, ele: 205 },
      ],
    },
    "increasing",
  ],
  ["des points vides", { points: [] }, "empty"],
  [
    "un point sans coordonnées",
    { points: [{ d: 0, ele: 200 }] as never },
    "points",
  ],
])("%s est refusé", (_, track, motif) => {
  expect(() => assertValid(normalise(avec(track)))).toThrow(
    new RegExp(motif, "i"),
  );
});

test("la trace de la fixture passe", () => {
  expect(() => assertValid(normalise(input))).not.toThrow();
});

/**
 * Le cas qui a mis le doigt dessus : `jsonb` accepte n'importe quelle forme et
 * `$type<>` est effacé à la compilation. Ce qui part en base doit donc être
 * réduit ici, quelle que soit la source.
 */
test("le profil est réduit à ses deux clés", () => {
  const sale = avec({
    profile: [
      { d: 0, ele: 200, lat: 48.7, lon: 7.3, intrus: true },
      { d: 10, ele: 201, lat: 48.7, lon: 7.3 },
    ] as never,
  });

  expect(normalise(sale).track.profile).toEqual([
    { d: 0, ele: 200 },
    { d: 10, ele: 201 },
  ]);
});

test("un point est réduit à ses quatre clés", () => {
  const sale = avec({
    points: [{ d: 0, lat: 48.7, lon: 7.3, ele: 200, intrus: "x" }] as never,
  });

  expect(normalise(sale).track.points).toEqual([
    { d: 0, lat: 48.7, lon: 7.3, ele: 200 },
  ]);
});
