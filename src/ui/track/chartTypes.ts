/**
 * Ce que le graphique reçoit et rend. À part du composant : quatre écrans les
 * lisent, et un type n'a pas à traîner un canevas derrière lui.
 */

/**
 * Ce que les axes prennent de part et d'autre du relief tracé, en pixels.
 *
 * Chart.js réserve à gauche la place des altitudes et à droite celle de la
 * dernière graduation de distance : le relief ne commence donc pas au bord du
 * composant. Ce qui s'aligne dessous — la bande des secteurs du roadbook —
 * doit reprendre ces gouttières, faute de quoi un secteur tombe à côté du
 * bout de relief qu'il décrit, et l'écart grandit avec la largeur de l'écran.
 */
export type Gouttieres = { gauche: number; droite: number };

/** Une borne posée sur le profil : un ravito, ou la fin d'un secteur. */
export type ProfileMark = {
  /** Le numéro lu sur la pastille. */
  rank: number;
  positionM: number;
  libelle?: string;
};

/**
 * L'allure que le chrono visé donne à chaque tronçon, telle qu'elle se trace
 * par-dessus le relief. Produite par `paceBand` sur l'écran Course.
 */
export type PaceBand = {
  /** Les tronçons, jointifs et dans l'ordre. */
  segments: { startM: number; endM: number; sPerKm: number }[];
  /** L'allure de mouvement sur la course entière : le vert de la rampe. */
  meanSPerKm: number;
  /** L'allure du tronçon le plus lent : le bleu plein. */
  slowestSPerKm: number;
  /** L'allure du tronçon le plus rapide : le rouge plein. */
  fastestSPerKm: number;
};

/**
 * Les bornes de l'axe d'allure, indépendantes de la `PaceBand` du moment —
 * voir `paceAxisRange` sur l'écran Course, où les curseurs font varier la
 * seconde sans que le cadre qui la mesure doive suivre.
 */
export type PaceAxisRange = {
  slowestSPerKm: number;
  fastestSPerKm: number;
};
