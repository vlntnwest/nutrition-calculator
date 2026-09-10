"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { loadOfficialRaceTrack, startOfficialRace } from "@/app/plans/actions";
import type { OfficialRace } from "@/app/plans/officialRaces";
import { rememberPlan } from "@/app/plans/stored";
import type { ResolvedPoint } from "@/core/type";
import { planImageUrl } from "@/format/plan";
import { ImportRaceModal } from "./ImportRaceModal";

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
 * Cliquer ouvre une fiche, pas un plan : le chrono s'y demande, et c'est sa
 * confirmation qui tire la copie du modèle. Sans elle, parcourir le catalogue
 * laissait un plan derrière chaque coup d'œil.
 *
 * La fiche s'ouvre sans attendre la trace du modèle, qui pèse jusqu'à un
 * mégaoctet et demi : la roue tourne dans le cadre du tracé, le nom et le
 * chrono se saisissent à côté, et le plan s'ouvre même si elle n'arrive
 * jamais. La copie ne la fait pas transiter par ici, elle se fait en base.
 *
 * La copie est un plan neuf, avec son propre lien, sa trace et ses ravitos
 * déjà posés. Le modèle, lui, reste hors de portée — l'écran n'en connaît que
 * le `slug`.
 */
export function PlanCards({ races }: { races: OfficialRace[] }) {
  const [choisie, setChoisie] = useState<OfficialRace | null>(null);
  const [trace, setTrace] = useState<{
    points: ResolvedPoint[] | null;
    erreur: string | null;
  }>({ points: null, erreur: null });
  const demande = useRef(0);
  const router = useRouter();

  function open(race: OfficialRace) {
    // Une carte ouverte pendant qu'une autre trace arrive : le rang jette la
    // réponse en retard plutôt que de la poser sur la fiche du moment.
    const rang = ++demande.current;

    setChoisie(race);
    setTrace({ points: null, erreur: null });

    void loadOfficialRaceTrack(race.slug).then((lue) => {
      if (rang !== demande.current) return;

      setTrace(
        lue.ok
          ? { points: lue.value, erreur: null }
          : {
              points: null,
              erreur:
                "Le tracé n'a pas pu être lu. Le plan s'ouvre quand même.",
            },
      );
    });
  }

  /**
   * Le message rendu rouvre la fiche dessus ; `null` la laisse se refermer
   * sur la navigation.
   */
  async function confirm(nom: string, targetTimeS: number | undefined) {
    if (!choisie) return "La course a été perdue. Rouvrez la carte.";

    const started = await startOfficialRace(choisie.slug, {
      name: nom,
      targetTimeS,
    });

    if (!started.ok) return started.error;

    rememberPlan(started.value);
    router.push(`/plan/${started.value}`);

    return null;
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
            onClick={() => open(race)}
            className="absolute inset-0 flex flex-col text-left"
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
                Modèle
              </span>
            </div>

            <div className="absolute top-1/2 left-0 w-full z-10 flex flex-1 items-center px-1 opacity-50 -translate-y-1/2">
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

            <div className="absolute bottom-0 left-0 w-full z-10 flex items-center justify-between gap-2 px-5 pt-3 pb-5">
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

      {choisie && (
        <ImportRaceModal
          source={{
            kind: "officielle",
            race: choisie,
            points: trace.points,
            traceError: trace.erreur,
          }}
          onCancel={() => setChoisie(null)}
          onConfirm={confirm}
        />
      )}
    </>
  );
}
