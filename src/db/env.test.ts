import { describe, expect, test } from "vitest";
import { withVerifiedSsl } from "./env";

const NEON = "postgresql://u:p%40ss@ep-x.eu-central-1.aws.neon.tech/neondb";

describe("withVerifiedSsl", () => {
  test.each([
    "prefer",
    "require",
    "verify-ca",
  ])("écrit verify-full à la place de %s, que pg lit déjà ainsi", (mode) => {
    expect(withVerifiedSsl(`${NEON}?sslmode=${mode}`)).toBe(
      `${NEON}?sslmode=verify-full`,
    );
  });

  test("garde les autres paramètres et le mot de passe encodé", () => {
    expect(
      withVerifiedSsl(`${NEON}?channel_binding=require&sslmode=require&x=1`),
    ).toBe(`${NEON}?channel_binding=require&sslmode=verify-full&x=1`);
  });

  test("laisse ce qui ne demande rien, ou demande autre chose", () => {
    for (const url of [
      "postgresql://postgres:postgres@localhost:5432/nutrition-calculator",
      `${NEON}?sslmode=verify-full`,
      `${NEON}?sslmode=disable`,
      `${NEON}?uselibpqcompat=true&sslmode=require`,
    ]) {
      expect(withVerifiedSsl(url)).toBe(url);
    }
  });
});
