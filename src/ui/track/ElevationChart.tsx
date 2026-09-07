"use client";

import {
  Chart as ChartJS,
  type ChartOptions,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  type Scale,
  type ScriptableContext,
  type ScriptableLineSegmentContext,
  Tooltip,
} from "chart.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import type { ProfilePoint } from "@/core/type";
import { paceLabel } from "@/format/clock";
import { PACE_GRADIENT, paceGradientStops, paceRampColor } from "./paceColor";
import { gradePercent, SLOPE_BUCKETS, slopeColor } from "./slopeColor";

ChartJS.register(LinearScale, PointElement, LineElement, Filler, Tooltip);

/**
 * Les couleurs du carnet, en dur : un `<canvas>` dessine avec l'API 2D, qui
 * ne résout pas les variables CSS — seule la SVG (la carte, plus haut) vit
 * dans le DOM et en profite. Ces valeurs miroitent `globals.css` ; les
 * changer là-bas sans les changer ici les désynchronise.
 */
const INK = "#131313";
const INK_SOFT = "#5c5c5c";
const LINE = "#1313131f";
const LINE_STRONG = "#13131333";
const PAPER = "#ffffff";

/** L'aplat sous la courbe : de l'encre à cinq pour cent, la masse du relief. */
const FILL = "#1313130d";

/**
 * `context.font` sur un `<canvas>` ne résout pas non plus les variables CSS
 * (`var(--font-geist-mono)` n'y vaudrait rien) : une pile mono littérale,
 * pas la police Geist chargée par `next/font` pour le reste de la page.
 */
const MONO_STACK = "ui-monospace, Menlo, Consolas, monospace";

/**
 * Le nombre de points réellement tracés.
 *
 * Chaque segment porte sa propre couleur de pente et son propre
 * remplissage : en dessous d'un pixel de large, ils se moirent et le relief
 * se lit comme un code-barres. Quatre cents points suffisent à dessiner un
 * profil à n'importe quelle largeur d'écran, et le survol continue de
 * désigner le point d'origine, celui que la carte connaît.
 */
const POINTS_TRACES = 400;

/**
 * En dessous de cette largeur de cadre, l'allure cesse de se superposer au
 * relief : les marches se resserrent au point de couvrir la silhouette, et
 * l'écran étroit n'a pas la place de les faire cohabiter. Elles prennent
 * alors un bandeau à part, en haut, et le relief garde le reste.
 */
const LARGEUR_SUPERPOSITION = 640;

/** Le nom de la pile qui range l'allure au-dessus du relief. */
const PILE = "profil";

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

/** `336` en `05:36`. L'échelle du graphique lit des secondes par kilomètre. */
function paceText(sPerKm: number): string {
  return paceLabel(sPerKm, 1000) ?? "";
}

