"use client";

import type { ReactNode } from "react";
import { Button } from "./Button";
import { CheckIcon, SpinnerIcon } from "./icons";

/**
 * Le pied d'un écran de saisie, posé hors de la zone qui défile : sur un
 * formulaire long, le bouton reste sous le pouce sans qu'on ait à remonter
 * le chercher, et rien ne passe derrière lui.
 */
export function SaveBar({
  pending,
  modifie,
  enregistre,
  consequence,
  onSave,
  children,
}: {
  pending: boolean;
  /** Des changements attendent d'être écrits. */
  modifie: boolean;
  /** Le dernier enregistrement a abouti et rien n'a bougé depuis. */
  enregistre: boolean;
  /** Ce que l'enregistrement entraînera, dit avant de le déclencher. */
  consequence?: ReactNode;
  onSave: () => void;
  /** Une action secondaire, posée à gauche. */
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-line border-t bg-veil px-4 py-3 sm:px-6">
      {children}
      <div className="ml-auto flex items-center gap-3">
        <p className="text-[12px] text-ink-soft">
          {pending ? (
            <span className="flex items-center gap-1.5">
              <SpinnerIcon className="size-3.5" />
              Enregistrement
            </span>
          ) : enregistre ? (
            <span className="flex items-center gap-1.5 text-ink">
              <CheckIcon className="size-3.5" />
              Enregistré
            </span>
          ) : (
            modifie && consequence
          )}
        </p>
        <Button ton="encre" disabled={pending || !modifie} onClick={onSave}>
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
