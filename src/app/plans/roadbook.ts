export type RoadbookServing = {
  /** Ce que l'écran renvoie pour désigner la ration qu'il retouche. */
  productSnapshotId: string;
  name: string;
  brandName: string | null;
  quantity: number;
  /** Le pas de retouche : 1 pour ce qui ne se coupe pas, 2 pour le reste. */
  divisibleBy: number;
  formatLabel: string;
  carbsG: number;
  sodiumMg: number;
  weightG: number;
};

export type RoadbookFill = {
  flaskRank: number;
  /** Absent : de l'eau claire. */
  product: string | null;
  productSnapshotId: string | null;
  volumeMl: number;
};

/** Ce que les rations apportent réellement. */
export type Supply = {
  carbsG: number;
  energyKcal: number;
  sodiumMg: number;
  fluidMl: number;
};

export type RoadbookLeg = {
  rank: number;
  /** L'abscisse où le secteur s'achève. Nul pour l'arrivée. */
  endPositionM: number | null;
  /** Le ravito qui clôt le secteur. Nul à l'arrivée, que rien ne clôt. */
  endName: string | null;
  /** La durée imposée à ce secteur, si le coureur en a posé une. */
  imposedDurationS: number | null;
  /** La cible de glucides imposée à ce secteur, le cas échéant. */
  imposedCarbsGH: number | null;
  ascentM: number;
  descentM: number;
  durationS: number;
  /** L'arrêt prévu à la borne qui clôt le secteur. Nul s'il n'y en a pas. */
  stopS: number | null;
  /**
   * Le temps écoulé depuis le départ à l'arrivée sur la borne : les durées de
   * mouvement des secteurs parcourus, plus les arrêts déjà faits. L'arrêt de
   * cette borne-ci n'y est pas — on arrive avant de s'arrêter.
   */
  elapsedS: number;
  servings: RoadbookServing[];
  fills: RoadbookFill[];
  /**
   * Le secteur ouvre-t-il une portée de liquide ? On ne remplit ses flasques
   * qu'au départ ou en repartant d'une borne qui fournit de l'eau : ailleurs,
   * il n'y a rien à verser. Même règle que `carrySpans`, côté noyau.
   */
  opensLiquidSpan: boolean;
  /**
   * Le secteur ouvre-t-il une portée de solide ? Même règle, sur les ravitos
   * qui donnent à manger. Un secteur qui n'en ouvre pas mange ce qu'il a
   * emporté : sa nourriture se prend au dernier qui en ouvrait une.
   */
  opensSolidSpan: boolean;
  supply: Supply;
  /** Les glucides visés sur ce secteur : la cible horaire fois sa durée. */
  needG: number;
  /**
   * Ce qu'il faut **boire** sur le secteur. À ne pas confondre avec les
   * volumes des flasques, qui partent pleines : on emporte souvent plus.
   */
  needFluidMl: number;
  /** Le sodium visé sur le secteur : la concentration ciblée fois `needFluidMl`. */
  needSodiumMg: number;
  /**
   * L'écart aux glucides visés, **signé** : un secteur peut passer sous son
   * besoin propre, la répartition se faisant sur toute la course.
   */
  marginG: number;
  warnings: { code: string; payload: unknown }[];
};

export type Roadbook = {
  legs: RoadbookLeg[];
  /** L'heure de départ, `HH:MM`, ou nulle tant qu'elle n'est pas renseignée. */
  startTime: string | null;
  /**
   * Les produits retenus pour ce plan — de quoi poser ce que le calcul n'a
   * pas proposé, et de quoi recalculer un apport à l'écran sans attendre
   * l'enregistrement (voir `liveSupply`, côté Roadbook).
   */
  catalogue: {
    id: string;
    name: string;
    brandName: string | null;
    divisibleBy: number;
    /** Le libellé du noyau — `gel`, `bar`, `drink`. Traduit à l'affichage. */
    formatLabel: string;
    carbsG: number;
    energyKcal: number;
    sodiumMg: number;
    fluidMl: number;
    weightG: number;
  }[];
  /** Les contenants déclarés, pour retoucher les remplissages. */
  flasks: { rank: number; volumeMl: number; onlyWater: boolean }[];
  /** Le plan a été retouché à la main depuis son dernier calcul. */
  edited: boolean;
  /** Quand le calcul a tourné. C'est lui qui fait foi sur sa fraîcheur. */
  generatedAt: Date;
  /** La distance totale, pour borner le dernier secteur. */
  totalM: number;
  /** Le sac complet, et ce qu'il apporte. */
  total: Supply & {
    marginG: number;
    /** Ce que le sac pèse au départ, tous produits confondus. */
    weightG: number;
    units: { name: string; brandName: string | null; quantity: number }[];
  };
  /** Ceux qui ne visent aucun secteur — ils portent `leg_rank` à null. */
  warnings: { code: string; payload: unknown }[];
};
