"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { startOfficialRace } from "@/app/plans/actions";
import type { OfficialRace } from "@/app/plans/officialRaces";
import { rememberPlan } from "@/app/plans/stored";
import { planImageUrl } from "@/format/plan";

const metres = new Intl.NumberFormat("fr-FR");

function kilometres(distanceM: number) {
  return (distanceM / 1000).toLocaleString("fr-FR", {
    maximumFractionDigits: 1,
  });
}

/**
 * Les cartes-affiche des courses officielles : photo pleine, profil tracé,
 * plaque de relevé.
 *
 * Cliquer n'ouvre pas le modèle, il en tire une copie : un plan neuf, avec
 * son propre lien, sa trace et ses ravitos déjà posés. Le modèle, lui, reste
 * hors de portée — l'écran n'en connaît que le `slug`.
 */
export function PlanCards({ races }: { races: OfficialRace[] }) {
  const [ouverture, setOuverture] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const router = useRouter();

  async function open(race: OfficialRace) {
    if (ouverture) return;

    setOuverture(race.slug);
    setErreur(null);

    const started = await startOfficialRace(race.slug);

    if (!started.ok) {
      setOuverture(null);
      setErreur(started.error);

      return;
    }

    rememberPlan(started.value);
    router.push(`/plan/${started.value}`);
  }

  return (
    <>
      {races.map((race) => (
        <article
          key={race.slug}
          className="relative min-h-[280px] min-w-[280px] flex-1 overflow-hidden rounded-[var(--radius-sheet)] bg-ink"
        >
          <button
            type="button"
            onClick={() => void open(race)}
            disabled={ouverture !== null}
            className="absolute inset-0 flex flex-col text-left disabled:cursor-progress"
          >
            <Image
              src={planImageUrl(race.slug)}
              alt=""
              fill
              unoptimized
              sizes="(min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
            {/* Un seul fondu, haut et bas : sombre pour le titre, clair sur
                le tracé, puis noyé dans l'encre pour la plaque de relevé —
                pas de panneau plaqué, juste la photo qui s'éteint. */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(23,19,15,.75) 0%, rgba(23,19,15,.14) 24%, transparent 42%, transparent 56%, rgba(23,19,15,.55) 72%, rgba(23,19,15,.9) 88%, rgba(23,19,15,.98) 100%)",
              }}
            />

            <div className="relative z-10 flex items-start justify-between gap-2 p-5">
              <h3 className="max-w-[70%] text-2xl font-bold text-balance tracking-tight text-paper leading-[1.05] sm:text-3xl">
                {race.name}
              </h3>
              <span className="shrink-0 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 font-mono text-[10px] text-paper tracking-wide backdrop-blur-sm">
                {ouverture === race.slug ? "Ouverture…" : "Modèle"}
              </span>
            </div>

            <div className="relative z-10 flex flex-1 items-center px-1 opacity-50">
              <svg
                viewBox="0 0 400 160"
                preserveAspectRatio="none"
                className="h-20 w-full sm:h-24"
                aria-hidden="true"
              >
                <path
                  d={race.profilePath}
                  vectorEffect="non-scaling-stroke"
                  fill="none"
                  stroke="var(--paper)"
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="relative z-10 flex items-center justify-between gap-2 px-5 pt-3 pb-5">
              <p className="font-mono text-paper text-xs tracking-wide sm:text-sm">
                {kilometres(race.distanceM)} km · D+{" "}
                {metres.format(race.ascentM)} m · {race.aidStationCount} ravito
                {race.aidStationCount > 1 ? "s" : ""} posé
                {race.aidStationCount > 1 ? "s" : ""}
              </p>
            </div>
          </button>
        </article>
      ))}

      {erreur && (
        <p role="alert" className="w-full text-accent text-sm">
          {erreur}
        </p>
      )}
    </>
  );
}
