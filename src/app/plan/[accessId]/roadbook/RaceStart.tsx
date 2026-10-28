"use client";

import { useState } from "react";
import { savePlan } from "@/app/plans/actions";
import { clockLabel, fromHM, type HM, toHM } from "@/format/clock";
import { HeureInput } from "@/ui/Chrono";
import { FieldLabel } from "@/ui/Field";
import { Val } from "@/ui/Measure";
import { ErrorNote } from "@/ui/Notice";
import { useAutosave } from "../save";

/**
 * La date et l'heure de départ, saisies là où elles servent.
 *
 * Elles n'entrent dans aucun calcul — `survives` les écarte explicitement, et
 * les écrire ne périme pas le roadbook. Ce qu'elles font est de traduire les
 * durées du plan en heures de la journée : le coureur ne lit pas « 4 h 12 de
 * course » au ravito, il lève les yeux sur une horloge. C'est donc ici, en
 * tête du roadbook, qu'elles se posent, et pas sur l'écran des réglages
 * d'allure où elles n'auraient rien réglé du tout.
 *
 * Les deux champs s'écrivent seuls, sans passer par les retouches de rations :
 * une heure de passage n'a pas à attendre un rejeu du calcul qui ne la
 * concerne pas.
 */
export function RaceStart({
  accessId,
  raceDate,
  startTime,
  arriveeS,
}: {
  accessId: string;
  /** `AAAA-MM-JJ`, tel que la colonne `date` le rend. */
  raceDate: string | undefined;
  /** `HH:MM`, tel que la colonne `time` le rend. */
  startTime: string | undefined;
  /** La durée totale du plan, pour annoncer l'heure d'arrivée. */
  arriveeS: number;
}) {
  const [date, setDate] = useState(raceDate ?? "");
  const [heure, setHeure] = useState<HM>(toHM(startTime));

  const pose = fromHM(heure);
  const erreur = useAutosave(
    { settings: { raceDate: date === "" ? undefined : date, startTime: pose } },
    (patch) => savePlan(accessId, patch),
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={`${accessId}-date`}>Date de course</FieldLabel>
          <input
            id={`${accessId}-date`}
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-[var(--radius-control)] border border-line bg-paper px-3 py-2 font-mono text-[15px] text-ink outline-none transition-colors focus:border-accent"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>Départ</FieldLabel>
          <HeureInput value={heure} onChange={setHeure} />
        </div>
      </div>

      <p className="text-[12px] text-ink-soft leading-relaxed">
        {pose ? (
          <>
            Les secteurs portent leur heure de passage, arrivée vers{" "}
            <Val>{clockLabel(pose, arriveeS)}</Val>.
          </>
        ) : (
          "Sans heure de départ, les secteurs portent le temps écoulé depuis le départ."
        )}
      </p>

      {erreur && <ErrorNote>{erreur}</ErrorNote>}
    </div>
  );
}