/**
 * Le profil altimétrique, tracé par palier de pente plutôt qu'en aplat
 * unique — inspiré d'OpenRunner, sur une échelle de cinq gris
 * (`slopeColor`) plutôt que sur son jaune-vert-rouge d'origine.
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
 * tombe plutôt qu'en tapant un nombre. Sous `LARGEUR_SUPERPOSITION`, le
 * cadre ne se laisse plus pointer : voir `pointable`.
 *
 * `paceBand` superpose au relief l'allure de chaque tronçon, en marches
 * d'escalier sur une échelle qui lui est propre : le relief est ce que la
 * course impose, l'allure ce que le coureur y répond. Elle prend alors l'axe
 * de gauche et renvoie l'altitude à droite, et l'échelle est inversée pour
 * que le haut du cadre soit le rapide, comme partout ailleurs un sommet est
 * un maximum. Sous `LARGEUR_SUPERPOSITION`, les deux cessent de se
 * superposer : l'allure prend le tiers haut du cadre, le relief les deux
 * tiers du bas, et les axes se partagent le bord gauche.
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
  onChoisirMark,
  onCadre,
  paceBand,
  legende = true,
}: {
  points: ProfilePoint[];
  hoverIndex?: number | null;
  onHoverIndex?: (index: number | null) => void;
  marks?: ProfileMark[];
  onPick?: (positionM: number) => void;
  /** Rappelle le rang de la borne cliquée. Absent, la pastille est inerte. */
  onChoisirMark?: (rank: number) => void;
  /**
   * Rend les gouttières d'axes du cadre tracé, en pixels, pour ce qui vient
   * s'aligner sous le graphique. Voir `Gouttieres`.
   */
  onCadre?: (gouttieres: Gouttieres) => void;
  paceBand?: PaceBand | null;
  legende?: boolean;
}) {
  const chartRef = useRef<ChartJS<"line"> | null>(null);
  // Un point sur `pas`, et l'indice d'origine gardé en regard : le survol
  // parle toujours du tableau que la carte partage.
  const { traces, origine } = useMemo(() => {
    const pas = Math.max(1, Math.ceil(points.length / POINTS_TRACES));
    const traces: ProfilePoint[] = [];
    const origine: number[] = [];

    for (let i = 0; i < points.length; i += pas) {
      traces.push(points[i]);
      origine.push(i);
    }
    // Le dernier point ferme le tracé sur la distance totale, quel que soit
    // l'endroit où le pas s'arrête.
    if (origine.at(-1) !== points.length - 1 && points.length > 0) {
      traces.push(points[points.length - 1]);
      origine.push(points.length - 1);
    }

    return { traces, origine };
  }, [points]);
  // Les bornes se placent avec les échelles du graphique, qui n'existent pas
  // encore au premier passage : un rendu de plus, une fois monté, suffit à
  // les poser. Les survols suivants rendent déjà pour leur propre compte.
  const [monte, setMonte] = useState(false);
  const cadreRef = useRef<HTMLDivElement>(null);
  const boiteRef = useRef<HTMLDivElement>(null);
  // La largeur du cadre décide de la mise en page de l'allure, pas celle de
  // la fenêtre : le même graphique sert la feuille du pouce, le socle du
  // grand écran et la vignette d'un secteur. `null` tant qu'elle n'est pas
  // mesurée — le premier rendu ne sait pas encore de quelle largeur il
  // dispose, et il vaut mieux ne rien promettre que promettre à tort. C'est
  // l'observateur qui la donne, dès l'observation ; Chart.js, lui, ne
  // signale qu'un changement.
  const [largeur, setLargeur] = useState<number | null>(null);
  const etroit = largeur === null ? null : largeur < LARGEUR_SUPERPOSITION;
  // Un rendu de plus, et rien d'autre.
  //
  // Les bornes et les repères de survol sont des éléments du DOM posés à
  // l'abscisse que les échelles du graphique donnent, et ces échelles se
  // refont quand le cadre change de taille. Sans ce rendu, une borne gardait
  // l'abscisse de la largeur précédente et glissait hors du relief au
  // redimensionnement de la fenêtre.
  //
  // Déclenché par `onResize` plutôt que par l'observateur ci-dessous :
  // Chart.js appelle ce rappel, puis refait ses échelles et redessine, le
  // tout d'un bloc ; l'état posé ici ne rend donc qu'après, quand les
  // échelles sont à jour. L'observateur, lui, part le premier, quand elles
  // décrivent encore le cadre d'avant.
  const [, redessiner] = useState(0);

  useEffect(() => setMonte(true), []);

  useEffect(() => {
    const cadre = cadreRef.current;

    if (!cadre) return;

    const observateur = new ResizeObserver(([entree]) =>
      setLargeur(entree.contentRect.width),
    );

    observateur.observe(cadre);

    return () => observateur.disconnect();
  }, []);

  // Les gouttières sont relues après chaque rendu et ne remontent que
  // lorsqu'elles bougent : sans ce garde-fou, le parent qui les mémorise
  // rendrait à nouveau, et l'on tournerait en rond.
  const derniereCadre = useRef<Gouttieres | null>(null);

  useEffect(() => {
    const chart = chartRef.current;
    const cadre = cadreRef.current;
    const boite = boiteRef.current;
    if (!onCadre || !chart?.chartArea || !cadre || !boite) return;

    // Les abscisses de Chart.js partent du canevas, celles du parent partent
    // du composant : le retrait qui sépare les deux entre dans le compte.
    const retrait =
      cadre.getBoundingClientRect().left - boite.getBoundingClientRect().left;
    const gouttieres = {
      gauche: retrait + chart.chartArea.left,
      droite: boite.clientWidth - retrait - chart.chartArea.right,
    };
    const avant = derniereCadre.current;

    if (
      avant?.gauche === gouttieres.gauche &&
      avant.droite === gouttieres.droite
    ) {
      return;
    }

    derniereCadre.current = gouttieres;
    onCadre(gouttieres);
  });

  // Le relief à part de l'allure : bouger un curseur d'allure ne doit pas
  // refaire ce tableau, et survoler ne doit refaire ni l'un ni l'autre.
  const relief = useMemo(
    () => traces.map((p) => ({ x: p.d / 1000, y: p.ele })),
    [traces],
  );
  const allures = useMemo(
    () => (paceBand ? paceSeries(traces, paceBand) : null),
    [traces, paceBand],
  );

  const data = useMemo(() => {
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
  }, [traces, relief, allures, paceBand]);

  const options = useMemo((): ChartOptions<"line"> | null => {
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

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { intersect: false, mode: "index" },
      onResize: () => redessiner((n) => n + 1),
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
          ticks: {
            color: INK_SOFT,
            font: { size: 9, family: MONO_STACK },
            // Empilée, l'altitude perd sa graduation du haut : il lui en
            // faut quelques-unes de plus à distribuer pour qu'il en reste
            // une échelle.
            maxTicksLimit: empile ? 8 : 4,
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
          grace: "8%",
          grid: { display: false },
          ...(empile && paceBand
            ? {
                stack: PILE,
                stackWeight: 1,
                // Un bandeau de quelques dizaines de pixels n'a pas la place
                // des paliers ronds de Chart.js. Les trois allures que la
                // rampe de couleur nomme déjà en font une échelle : la plus
                // rapide en haut, la moyenne sur son pointillé, la plus lente
                // en bas. La marge de `grace` les tient à distance des bords.
                afterBuildTicks: (axe: Scale) => {
                  axe.ticks = [
                    paceBand.fastestSPerKm,
                    paceBand.meanSPerKm,
                    paceBand.slowestSPerKm,
                  ].map((value) => ({ value }));
                },
              }
            : {}),
          ticks: {
            color: INK_SOFT,
            font: { size: 9, family: MONO_STACK },
            maxTicksLimit: 4,
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
  }, [traces, origine, onHoverIndex, paceBand, allures, etroit]);

  if (!data || !options) return null;

  // Sur un cadre étroit, le doigt qui fait défiler la feuille se pose sur le
  // relief : une borne y naîtrait plus souvent par accident que par
  // intention. La carte garde la pose au doigt, elle a l'écran pour elle.
  // Tant que le cadre n'est pas mesuré, le relief ne se laisse pas pointer.
  const pointable = onPick != null && etroit === false;
  // Lu pendant le rendu plutôt qu'en état : `hoverIndex` ne change jamais
  // avant que le graphique n'ait déjà monté et peuplé la ref.
  const survole = hoverIndex != null ? points[hoverIndex] : undefined;
  const chart = chartRef.current;
  const x =
    survole && chart ? chart.scales.x.getPixelForValue(survole.d / 1000) : null;
  // Un disque par échelle : le relief et l'allure se lisent à des hauteurs
  // sans rapport, et un seul repère laisserait deviner l'autre. Le pointillé
  // de la moyenne n'en porte pas, il n'a rien à désigner qui lui soit propre.
  const surReliefY =
    survole && chart ? chart.scales.y.getPixelForValue(survole.ele) : null;
  const allure = survole && paceBand ? paceAt(paceBand, survole.d) : null;
  const surAllureY =
    allure !== null && chart?.scales.yPace
      ? chart.scales.yPace.getPixelForValue(allure)
      : null;

  return (
    <div ref={boiteRef} className="flex h-full flex-col gap-1 p-2">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: le survol et le clic visent un canevas, qui n'a pas d'enfants à focaliser. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: poser une borne au clavier passe par « Ajouter un ravito » et son champ de position, à côté ; viser un pixel du relief n'a pas d'équivalent au clavier. */}
      <div
        ref={cadreRef}
        className={`relative min-h-0 flex-1 ${pointable ? "cursor-crosshair" : ""}`}
        onMouseLeave={() => onHoverIndex?.(null)}
        onClick={(event) => {
          if (!pointable || !onPick || !chartRef.current) return;
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
                {/* Le trait reste inerte, la pastille seule se laisse
                    prendre : elle est la poignée du ravito, et la viser ne
                    doit pas en poser un de plus par-dessus. */}
                {onChoisirMark ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onChoisirMark(mark.rank);
                    }}
                    aria-label={mark.libelle ?? `Ouvrir le ravito ${mark.rank}`}
                    title={mark.libelle ?? `Ravito ${mark.rank}`}
                    // `before` élargit la cible à 32px sans grossir la
                    // pastille : seize pixels se lisent bien et se visent mal.
                    className="-translate-x-1/2 pointer-events-auto absolute top-0 flex size-4 cursor-pointer items-center justify-center rounded-full bg-accent font-mono text-[9px] text-paper transition-colors before:absolute before:-inset-2 before:content-[''] hover:bg-accent-dark"
                  >
                    {mark.rank}
                  </button>
                ) : (
                  <span className="-translate-x-1/2 absolute top-0 flex size-4 items-center justify-center rounded-full bg-accent font-mono text-[9px] text-paper">
                    {mark.rank}
                  </span>
                )}
              </span>
            );
          })}

        {x !== null &&
          [surReliefY, surAllureY].map(
            (y, i) =>
              y !== null && (
                <span
                  // Deux repères d'une même position, l'un sur le relief et
                  // l'autre sur l'allure : leur rang est leur identité.
                  // biome-ignore lint/suspicious/noArrayIndexKey: le rang est l'identité
                  key={i}
                  className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
                  style={{
                    left: x,
                    top: y,
                    backgroundColor: "var(--accent)",
                  }}
                />
              ),
          )}
      </div>
      {legende && <SlopeLegend pace={paceBand != null} />}
    </div>
  );
}

/** L'allure du tronçon qui contient une distance. */
function paceAt(band: PaceBand, distanceM: number): number | null {
  const segment = band.segments.find(
    (s) => distanceM >= s.startM && distanceM <= s.endM,
  );

  return segment?.sPerKm ?? null;
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
function paceSeries(traces: ProfilePoint[], band: PaceBand): number[] {
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
 * « La couleur ne peut jamais porter seule une information » — les seuils de
 * `slopeColor` en texte, ou, quand l'allure a pris la couleur du cadre, ses
 * deux extrêmes en toutes lettres de part et d'autre de la rampe. Jamais les
 * deux : une seule échelle de couleur à la fois.
 */
function SlopeLegend({ pace }: { pace: boolean }) {
  if (pace) {
    return (
      <div className="flex shrink-0 items-center justify-center gap-1.5 px-1 text-[9px] text-ink-soft">
        plus lente
        <span
          className="h-1.5 w-20 rounded-full"
          style={{ backgroundImage: PACE_GRADIENT }}
          aria-hidden="true"
        />
        plus rapide
      </div>
    );
  }

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
