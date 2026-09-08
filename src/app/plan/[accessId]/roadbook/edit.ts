import type { Roadbook } from "@/app/plans/getRoadbook";
import type { RoadbookEdit } from "@/app/plans/saveRoadbook";
import { pouredUnits, spanIndexes, spanStart } from "./format";

/**
 * Les deux transitions d'un roadbook retouché.
 *
 * Le noyau reçoit rations et remplissages comme deux entrées indépendantes
 * (`saveRoadbook`) : rien là-bas n'empêche une boisson posée sur un secteur
 * qu'aucune flasque ne verse, ni une flasque versée d'une boisson qu'aucune
 * ration ne compte. C'est ici que les deux se tiennent d'accord.
 *
 * Le périmètre est la **portée**, pas le secteur : les flasques se remplissent
 * à son ouverture et ce qu'elles portent se boit sur tous les secteurs
 * qu'elle couvre.
 */

type Produit = Roadbook["catalogue"][number];
type Flasques = Roadbook["flasks"];
type Remplissages = RoadbookEdit["fills"][number];

/**
 * Pose une quantité sur un secteur. À zéro, la ration disparaît.
 *
 * Un solide se pose là où on le pose. Une boisson, elle, ne vit que dans une
 * flasque : la quantité se traduit en volume, les flasques se versent pour le
 * couvrir, et la ration retombe sur ce qu'elles portent vraiment. Demander
 * plus que les flasques ne tiennent ne fait donc rien — le stepper le sait et
 * s'y arrête (`flaskCapacityUnits`).
 */
export function withServing(
  edit: RoadbookEdit,
  legs: Roadbook["legs"],
  catalogue: Roadbook["catalogue"],
  flasks: Flasques,
  leg: number,
  snapshotId: string,
  quantity: number,
): RoadbookEdit {
  const produit = catalogue.find((p) => p.id === snapshotId);
  if (!produit || produit.fluidMl <= 0) {
    return {
      ...edit,
      servings: posee(edit.servings, leg, snapshotId, quantity),
    };
  }

  // Les flasques d'un secteur au milieu d'une portée sont à son ouverture :
  // c'est là que la boisson se prépare, et donc là qu'elle se compte.
  const ouverture = spanStart(legs, leg);
  const portee = spanIndexes(legs, ouverture);
  const fills = edit.fills.map((remplissages, l) =>
    l === ouverture
      ? poured(flasks, remplissages, snapshotId, quantity * produit.fluidMl)
      : remplissages,
  );

  return {
    ...edit,
    fills,
    servings: alignedToFills(
      edit.servings,
      portee,
      ouverture,
      fills[ouverture],
      snapshotId,
      catalogue,
    ),
  };
}

/** Pose une quantité dans la liste d'un secteur, sur place. À zéro, elle sort. */
function posee(
  servings: RoadbookEdit["servings"],
  leg: number,
  snapshotId: string,
  quantity: number,
): RoadbookEdit["servings"] {
  return servings.map((rations, l) => {
    if (l !== leg) return rations;
    if (quantity <= 0) {
      return rations.filter((r) => r.productSnapshotId !== snapshotId);
    }

    // Retouchée sur place : la renvoyer en queue faisait sauter le produit en
    // bas de la carte à chaque frappe du stepper.
    const presente = rations.some((r) => r.productSnapshotId === snapshotId);

    return presente
      ? rations.map((r) =>
          r.productSnapshotId === snapshotId ? { ...r, quantity } : r,
        )
      : [...rations, { productSnapshotId: snapshotId, quantity }];
  });
}

/**
 * Verse un produit dans les flasques jusqu'à couvrir un volume.
 *
 * Celles qui le versent déjà servent en premier : sans quoi ajouter une dose
 * déplacerait la boisson d'une flasque à l'autre sous l'œil du coureur. Les
 * autres candidates sont les libres et celles à l'eau claire — jamais une
 * flasque « eau seulement », ni une qui porte une autre boisson, qu'on
 * jetterait en silence.
 *
 * Ce qui n'est plus nécessaire repasse à l'eau claire : la flasque reste
 * emportée, elle ne se vide pas parce que sa boisson a maigri.
 */
function poured(
  flasks: Flasques,
  remplissages: Remplissages,
  snapshotId: string,
  volumeMl: number,
): Remplissages {
  const contenuDe = (rank: number) =>
    remplissages.find((f) => f.flaskRank === rank);
  const candidates = [
    ...flasks.filter(
      (f) => contenuDe(f.rank)?.productSnapshotId === snapshotId,
    ),
    ...flasks.filter((f) => libre(f, contenuDe(f.rank))),
  ];

  const versees = new Set<number>();
  let reste = volumeMl;
  for (const f of candidates) {
    if (reste <= 0) break;
    versees.add(f.rank);
    reste -= f.volumeMl;
  }

  const inchangees = remplissages.filter(
    (f) => !versees.has(f.flaskRank) && f.productSnapshotId !== snapshotId,
  );
  const rendues = remplissages
    .filter(
      (f) => !versees.has(f.flaskRank) && f.productSnapshotId === snapshotId,
    )
    .map((f) => ({ ...f, productSnapshotId: null }));
  const remplies = flasks
    .filter((f) => versees.has(f.rank))
    .map((f) => ({
      flaskRank: f.rank,
      productSnapshotId: snapshotId,
      volumeMl: f.volumeMl,
    }));

  return [...inchangees, ...rendues, ...remplies].sort(
    (a, b) => a.flaskRank - b.flaskRank,
  );
}

