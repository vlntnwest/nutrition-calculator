import { beforeEach, expect, test, vi } from "vitest";
import { forgetPlan, rememberPlan, storedPlans } from "./stored";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
  });
});

test("une liste vide au départ", () => {
  expect(storedPlans()).toEqual([]);
});

test("le plus récent d'abord, sans doublon", () => {
  rememberPlan("a");
  rememberPlan("b");
  rememberPlan("a");

  expect(storedPlans()).toEqual(["a", "b"]);
});

test("oublier un plan le retire", () => {
  rememberPlan("a");
  rememberPlan("b");
  forgetPlan("a");

  expect(storedPlans()).toEqual(["b"]);
});

test("une entrée illisible ne plante pas", () => {
  store.set("plans", "{pas du json");

  expect(storedPlans()).toEqual([]);
});

test("une entrée qui n'est pas une liste de textes est filtrée", () => {
  store.set("plans", JSON.stringify(["a", 42, null, "b"]));

  expect(storedPlans()).toEqual(["a", "b"]);
});
