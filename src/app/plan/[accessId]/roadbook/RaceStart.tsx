"use client";

import { useState } from "react";
import { clockLabel, fromHM, type HM, toHM } from "@/format/clock";
import { Button } from "@/ui/Button";
import { HeureInput } from "@/ui/Chrono";
import { FieldLabel } from "@/ui/Field";
import { Val } from "@/ui/Measure";
import { ErrorNote } from "@/ui/Notice";
import { usePlanSave } from "../save";

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
 * Le champ s'enregistre seul, sans toucher à la barre du bas : celle-là écrit
 * les retouches de rations, et mêler les deux ferait dépendre une heure de
 * passage d'un enregistrement qui ne la concerne pas.
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
  const [modifie, setModifie] = useState(false);
  const { pending, erreur, enregistre, save, reprise } = usePlanSave(accessId);

  const pose = fromHM(heure);

  function change(fait: () => void) {
    fait();
    setModifie(true);
    reprise();
  }

  function submit() {
    save(
      {
        settings: {
          raceDate: date === "" ? undefined : date,
          startTime: pose,
        },
      },
      () => setModifie(false),
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={`${accessId}-date`}>Date de course</FieldLabel>
          <input
            id={`${accessId}-date`}
            type="date"
            value={date}
            onChange={(event) => change(() => setDate(event.target.value))}
            className="rounded-[var(--radius-control)] border border-line bg-paper px-3 py-2 font-mono text-[15px] text-ink outline-none transition-colors focus:border-accent"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>Départ</FieldLabel>
          <HeureInput
            value={heure}
            onChange={(value) => change(() => setHeure(value))}
          />
        </div>

        {/* Toujours là, désactivé tant que rien n'a bougé : un bouton qui
            apparaît décale ce qui l'entoure au moment même où l'on tape. */}
        <Button
          taille="sm"
          ton="encre"
          disabled={pending || !modifie}
          onClick={submit}
        >
          {pending ? "Enregistrement" : "Enregistrer"}
        </Button>
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
        {enregistre && !modifie && (
          <span className="pl-1.5 text-ink-faint">Enregistré.</span>
        )}
      </p>

      {erreur && <ErrorNote>{erreur}</ErrorNote>}
    </div>
  );
}
