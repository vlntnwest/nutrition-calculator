"use client";

import { useState } from "react";
import type { Flask } from "@/core/type";
import { toNumber } from "@/format/number";
import { Button, IconButton } from "@/ui/Button";
import { ToggleChip } from "@/ui/Chip";
import { MeasureField } from "@/ui/Field";
import { PlusIcon, TrashIcon } from "@/ui/icons";
import { EmptyNote } from "@/ui/Notice";
import { Panel, PanelHead, Rule } from "@/ui/Panel";

/** `id` n'est jamais écrit : il tient l'identité d'une ligne pendant la saisie. */
export type FlaskRow = { id: string; volumeMl: string; onlyWater: boolean };

let compteur = 0;

function nouvelId(): string {
  compteur += 1;

  return `flasque-${compteur}`;
}

export function useFlaskRows(flasks: Flask[]) {
  return useState<FlaskRow[]>(
    flasks.map((f) => ({
      id: nouvelId(),
      volumeMl: String(f.volumeMl),
      onlyWater: f.onlyWater,
    })),
  );
}

/** Les contenances déjà lisibles, pour la synthèse affichée au fil de la saisie. */
export function volumesLisibles(lignes: FlaskRow[]): Flask[] {
  return lignes.flatMap((ligne) => {
    const volumeMl = toNumber(ligne.volumeMl);

    return volumeMl === undefined || volumeMl <= 0
      ? []
      : [{ volumeMl, onlyWater: ligne.onlyWater }];
  });
}

export function FlaskTable({
  lignes,
  onChange,
}: {
  lignes: FlaskRow[];
  onChange: (suite: FlaskRow[]) => void;
}) {
  return (
    <Panel>
      <PanelHead
        titre="Flasques emportées"
        aide="Sans flasque, le roadbook ne dit pas où verser la boisson."
      />
      <Rule />

      <div className="flex flex-col gap-3 p-4">
        {lignes.length === 0 && (
          <EmptyNote titre="Rien à porter pour l'instant">
            Ajoutez au moins un contenant : le calcul a besoin de savoir dans
            quoi la boisson part.
          </EmptyNote>
        )}

        {lignes.map((ligne, i) => (
          <div key={ligne.id} className="flex items-end gap-3">
            {/* Le libellé du champ dit déjà « Flasque N » : une icône
                de flasque identique à côté ne distingue rien, elle
                répète ce que le texte a déjà dit. */}
            <MeasureField
              label={`Flasque ${i + 1}`}
              unite="mL"
              placeholder="500"
              largeur="w-32"
              value={ligne.volumeMl}
              onChange={(event) =>
                onChange(
                  lignes.map((l, j) =>
                    j === i ? { ...l, volumeMl: event.target.value } : l,
                  ),
                )
              }
            />

            <div className="flex flex-1 items-center gap-2 pb-1">
              <ToggleChip
                actif={ligne.onlyWater}
                onChange={(onlyWater) =>
                  onChange(
                    lignes.map((l, j) => (j === i ? { ...l, onlyWater } : l)),
                  )
                }
              >
                eau claire seulement
              </ToggleChip>
            </div>

            <div className="pb-1">
              <IconButton
                libelle={`Retirer la flasque ${i + 1}`}
                onClick={() => onChange(lignes.filter((_, j) => j !== i))}
              >
                <TrashIcon className="size-4" />
              </IconButton>
            </div>
          </div>
        ))}

        <Button
          taille="sm"
          icone={<PlusIcon className="size-4" />}
          className="self-start"
          onClick={() =>
            onChange([
              ...lignes,
              { id: nouvelId(), volumeMl: "500", onlyWater: false },
            ])
          }
        >
          Ajouter une flasque
        </Button>
      </div>
    </Panel>
  );
}
