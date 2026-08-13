/**
 * Tous les types du noyau. Aucun autre fichier n'en déclare : chaque module
 * importe ce dont il a besoin depuis ici.
 */

// ────────────────────────────────────────────────────────────── Lecture du GPX

export type GpxPoint = { "@_lat"?: string; "@_lon"?: string; ele?: number };

export type GpxTrkseg = { trkpt?: GpxPoint[] };

export type GpxTrk = { name?: string | number; trkseg?: GpxTrkseg[] };

export type GpxRte = { name?: string | number; rtept?: GpxPoint[] };

export type GpxRoot = {
  gpx?: {
    metadata?: { name?: string | number };
    trk?: GpxTrk[];
    rte?: GpxRte[];
  };
};

// ───────────────────────────────────────────────── Les étapes du pipeline

/** Le minimum pour situer un point sur le globe : ce qu'exige `haversine`. */
export type Coordinates = { lat: number; lon: number };

/**
 * Les quatre types de points ne décrivent pas quatre formes différentes, ils
 * décrivent quatre **étapes du pipeline**. Chaque fonction déclare l'étape
 * qu'elle exige, et le compilateur impose donc l'ordre : `resample` ne peut
 * pas être appelée avant `fillMissingElevation`, faute de quoi ses `ele`
 * pourraient être `null`.
 *
 *   RawPoint       ele: number | null   —                    sorti du fichier
 *   RoutePoint     ele: number | null   d                    ancré sur la distance
 *   ResolvedPoint  ele: number          d                    plus aucun trou
 *   TimedPoint     ele: number          d, t                 le temps réparti
 *
 * `ResolvedPoint` n'ajoute pas de champ : l'intersection avec `{ ele: number }`
 * **rétrécit** celui qui existe, `number & (number | null)` valant `number`.
 */
export type RawPoint = {
  lat: number;
  lon: number;
  ele: number | null; // null = absent, JAMAIS 0
};

export type RoutePoint = RawPoint & { d: number };

/** Toutes les altitudes sont renseignées : les trous ont été interpolés. */
export type ResolvedPoint = RoutePoint & { ele: number };

/** `t` est le temps cumulé depuis le départ, comme `d` est la distance. */
export type TimedPoint = ResolvedPoint & { t: number };

/**
 * Une source de points du fichier : **un** `<trk>` ou **un** `<rte>`, pris
 * isolément.
 *
 * Les `<trkseg>` d'une même trace y sont concaténés — leur coupure est une
 * pause ou une perte de signal dans un même effort, et `resample` la traite.
 * Deux `<trk>` distincts, en revanche, peuvent être deux parcours sans rapport.
 */
export type GpxSource = {
  name: string | null;
  kind: "track" | "route";
  points: RawPoint[];
  /** Points de cette source écartés faute de coordonnées exploitables. */
  skipped: number;
};

/**
 * Le saut entre deux sources consécutives, une fois combinées.
 *
 * C'est lui qui distingue les deux familles de fichiers à plusieurs traces,
 * sans qu'on ait à deviner : quelques mètres trahissent un enregistrement
 * scindé — pause, changement de batterie, transition multisport — et plusieurs
 * kilomètres, deux parcours sans rapport réunis dans un même fichier. ADR 009.
 */
export type Join = {
  /** Position, dans `sources`, de la source qui précède la jointure. */
  afterSource: number;
  /**
   * Distance à vol d'oiseau entre le dernier point de l'une et le premier de
   * la suivante. Aucun seuil n'est appliqué : le noyau rend la mesure, il ne
   * décide pas à partir de quand elle est suspecte.
   */
  gapM: number;
};

export type RawTrack = {
  // Le nom de la première source — <trk><name> ou <rte><name> selon celle qui
  // ouvre le fichier — puis <metadata><name>.
  name: string | null;
  /**
   * Toutes les sources lisibles, bout à bout. Combiner est le défaut parce que
   * le cas dominant d'un fichier d'activité à plusieurs `<trk>` est un
   * enregistrement scindé, et que l'erreur inverse — n'en retenir qu'une — est
   * silencieuse là où celle-ci se voit dans la distance. ADR 009.
   */
  points: RawPoint[];
  /** <trkpt> ou <rtept> écartés faute de coordonnées exploitables, toutes
   * sources retenues confondues. */
  skipped: number;
  /**
   * Les sources lisibles du fichier, dans l'ordre où elles y figurent. Une
   * seule dans le cas courant. Elles restent exposées pour qui voudrait n'en
   * retenir qu'une : `sources[i].points` suffit.
   */
  sources: GpxSource[];
  /** Une entrée par jointure, donc `sources.length - 1`. Vide sur une source
   * unique. */
  joins: Join[];
};

/** Un point porteur de son index d'origine, pour Douglas-Peucker. */
export type Mark = { x: number; y: number; i: number };

// ───────────────────────────────────────────────────── Découpage et allure

export type SegmentType = "climb" | "descent" | "flat";

