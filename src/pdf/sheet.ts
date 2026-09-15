import { legBounds, startOf } from "@/app/plan/[accessId]/roadbook/format";
import { warningText } from "@/app/plan/[accessId]/roadbook/warnings";
import type { StoredPlan } from "@/app/plans/planInput";
import type { Roadbook } from "@/app/plans/roadbook";
import type { Targets } from "@/core/type";
import { clockLabel, paceLabel } from "@/format/clock";
import { shortDate } from "@/format/date";
import { duree, ecart, entier, km, quantite } from "@/format/number";
import { formatFr, nomProduit } from "@/format/produit";

/**
 * Le plan calculé, rangé en lignes de feuille.
 *
 * Ce module ne dessine rien : il traduit des nombres en chaînes, une fois,
 * pour que les composants `@react-pdf/renderer` n'aient plus qu'à poser du
 * texte dans des cases. C'est aussi ce qui le rend testable sans rendu.
 *
 * Tout est chaîne, et l'absence s'écrit `""` plutôt que `null` : une case de
 * tableau reçoit du texte, et la faire choisir entre deux types la ferait
 * brancher pour rien.
 */

/** Une ration posée sur un secteur, et ce qu'elle apporte à elle seule. */
export type Ration = {
  quantite: string;
  produit: string;
  marque: string;
  format: string;
  carbs: string;
  sodium: string;
};

export type Secteur = {
  titre: string;
  /**
   * La borne qui clôt le secteur, seule. Le titre la porte déjà avec celle
   * d'où l'on part ; la forme à un tableau n'a la place que de la seconde.
   */
  arrivee: string;
  /** Le repère de cette borne, le même que sur la carte et sur les passages. */
  repere: string;
  km: string;
  duree: string;
  besoin: string;
  apport: string;
  /** L'écart signé aux glucides visés. Vide sous le gramme. */
  ecart: string;
  /** L'heure de passage à la borne qui clôt, et l'arrêt qu'on y fait. */
  passage: string;
  arret: string;
  rations: Ration[];
  avertissements: string[];
};

export type Course = { quantite: string; produit: string; marque: string };

export type Sheet = {
  entete: {
    nom: string;
    date: string;
    depart: string;
    distance: string;
    denivele: string;
    chrono: string;
    allure: string;
  };
  cibles: { carbs: string; boisson: string; sodium: string };
  secteurs: Secteur[];
  courses: Course[];
  totaux: {
    carbs: string;
    ecart: string;
    energie: string;
    sodium: string;
    boisson: string;
    poids: string;
  };
  /** Ceux qui ne visent aucun secteur. Les autres sont sous le leur. */
  avertissements: string[];
};

/**
 * Les signes que les polices intégrées de `@react-pdf/renderer` ne portent
 * pas, et ce qui les remplace.
 *
 * Helvetica et Courier sont encodées en WinAnsi. Il y manque l'espace fine
 * insécable que `toLocaleString("fr-FR")` glisse entre les milliers, le signe
 * moins d'un écart, et la flèche entre deux bornes. Sans conversion, « 6 290
 * m » s'imprime « 6ℓ90 m » : un dénivelé faux, pas une coquille de style.
 *
 * On convertit plutôt que d'embarquer une police : chacun de ces trois signes
 * a un équivalent que WinAnsi porte, et la feuille garde ses polices.
 */
const HORS_WINANSI: [RegExp, string][] = [
  [/[\u2009\u202f]/g, "\u00a0"],
  [/\u2212/g, "-"],
  [/\u2192/g, ">"],
];

export function pdfSafe(texte: string): string {
  return HORS_WINANSI.reduce(
    (suite, [motif, remplacement]) => suite.replace(motif, remplacement),
    texte,
  );
}

/**
 * La conversion passée sur toute la feuille d'un coup, plutôt qu'à chaque
 * endroit qui compose une chaîne. Un seul passage, au dernier moment : rien
 * ne peut y échapper, pas même le texte d'un avertissement ou un champ ajouté
 * plus tard.
 */
function safeDeep<T>(valeur: T): T {
  if (typeof valeur === "string") return pdfSafe(valeur) as T;
  if (Array.isArray(valeur)) return valeur.map(safeDeep) as T;
  if (valeur !== null && typeof valeur === "object") {
    return Object.fromEntries(
      Object.entries(valeur).map(([cle, v]) => [cle, safeDeep(v)]),
    ) as T;
  }

  return valeur;
}

