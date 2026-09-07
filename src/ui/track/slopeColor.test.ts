import { expect, test } from "vitest";
import { gradePercent, slopeColor } from "./slopeColor";

test.each([
  [0, "#d9d9d9"],
  [4.9, "#d9d9d9"],
  [5, "#d9d9d9"],
  [5.1, "#a8a8a8"],
  [7, "#a8a8a8"],
  [9.9, "#787878"],
  [12, "#454545"],
  [20, "#000000"],
  // Une descente est aussi raide qu'une montée du même pourcentage.
  [-20, "#000000"],
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
