import type {
  Chart as ChartJS,
  ScriptableContext,
  ScriptableLineSegmentContext,
} from "chart.js";
import type { ProfilePoint } from "@/core/type";
import { FILL, LINE_STRONG } from "./chartTheme";
import type { PaceBand } from "./chartTypes";
import { paceGradientStops, paceRampColor } from "./paceColor";
import { gradePercent, slopeColor } from "./slopeColor";

/**
 * Le dégradé du trait d'allure : bleu plein sur le tronçon le plus lent de la
 * trace, vert sur l'allure moyenne, rouge plein sur le plus rapide. Chaque
 * pixel du trait prend la couleur de l'endroit où il passe, contremarches
 * comprises.
 *
 * Tendu entre les deux allures extrêmes, jamais entre les bords du cadre :
 * l'axe se donne une marge de 8 % au-dessus et en dessous des données, et le
 * tronçon le plus rapide n'aurait donc jamais atteint le rouge. Un dégradé de
 * canevas prolonge sa couleur de bout au-delà de ses bornes, si bien que la
 * marge se remplit d'elle-même.
 *
 * Rendu à chaque dessin, parce qu'un `CanvasGradient` naît d'un contexte 2D et
 * de coordonnées en pixels : ni l'un ni l'autre n'existent avant que Chart.js
 * n'ait placé son cadre. Tant qu'il ne l'a pas fait, une couleur unie tient
 * lieu de secours.
 */
function paceStroke(
  chart: ChartJS<"line">,
  band: PaceBand,
): CanvasGradient | string {
  const { chartArea, scales } = chart;
  const echelle = scales.yPace;

  if (!chartArea || !echelle) return paceRampColor(0.5);

  // L'échelle est inversée : le rapide, petit nombre de secondes, est haut
  // dans le cadre, donc à la plus petite ordonnée.
  const lent = echelle.getPixelForValue(band.slowestSPerKm);
  const rapide = echelle.getPixelForValue(band.fastestSPerKm);
  const ecart = lent - rapide;

  // Une trace sans écart d'allure n'a pas de rampe à tendre : tout y vaut la
  // moyenne, et deux arrêts au même pixel feraient un dégradé dégénéré.
  if (!(ecart > 0)) return paceRampColor(0.5);

  const gradient = chart.ctx.createLinearGradient(0, lent, 0, rapide);
  const meanAt = (lent - echelle.getPixelForValue(band.meanSPerKm)) / ecart;

  for (const stop of paceGradientStops(meanAt)) {
    gradient.addColorStop(stop.offset, stop.color);
  }

  return gradient;
}

/**
 * L'allure de chaque point tracé : celle du tronçon qui le contient.
 *
 * Tous les jeux du graphique partagent la grille du relief, et c'est une
 * condition de son fonctionnement, pas une commodité : le mode `index` de
 * Chart.js lit l'indice du jeu le plus proche du curseur puis va chercher cet
 * indice-là dans tous les autres. Des marches portées par deux points par
 * tronçon rendaient donc un indice qui ne désignait aucun point de la trace,
 * et la carte surlignait un point sans rapport avec le curseur.
 *
 * Un seul passage : les deux tableaux sont triés sur la distance.
 */
export function paceSeries(traces: ProfilePoint[], band: PaceBand): number[] {
  const allures = new Array<number>(traces.length);
  let k = 0;

  for (let i = 0; i < traces.length; i++) {
    while (
      k < band.segments.length - 1 &&
      traces[i].d > band.segments[k].endM
    ) {
      k++;
    }
    allures[i] = band.segments[k].sPerKm;
  }

  return allures;
}

/**
 * La pente entre les deux points qui portent un segment du tracé Chart.js —
 * jamais celle d'un seul point, une pente n'existe qu'entre deux.
 */
function segmentSlope(
  ctx: ScriptableLineSegmentContext,
  points: ProfilePoint[],
): number {
  const a = points[ctx.p0DataIndex];
  const b = points[ctx.p0DataIndex + 1];

  if (!a || !b) return 0;

  return gradePercent(a, b) ?? 0;
}

/**
 * Les jeux que Chart.js trace : la masse du relief, sa pente, et — sous une
 * bande d'allure — la moyenne en pointillé et les marches.
 */
export function chartData({
  traces,
  relief,
  allures,
  paceBand,
}: {
  traces: ProfilePoint[];
  relief: { x: number; y: number }[];
  allures: number[] | null;
  paceBand?: PaceBand | null;
}) {
  if (traces.length < 2) return null;

  // Chart.js pose un point de survol par jeu, et le mode `index` les
  // désigne tous d'un coup : le relief, la moyenne et les marches en
  // portaient donc trois, sur deux échelles différentes. Le seul marqueur
  // du survol est le disque dessiné à la main plus bas, celui que la carte
  // partage.
  const muet = { pointRadius: 0, pointHoverRadius: 0 };

  return {
    datasets: [
      // La masse du relief : un seul tracé, une seule couleur. Coloré
      // segment par segment, l'aplat laissait voir ses coutures verticales
      // là où il n'y a qu'un relief continu.
      {
        ...muet,
        data: relief,
        yAxisID: "y",
        borderWidth: 0,
        fill: "origin" as const,
        backgroundColor: FILL,
      },
      // La pente, portée par le trait seul. Sous une bande d'allure, elle
      // rend sa couleur et redevient une silhouette : deux échelles de
      // couleur sur un même cadre ne se lisent plus ni l'une ni l'autre, et
      // c'est l'allure qu'on est venu voir.
      {
        ...muet,
        data: relief,
        yAxisID: "y",
        borderWidth: paceBand ? 1 : 2,
        fill: false as const,
        ...(paceBand
          ? { borderColor: LINE_STRONG }
          : {
              segment: {
                borderColor: (ctx: ScriptableLineSegmentContext) =>
                  slopeColor(segmentSlope(ctx, traces)),
              },
            }),
      },
      // L'allure moyenne, en pointillé : sans elle, les marches disent
      // laquelle est la plus lente mais pas laquelle est en retard.
      ...(paceBand && allures
        ? [
            {
              ...muet,
              data: relief.map((p) => ({ x: p.x, y: paceBand.meanSPerKm })),
              yAxisID: "yPace",
              borderColor: LINE_STRONG,
              borderWidth: 1,
              borderDash: [4, 4],
              fill: false as const,
            },
            // Les marches : l'allure du tronçon qui contient chaque point.
            // Deux points voisins d'un même tronçon portent la même valeur,
            // et le passage au suivant fait la contremarche.
            {
              ...muet,
              data: relief.map((p, i) => ({ x: p.x, y: allures[i] })),
              yAxisID: "yPace",
              borderWidth: 2,
              fill: false as const,
              borderColor: (ctx: ScriptableContext<"line">) =>
                paceStroke(ctx.chart as ChartJS<"line">, paceBand),
            },
          ]
        : []),
    ],
  };
}