/** Un morceau de pente homogène, pour le profil et les temps de passage. */
export type Segment = {
  startM: number;
  endM: number;
  lengthM: number;
  ascentM: number;
  descentM: number;
  meanSlope: number;
  type: SegmentType;
};

/**
 * Un tronçon une fois le temps réparti — ce qu'on lit sur un roadbook.
 *
 * `speedKmh` et `vamMH` sont dérivés des champs voisins, comme `Leg.durationS`
 * l'est de ses deux bornes : calculés une fois à la construction, jamais
 * recalculés ailleurs.
 */
export type TimedSegment = Segment & {
  startS: number;
  arrivalS: number;
  durationS: number;
  speedKmh: number;
  /**
   * Vitesse ascensionnelle, en mètres de D+ par heure. C'est le chiffre qui
   * parle en côte, là où les km/h ne disent plus rien.
   */
  vamMH: number;
};

export type PacingProfile = {
  /** De 0 à 1 : plus elle monte, moins les côtes ralentissent. */
  climbIntensity: number;
  /** Positif pour un positive split. */
  split: number;
};

export type TrackAnalysis = {
  name: string | null;
  /** Points présents dans le fichier, avant tout traitement. */
  rawPoints: number;
  /** Points écartés faute de coordonnées exploitables. */
  skipped: number;
  distanceM: number;
  /**
   * Calculé sur la trace lissée en **pleine résolution**, jamais sur la trace
   * simplifiée. C'est ce scalaire qui fait autorité et qui sera stocké ; les
   * points ci-dessous ne servent qu'à dessiner. §14.3.
   */
  ascentM: number;
  /**
   * La trace simplifiée : ~2 000 points, ce qui part en `jsonb` et alimente
   * la carte et le profil.
   */
  points: ResolvedPoint[];
  /**
   * Le parcours découpé en morceaux de pente homogène. Comme le D+, ils sont
   * lus sur la trace pleine résolution, jamais sur la simplifiée.
   */
  segments: Segment[];
};

// ─────────────────────────────────────────────────────────────── Nutrition

export type ProductType = "gel" | "bar" | "puree" | "drink" | "waffle";

export type Product = {
  id: string;
  brand: string;
  name: string;
  type: ProductType;
  /** Masse d'une unité, ou d'une dose pour une poudre. */
  weightG: number;
  energyKcal: number;
  carbsG: number;
  sodiumMg: number;
  /** Volume une fois préparé. Nul pour tout ce qui se mange. */
  fluidMl: number;
  /**
   * Le produit annonce-t-il un mélange de glucides à transporteurs distincts
   * (glucose + fructose) ? Au-delà d'environ 60 g/h, le glucose seul sature
   * son transporteur intestinal et le reste n'est pas absorbé.
   */
  multiTransportable: boolean;
  /**
   * En combien de parts égales une unité se coupe. 1 pour ce qui est
   * insécable — un gel, une dosette. 2 pour ce qui se partage — une dose de
   * poudre, une barre. C'est une propriété **physique** du produit, pas une
   * souplesse qu'on accorde à l'algorithme quand le compte ne tombe pas juste.
   */
  divisibleBy: number;
};

export type Targets = {
  carbsGH: number;
  fluidMlH: number;
  /** Sodium par litre de boisson, pas par heure. */
  sodiumMgL: number;
};

/**
 * Un contenant, tel qu'on le porte. `onlyWater` le réserve à l'eau claire :
 * on n'y prépare aucune boisson glucidique, et sa contenance ne compte donc
 * pas dans ce que la poudre peut occuper.
 */
export type Flask = {
  volumeMl: number;
  onlyWater: boolean;
};

export type Runner = {
  massKg: number;
  /**
   * Ce qu'on porte entre deux points d'eau. Une liste **vide** vaut
   * « contenance non déclarée » : le noyau ne borne alors rien et n'alerte sur
   * rien, plutôt que de supposer un matériel qu'on ne lui a pas donné.
   */
  flasks: Flask[];
};

/** Un point de ravitaillement, tel qu'il figure au roadbook. */
export type AidStation = {
  name: string;
  distanceM: number;
};

export type Serving = {
  product: Product;
  /**
   * Fractionnaire pour ce qui se coupe — 1,5 barre, ½ dose de poudre. Toujours
   * un multiple de `1 / product.divisibleBy`.
   */
  units: number;
};

/**
 * Ce qu'on met dans un contenant au départ du secteur — `product` à `null`
 * pour de l'eau claire.
 *
 * **Un contenant ne porte qu'une chose.** Mélanger deux poudres ou compléter
 * une boisson à l'eau dans la même flasque en changerait la concentration :
 * c'est une règle physique, pas une simplification. Une flasque peut en
 * revanche n'être remplie qu'à moitié, quand il ne reste pas de quoi la finir.
 */
export type Fill = {
  /** Position dans `Runner.flasks`. */
  flaskIndex: number;
  product: Product | null;
  volumeMl: number;
};

