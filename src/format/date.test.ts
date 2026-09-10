import { expect, test } from "vitest";
import { shortDate } from "./date";

test("une date s'écrit en jour, mois abrégé et année", () => {
  expect(shortDate(new Date("2026-09-10T08:30:00Z"))).toBe("10 sept. 2026");
});

/** Une action rend un `Date`, un attribut relu rend la chaîne ISO. */
test("la chaîne ISO se lit comme la date qu'elle porte", () => {
  expect(shortDate("2026-01-05T10:00:00.000Z")).toBe("5 janv. 2026");
});
