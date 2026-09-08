import type { CatalogueEntry } from "@/app/plans/catalogue";

/**
 * Ce qui reste du catalogue une fois la recherche et les filtres appliqués.
 *
 * Les facettes se cumulent entre elles et s'additionnent à l'intérieur d'une
 * même facette : deux marques cochées élargissent, une marque plus un format
 * restreignent.
 */
export type Filtres = {
  recherche: string;
  formats: string[];
  marques: string[];
  /** L'identifiant d'un palier de glucides, ou null pour tous. */
  palier: string | null;
};

export const FILTRES_VIDES: Filtres = {
  recherche: "",
  formats: [],
  marques: [],
  palier: null,
};

/**
 * Les paliers de glucides par dose. Coupés là où le catalogue se sépare
 * vraiment : une gaufre et un gel ne jouent pas le même rôle dans un sac.
 */
export const PALIERS = [
  { id: "moins-25", nom: "moins de 25 g", garde: (g: number) => g < 25 },
  {
    id: "25-40",
    nom: "de 25 à 40 g",
    garde: (g: number) => g >= 25 && g <= 40,
  },
  { id: "plus-40", nom: "plus de 40 g", garde: (g: number) => g > 40 },
];

/** Sans accent ni casse : « purée » se trouve en tapant « puree ». */
function pliable(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function filtrer(
  catalogue: CatalogueEntry[],
  filtres: Filtres,
): CatalogueEntry[] {
  const recherche = pliable(filtres.recherche.trim());
  const palier = PALIERS.find((p) => p.id === filtres.palier);

  return catalogue.filter((produit) => {
    if (
      recherche !== "" &&
      !pliable(
        `${produit.brandName} ${produit.name} ${produit.formatLabel}`,
      ).includes(recherche)
    ) {
      return false;
    }
    if (
      filtres.formats.length > 0 &&
      !filtres.formats.includes(produit.formatLabel)
    ) {
      return false;
    }
    if (
      filtres.marques.length > 0 &&
      !filtres.marques.includes(produit.brandName)
    ) {
      return false;
    }

    return palier === undefined || palier.garde(produit.carbsG);
  });
}

export function aucunFiltre(filtres: Filtres): boolean {
  return (
    filtres.recherche.trim() === "" &&
    filtres.formats.length === 0 &&
    filtres.marques.length === 0 &&
    filtres.palier === null
  );
}

/** Coche ou décoche une valeur dans une facette à choix multiple. */
export function bascule(liste: string[], valeur: string): string[] {
  return liste.includes(valeur)
    ? liste.filter((v) => v !== valeur)
    : [...liste, valeur];
}
