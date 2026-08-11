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

export type RawTrack = {
  name: string | null; // <trk><name> ou <metadata><name> ou <rte><name>
  points: RawPoint[];
  skipped: number; // <trkpt> ou <rtept> écartés faute de coordonnées exploitables
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

export type ProductType = "gel" | "bar" | "puree" | "drink";

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
};

export type Targets = {
  carbsGH: number;
  fluidMlH: number;
  /** Sodium par litre de boisson, pas par heure. */
  sodiumMgL: number;
};

export type Runner = {
  massKg: number;
};

/** Un point de ravitaillement, tel qu'il figure au roadbook. */
export type AidStation = {
  name: string;
  distanceM: number;
};

export type Serving = {
  product: Product;
  units: number;
  /** Un toutes les combien de secondes, sur la durée du secteur. */
  intervalS: number;
};

/**
 * Une prise, à un instant du secteur. La boisson n'en est pas une : le bidon
 * délivre un flux continu, on ne « prend » pas un bidon.
 */
export type Intake = {
  /** Secondes depuis le départ du secteur. */
  atS: number;
  product: Product;
};

/** Ce qu'il y a entre deux ravitos — l'unité du plan, et du sac. */
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
  supply: { carbsG: number; sodiumMg: number; fluidMl: number };
  /**
   * Ce que l'apport dépasse le besoin, en grammes de glucides. On n'achète pas
   * 7,3 gels : « 8 gels, dont 1 de marge » est plus utile qu'un chiffre juste.
   */
  marginG: number;
  /** L'ordre des prises solides, formats alternés. */
  intakes: Intake[];
  /** Eau claire à ajouter à la boisson pour atteindre la cible. */
  plainWaterMl: number;
};

/** Un secteur avant qu'on ne l'ait ravitaillé : géométrie et durée seules. */
export type RawLeg = Omit<
  Leg,
  "need" | "servings" | "supply" | "marginG" | "intakes" | "plainWaterMl"
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
    };

export type NutritionPlan = {
  legs: Leg[];
  total: {
    durationS: number;
    expenditureKcal: number;
    carbsG: number;
    sodiumMg: number;
    fluidMl: number;
    /** Le sac complet, tous secteurs confondus. */
    units: Map<string, number>;
  };
  warnings: Warning[];
};
