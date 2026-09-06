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
  const plusLente = Math.max(...connues, 1);
  const plusRapide = Math.min(...connues, plusLente);

  return (
    <div className="border-line border-b bg-paper">
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

      <div className="flex gap-px px-2 pb-2">
        {legs.map((leg, i) => {
          const debut = startOf(legs, i);
          const fin = leg.endPositionM ?? totalM;
          const allure = allures[i];
          // De 0 pour le secteur le plus rapide à 1 pour le plus lent.
          const lenteur =
            allure === null || plusLente === plusRapide
              ? 0
              : (allure - plusRapide) / (plusLente - plusRapide);

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
                  backgroundColor: `color-mix(in srgb, var(--ink) ${Math.round(12 + lenteur * 58)}%, var(--paper-sunk))`,
                }}
              />
              <span className="truncate font-mono text-[10px] text-ink-soft">
                {paceLabel(leg.durationS, fin - debut) ?? `s${leg.rank}`}
              </span>
            </button>
          );
        })}
      </div>

      <p className="flex justify-between px-3 pb-2 text-[10px] text-ink-faint">
        <span>départ</span>
        <span>
          allure moyenne par secteur, en minutes par kilomètre, arrêts exclus
        </span>
        <span>{km(totalM)} km</span>
      </p>
    </div>
  );
}
