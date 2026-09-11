import { expect, test } from "vitest";
import { shortDate } from "./date";

test("une date s'écrit en jour, mois abrégé et année", () => {
  expect(shortDate(new Date("2026-09-10T08:30:00Z"))).toBe("10 sept. 2026");
});

/** Une action rend un `Date`, un attribut relu rend la chaîne ISO. */
test("la chaîne ISO se lit comme la date qu'elle porte", () => {
  expect(shortDate("2026-01-05T10:00:00.000Z")).toBe("5 janv. 2026");
});

/**
 * La date est celle du lecteur, pas celle de Greenwich : un plan enregistré à
 * 23 h à Paris s'est bien fait le jour où le coureur l'a ouvert. Le fuseau de
 * la suite est fixé dans `vitest.config.ts`, sans quoi ce test dirait la
 * veille à l'ouest de Greenwich.
 */
test("l'heure tardive reste au jour du coureur, pas à celui d'UTC", () => {
  expect(shortDate("2026-09-10T22:30:00.000Z")).toBe("11 sept. 2026");
});
