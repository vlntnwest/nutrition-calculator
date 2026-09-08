import type { Roadbook, Supply } from "@/app/plans/getRoadbook";
import type { RoadbookEdit } from "@/app/plans/saveRoadbook";
import { CARBS_OVERSHOOT_MAX } from "@/core/nutrition";
import { km } from "@/format/number";
import type { PaceBand } from "@/ui/track/ElevationChart";

const APPORT_VIDE: Supply = {
  carbsG: 0,
  energyKcal: 0,
  sodiumMg: 0,
  fluidMl: 0,
};

/**
 * L'apport d'un secteur recalculé depuis les retouches, sans attendre
 * l'enregistrement — la même somme que fait `assemble()` au noyau, sur les
 * mêmes instantanés. Un produit disparu du catalogue (jamais le cas en
 * pratique, la retouche ne peut poser que ce que le catalogue liste) ne
 * compte pour rien plutôt que de faire planter la carte.
 */
export function liveSupply(
  rations: RoadbookEdit["servings"][number],
  catalogue: Roadbook["catalogue"],
): Supply {
  return rations.reduce((s, r) => {
    const produit = catalogue.find((p) => p.id === r.productSnapshotId);
    if (!produit) return s;

    return {
      carbsG: s.carbsG + r.quantity * produit.carbsG,
      energyKcal: s.energyKcal + r.quantity * produit.energyKcal,
      sodiumMg: s.sodiumMg + r.quantity * produit.sodiumMg,
      fluidMl: s.fluidMl + r.quantity * produit.fluidMl,
    };
  }, APPORT_VIDE);
}

/**
 * Ce qu'il y a réellement à boire sur un secteur : la boisson dosée par les
 * rations, plus l'eau claire réellement versée dans les flasques à
 * l'ouverture de la portée.
 *
 * `supply.fluidMl` (ci-dessus) ne compte que la boisson glucidique — c'est
 * voulu, `PackSummary` l'affiche sous « boisson » et mélanger l'eau claire
 * dedans fausserait ce chiffre-là. Mais comparé au besoin d'un secteur, ne
 * compter que la boisson fait passer pour un manque de l'eau claire pourtant
 * déjà déclarée dans les flasques : deux flasques d'eau couvrent le besoin
 * aussi bien qu'une flasque de boisson.
 *
 * `remplissages` n'existe qu'à l'ouverture d'une portée (voir `editOf` dans
 * `RoadbookEditor`) : ailleurs, il est vide et cette fonction ne rend que la
 * boisson, comme avant — un secteur au milieu d'une portée n'a pas encore de
 * remplissage à lui montrer, pas plus qu'il n'en avait.
 */
export function liveFluidCoverage(
  rations: RoadbookEdit["servings"][number],
  remplissages: RoadbookEdit["fills"][number],
  catalogue: Roadbook["catalogue"],
): number {
  const eauClaire = remplissages
    .filter((f) => f.productSnapshotId === null)
    .reduce((t, f) => t + f.volumeMl, 0);

  return liveSupply(rations, catalogue).fluidMl + eauClaire;
}

/**
 * Le sac complet recalculé depuis les retouches de tous les secteurs, dans la
 * même forme que `Roadbook["total"]` : c'est ce qui permet à `PackSummary` de
 * ne pas savoir si ce qu'on lui donne vient du serveur ou de la saisie en
 * cours.
 */
export function liveTotal(
  servings: RoadbookEdit["servings"],
  needsG: number[],
  catalogue: Roadbook["catalogue"],
): Roadbook["total"] {
  const supplies = servings.map((rations) => liveSupply(rations, catalogue));
  const carbsG = supplies.reduce((t, s) => t + s.carbsG, 0);

  const unites = new Map<
    string,
    { brandName: string | null; quantity: number }
  >();
  let weightG = 0;
  for (const rations of servings) {
    for (const r of rations) {
      const produit = catalogue.find((p) => p.id === r.productSnapshotId);
      if (!produit) continue;

      weightG += r.quantity * produit.weightG;
      const vu = unites.get(produit.name);
      unites.set(produit.name, {
        brandName: produit.brandName,
        quantity: (vu?.quantity ?? 0) + r.quantity,
      });
    }
  }

  return {
    carbsG,
    energyKcal: supplies.reduce((t, s) => t + s.energyKcal, 0),
    sodiumMg: supplies.reduce((t, s) => t + s.sodiumMg, 0),
    fluidMl: supplies.reduce((t, s) => t + s.fluidMl, 0),
    marginG: carbsG - needsG.reduce((t, n) => t + n, 0),
    weightG,
    units: [...unites].map(([name, v]) => ({ name, ...v })),
  };
}

