import { expect, test } from "vitest";
import { gradePercent, slopeColor } from "./slopeColor";

test.each([
  [0, "#fbe7d9"],
  [4.9, "#fbe7d9"],
  [5, "#fbe7d9"],
  [5.1, "#eeb27a"],
  [7, "#eeb27a"],
  [9.9, "#c2410c"],
  [12, "#7a2c08"],
  [20, "#3a1306"],
  // Une descente est aussi raide qu'une montée du même pourcentage.
  [-20, "#3a1306"],
])("slopeColor(%o) → %o", (pente, attendu) => {
  expect(slopeColor(pente)).toBe(attendu);
});

test.each([
  [{ d: 0, ele: 100 }, { d: 100, ele: 110 }, 10],
  [{ d: 0, ele: 100 }, { d: 200, ele: 80 }, -10],
  [{ d: 0, ele: 100 }, { d: 0, ele: 110 }, undefined],
])("gradePercent(%o, %o) → %o", (a, b, attendu) => {
  expect(gradePercent(a, b)).toBe(attendu);
});
