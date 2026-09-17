import type { ChartOptions, Scale } from "chart.js";
import type { ProfilePoint } from "@/core/type";
import { graduations } from "@/format/axis";
import { paceLabel } from "@/format/clock";
import { INK, INK_SOFT, LINE, MONO_STACK, PAPER, PILE } from "./chartTheme";
import type { PaceAxisRange, PaceBand } from "./chartTypes";

/** `336` en `05:36`. L'échelle du graphique lit des secondes par kilomètre. */
function paceText(sPerKm: number): string {
  return paceLabel(sPerKm, 1000) ?? "";
}

/**
 * Le cadre du graphique : ses deux échelles, ses graduations, et ce qu'il
 * fait du survol. Sans canevas ni DOM — de quoi le décrire en le lisant.
 *
 * `onResize` est appelé par Chart.js une fois ses échelles refaites : c'est
 * ce qui replace les bornes du DOM posées par-dessus. Voir `ElevationChart`.
 */
export function chartOptions({
  traces,
  origine,
  allures,
  paceBand,
  paceAxisRange,
  etroit,
  onHoverIndex,
  onResize,
}: {
  traces: ProfilePoint[];
  /** L'indice d'origine de chaque point tracé, celui que la carte partage. */
  origine: number[];
  allures: number[] | null;
  paceBand?: PaceBand | null;
  paceAxisRange?: PaceAxisRange | null;
  /** Le cadre est-il trop étroit pour superposer l'allure au relief ? */
  etroit: boolean | null;
  onHoverIndex?: (index: number | null) => void;
  onResize: () => void;
}): ChartOptions<"line"> | null {
  if (traces.length < 2) return null;

  // Le cadre étroit sépare les deux lectures au lieu de les superposer :
  // l'allure sur le tiers haut, le relief sur les deux tiers du bas.
  const empile = paceBand != null && etroit === true;

  const elevations = traces.map((p) => p.ele);
  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  // Une marge d'un dixième de l'amplitude : sans elle, le point le plus
  // haut touche le bord du cadre.
  const marge = Math.max((max - min) * 0.1, 15);
  // Arrondis au palier de 50 m : les bornes du cadre sont aussi les
  // étiquettes de ses graduations, jamais une altitude à la décimale près.
  const palier = 50;
  const yMin = Math.max(0, Math.floor((min - marge) / palier) * palier);
  const yMax = Math.ceil((max + marge) / palier) * palier;

  // Les altitudes commandent la grille, parce qu'elles tombent sur des nombres
  // ronds ; l'allure se lit ensuite à la hauteur où la ligne passe, et ses
  // valeurs ne sont donc pas rondes. Deux axes qui gradueraient chacun pour
  // son compte poseraient deux séries de traits à des hauteurs qui ne
  // coïncident jamais : on ne saurait plus laquelle des deux lire. Même
  // disposition que la feuille PDF (`pdf/profile.ts`) et que le PacePro des
  // montres de course.
  //
  // Empilés, les deux lectures ne se superposent plus : chacune a son cadre,
  // donc chacune reprend sa graduation.
  const alignees = paceBand != null && !empile;
  const lignes = graduations(yMin, yMax, 4);
  // L'allure portée par une hauteur du cadre, de 0 en bas à 1 en haut.
  // L'échelle est inversée : son minimum, le rapide, est en haut.
  const bornes = paceAxisRange ?? paceBand;
  const etendue = bornes ? bornes.slowestSPerKm - bornes.fastestSPerKm || 1 : 1;
  // La même marge de 8 % que `grace` posait, mais explicite : c'est elle qui
  // permet de convertir une hauteur en allure. Voir `bornesAllure` au PDF.
  const paceMin = (bornes?.fastestSPerKm ?? 0) - etendue * 0.08;
  const paceMax = (bornes?.slowestSPerKm ?? 0) + etendue * 0.08;
  const allureA = (altitude: number) =>
    paceMax - ((altitude - yMin) / (yMax - yMin || 1)) * (paceMax - paceMin);

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { intersect: false, mode: "index" },
    onResize: () => onResize(),
    onHover: (_event, elements) => {
      onHoverIndex?.(
        elements.length > 0 ? (origine[elements[0].index] ?? null) : null,
      );
    },
    scales: {
      x: {
        type: "linear",
        min: 0,
        max: traces[traces.length - 1].d / 1000,
        grid: { display: false },
        ticks: {
          color: INK_SOFT,
          font: { size: 9, family: MONO_STACK },
          maxTicksLimit: 5,
          callback: (value) => `${Math.round(value as number)} km`,
        },
        border: { color: LINE },
      },
      y: {
        // L'altitude cède l'axe de gauche à l'allure quand il y en a une :
        // à gauche se lit ce qu'on est venu régler. Empilés, les deux
        // partagent le bord gauche — c'est la condition de l'empilement,
        // et l'écran étroit y gagne la gouttière de droite.
        position: paceBand && !empile ? "right" : "left",
        min: yMin,
        max: yMax,
        grid: { color: LINE },
        ...(empile
          ? {
              stack: PILE,
              stackWeight: 2,
              // La graduation la plus haute tomberait sur la couture, là où
              // le bandeau d'allure pose déjà la sienne : elle cède.
              afterBuildTicks: (axe: Scale) => {
                axe.ticks = axe.ticks.slice(0, -1);
              },
            }
          : {}),
        ...(alignees
          ? {
              afterBuildTicks: (axe: Scale) => {
                axe.ticks = lignes.map((value) => ({ value }));
              },
            }
          : {}),
        ticks: {
          color: INK_SOFT,
          font: { size: 9, family: MONO_STACK },
          // Empilée, l'altitude perd sa graduation du haut : il lui en
          // faut quelques-unes de plus à distribuer pour qu'il en reste
          // une échelle.
          maxTicksLimit: empile ? 8 : 4,
          // Les deux séries se répondent ligne à ligne : l'une ne peut pas
          // en sauter une que l'autre garde.
          ...(alignees ? { autoSkip: false } : {}),
          callback: (value) => `${Math.round(value as number)} m`,
        },
        border: { display: false },
      },
      // Déclarée après l'altitude : deux axes empilés au bord gauche se
      // posent du dernier donné au premier, et l'allure va en haut.
      yPace: {
        display: paceBand != null,
        position: "left",
        // Des secondes par kilomètre : le rapide est le petit nombre, et
        // c'est lui qu'on veut en haut du cadre.
        reverse: true,
        // Des bornes explicites, jamais `grace` : une hauteur du cadre ne se
        // convertit en allure que si l'on sait ce que ses deux bouts valent.
        // `paceAxisRange` les fournit quand un curseur est tenu — l'axe cesse
        // alors de suivre la bande qui bouge sous lui.
        ...(bornes ? { min: paceMin, max: paceMax } : {}),
        grid: { display: false },
        ...(empile && paceBand
          ? {
              stack: PILE,
              stackWeight: 1,
              // Un bandeau de quelques dizaines de pixels n'a pas la place
              // des paliers ronds de Chart.js. Les trois allures que la
              // rampe de couleur nomme déjà en font une échelle : la plus
              // rapide en haut, la moyenne sur son pointillé, la plus lente
              // en bas. Les 8 % de marge les tiennent à distance des bords.
              afterBuildTicks: (axe: Scale) => {
                axe.ticks = [
                  paceBand.fastestSPerKm,
                  paceBand.meanSPerKm,
                  paceBand.slowestSPerKm,
                ].map((value) => ({ value }));
              },
            }
          : {}),
        ...(alignees
          ? {
              // Les hauteurs de la grille des altitudes, lues en allures.
              afterBuildTicks: (axe: Scale) => {
                axe.ticks = lignes.map((altitude) => ({
                  value: allureA(altitude),
                }));
              },
            }
          : {}),
        ticks: {
          color: INK_SOFT,
          font: { size: 9, family: MONO_STACK },
          maxTicksLimit: 4,
          ...(alignees ? { autoSkip: false } : {}),
          callback: (value) => paceText(value as number),
        },
        border: { display: false },
      },
    },
    plugins: {
      tooltip: {
        backgroundColor: INK,
        titleColor: PAPER,
        bodyColor: PAPER,
        padding: 8,
        cornerRadius: 6,
        displayColors: false,
        // Les deux jeux portent la même altitude : sans ce filtre,
        // l'infobulle la donnerait deux fois.
        filter: (item) => item.datasetIndex === 1,
        bodyFont: { family: MONO_STACK, size: 11 },
        titleFont: { family: MONO_STACK, size: 11 },
        callbacks: {
          title: ([item]) =>
            item ? `${(item.parsed.x as number).toFixed(1)} km` : "",
          label: (item) => {
            const altitude = `${Math.round(item.parsed.y ?? 0)} m`;
            const allure = allures?.[item.dataIndex];

            return allure ? [altitude, `${paceText(allure)} /km`] : altitude;
          },
        },
      },
    },
  };
}