/** Là où le secteur s'achève, nommé quand un ravito le clôt. */
export function bound(leg: Roadbook["legs"][number], totalM: number): string {
  return leg.endPositionM === null
    ? `arrivée, ${km(totalM)} km`
    : `${km(leg.endPositionM)} km`;
}

/**
 * L'écart mérite-t-il d'être signalé ?
 *
 * Seulement vers le haut : un secteur sous son besoin propre est prévu par
 * l'ADR 007, les solides se comptant sur la course puis se plaçant. Le seuil
 * est celui du contrôle global — mesuré, un plan calculé reste sous 1,1 quand
 * une retouche peut tripler.
 */
export function excessive(supplyG: number, needG: number): boolean {
  return needG > 0 && supplyG > needG * CARBS_OVERSHOOT_MAX;
}

/** L'abscisse où le secteur commence : la borne qui clôt le précédent. */
export function startOf(legs: Roadbook["legs"], index: number): number {
  return index === 0 ? 0 : (legs[index - 1].endPositionM ?? 0);
}

/**
 * L'allure moyenne d'un secteur, en secondes par kilomètre. C'est du temps de
 * mouvement : les arrêts au ravito ne sont pas dedans.
 */
export function legPaceSPerKm(
  legs: Roadbook["legs"],
  index: number,
  totalM: number,
): number | null {
  const leg = legs[index];
  const distanceM = (leg.endPositionM ?? totalM) - startOf(legs, index);

  return distanceM > 0 && leg.durationS > 0
    ? leg.durationS / (distanceM / 1000)
    : null;
}

/**
 * L'allure des secteurs, dans la forme que `paceBand` produit sur l'écran
 * Course — même dégradé sur le relief, même moyenne. `null` si aucun secteur
 * n'a d'allure lisible (une trace sans distance, par exemple).
 */
export function legPaceBand(
  legs: Roadbook["legs"],
  totalM: number,
): PaceBand | null {
  const segments = legs.flatMap((leg, i) => {
    const sPerKm = legPaceSPerKm(legs, i, totalM);

    return sPerKm === null
      ? []
      : [
          {
            startM: startOf(legs, i),
            endM: leg.endPositionM ?? totalM,
            sPerKm,
          },
        ];
  });

  if (segments.length === 0 || totalM <= 0) return null;

  const paces = segments.map((s) => s.sPerKm);
  const movingS = legs.reduce((t, l) => t + l.durationS, 0);

  return {
    segments,
    meanSPerKm: movingS / (totalM / 1000),
    slowestSPerKm: Math.max(...paces),
    fastestSPerKm: Math.min(...paces),
  };
}

/**
 * Ce qui se verse dans une flasque.
 *
 * Une flasque contient une boisson, et rien d'autre : une poudre à diluer, un
 * liquide à couper. Un gel, une barre, une gaufre se mangent — les proposer
 * au remplissage laissait poser une barre dans cinq cents millilitres, et le
 * calcul comptait alors ses glucides comme bus. Une capsule ne s'y verse pas
 * davantage : elle s'avale avec l'eau, elle ne la prépare pas.
 *
 * La liste nomme ce qui passe plutôt que ce qui ne passe pas, sur les
 * libellés du noyau (`src/format/produit.ts`) : un format nouveau ne se
 * retrouve pas versable par oubli.
 */
const VERSABLES = new Set(["drink"]);

export function estVersable(formatLabel: string): boolean {
  return VERSABLES.has(formatLabel);
}
