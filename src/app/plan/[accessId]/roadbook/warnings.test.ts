import { expect, test } from "vitest";
import { warningEnum } from "@/db/schema/warnings";
import { warningText } from "./warnings";

test("les dix codes de la base ont tous une phrase", () => {
  for (const code of warningEnum.enumValues) {
    const phrase = warningText(code, {});

    expect(phrase).not.toBe(code);
    expect(phrase.length).toBeGreaterThan(20);
  }
});

test("les chiffres du noyau entrent dans la phrase", () => {
  expect(warningText("carbs-above-guide", { carbsGH: 110, guideGH: 90 })).toBe(
    "La cible de 110 g de glucides par heure passe au-dessus du repère de 90 g/h retenu dans la littérature. Rien ne l'interdit, mais cela se teste à l'entraînement.",
  );
});

test("une part de 0 à 1 se lit en pourcentage", () => {
  expect(warningText("carbs-above-target", { share: 1.42 })).toContain("142 %");
});

test("un payload absent ne casse pas la phrase", () => {
  expect(warningText("sodium-below-target", null)).toContain("sous la cible");
});

test("un code inconnu ressort tel quel plutôt que de disparaître", () => {
  expect(warningText("code-invente", {})).toBe("code-invente");
});