/**
 * Ce qu'il y a entre deux ravitos — l'unité d'**affichage** du plan.
 *
 * Ce n'est plus l'unité de calcul : depuis l'ADR 007, les glucides solides se
 * comptent sur la course entière puis se placent ici. Un secteur peut donc
 * recevoir un peu moins que son besoin propre, l'unité qui lui manque étant
 * allée à un autre.
 */
export type Leg = {
  /** Le ravito d'où l'on part. `null` au départ de la course. */
  from: string | null;
  /** Le ravito où l'on arrive. `null` à l'arrivée de la course. */
  to: string | null;
  startM: number;
  endM: number;
  lengthM: number;
  ascentM: number;
  descentM: number;
  startS: number;
  arrivalS: number;
  durationS: number;
  expenditureKcal: number;
  /** Ce qu'il faut emporter. */
  need: { carbsG: number; fluidMl: number; sodiumMg: number };
  servings: Serving[];
  supply: {
    carbsG: number;
    energyKcal: number;
    sodiumMg: number;
    fluidMl: number;
  };
  /**
   * L'écart à la cible, en grammes de glucides. **Signé**, et c'est nouveau :
   * un secteur peut être en dessous de son besoin propre depuis que la
   * répartition se fait sur la course. Seul `NutritionPlan.total.marginG` est
   * positif par construction.
   */
  marginG: number;
  /** Eau claire à ajouter à la boisson pour atteindre la cible. */
  plainWaterMl: number;
  /**
   * Le remplissage des contenants au départ du secteur — quelle flasque porte
   * quoi. Vide tant qu'aucune contenance n'est déclarée : le noyau ne suppose
   * pas un matériel qu'on ne lui a pas donné.
   */
  fills: Fill[];
  /**
   * Le liquide qui ne tient dans aucun contenant : à boire au ravito, ou à
   * refaire en route. Nul quand tout rentre, ou quand rien n'est déclaré.
   */
  refillMl: number;
};

/** Un secteur avant qu'on ne l'ait ravitaillé : géométrie et durée seules. */
export type RawLeg = Omit<
  Leg,
  | "need"
  | "servings"
  | "supply"
  | "marginG"
  | "plainWaterMl"
  | "fills"
  | "refillMl"
>;

/**
 * Une remarque du noyau, en données. La formulation est l'affaire de la couche
 * qui affiche : le noyau dit ce qu'il a constaté et avec quels chiffres, il
 * n'écrit pas de phrases. L'union discriminée oblige l'appelant à traiter tous
 * les cas, et interdit un `code` inventé.
 *
 * Les parts (`multiShare`, `share`) sont des fractions de 0 à 1, jamais des
 * pourcentages : l'arrondi appartient à l'affichage.
 */
export type Warning =
  | { code: "no-carb-product" }
  | { code: "carbs-above-guide"; carbsGH: number; guideGH: number }
  | {
      code: "carbs-single-source";
      carbsGH: number;
      maxGH: number;
      multiShare: number;
    }
  | { code: "fluid-above-guide"; fluidMlH: number; guideMlH: number }
  | { code: "sodium-below-target"; share: number }
  | {
      code: "leg-fluid-above-target";
      /** Position du secteur dans `NutritionPlan.legs`. */
      legIndex: number;
      supplyMl: number;
      needMl: number;
    }
  | {
      /**
       * Le besoin en liquide dépasse ce que le coureur peut porter. Ce n'est
       * pas une erreur de calcul : c'est un secteur où il faudra boire au
       * ravito ou puiser en route, et le taire serait proposer l'impossible.
       */
      code: "leg-fluid-above-carry";
      legIndex: number;
      /** Le plus contraignant de ce qu'il faut boire et de ce qu'occupe la
       * boisson préparée. */
      requiredMl: number;
      carryMl: number;
    }
  | {
      /**
       * Une boisson glucidique était sélectionnée, mais aucune dose n'entre
       * dans ce secteur — tout le liquide part en eau claire. Le cas se
       * produisait en silence avant l'ADR 007.
       */
      code: "leg-drink-unused";
      legIndex: number;
      plainWaterMl: number;
    }
  | {
      /**
       * La boisson préparée ne tient pas dans les flasques qui l'acceptent,
       * les autres étant réservées à l'eau claire. Sans cette remarque, la
       * ventilation laisserait le surplus disparaître de la liste.
       */
      code: "leg-drink-above-flasks";
      legIndex: number;
      drinkMl: number;
      capacityMl: number;
    };

export type NutritionPlan = {
  legs: Leg[];
  total: {
    durationS: number;
    expenditureKcal: number;
    carbsG: number;
    energyKcal: number;
    sodiumMg: number;
    fluidMl: number;
    /**
     * Ce que l'apport dépasse le besoin sur la course. Positif par
     * construction : on n'achète pas 7,3 gels, donc on en emporte 8 et on dit
     * lequel est en trop. C'est le **seul** arrondi de quantité du plan.
     */
    marginG: number;
    /** Le sac complet, tous secteurs confondus. */
    units: Map<string, number>;
  };
  warnings: Warning[];
};
