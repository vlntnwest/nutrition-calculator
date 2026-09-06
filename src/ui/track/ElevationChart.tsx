"use client";

import {
  Chart as ChartJS,
  type ChartOptions,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  type ScriptableLineSegmentContext,
  Tooltip,
} from "chart.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import type { ProfilePoint } from "@/core/type";
import { gradePercent, SLOPE_BUCKETS, slopeColor } from "./slopeColor";

ChartJS.register(LinearScale, PointElement, LineElement, Filler, Tooltip);

/**
 * Les couleurs du carnet, en dur : un `<canvas>` dessine avec l'API 2D, qui
 * ne résout pas les variables CSS — seule la SVG (la carte, plus haut) vit
 * dans le DOM et en profite. Ces valeurs miroitent `globals.css` ; les
 * changer là-bas sans les changer ici les désynchronise.
 */
const INK = "#17130f";
const INK_SOFT = "#635c52";
const LINE = "#17130f1f";
const PAPER = "#ffffff";

/**
 * `context.font` sur un `<canvas>` ne résout pas non plus les variables CSS
 * (`var(--font-geist-mono)` n'y vaudrait rien) : une pile mono littérale,
 * pas la police Geist chargée par `next/font` pour le reste de la page.
 */
const MONO_STACK = "ui-monospace, Menlo, Consolas, monospace";

/** Une borne posée sur le profil : un ravito, ou la fin d'un secteur. */
export type ProfileMark = {
  /** Le numéro lu sur la pastille. */
  rank: number;
  positionM: number;
  libelle?: string;
};

/**
 * Le profil altimétrique, coloré par palier de pente plutôt qu'en aplat
 * unique — inspiré d'OpenRunner, dans la famille du seul accent du carnet
 * (`slopeColor`) plutôt que dans son jaune-vert-rouge d'origine.
 *
 * Prend `track.points` (~2 000, déjà simplifiés pour l'affichage), jamais
 * `track.profile` (pleine résolution, un point tous les 10 m — plusieurs
 * dizaines de milliers sur un ultra) : un dégradé par segment ne peut pas
 * fusionner les traits contigus de même couleur en un seul tracé, chaque
 * segment coûte son propre remplissage, et la page se fige le temps d'en
 * dessiner autant.
 *
 * `onHoverIndex` rend l'index survolé — le même tableau `points` alimente
 * la carte, qui y retrouve le point sans jamais recevoir de coordonnées :
 * les deux composants restent sourds l'un à l'autre, reliés par un indice.
 * `hoverIndex` fait le chemin inverse — survoler la carte surligne ici le
 * point correspondant, dessiné à la main (`chart.scales.getPixelForValue`)
 * puisque rien ne force Chart.js à afficher un point qu'il n'a pas
 * lui-même détecté sous la souris.
 *
 * `marks` pose des bornes verticales sur le tracé, `onPick` rend l'abscisse
 * cliquée : c'est ainsi qu'un ravito se place, à l'endroit du relief où il
 * tombe plutôt qu'en tapant un nombre.
 *
 * `data` et `options` sont mémoïsés sur `points` : sans ça, chaque survol
 * change `hoverIndex` chez le parent, qui refait tout rendre — et recalculer
 * ~2 000 couleurs de segment à chaque déplacement de souris rendait le
 * survol perceptiblement lent.
 */
