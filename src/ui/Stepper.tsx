"use client";

import { quantite } from "@/format/number";
import { MinusIcon, PlusIcon } from "./icons";

/**
 * La quantité d'une ration. Le pas suit le produit : un gel se finit, une
 * barre se casse en deux. Les deux cibles font 36 px de haut, atteignables au
 * pouce sans loupe.
 */
export function Stepper({
  value,
  pas,
  max,
  libelle,
  onChange,
}: {
  value: number;
  pas: number;
  /** Ce que la ration ne peut pas dépasser — une boisson tient dans ses
   * flasques. Absent, rien ne la borne. */
  max?: number;
  /** Ce qu'on ajoute ou retire, pour nommer les deux boutons. */
  libelle: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center rounded-[var(--radius-control)] border border-line bg-paper">
      <Cran
        libelle={`Retirer ${quantite(pas)} de ${libelle}`}
        onClick={() => onChange(value - pas)}
        disabled={value - pas < 0}
      >
        <MinusIcon className="size-4" />
      </Cran>
      <span className="min-w-9 text-center font-mono text-[15px] text-ink tabular-nums">
        {quantite(value)}
      </span>
      <Cran
        libelle={`Ajouter ${quantite(pas)} de ${libelle}`}
        onClick={() => onChange(value + pas)}
        disabled={max !== undefined && value + pas > max}
      >
        <PlusIcon className="size-4" />
      </Cran>
    </div>
  );
}

function Cran({
  libelle,
  onClick,
  disabled,
  children,
}: {
  libelle: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={libelle}
      title={libelle}
      onClick={onClick}
      disabled={disabled}
      className="flex size-9 cursor-pointer items-center justify-center rounded-[var(--radius-control)] text-ink-soft transition-colors hover:bg-paper-dim hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}
