"use client";

import { useState } from "react";
import type { Roadbook } from "@/app/plans/roadbook";
import { type HMS, toHMS, toSecondsHMS } from "@/format/clock";
import { duree, entier, toNumber } from "@/format/number";
import { Button } from "@/ui/Button";
import { Tag } from "@/ui/Chip";
import { ChronoInput } from "@/ui/Chrono";
import { MeasureField } from "@/ui/Field";
import { ChevronIcon, CloseIcon } from "@/ui/icons";

/**
 * Ce qu'on impose à ce secteur : sa durée, sa cible de glucides.
 *
 * Une consigne est une saisie, pas un ajustement du calcul : elle survit à
 * chaque régénération (ADR 011). Le tiroir se referme sur la validation, et
 * la pastille qui reste porte de quoi la retirer.
 */
export function LegImpositions({
  leg,
  cibleGH,
  imposing,
  onImposerDuree,
  onImposerCible,
}: {
  leg: Roadbook["legs"][number];
  /** La cible horaire qui s'applique ici, imposée ou héritée du plan. */
  cibleGH: number;
  imposing: boolean;
  onImposerDuree: (durationS: number | null) => void;
  onImposerCible: (carbsGH: number | null) => void;
}) {
  const [dureeOuverte, setDureeOuverte] = useState(false);
  const [cibleOuverte, setCibleOuverte] = useState(false);
  const [saisieDuree, setSaisieDuree] = useState<HMS>(() =>
    toHMS(leg.imposedDurationS ?? leg.durationS),
  );
  const [saisieCible, setSaisieCible] = useState(String(Math.round(cibleGH)));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
        {leg.imposedDurationS === null ? (
          <Button
            taille="sm"
            ton="contour"
            disabled={imposing}
            onClick={() => setDureeOuverte(!dureeOuverte)}
            aria-expanded={dureeOuverte}
            iconeFin={
              <ChevronIcon
                className={`size-3.5 text-ink-faint ${dureeOuverte ? "rotate-180" : ""}`}
              />
            }
          >
            imposer une durée
          </Button>
        ) : (
          <Tag ton="marque">
            durée imposée {duree(leg.imposedDurationS)}
            <button
              type="button"
              onClick={() => onImposerDuree(null)}
              disabled={imposing}
              aria-label="Retirer la durée imposée"
              className="cursor-pointer disabled:opacity-40"
            >
              <CloseIcon className="size-3" />
            </button>
          </Tag>
        )}

        {leg.imposedCarbsGH === null ? (
          <Button
            taille="sm"
            ton="contour"
            disabled={imposing}
            onClick={() => setCibleOuverte(!cibleOuverte)}
            aria-expanded={cibleOuverte}
            iconeFin={
              <ChevronIcon
                className={`size-3.5 text-ink-faint ${cibleOuverte ? "rotate-180" : ""}`}
              />
            }
          >
            cible {entier(cibleGH)} g/h
          </Button>
        ) : (
          <Tag ton="marque">
            cible imposée {entier(leg.imposedCarbsGH)} g/h
            <button
              type="button"
              onClick={() => onImposerCible(null)}
              disabled={imposing}
              aria-label="Retirer la cible imposée"
              className="cursor-pointer disabled:opacity-40"
            >
              <CloseIcon className="size-3" />
            </button>
          </Tag>
        )}
      </div>

      {dureeOuverte && leg.imposedDurationS === null && (
        <Consigne
          aide="Le temps de mouvement imposé à ce secteur. Les autres se serrent d'autant."
          onValider={() => {
            const secondes = toSecondsHMS(saisieDuree);
            if (secondes !== undefined && secondes > 0) {
              onImposerDuree(secondes);
              setDureeOuverte(false);
            }
          }}
          imposing={imposing}
        >
          <ChronoInput
            value={saisieDuree}
            onChange={setSaisieDuree}
            taille="sm"
          />
        </Consigne>
      )}

      {cibleOuverte && leg.imposedCarbsGH === null && (
        <Consigne
          aide="La cible de glucides de ce seul secteur, quand la cible du plan n'y convient pas."
          onValider={() => {
            const valeur = toNumber(saisieCible);
            if (valeur !== undefined && valeur >= 0) {
              onImposerCible(valeur);
              setCibleOuverte(false);
            }
          }}
          imposing={imposing}
        >
          <MeasureField
            label="Glucides sur ce secteur"
            unite="g/h"
            largeur="w-32"
            value={saisieCible}
            onChange={(event) => setSaisieCible(event.target.value)}
          />
        </Consigne>
      )}
    </>
  );
}

/** Le tiroir d'une consigne : la saisie, puis le geste qui la pose. */
function Consigne({
  aide,
  children,
  onValider,
  imposing,
}: {
  aide: string;
  children: React.ReactNode;
  onValider: () => void;
  imposing: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 border-line border-t bg-paper-dim px-4 py-3">
      <div className="w-40">{children}</div>
      <Button ton="encre" taille="sm" disabled={imposing} onClick={onValider}>
        {imposing ? "Recalcul" : "Imposer et recalculer"}
      </Button>
      <p className="w-full text-[11px] text-ink-faint leading-relaxed">
        {aide}
      </p>
    </div>
  );
}