export function ElevationChart({
  points,
  hoverIndex,
  onHoverIndex,
  marks,
  onPick,
  legende = true,
}: {
  points: ProfilePoint[];
  hoverIndex?: number | null;
  onHoverIndex?: (index: number | null) => void;
  marks?: ProfileMark[];
  onPick?: (positionM: number) => void;
  legende?: boolean;
}) {
  const chartRef = useRef<ChartJS<"line"> | null>(null);
  // Les bornes se placent avec les échelles du graphique, qui n'existent pas
  // encore au premier passage : un rendu de plus, une fois monté, suffit à
  // les poser. Les survols suivants rendent déjà pour leur propre compte.
  const [monte, setMonte] = useState(false);

  useEffect(() => setMonte(true), []);

  const data = useMemo(() => {
    if (points.length < 2) return null;

    return {
      datasets: [
        {
          data: points.map((p) => ({ x: p.d / 1000, y: p.ele })),
          borderWidth: 1.5,
          pointRadius: 0,
          fill: "origin" as const,
          segment: {
            borderColor: (ctx: ScriptableLineSegmentContext) =>
              slopeColor(segmentSlope(ctx, points)),
            backgroundColor: (ctx: ScriptableLineSegmentContext) =>
              `${slopeColor(segmentSlope(ctx, points))}66`,
          },
        },
      ],
    };
  }, [points]);

  const options = useMemo((): ChartOptions<"line"> | null => {
    if (points.length < 2) return null;

    const elevations = points.map((p) => p.ele);
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

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { intersect: false, mode: "index" },
      onHover: (_event, elements) => {
        onHoverIndex?.(elements.length > 0 ? elements[0].index : null);
      },
      scales: {
        x: {
          type: "linear",
          min: 0,
          max: points[points.length - 1].d / 1000,
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
          min: yMin,
          max: yMax,
          grid: { color: LINE },
          ticks: {
            color: INK_SOFT,
            font: { size: 9, family: MONO_STACK },
            maxTicksLimit: 4,
            callback: (value) => `${Math.round(value as number)} m`,
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
          bodyFont: { family: MONO_STACK, size: 11 },
          titleFont: { family: MONO_STACK, size: 11 },
          callbacks: {
            title: ([item]) =>
              item ? `${(item.parsed.x as number).toFixed(1)} km` : "",
            label: (item) => `${Math.round(item.parsed.y ?? 0)} m`,
          },
        },
      },
    };
  }, [points, onHoverIndex]);

  if (!data || !options) return null;

  // Lu pendant le rendu plutôt qu'en état : `hoverIndex` ne change jamais
  // avant que le graphique n'ait déjà monté et peuplé la ref.
  const survole = hoverIndex != null ? points[hoverIndex] : undefined;
  const chart = chartRef.current;
  const point =
    survole && chart
      ? {
          x: chart.scales.x.getPixelForValue(survole.d / 1000),
          y: chart.scales.y.getPixelForValue(survole.ele),
        }
      : null;

  return (
    <div className="flex h-full flex-col gap-1 p-2">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: le survol et le clic visent un canevas, qui n'a pas d'enfants à focaliser. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: poser une borne au clavier passe par « Ajouter un ravito » et son champ de position, à côté ; viser un pixel du relief n'a pas d'équivalent au clavier. */}
      <div
        className={`relative min-h-0 flex-1 ${onPick ? "cursor-crosshair" : ""}`}
        onMouseLeave={() => onHoverIndex?.(null)}
        onClick={(event) => {
          if (!onPick || !chartRef.current) return;
          const zone = event.currentTarget.getBoundingClientRect();
          const km = chartRef.current.scales.x.getValueForPixel(
            event.clientX - zone.left,
          );
          if (km == null) return;
          const total = points[points.length - 1].d;

          onPick(Math.min(Math.max(km * 1000, 0), total));
        }}
      >
        <Line ref={chartRef} data={data} options={options} />

        {monte &&
          chart &&
          marks?.map((mark) => {
            const x = chart.scales.x.getPixelForValue(mark.positionM / 1000);

            return (
              <span
                key={`${mark.rank}-${mark.positionM}`}
                className="pointer-events-none absolute top-0 bottom-0"
                style={{ left: x }}
              >
                <span className="absolute inset-y-0 w-px bg-accent" />
                <span className="-translate-x-1/2 absolute top-0 flex size-4 items-center justify-center rounded-full bg-accent font-mono text-[9px] text-paper">
                  {mark.rank}
                </span>
              </span>
            );
          })}

        {point && (
          <span
            className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
            style={{
              left: point.x,
              top: point.y,
              backgroundColor: "var(--accent)",
            }}
          />
        )}
      </div>
      {legende && <SlopeLegend />}
    </div>
  );
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
 * « La couleur ne peut jamais porter seule une information » — les mêmes
 * seuils que `slopeColor`, en texte, tenus sur une seule ligne discrète.
 */
function SlopeLegend() {
  return (
    <div className="flex shrink-0 items-center gap-2.5 px-1">
      {SLOPE_BUCKETS.map((bucket) => (
        <span
          key={bucket.label}
          className="flex items-center gap-1 text-[9px] text-ink-soft"
        >
          <span
            className="size-1.5 rounded-full"
            style={{ backgroundColor: bucket.color }}
            aria-hidden="true"
          />
          {bucket.label}
        </span>
      ))}
    </div>
  );
}
