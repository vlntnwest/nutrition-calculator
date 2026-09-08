import type { NewPlan } from "@/app/plans/planInput";

/**
 * Les quatre destinations d'un plan, et l'état de chacune.
 *
 * Un plan est un dossier qu'on rouvre, pas un tunnel : le rail ne verrouille
 * rien, il dit seulement où il reste du travail. La pastille vaut pour les
 * trois cas du carnet, vide, remplie, ou à reprendre.
 */
export type Etat = "vide" | "rempli" | "perime";

export type Destination = {
  /** Le segment de route sous `/plan/[accessId]`, vide pour l'écran Course. */
  segment: "" | "cibles" | "produits" | "roadbook";
  nom: string;
  etat: Etat;
  /** Ce qui se lit sous le nom : un compte, un reste à faire. */
  mention?: string;
};

/** Le plan porte-t-il tout ce qu'il faut pour lancer un calcul ? */
export function calculable(plan: NewPlan): boolean {
  return (
    plan.settings.targetTimeS !== undefined &&
    plan.settings.massKg !== undefined &&
    plan.productCodes.length > 0
  );
}

export function destinations(
  plan: NewPlan,
  roadbookCalcule: boolean,
): Destination[] {
  const ravitos = plan.aidStations.length;
  const produits = plan.productCodes.length;

  return [
    {
      segment: "",
      nom: "Course",
      etat: plan.settings.targetTimeS === undefined ? "vide" : "rempli",
      mention:
        ravitos === 0
          ? "aucun ravito"
          : `${ravitos} ravito${ravitos > 1 ? "s" : ""}`,
    },
    {
      segment: "cibles",
      nom: "Cibles",
      etat: plan.settings.targets === undefined ? "vide" : "rempli",
      mention:
        plan.flasks.length === 0
          ? "aucune flasque"
          : `${plan.flasks.length} flasque${plan.flasks.length > 1 ? "s" : ""}`,
    },
    {
      segment: "produits",
      nom: "Produits",
      etat: produits === 0 ? "vide" : "rempli",
      mention: produits === 0 ? "sac vide" : `${produits} dans le sac`,
    },
    {
      segment: "roadbook",
      nom: "Roadbook",
      etat: roadbookCalcule ? "rempli" : calculable(plan) ? "perime" : "vide",
      mention: roadbookCalcule
        ? undefined
        : calculable(plan)
          ? "à calculer"
          : "incomplet",
    },
  ];
}
