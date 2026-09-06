"use client";

import type { Roadbook } from "@/app/plans/getRoadbook";
import type { ProfilePoint } from "@/core/type";
import { paceLabel } from "@/format/clock";
import { km } from "@/format/number";
import { ElevationChart } from "@/ui/track/ElevationChart";
import { legPaceSPerKm, startOf } from "./format";

/**
 * Le relief et l'allure, tenus en tête pendant que les secteurs défilent
 * derrière.
 *
 * La bande d'allure sous le profil découpe la course en secteurs, chacun
 * large à proportion de sa distance et rempli à proportion de sa lenteur.
 * Le remplissage n'est jamais seul à dire quoi que ce soit : l'allure est
 * écrite dedans, et la feuille s'imprime en noir et blanc.
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

  return (
    <div>
      <div className="h-32 sm:h-40">
        <ElevationChart
          points={points}
          legende={false}
          marks={legs.flatMap((leg) =>
            leg.endPositionM === null
              ? []
              : [{ rank: leg.rank, positionM: leg.endPositionM }],
          )}
        />
      </div>

      <div className="flex gap-px pb-2">
        {legs.map((leg, i) => {
          const debut = startOf(legs, i);
          const fin = leg.endPositionM ?? totalM;
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
              className={`flex min-w-0 basis-0 cursor-pointer flex-col items-center gap-0.5 rounded-[4px] px-1 py-1.5 text-center transition-colors ${
                actif === leg.rank
                  ? "ring-1 ring-accent ring-inset"
                  : "hover:ring-1 hover:ring-line-strong hover:ring-inset"
              }`}
            >
              <span
                className="h-1.5 w-full rounded-full"
                style={{
                  backgroundColor: `color-mix(in srgb, var(--ink) ${Math.round(10 + lenteur * 60)}%, var(--paper-sunk))`,
                }}
              />
              <span className="truncate font-mono text-[10px] text-ink-soft">
                {paceLabel(leg.durationS, fin - debut) ?? `s${leg.rank}`}
              </span>
            </button>
          );
        })}
      </div>

      <p className="flex items-baseline justify-between gap-4 pb-2 text-[10px] text-ink-faint">
        <span className="shrink-0">départ</span>
        <span className="hidden truncate text-center sm:block">
          allure moyenne par secteur, en minutes par kilomètre, arrêts exclus
        </span>
        <span className="shrink-0">{km(totalM)} km</span>
      </p>
    </div>
  );
}
