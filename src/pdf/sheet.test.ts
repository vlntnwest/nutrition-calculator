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

describe("passages", () => {
  test("porte une ligne de plus qu'il n'y a de secteurs", () => {
    const deux = roadbook({
      legs: [
        leg({ rank: 1, endPositionM: 9800 }),
        leg({ rank: 2, endPositionM: null, elapsedS: 9000 }),
      ],
    });

    expect(sheetOf(plan(), deux, CIBLES).passages).toHaveLength(3);
  });

  test("numérote les bornes comme la carte les marque", () => {
    const trois = roadbook({
      legs: [
        leg({ rank: 1, endPositionM: 9800 }),
        leg({ rank: 2, endPositionM: 20800 }),
        leg({ rank: 3, endPositionM: null }),
      ],
    });

    expect(
      sheetOf(plan(), trois, CIBLES).passages.map((p) => p.repere),
    ).toEqual(["D", "1", "2", "A"]);
  });

  test("ouvre sur le départ, à zéro kilomètre et sans durée", () => {
    const [depart] = sheetOf(plan(), roadbook(), CIBLES).passages;

    expect(depart.borne).toBe("Départ");
    expect(depart.km).toBe("0,0");
    expect(depart.duree).toBe("");
  });

  test("donne au départ l'heure de départ pour heure de passage", () => {
    const [depart] = sheetOf(
      plan(),
      roadbook({ startTime: "08:00" }),
      CIBLES,
    ).passages;

    expect(depart.passage).toBe("08 h 00");
  });

  test("laisse l'heure de passage vide quand la course n'a pas d'heure", () => {
    const sheet = sheetOf(plan(), roadbook({ startTime: null }), CIBLES);

    expect(sheet.passages.every((p) => p.passage === "")).toBe(true);
  });

  test("nomme Arrivée la borne que rien ne clôt", () => {
    // Le dernier secteur porte `endPositionM: null` : rien ne le clôt.
    const sheet = sheetOf(
      plan(),
      roadbook({ legs: [leg({ endPositionM: null })] }),
      CIBLES,
    );

    expect(sheet.passages.at(-1)?.borne).toBe("Arrivée");
  });

  test("retombe sur le kilomètre quand le ravito n'a pas de nom", () => {
    const deux = roadbook({
      legs: [
        leg({ rank: 1, endPositionM: 9800, endName: null }),
        leg({ rank: 2, endPositionM: null }),
      ],
    });

    expect(sheetOf(plan(), deux, CIBLES).passages[1].borne).toBe("9,8 km");
  });

  test("écrit la durée du secteur qui mène à la borne, et son arrêt", () => {
    const sheet = sheetOf(
      plan(),
      roadbook({
        legs: [leg({ durationS: 4500, stopS: 300, endName: "Haberacker" })],
      }),
      CIBLES,
    );

    expect(sheet.passages[1]).toMatchObject({
      borne: "Haberacker",
      duree: "1 h 15",
      arret: "5 min",
      denivele: "+420 / -180",
    });
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
