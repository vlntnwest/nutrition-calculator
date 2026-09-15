import type { ProfilePoint } from "@/core/type";
import type { PaceBand } from "@/ui/track/chartTypes";
import { paceRampColor } from "@/ui/track/paceColor";

/**
 * Le profil et la bande d'allure, ramenés à des tracés SVG.
 *
 * Le relief est d'un seul ton et ses arêtes sont lissées : sur une A4, les
 * cinq gris de pente de l'écran se moirent, et un ultra de cent trente
 * kilomètres y devient un peigne. L'allure garde sa rampe, elle, qui porte
 * une mesure que rien d'autre ne donne. La figure n'est pas exportée depuis
 * Chart.js, qui ne sait rendre qu'un canevas : elle est redessinée à partir
 * des mêmes données. Voir `docs/pdf-du-roadbook.md`, section 2.3.
 *
 * Tout est en unités de la `viewBox`, jamais en points PDF : c'est elle qui
 * met la figure à l'échelle du papier.
 */

export type Cadre = { largeur: number; hauteur: number };

/** Un palier d'allure, ou la contremarche qui mène au suivant. */
export type Marche = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  couleur: string;
};

export type ProfileFigure = {
  cadre: Cadre;
  /** L'aplat du relief, fermé sur le sol, et la crête qui le souligne. */
  relief: { aplat: string; crete: string };
  /** L'escalier d'allure : les paliers, les contremarches, et leur couleur. */
  allure: Marche[] | null;
  /**
   * Les lignes de repère, communes aux deux échelles : l'altitude se lit à
   * droite, l'allure à gauche, à la même hauteur. C'est ce qui permet de
   * superposer les deux figures sans avoir deux grilles.
   */
  graduations: { y: number; altitude: string; allure: string }[];
  distances: { x: number; texte: string }[];
  bornes: { x: number; repere: string }[];
};

/**
 * Une courbe lissée passant par tous les points, en cubiques de Bézier.
 *
 * Les tangentes sont celles de Catmull-Rom : en chaque point, la direction du
 * segment qui joint ses deux voisins. Un relief tracé au segment droit montre
 * ses arêtes, et sur une A4 les sommets se lisent en dents de scie plutôt
 * qu'en cols.
 */
export function courbe(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";

  const au = (i: number) => points[Math.min(Math.max(i, 0), points.length - 1)];
  const morceaux = [`M ${net(points[0].x)} ${net(points[0].y)}`];

  for (let i = 0; i < points.length - 1; i++) {
    const avant = au(i - 1);
    const depart = au(i);
    const arrivee = au(i + 1);
    const apres = au(i + 2);
    const c1x = depart.x + (arrivee.x - avant.x) / 6;
    const c1y = depart.y + (arrivee.y - avant.y) / 6;
    const c2x = arrivee.x - (apres.x - depart.x) / 6;
    const c2y = arrivee.y - (apres.y - depart.y) / 6;

    morceaux.push(
      `C ${net(c1x)} ${net(c1y)} ${net(c2x)} ${net(c2y)} ${net(arrivee.x)} ${net(arrivee.y)}`,
    );
  }

  return morceaux.join(" ");
}

/** Une coordonnée au dixième : un tracé SVG n'a que faire de la suite. */
function net(valeur: number): number {
  return Math.round(valeur * 10) / 10;
}

/**
 * Des valeurs rondes à poser sur un axe : autant que possible proches de
 * `cible`, jamais hors de l'intervalle.
 *
 * Un axe gradué sur des nombres arbitraires ne se lit pas — « 137, 326, 515 »
 * demande un calcul à chaque coup d'œil, « 200, 400, 600 » ne demande rien.
 */
export function graduations(min: number, max: number, cible: number): number[] {
  if (!(max > min)) return [min];

  const pas = arrondi((max - min) / Math.max(cible, 1));
  const valeurs: number[] = [];

  for (
    let valeur = Math.ceil(min / pas) * pas;
    valeur <= max + pas * 1e-9;
    valeur += pas
  ) {
    // La somme flottante dérive : on la ramène sur le pas à chaque tour.
    valeurs.push(Math.round(valeur / pas) * pas);
  }

  return valeurs.length >= 2 ? valeurs : [min, max];
}

/**
 * Les graduations d'un axe, chacune écrite avec juste assez de décimales pour
 * se distinguer de sa voisine.
 *
 * Le pas rond peut valoir 2,5 : l'écrire en entiers étiquetait « 3 » un trait
 * tombant à 2,5, et deux traits voisins portaient parfois le même nombre.
 * L'écriture se déduit donc du pas, pas du hasard.
 *
 * `toFixed` et non `toLocaleString` : ce dernier sépare les milliers d'une
 * espace fine insécable, que les polices intégrées n'ont pas et que `pdfSafe`
 * ne vient pas convertir ici. Voir la section 5.1 du document.
 */
