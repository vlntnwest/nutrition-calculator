import { expect, test } from "vitest";
import config from "./next.config";

test("les en-têtes de sécurité couvrent toutes les routes", async () => {
  const regles = (await config.headers?.()) ?? [];
  const toutes = regles.find((r) => r.source === "/:path*");

  expect(
    Object.fromEntries(toutes?.headers.map((h) => [h.key, h.value]) ?? []),
  ).toEqual({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  });
});
