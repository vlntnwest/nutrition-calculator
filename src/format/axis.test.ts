import { describe, expect, test } from "vitest";
import { graduations } from "./axis";

describe("graduations", () => {
  test("tombe sur des valeurs rondes", () => {
    expect(graduations(0, 1000, 4)).toEqual([0, 250, 500, 750, 1000]);
  });

  test("reste dans l'intervalle demandé", () => {
    for (const valeur of graduations(137, 892, 4)) {
      expect(valeur).toBeGreaterThanOrEqual(137);
      expect(valeur).toBeLessThanOrEqual(892);
    }
  });

  test("en pose au moins deux sur un intervalle étroit", () => {
    expect(graduations(100, 100.5, 4).length).toBeGreaterThanOrEqual(2);
  });

  test("ne diverge pas sur un intervalle nul", () => {
    expect(graduations(200, 200, 4)).toEqual([200]);
  });
});
