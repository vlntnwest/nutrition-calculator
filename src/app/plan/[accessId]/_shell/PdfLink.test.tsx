import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { PdfLink } from "./PdfLink";

const HREF = "/plan/abc/roadbook/pdf";

function rendre(tenue: "icone" | "bouton"): string {
  return renderToStaticMarkup(<PdfLink accessId="abc" tenue={tenue} />);
}

describe("PdfLink", () => {
  test("mène au fichier, dans les deux tenues", () => {
    expect(rendre("bouton")).toContain(`href="${HREF}"`);
    expect(rendre("icone")).toContain(`href="${HREF}"`);
  });

  test("l'icône se nomme, faute de texte", () => {
    expect(rendre("icone")).toContain('aria-label="Télécharger la feuille"');
  });
});
