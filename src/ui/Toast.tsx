"use client";

import type { ReactNode } from "react";
import { CloseIcon } from "./icons";

/**
 * Une remarque posée par-dessus l'écran plutôt que dans son fil : une erreur
 * de sauvegarde arrive n'importe où sur une page qui défile, et attendre
 * qu'on la retrouve en bas serait la manquer. Fixe en tête d'écran, elle se
 * voit d'où qu'on regarde.
 */
export function Toast({
  children,
  onFermer,
}: {
  children: ReactNode;
  onFermer: () => void;
}) {
  return (
    <div
      role="alert"
      className="fixed inset-x-4 top-4 z-30 mx-auto flex max-w-md items-start gap-3 rounded-[var(--radius-panel)] border border-accent/30 bg-accent-tint px-4 py-3 text-[13px] text-accent-dark shadow-[0_8px_24px_#13131326] sm:top-6"
    >
      <span className="min-w-0 flex-1">{children}</span>
      <button
        type="button"
        onClick={onFermer}
        aria-label="Fermer"
        className="shrink-0 cursor-pointer text-accent-dark/70 hover:text-accent-dark"
      >
        <CloseIcon className="size-4" />
      </button>
    </div>
  );
}
