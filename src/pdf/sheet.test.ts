import { describe, expect, test } from "vitest";
import { leg, roadbook } from "@/app/plan/[accessId]/roadbook/roadbook.fixture";
import { storedPlan } from "@/app/plans/newPlan.fixture";
import type { StoredPlan } from "@/app/plans/planInput";
import type { Targets } from "@/core/type";
import { fileNameOf, pdfSafe, sheetOf } from "./sheet";

const CIBLES: Targets = { carbsGH: 60, fluidMlH: 490, sodiumMgL: 600 };

function plan(patch: Partial<StoredPlan["settings"]> = {}): StoredPlan {
  return { ...storedPlan, settings: { ...storedPlan.settings, ...patch } };
}

describe("fileNameOf", () => {
  test("accole la date de course au nom assaini", () => {
    expect(fileNameOf("Saverne Trail", "2026-10-11")).toBe(
      "saverne-trail_2026-10-11.pdf",
    );
  });

  test("déplie les accents et fond la ponctuation en tirets", () => {
    expect(fileNameOf("Côte & Vallée / Étape 1", undefined)).toBe(
      "cote-vallee-etape-1.pdf",
    );
  });

  test("garde le seul nom quand la course n'a pas de date", () => {
    expect(fileNameOf("Saverne Trail", undefined)).toBe("saverne-trail.pdf");
  });

  test("retombe sur un nom générique quand il ne reste rien à assainir", () => {
    expect(fileNameOf("///", undefined)).toBe("roadbook.pdf");
  });
});

describe("secteurs", () => {
  test("titre un secteur par ses deux bornes", () => {
    const sheet = sheetOf(
      plan(),
      roadbook({ legs: [leg({ endName: "Haberacker" })] }),
      CIBLES,
    );

    expect(sheet.secteurs[0].titre).toBe("Départ > Haberacker");
  });

  test("porte la borne qui le clôt, pour la forme à un tableau", () => {
    // La forme « un tableau » fond les deux tableaux en un : chaque secteur
    // doit donc porter lui-même ce que sa ligne de passage disait, plutôt que
    // de faire coïncider deux listes par leur indice.
    const sheet = sheetOf(
      plan(),
      roadbook({
        startTime: "08:00",
        legs: [
          leg({ rank: 1, endName: "Haberacker", stopS: 300 }),
          leg({ rank: 2, endPositionM: null, elapsedS: 9300 }),
        ],
      }),
      CIBLES,
    );

    expect(sheet.secteurs[0]).toMatchObject({
      repere: "1",
      arrivee: "Haberacker",
      passage: "09 h 15",
      arret: "5 min",
    });
    expect(sheet.secteurs[1]).toMatchObject({
      repere: "A",
      arrivee: "Arrivée",
      arret: "",
    });
  });

  test("laisse l'heure de passage vide quand la course n'a pas d'heure", () => {
    const sheet = sheetOf(plan(), roadbook({ startTime: null }), CIBLES);

    expect(sheet.secteurs.every((s) => s.passage === "")).toBe(true);
  });

  test("signe l'écart aux glucides visés", () => {
    const sheet = sheetOf(
      plan(),
      roadbook({ legs: [leg({ needG: 75, marginG: -12.4 })] }),
      CIBLES,
    );

    expect(sheet.secteurs[0].ecart).toBe("-12 g");
  });

  test("détaille chaque ration en quantité, produit et apport", () => {
    const sheet = sheetOf(
      plan(),
      roadbook({
        legs: [
          leg({
            servings: [
              {
                productSnapshotId: "gel-1",
                name: "Gel citron",
                brandName: "Marque",
                quantity: 1.5,
                divisibleBy: 2,
                formatLabel: "gel",
                carbsG: 25,
                sodiumMg: 50,
                weightG: 40,
              },
            ],
          }),
        ],
      }),
      CIBLES,
    );

    expect(sheet.secteurs[0].rations[0]).toMatchObject({
      quantite: "1,5",
      produit: "Gel citron",
      marque: "Marque",
      format: "gel",
      carbs: "38 g",
      sodium: "75 mg",
    });
  });

  test("rend lisibles les avertissements du secteur", () => {
    const sheet = sheetOf(
      plan(),
      roadbook({
        legs: [leg({ warnings: [{ code: "carbs-above-guide", payload: {} }] })],
      }),
      CIBLES,
    );

    expect(sheet.secteurs[0].avertissements[0]).not.toBe("");
  });
});

describe("l'en-tête et le sac", () => {
  test("reprend l'identité de la course", () => {
    const sheet = sheetOf(plan(), roadbook(), CIBLES);

    expect(sheet.entete).toMatchObject({
      nom: "Saverne Trail",
      distance: "28,4",
      denivele: "1\u00a0314",
      chrono: "3 h 45",
    });
  });

  test("donne l'allure moyenne de mouvement, arrêts déduits", () => {
    // 13 500 s visées, 540 s d'arrêt, sur 28,35 km : 4'34 au kilomètre.
    const sheet = sheetOf(
      plan(),
      roadbook({ legs: [leg({ durationS: 12960 })] }),
      CIBLES,
    );

    expect(sheet.entete.allure).toBe("7'37");
  });

  test("dresse la liste de courses depuis le sac complet", () => {
    const sheet = sheetOf(
      plan(),
      roadbook({
        total: {
          carbsG: 210,
          energyKcal: 840,
          sodiumMg: 900,
          fluidMl: 1000,
          marginG: -12,
          weightG: 320,
          units: [{ name: "Gel citron", brandName: "Marque", quantity: 3 }],
        },
      }),
      CIBLES,
    );

    expect(sheet.courses).toEqual([
      { quantite: "3", produit: "Gel citron", marque: "Marque" },
    ]);
    expect(sheet.totaux).toMatchObject({ carbs: "210 g", poids: "320 g" });
  });
});

describe("pdfSafe", () => {
  test("ramène l'espace fine insécable à l'espace insécable", () => {
    expect(pdfSafe("6\u202f290 m")).toBe("6\u00a0290 m");
  });

  test("ramène le signe moins au trait d'union", () => {
    expect(pdfSafe("\u2212545")).toBe("-545");
  });

  test("ramène la flèche au chevron", () => {
    expect(pdfSafe("Départ \u2192 Arrivée")).toBe("Départ > Arrivée");
  });

  test("laisse intact ce que WinAnsi porte déjà", () => {
    expect(pdfSafe("Côte · 45 % · +9 g")).toBe("Côte · 45 % · +9 g");
  });

  test("ne laisse aucun caractère absent des polices intégrées dans la feuille", () => {
    const sheet = sheetOf(
      plan(),
      roadbook({
        legs: [leg({ endName: "Haberacker", marginG: -12.4 })],
        total: {
          carbsG: 6290,
          energyKcal: 0,
          sodiumMg: 0,
          fluidMl: 0,
          marginG: 0,
          weightG: 1314,
          units: [],
        },
      }),
      CIBLES,
    );

    expect(JSON.stringify(sheet)).not.toMatch(/[\u2009\u202f\u2212\u2192]/);
  });
});
