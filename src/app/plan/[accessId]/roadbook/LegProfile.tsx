"use client";

import { useState } from "react";
import type { Roadbook } from "@/app/plans/getRoadbook";
import type { ProfilePoint } from "@/core/type";
import { paceLabel } from "@/format/clock";
import { km } from "@/format/number";
import { ElevationChart, type Gouttieres } from "@/ui/track/ElevationChart";
import { legPaceSPerKm, startOf } from "./format";

/**
 * Le relief et l'allure, tenus en tête pendant que les secteurs défilent
 * derrière.
 *
 * La bande d'allure sous le profil découpe la course en secteurs, chacun
 * large à proportion de sa distance et rempli à proportion de sa lenteur.
 * Le remplissage n'est jamais seul à dire quoi que ce soit : l'allure est
 * écrite dedans, et la feuille s'imprime en noir et blanc.
 *
 * La bande se cale sur le relief tracé, pas sur la largeur du composant :
 * Chart.js réserve à gauche la place des altitudes et à droite celle de la
 * dernière graduation, et une bande posée bord à bord glissait de ces
 * gouttières — le bouton d'un secteur tombait à côté du bout de relief qu'il
 * décrit, d'autant plus loin que l'écran était large. Le graphique rend ses
 * gouttières, la bande les reprend, et les deux se superposent au pixel.
 */
export function LegProfile({
  points,
  legs,
  totalM,
  actif,
  onChoisir,
}: {
  points: ProfilePoint[];
  legs: Roadbook["legs"];
  totalM: number;
  /** Le rang du secteur en cours de lecture. */
  actif: number | null;
  onChoisir: (rank: number) => void;
}) {
  const [gouttieres, setGouttieres] = useState<Gouttieres | null>(null);
  const allures = legs.map((_, i) => legPaceSPerKm(legs, i, totalM));
  const connues = allures.filter((a): a is number => a !== null);
  // La référence est l'allure moyenne de la course, et l'échelle un écart de
  // vingt pour cent autour d'elle. Normaliser aux extrêmes ferait passer
  // quinze secondes de différence pour un gouffre.
  const moyenne =
    connues.length === 0
      ? 0
      : connues.reduce((t, a) => t + a, 0) / connues.length;
  const ECART_PLEIN = 0.2;

  // Tant que le graphique n'a pas mesuré son cadre, la bande reste au bord :
  // une gouttière devinée serait fausse à coup sûr, une gouttière nulle n'est
  // fausse que d'un rendu.
  const calage = {
    paddingLeft: gouttieres?.gauche ?? 0,
    paddingRight: gouttieres?.droite ?? 0,
  };

  return (
    <div>
      <div className="h-32 sm:h-40">
        <ElevationChart
          points={points}
          legende={false}
          onCadre={setGouttieres}
          marks={legs.flatMap((leg) =>
            leg.endPositionM === null
              ? []
              : [{ rank: leg.rank, positionM: leg.endPositionM }],
          )}
        />
      </div>

      {/* Ni retrait horizontal, ni gouttière : un secteur doit mesurer
          exactement la part de trace qu'il décrit, et tout ce qui se pose
          entre deux boutons se prend sur la largeur avant le partage
          proportionnel. Le `px-1` de chaque bouton valait huit pixels fixes
          par secteur — soixante-douze sur neuf, plus huit de gouttière, sur
          les deux cent quatre-vingt-douze de la zone tracée : un quart de la
          bande partait hors proportion, et les bornes s'éloignaient d'autant
          de leurs traits sur le relief. La séparation se dessine donc à
          l'intérieur de la barre, où elle ne coûte rien à la mise en page. */}
      <div className="flex pb-2" style={calage}>
        {legs.map((leg, i) => {
          const debut = startOf(legs, i);
          const fin = leg.endPositionM ?? totalM;
          const dernier = i === legs.length - 1;
          const allure = allures[i];
          // 0,5 sur la moyenne, 0 à vingt pour cent plus rapide, 1 autant
          // plus lent.
          const lenteur =
            allure === null || moyenne === 0
              ? 0.5
              : Math.min(
                  Math.max(0.5 + (allure / moyenne - 1) / (2 * ECART_PLEIN), 0),
                  1,
                );

          return (
            <button
              key={leg.rank}
              type="button"
              onClick={() => onChoisir(leg.rank)}
              style={{ flexGrow: Math.max(fin - debut, 1) }}
              className={`flex min-w-0 basis-0 cursor-pointer flex-col items-center gap-0.5 rounded-[4px] py-1.5 text-center transition-colors ${
                actif === leg.rank
                  ? "ring-1 ring-accent ring-inset"
                  : "hover:ring-1 hover:ring-line-strong hover:ring-inset"
              }`}
            >
              {/* Le filet qui sépare deux secteurs est pris sur la barre,
                  jamais entre elles. Les deux bouts de la course s'arrondissent,
                  le reste est jointif : la bande est une seule mesure découpée,
                  pas une file de pastilles. */}
              <span
                className={`h-1.5 w-full border-paper ${dernier ? "rounded-r-full" : "border-r"} ${i === 0 ? "rounded-l-full" : ""}`}
                style={{
                  backgroundColor: `color-mix(in srgb, var(--ink) ${Math.round(10 + lenteur * 60)}%, var(--paper-sunk))`,
                }}
              />
              <span className="w-full truncate px-0.5 font-mono text-[10px] text-ink-soft">
                {paceLabel(leg.durationS, fin - debut) ?? `s${leg.rank}`}
              </span>
            </button>
          );
        })}
      </div>

      <p
        className="flex items-baseline justify-between gap-4 pb-2 text-[10px] text-ink-faint"
        style={calage}
      >
        <span className="shrink-0">départ</span>
        <span className="hidden truncate text-center sm:block">
          allure moyenne par secteur, en minutes par kilomètre, arrêts exclus
        </span>
        <span className="shrink-0">{km(totalM)} km</span>
      </p>
    </div>
  );
}
