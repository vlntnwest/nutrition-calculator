import type { Roadbook } from "@/app/plans/roadbook";
import { clockLabel } from "@/format/clock";
import { duree, entier, km } from "@/format/number";
import { Releve, Val } from "@/ui/Measure";
import { legBounds, startOf } from "../format";

/** L'identité du secteur : où il va, combien il dure, ce qu'il monte. */
export function LegHeader({
  leg,
  index,
  legs,
  startTime,
  totalM,
}: {
  leg: Roadbook["legs"][number];
  index: number;
  legs: Roadbook["legs"];
  startTime: Roadbook["startTime"];
  totalM: number;
}) {
  // Un secteur se nomme par ses bornes, pas par un numéro — voir `legBounds`.
  const bornes = legBounds(legs, index);

  return (
    <header className="px-4 pt-3.5 pb-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 font-semibold text-[15px] text-ink">
          {bornes.depart}
          <span className="px-1.5 font-normal text-ink-faint">→</span>
          {bornes.arrivee}
        </h3>
        {/* Un chrono nu en haut d'une carte se lit comme une heure de la
            journée. Il porte donc ce qu'il est : la durée de mouvement de
            ce seul secteur, arrêts exclus (ADR 010). Ce qui se lit vraiment
            comme une heure est la ligne d'en dessous, et elle le dit. */}
        <p className="shrink-0 text-right">
          <span className="block font-mono text-[13px] text-ink">
            {duree(leg.durationS)}
          </span>
          <span className="block text-[11px] text-ink-faint">de mouvement</span>
        </p>
      </div>
      <p className="mt-0.5 text-[12px] text-ink-soft">
        <span className="font-mono">
          {km(startOf(legs, index))} → {km(leg.endPositionM ?? totalM)} km
        </span>
        <span className="px-1.5 text-ink-faint">·</span>
        <span className="font-mono">
          +{entier(leg.ascentM)} m / −{entier(leg.descentM)} m
        </span>
      </p>
      {/* L'heure de passage quand la course a une heure de départ, le temps
          écoulé sinon : dans les deux cas, où l'on en est.

          Sur le premier secteur et sans heure de départ, le temps écoulé
          est la durée du secteur : la répéter en dessous n'apprend rien.
          L'heure de passage, elle, vaut dès le premier — c'est un nombre
          que la durée ne donne pas. */}
      <Releve
        className="mt-1 text-[12px]"
        items={[
          startTime ? (
            <>
              passage vers <Val>{clockLabel(startTime, leg.elapsedS)}</Val>
            </>
          ) : (
            leg.rank > 1 && (
              <>
                <Val>{duree(leg.elapsedS)}</Val> depuis le départ
              </>
            )
          ),
          leg.stopS !== null && (
            <>
              <Val>{duree(leg.stopS)}</Val> d'arrêt
            </>
          ),
        ]}
      />
    </header>
  );
}