export function axe(
  min: number,
  max: number,
  cible: number,
): { valeur: number; texte: string }[] {
  const valeurs = graduations(min, max, cible);
  const pas = valeurs.length > 1 ? valeurs[1] - valeurs[0] : 1;
  const decimales = decimalesDe(pas);

  return valeurs.map((valeur) => ({
    valeur,
    texte: valeur.toFixed(decimales).replace(".", ","),
  }));
}

/** Combien de décimales il faut pour écrire ce pas sans le tronquer. */
function decimalesDe(pas: number): number {
  for (let d = 0; d <= 6; d++) {
    const echelle = 10 ** d;
    if (Math.abs(pas * echelle - Math.round(pas * echelle)) < 1e-9) return d;
  }

  return 6;
}

/** Le pas rond immédiatement utile : 1, 2, 2,5 ou 5 fois une puissance de dix. */
function arrondi(brut: number): number {
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const reste = brut / puissance;
  const echelon = reste <= 1 ? 1 : reste <= 2 ? 2 : reste <= 2.5 ? 2.5 : 5;

  return echelon * puissance;
}

/**
 * Un point sur `pas`, le dernier toujours gardé.
 *
 * Le plafond se donne, il n'a pas de défaut : la finesse utile est celle du
 * cadre, jamais un nombre fixe (section 5.2 du document). Le dernier point
 * ferme le tracé sur la distance totale, où que le pas s'arrête.
 */
export function echantillonne(
  points: ProfilePoint[],
  max: number,
): ProfilePoint[] {
  const pas = Math.max(1, Math.ceil(points.length / max));
  if (pas === 1) return points;

  const gardes: ProfilePoint[] = [];
  for (let i = 0; i < points.length; i += pas) gardes.push(points[i]);
  if (gardes.at(-1) !== points.at(-1) && points.length > 0) {
    gardes.push(points[points.length - 1]);
  }

  return gardes;
}

/**
 * La couleur de la rampe pour une allure : bleu sur le tronçon le plus lent,
 * vert sur l'allure moyenne, rouge sur le plus rapide.
 *
 * Les deux moitiés s'étirent séparément pour que le vert tombe pile sur la
 * moyenne, qui n'est presque jamais à mi-chemin des extrêmes. C'est l'inverse
 * exact de `paceGradientStops`, qui fait le même étirement sur un dégradé de
 * canevas : ici l'escalier est horizontal et le dégradé vertical, si bien que
 * chaque palier prend de toute façon une couleur unie.
 */
export function couleurAllure(sPerKm: number, band: PaceBand): string {
  const etendue = band.slowestSPerKm - band.fastestSPerKm;
  if (!(etendue > 0)) return paceRampColor(0.5);

  const u = (band.slowestSPerKm - sPerKm) / etendue;
  const pivot = Math.min(
    Math.max((band.slowestSPerKm - band.meanSPerKm) / etendue, 0.02),
    0.98,
  );

  return paceRampColor(
    u <= pivot ? (u / pivot) * 0.5 : 0.5 + ((u - pivot) / (1 - pivot)) * 0.5,
  );
}

export function figureOf({
  points,
  band,
  bornes,
  cadre,
}: {
  points: ProfilePoint[];
  band: PaceBand | null;
  bornes: { positionM: number; repere: string }[];
  cadre: Cadre;
}): ProfileFigure {
  const vide: ProfileFigure = {
    cadre,
    relief: { aplat: "", crete: "" },
    allure: null,
    graduations: [],
    distances: [],
    bornes: [],
  };

  if (points.length < 2) return vide;

  // Le relief se trace sur une trace allégée, et la finesse utile est celle
  // du cadre, pas un nombre fixe : un aplat de moins de quelques unités de
  // large ne se distingue plus de son voisin. Voir `echantillonne`.
  const traces = echantillonne(points, Math.round(cadre.largeur / 4));
  const departM = points[0].d;
  const finM = points[points.length - 1].d;
  if (!(finM > departM)) return vide;

  const eles = traces.map((p) => p.ele);
  const basse = Math.min(...eles);
  const haute = Math.max(...eles);
  // Un profil plat n'a pas d'amplitude : sans cette marge, tout se tasserait
  // sur une ligne et la division ci-dessous partirait à l'infini.
  const amplitude = haute - basse || 1;

  const x = (d: number) => ((d - departM) / (finM - departM)) * cadre.largeur;
  // Les deux figures occupent tout le cadre et se superposent franchement,
  // comme le PacePro des montres de course : une allure se lit contre le
  // relief qui l'impose, pas à côté de lui. Un souffle de marge en haut pour
  // que le sommet ne touche pas le bord.
  const solM = cadre.hauteur;
  const cielM = cadre.hauteur * 0.06;
  const yEle = (ele: number) =>
    solM - ((ele - basse) / amplitude) * (solM - cielM);

  return {
    cadre,
    relief: reliefOf(
      traces.map((point) => ({ x: x(point.d), y: yEle(point.ele) })),
      solM,
    ),

    allure: band === null ? null : escalier(band, x, cadre),

    // Les altitudes commandent la grille, parce qu'elles tombent sur des
    // nombres ronds ; l'allure se lit ensuite à la hauteur où la ligne passe,
    // et ses valeurs ne sont donc pas rondes. Le PacePro fait de même : une
    // grille lisible vaut mieux que deux séries de nombres ronds qui ne
    // tomberaient jamais aux mêmes hauteurs.
    graduations: axe(basse, haute, 4).map(({ valeur, texte }) => {
      const y = yEle(valeur);

      return {
        y,
        altitude: texte,
        allure: band === null ? "" : allureTexte(allureA(y, band, cadre)),
      };
    }),

    // Graduées en kilomètres, pas en mètres : un pas rond en mètres peut
    // valoir 500 ou 2 500, que des étiquettes en kilomètres entiers
    // dupliquaient ou décalaient d'un demi-kilomètre.
    distances: axe(departM / 1000, finM / 1000, 6).map(({ valeur, texte }) => ({
      x: x(valeur * 1000),
      texte,
    })),

    bornes: bornes.map((borne) => ({
      x: x(borne.positionM),
      repere: borne.repere,
    })),
  };
}

