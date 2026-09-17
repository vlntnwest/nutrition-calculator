import { expect, test } from "vitest";
import config from "./next.config";

test("les en-têtes de sécurité couvrent toutes les routes, et rien ne les écrase", async () => {
  const regles = (await config.headers?.()) ?? [];

  // Une seule règle : Next applique la dernière qui correspond, donc une
  // seconde suffirait à défaire la première sans que rien ne le dise.
  expect(regles).toHaveLength(1);
  expect(regles[0].source).toBe("/:path*");
  expect(
    Object.fromEntries(regles[0].headers.map((h) => [h.key, h.value])),
  ).toEqual({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
  });
});
