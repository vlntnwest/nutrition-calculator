"use client";

import type { ReactNode } from "react";
import { CheckIcon, CloseIcon } from "./icons";

/**
 * Un choix qui se pose ou se retire d'un coup. Coché, il prend l'accent et
 * une coche : la teinte ne dit jamais l'état à elle seule.
 */
export function ToggleChip({
  actif,
  onChange,
  children,
}: {
  actif: boolean;
  onChange: (actif: boolean) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={() => onChange(!actif)}
      className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors ${
        actif
          ? "border-accent bg-accent-tint text-accent-dark"
          : "border-line bg-paper text-ink-soft hover:border-line-strong hover:text-ink"
      }`}
    >
      {actif && <CheckIcon className="size-3.5" />}
      {children}
    </button>
  );
}

/** Un filtre posé, avec la croix qui le défait. */
export function FilterChip({
  onRemove,
  children,
}: {
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex h-8 items-center gap-1 rounded-full border border-accent/40 bg-accent-tint pr-1.5 pl-3 text-[13px] text-accent-dark">
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Retirer le filtre ${children}`}
        className="flex size-5 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-accent/20"
      >
        <CloseIcon className="size-3" />
      </button>
    </span>
  );
}

/** Une mention posée sur une fiche : un état, un format, un compte. */
export function Tag({
  ton = "neutre",
  children,
}: {
  ton?: "neutre" | "marque" | "alerte";
  children: ReactNode;
}) {
  const tons = {
    neutre: "border-line bg-paper-dim text-ink-soft",
    marque: "border-accent/40 bg-accent-tint text-accent-dark",
    alerte: "border-line-strong bg-paper-sunk text-ink",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${tons[ton]}`}
    >
      {children}
    </span>
  );
}
