"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";

/** Le libellé d'un champ : un nom, jamais une phrase à l'impératif. */
export function FieldLabel({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label className="text-ink-soft text-xs" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] text-ink-faint leading-relaxed">{children}</p>
  );
}

const CHAMP =
  "w-full rounded-[var(--radius-control)] border border-line bg-paper px-3 py-2 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent";

export function TextField({
  label,
  hint,
  className = "",
  ...props
}: {
  label: string;
  hint?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input id={id} {...props} className={`${CHAMP} ${className}`} />
      {hint && <Hint>{hint}</Hint>}
    </div>
  );
}

/**
 * Une mesure saisie : le nombre en Geist Mono, l'unité posée dans le champ
 * plutôt qu'à côté. Le texte tapé sort tel quel, la conversion attend
 * l'enregistrement.
 */
export function MeasureField({
  label,
  unite,
  hint,
  largeur = "w-full",
  ...props
}: {
  label: string;
  unite: string;
  hint?: ReactNode;
  largeur?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();

  return (
    <div className={`flex flex-col gap-1.5 ${largeur}`}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center rounded-[var(--radius-control)] border border-line bg-paper transition-colors focus-within:border-accent">
        <input
          id={id}
          inputMode="decimal"
          {...props}
          className="w-full min-w-0 bg-transparent py-2 pl-3 font-mono text-[15px] text-ink outline-none placeholder:text-ink-faint"
        />
        <span className="shrink-0 pr-3 pl-1.5 text-ink-soft text-xs">
          {unite}
        </span>
      </div>
      {hint && <Hint>{hint}</Hint>}
    </div>
  );
}
