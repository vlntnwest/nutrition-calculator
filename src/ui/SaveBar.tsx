"use client";

import type { ReactNode } from "react";
import { Button } from "./Button";
import { CheckIcon, SpinnerIcon } from "./icons";

/**
 * Le pied d'un écran de saisie, posé hors de la zone qui défile : sur un
 * formulaire long, le bouton reste sous le pouce sans qu'on ait à remonter
 * le chercher, et rien ne passe derrière lui.
 *
 * Le bouton prend toute la largeur au pouce, où la colonne est étroite et où
 * la cible se vise au doigt, et retrouve sa largeur propre à partir de `sm` :
 * étiré sur un catalogue en quatre colonnes, « Enregistrer » cessait d'être
 * un bouton pour devenir une bande. L'état passe alors à sa gauche, sur la
 * même ligne.
 *
 * Sans fond ni filet à elle : ce pied n'est pas la même plaque d'un écran à
 * l'autre — plateau creux sur un formulaire, verre flouté sur la colonne qui
 * flotte au-dessus de la carte — c'est à l'appelant de poser le sien, comme
 * il pose déjà le filet qui le sépare du reste.
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
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-3">
      {children}
      <Button
        ton="encre"
        disabled={pending || !modifie}
        onClick={onSave}
        className="order-1 w-full sm:order-2 sm:w-auto"
      >
        Enregistrer
      </Button>
      <p className="order-2 text-center text-[12px] text-ink sm:order-1 sm:ml-auto sm:text-right">
        {pending ? (
          <span className="flex items-center justify-center gap-1.5 sm:justify-end">
            <SpinnerIcon className="size-3.5" />
            Enregistrement
          </span>
        ) : enregistre ? (
          <span className="flex items-center justify-center gap-1.5 sm:justify-end">
            <CheckIcon className="size-3.5" />
            Enregistré
          </span>
        ) : (
          modifie && consequence
        )}
      </p>
    </div>
  );
}
