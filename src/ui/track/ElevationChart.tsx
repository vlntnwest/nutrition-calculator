"use client";

import {
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import type { ProfilePoint } from "@/core/type";
import { chartData, paceSeries } from "./chartData";
import { chartOptions } from "./chartOptions";
import { LARGEUR_SUPERPOSITION, POINTS_TRACES } from "./chartTheme";
import type {
  Gouttieres,
  PaceAxisRange,
  PaceBand,
  ProfileMark,
} from "./chartTypes";
import { SlopeLegend } from "./SlopeLegend";

ChartJS.register(LinearScale, PointElement, LineElement, Filler, Tooltip);

// Les types vivent à part, mais c'est d'ici qu'on importe le graphique : les
// écrans qui le posent n'ont pas à connaître son découpage.
export type { Gouttieres, PaceAxisRange, PaceBand, ProfileMark };

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
  onDeplacerMark,
  onCadre,
  paceBand,
  paceAxisRange,
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
   * Rend l'abscisse visée pendant qu'on glisse une pastille, en continu.
   * Absent, la pastille s'ouvre au clic mais ne se déplace pas — c'est le cas
   * du roadbook, où une borne de secteur n'est pas à elle seule un ravito
   * qu'on repose.
   */
  onDeplacerMark?: (rank: number, positionM: number) => void;
  /**
   * Rend les gouttières d'axes du cadre tracé, en pixels, pour ce qui vient
   * s'aligner sous le graphique. Voir `Gouttieres`.
   */
  onCadre?: (gouttieres: Gouttieres) => void;
  paceBand?: PaceBand | null;
  /**
   * Fixe l'axe d'allure sur ces bornes plutôt que sur celles, mouvantes, de
   * `paceBand`. Absent, l'axe continue de s'ajuster à `paceBand` — le cas du
   * roadbook, où rien ne la fait varier sous les yeux.
   */
  paceAxisRange?: PaceAxisRange | null;
  legende?: boolean;
}) {
  const chartRef = useRef<ChartJS<"line"> | null>(null);
  /** Le rang de la pastille en cours de glisser, tant qu'un doigt la tient. */
  const [glissee, setGlissee] = useState<number | null>(null);
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

  const data = useMemo(
    () => chartData({ traces, relief, allures, paceBand }),
    [traces, relief, allures, paceBand],
  );

  const options = useMemo(
    () =>
      chartOptions({
        traces,
        origine,
        allures,
        paceBand,
        paceAxisRange,
        etroit,
        onHoverIndex,
        onResize: () => redessiner((n) => n + 1),
      }),
    [traces, origine, onHoverIndex, paceBand, paceAxisRange, allures, etroit],
  );

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
                // Le rang seul, jamais l'abscisse : au glisser, la position
                // change à chaque frame, et une clé qui bouge avec elle
                // démonterait la pastille en plein geste — perdant la capture
                // du pointeur qui le porte.
                key={mark.rank}
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
                    onPointerDown={
                      onDeplacerMark &&
                      ((event) => {
                        event.stopPropagation();
                        onChoisirMark(mark.rank);
                        event.currentTarget.setPointerCapture(event.pointerId);
                        setGlissee(mark.rank);
                      })
                    }
                    onPointerMove={
                      onDeplacerMark &&
                      ((event) => {
                        const cadre = cadreRef.current;
                        if (glissee !== mark.rank || !chart || !cadre) return;

                        const zone = cadre.getBoundingClientRect();
                        const km = chart.scales.x.getValueForPixel(
                          event.clientX - zone.left,
                        );
                        if (km == null) return;

                        const total = points[points.length - 1].d;
                        onDeplacerMark(
                          mark.rank,
                          Math.min(Math.max(km * 1000, 0), total),
                        );
                      })
                    }
                    onPointerUp={
                      onDeplacerMark &&
                      ((event) => {
                        event.currentTarget.releasePointerCapture(
                          event.pointerId,
                        );
                        setGlissee(null);
                      })
                    }
                    aria-label={mark.libelle ?? `Ouvrir le ravito ${mark.rank}`}
                    title={mark.libelle ?? `Ravito ${mark.rank}`}
                    // `before` élargit la cible à 32px sans grossir la
                    // pastille : seize pixels se lisent bien et se visent mal.
                    // `touch-none` retire le geste tactile par défaut (faire
                    // défiler la page) là où la pastille se glisse au doigt.
                    className={`-translate-x-1/2 pointer-events-auto absolute top-0 flex size-4 items-center justify-center rounded-full bg-accent font-mono text-[9px] text-paper transition-colors before:absolute before:-inset-2 before:content-[''] hover:bg-accent-dark ${
                      onDeplacerMark
                        ? "touch-none cursor-grab active:cursor-grabbing"
                        : "cursor-pointer"
                    }`}
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

/** L'allure du tronçon qui contient une distance. */
function paceAt(band: PaceBand, distanceM: number): number | null {
  const segment = band.segments.find(
    (s) => distanceM >= s.startM && distanceM <= s.endM,
  );

  return segment?.sPerKm ?? null;
}