export function sheetOf(
  plan: StoredPlan,
  roadbook: Roadbook,
  cibles: Targets,
): Sheet {
  const { legs, totalM, startTime } = roadbook;
  // La distance du plan, pas celle du roadbook : c'est elle que porte
  // l'en-tête, et l'allure doit se recalculer de tête depuis ce qui est écrit.
  const distanceM = plan.track.distanceM;
  const mouvementS = legs.reduce((total, leg) => total + leg.durationS, 0);
  const heure = (elapsedS: number) =>
    startTime ? clockLabel(startTime, elapsedS) : "";
  const borneM = (leg: Roadbook["legs"][number]) => leg.endPositionM ?? totalM;

  // Composée avec les signes justes, convertie une fois à la sortie.
  return safeDeep({
    entete: {
      nom: plan.track.name,
      date: plan.settings.raceDate ? shortDate(plan.settings.raceDate) : "",
      depart: startTime ?? "",
      distance: km(distanceM),
      denivele: entier(plan.track.ascentM),
      chrono: duree(plan.settings.targetTimeS ?? 0),
      // ADR 010 : les arrêts sont déjà hors du mouvement, la somme des
      // secteurs est donc l'allure réelle et non le chrono divisé.
      allure: paceLabel(mouvementS, distanceM) ?? "",
    },

    cibles: {
      carbs: `${entier(cibles.carbsGH)} g/h`,
      boisson: `${entier(cibles.fluidMlH)} mL/h`,
      sodium: `${entier(cibles.sodiumMgL)} mg/L`,
    },

    secteurs: legs.map((leg, i) => {
      const bornes = legBounds(legs, i);

      return {
        titre: `${bornes.depart} → ${bornes.arrivee}`,
        arrivee: bornes.arrivee,
        repere: i === legs.length - 1 ? "A" : String(i + 1),
        km: `${km(startOf(legs, i))} → ${km(borneM(leg))}`,
        duree: duree(leg.durationS),
        besoin: `${entier(leg.needG)} g`,
        apport: `${entier(leg.supply.carbsG)} g`,
        ecart: ecart(leg.marginG),
        passage: heure(leg.elapsedS),
        arret: leg.stopS === null ? "" : duree(leg.stopS),
        rations: leg.servings.map((r) => ({
          quantite: quantite(r.quantity),
          produit: nomProduit(r.name),
          marque: r.brandName ?? "",
          format: formatFr(r.formatLabel),
          carbs: `${entier(r.carbsG * r.quantity)} g`,
          sodium: `${entier(r.sodiumMg * r.quantity)} mg`,
        })),
        avertissements: leg.warnings.map((w) => warningText(w.code, w.payload)),
      };
    }),

    courses: roadbook.total.units.map((unite) => ({
      quantite: quantite(unite.quantity),
      produit: nomProduit(unite.name),
      marque: unite.brandName ?? "",
    })),

    totaux: {
      carbs: `${entier(roadbook.total.carbsG)} g`,
      ecart: ecart(roadbook.total.marginG),
      energie: `${entier(roadbook.total.energyKcal)} kcal`,
      sodium: `${entier(roadbook.total.sodiumMg)} mg`,
      boisson: `${entier(roadbook.total.fluidMl)} mL`,
      poids: `${entier(roadbook.total.weightG)} g`,
    },

    avertissements: roadbook.warnings.map((w) =>
      warningText(w.code, w.payload),
    ),
  });
}

/**
 * Le nom du fichier téléchargé : `nom-de-la-trace_date.pdf`.
 *
 * Le nom est assaini parce qu'il vient d'un fichier GPX déposé par le
 * coureur, et qu'un nom de course porte accents, apostrophes et barres
 * obliques. Un nom qui ne laisse rien après nettoyage retombe sur
 * `roadbook` : un fichier `_2026-10-11.pdf` ne se retrouve pas dans un
 * dossier de téléchargements.
 */
export function fileNameOf(nom: string, raceDate: string | undefined): string {
  const propre = nom
    .normalize("NFD")
    // Les diacritiques, que `NFD` vient de détacher de leur lettre.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${propre || "roadbook"}${raceDate ? `_${raceDate}` : ""}.pdf`;
}