/** Une flasque libre, ou à l'eau claire : de la place pour une boisson. */
function libre(
  flask: Flasques[number],
  verse: Remplissages[number] | undefined,
): boolean {
  return (
    !flask.onlyWater &&
    (verse === undefined || verse.productSnapshotId === null)
  );
}

/**
 * Combien de doses d'un produit les flasques peuvent porter, au plus. C'est
 * le plafond du stepper : au-delà, la boisson n'aurait nulle part où aller.
 * `null` pour un solide, que rien ne borne ici.
 */
export function flaskCapacityUnits(
  produit: Produit,
  flasks: Flasques,
  remplissages: Remplissages,
): number | null {
  if (produit.fluidMl <= 0) return null;

  const volumeMl = flasks
    .filter((f) => {
      const verse = remplissages.find((r) => r.flaskRank === f.rank);

      return verse?.productSnapshotId === produit.id || libre(f, verse);
    })
    .reduce((t, f) => t + f.volumeMl, 0);

  return volumeMl / produit.fluidMl;
}

/**
 * Le pas de retouche d'une ration.
 *
 * Un solide se coupe selon le produit. Une boisson, non : elle se prépare
 * flasque par flasque, à ras bord (voir le sélecteur de contenu, `LegCard`).
 * Un demi-dosage n'aurait nulle part où aller, donc son pas est ce qu'une
 * flasque représente de doses.
 */
export function servingStep(produit: Produit, flasks: Flasques): number {
  const versables = flasks.filter((f) => !f.onlyWater);
  if (produit.fluidMl <= 0 || versables.length === 0) {
    return 1 / produit.divisibleBy;
  }

  return Math.min(...versables.map((f) => f.volumeMl)) / produit.fluidMl;
}

/** Verse, ou vide, une flasque sur le secteur qui ouvre une portée. */
export function withFill(
  edit: RoadbookEdit,
  legs: Roadbook["legs"],
  catalogue: Roadbook["catalogue"],
  leg: number,
  flaskRank: number,
  contenu: { productSnapshotId: string | null; volumeMl: number } | null,
): RoadbookEdit {
  const fills = edit.fills.map((remplissages, l) => {
    if (l !== leg) return remplissages;
    const reste = remplissages.filter((f) => f.flaskRank !== flaskRank);

    return contenu === null ? reste : [...reste, { flaskRank, ...contenu }];
  });

  const avant =
    edit.fills[leg].find((f) => f.flaskRank === flaskRank)?.productSnapshotId ??
    null;
  const apres = contenu?.productSnapshotId ?? null;
  // Reverser la même boisson dans la même flasque ne change qu'un volume,
  // que le noyau borne déjà : les rations n'ont pas à bouger.
  if (avant === apres) return { ...edit, fills };

  // Les deux boissons touchées se réaccordent de la même façon : celle qui
  // part comme celle qui arrive. La sortante n'est pas forcément partie —
  // une autre flasque peut la verser encore, mais alors en moindre dose.
  const portee = spanIndexes(legs, leg);
  let servings = edit.servings;
  for (const boisson of [avant, apres]) {
    if (boisson === null) continue;
    servings = alignedToFills(
      servings,
      portee,
      leg,
      fills[leg],
      boisson,
      catalogue,
    );
  }

  return { ...edit, fills, servings };
}

/**
 * Accorde les rations d'une portée avec ce que ses flasques versent d'un
 * produit : la dose entière sur le secteur qui les porte, rien sur les autres.
 * Plus versé nulle part, il quitte la portée.
 *
 * Rassembler la dose à l'ouverture plutôt que de l'étaler est le seul endroit
 * où elle est certaine : c'est là que sont les flasques. Le calcul la
 * réétalera à l'enregistrement s'il le juge mieux.
 */
function alignedToFills(
  servings: RoadbookEdit["servings"],
  portee: number[],
  leg: number,
  remplissages: RoadbookEdit["fills"][number],
  snapshotId: string,
  catalogue: Roadbook["catalogue"],
): RoadbookEdit["servings"] {
  const verse = remplissages.some((f) => f.productSnapshotId === snapshotId);
  const quantity = pouredUnits(snapshotId, remplissages, catalogue);

  return servings.map((rations, l) => {
    if (!portee.includes(l)) return rations;
    if (l !== leg || !verse) {
      return rations.filter((r) => r.productSnapshotId !== snapshotId);
    }

    // Retouchée sur place : la renvoyer en queue la ferait sauter en bas de
    // la carte.
    const presente = rations.some((r) => r.productSnapshotId === snapshotId);

    return presente
      ? rations.map((r) =>
          r.productSnapshotId === snapshotId ? { ...r, quantity } : r,
        )
      : [...rations, { productSnapshotId: snapshotId, quantity }];
  });
}
