import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { PdfTrigger } from "./PdfLink";

const HREF = "/plan/abc/roadbook/pdf";

/**
 * Seule la décision se teste ici — mener au fichier, ou refuser. La lecture
 * du contexte vit dans `PdfLink`, qui n'a rien d'autre à faire.
 */
function rendre(tenue: "icone" | "bouton", sale: boolean): string {
  return renderToStaticMarkup(
    <PdfTrigger accessId="abc" tenue={tenue} sale={sale} />,
  );
}

describe("PdfTrigger", () => {
  test("mène au fichier quand rien n'attend d'être enregistré", () => {
    expect(rendre("bouton", false)).toContain(`href="${HREF}"`);
    expect(rendre("icone", false)).toContain(`href="${HREF}"`);
  });

  test("refuse de partir tant qu'il reste des retouches", () => {
    // La feuille ne rend que l'état de la base : un lien qui marcherait
    // téléchargerait autre chose que ce qui est à l'écran.
    expect(rendre("bouton", true)).not.toContain("href=");
    expect(rendre("bouton", true)).toContain("disabled");
    expect(rendre("icone", true)).not.toContain("href=");
  });

  test("dit ce qui bloque et ce qui débloque", () => {
    expect(rendre("icone", true)).toContain("Enregistrez les retouches");
  });
});
