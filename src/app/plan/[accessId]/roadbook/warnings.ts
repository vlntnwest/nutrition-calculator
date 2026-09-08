import { entier } from "@/format/number";

/**
 * Les remarques du noyau, en français.
 *
 * Le noyau dit ce qu'il a constaté et avec quels chiffres, il n'écrit pas de
 * phrases : c'est ici, et nulle part ailleurs, que ces données deviennent une
 * phrase lisible. La base ne rend le payload que comme du JSON libre, d'où
 * les lectures prudentes.
 */
type Payload = Record<string, unknown>;

function nombre(payload: unknown, cle: string): number | null {
  const valeur = (payload as Payload | null)?.[cle];

  return typeof valeur === "number" && Number.isFinite(valeur) ? valeur : null;
}

/** Une part de 0 à 1 lue en pourcentage entier. */
function pourcent(payload: unknown, cle: string): string | null {
  const part = nombre(payload, cle);

  return part === null ? null : `${Math.round(part * 100)} %`;
}

/**
 * Le ton d'une remarque : alerte par défaut, sauf pour celles qui décrivent un
 * fonctionnement normal plutôt qu'un problème à corriger.
 *
 * `leg-drink-unused` existe pour ne plus faire disparaître ce cas en silence
 * (ADR 007), pas pour le présenter comme une erreur : sur un plan avec une
 * seule boisson, la plupart des secteurs n'en reçoivent aucune dose, et
 * l'afficher en alerte à chaque fois ferait crier au loup partout.
 */
export function warningTon(code: string): "alerte" | "neutre" {
  return code === "leg-drink-unused" ? "neutre" : "alerte";
}

export function warningText(code: string, payload: unknown): string {
  switch (code) {
    case "no-carb-product":
      return "Aucun produit du sac n'apporte de glucides. Le plan ne peut rien répartir.";

    case "carbs-above-guide": {
      const vise = nombre(payload, "carbsGH");
      const guide = nombre(payload, "guideGH");

      return `La cible de ${entier(vise ?? 0)} g de glucides par heure passe au-dessus du repère de ${entier(guide ?? 0)} g/h retenu dans la littérature. Testez-la à l'entraînement avant de l'appliquer en course.`;
    }

    case "carbs-single-source": {
      const vise = nombre(payload, "carbsGH");
      const max = nombre(payload, "maxGH");
      const part = pourcent(payload, "multiShare");

      return `À ${entier(vise ?? 0)} g/h, une seule source de sucre sature vers ${entier(max ?? 0)} g/h${part ? ` et seulement ${part} du sac annonce un mélange` : ""}. Ajoutez un produit qui annonce du glucose et du fructose.`;
    }

    case "fluid-above-guide": {
      const vise = nombre(payload, "fluidMlH");
      const guide = nombre(payload, "guideMlH");

      return `Boire ${entier(vise ?? 0)} mL par heure dépasse le repère de ${entier(guide ?? 0)} mL/h. Au-delà, l'excès d'eau devient le risque principal : redescendez la cible de boisson, ou salez davantage.`;
    }

    case "sodium-below-target": {
      const part = pourcent(payload, "share");

      return `Le sodium reste sous la cible${part ? ` : ${part} de ce qui était visé` : ""}. Une pastille de sel ou une boisson plus salée comble l'écart.`;
    }

    case "carbs-above-target": {
      const part = pourcent(payload, "share");

      return `Le sac apporte plus de glucides que visé${part ? ` : ${part} de la cible` : ""}. Les doses ajoutées à la main ne sont pas redistribuées.`;
    }

    case "leg-fluid-above-target": {
      const apport = nombre(payload, "supplyMl");
      const besoin = nombre(payload, "needMl");

      return `Les produits de ce secteur apportent ${entier(apport ?? 0)} mL de boisson pour un besoin de ${entier(besoin ?? 0)} mL. Le surplus se boira ailleurs, ou se laissera.`;
    }

    case "leg-fluid-above-carry": {
      const requis = nombre(payload, "requiredMl");
      const porte = nombre(payload, "carryMl");

      return `Il faut ${entier(requis ?? 0)} mL d'ici au prochain point d'eau, et les flasques n'en portent que ${entier(porte ?? 0)}. Prévoyez de boire sur place, ou de porter davantage.`;
    }

    case "leg-drink-unused": {
      const eau = nombre(payload, "plainWaterMl");

      return `Aucune dose de boisson glucidique n'entre dans ce secteur : les ${entier(eau ?? 0)} mL partent en eau claire.`;
    }

    case "leg-drink-above-flasks": {
      const boisson = nombre(payload, "drinkMl");
      const capacite = nombre(payload, "capacityMl");

      return `La boisson préparée fait ${entier(boisson ?? 0)} mL, et les flasques qui l'acceptent n'en tiennent que ${entier(capacite ?? 0)}. Une flasque réservée à l'eau claire ne peut pas la recevoir.`;
    }

    default:
      // Un code ajouté au noyau sans phrase ici : mieux vaut le code brut
      // qu'un silence, le coureur peut au moins le rapporter.
      return code;
  }
}