/**
 * La crête, et le même tracé refermé sur le sol pour l'aplat. Deux chemins
 * plutôt qu'un : l'aplat porte la masse du relief, la crête porte sa ligne,
 * et un seul tracé ne peut pas faire les deux sans que le trait suive aussi
 * le sol.
 */
function reliefOf(
  points: { x: number; y: number }[],
  solM: number,
): ProfileFigure["relief"] {
  const crete = courbe(points);
  if (crete === "") return { aplat: "", crete: "" };

  const debut = points[0];
  const fin = points[points.length - 1];

  return {
    crete,
    aplat: `M ${net(debut.x)} ${net(solM)} L ${crete.slice(2)} L ${net(fin.x)} ${net(solM)} Z`,
  };
}

/**
 * Les deux bouts de l'échelle d'allure : le **rapide en haut** du cadre,
 * parce que partout ailleurs un sommet est un maximum. Même sens que l'écran
 * Course.
 *
 * Huit pour cent de marge de part et d'autre, comme Chart.js s'en donne : un
 * tronçon extrême collé au bord du cadre ne se lit pas.
 */
function bornesAllure(band: PaceBand): { lent: number; rapide: number } {
  const etendue = band.slowestSPerKm - band.fastestSPerKm || 1;
  const marge = etendue * 0.08;

  return {
    lent: band.slowestSPerKm + marge,
    rapide: band.fastestSPerKm - marge,
  };
}

/** L'ordonnée d'une allure, sur toute la hauteur du cadre. */
function yAllure(sPerKm: number, band: PaceBand, cadre: Cadre): number {
  const { lent, rapide } = bornesAllure(band);

  return ((sPerKm - rapide) / (lent - rapide)) * cadre.hauteur;
}

/** L'allure que porte une ordonnée : l'inverse de `yAllure`. */
function allureA(y: number, band: PaceBand, cadre: Cadre): number {
  const { lent, rapide } = bornesAllure(band);

  return rapide + (y / cadre.hauteur) * (lent - rapide);
}

/**
 * L'allure en marches d'escalier : un palier par tronçon, relié au suivant
 * par une contremarche. Chaque trait porte sa couleur, prise sur la rampe à
 * la hauteur où il passe.
 *
 * Des traits plutôt qu'une polyligne teintée par un dégradé : une
 * contremarche traverse la rampe, un palier n'en touche qu'une hauteur, et
 * les deux se colorent donc par le même appel plutôt que par une teinture
 * que le rendu PDF n'applique pas au trait.
 */
function escalier(
  band: PaceBand,
  x: (d: number) => number,
  cadre: Cadre,
): Marche[] {
  const y = (sPerKm: number) => yAllure(sPerKm, band, cadre);

  return band.segments.flatMap((segment, i) => {
    const hauteur = y(segment.sPerKm);
    const palier = {
      x1: x(segment.startM),
      y1: hauteur,
      x2: x(segment.endM),
      y2: hauteur,
      couleur: couleurAllure(segment.sPerKm, band),
    };
    const suivant = band.segments[i + 1];
    if (suivant === undefined) return [palier];

    return [
      palier,
      {
        x1: x(segment.endM),
        y1: hauteur,
        x2: x(segment.endM),
        y2: y(suivant.sPerKm),
        // La contremarche prend la couleur de son milieu : elle traverse la
        // rampe, aucune de ses deux extrémités ne la décrit seule.
        couleur: couleurAllure((segment.sPerKm + suivant.sPerKm) / 2, band),
      },
    ];
  });
}

/** `456` → `7'36`. La même écriture que `paceLabel`, sur une allure connue. */
function allureTexte(sPerKm: number): string {
  const minutes = Math.floor(sPerKm / 60);
  const secondes = Math.round(sPerKm % 60);

  return secondes === 60
    ? `${minutes + 1}'00`
    : `${minutes}'${String(secondes).padStart(2, "0")}`;
}
