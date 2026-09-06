"use client";

import { type Ref, useRef } from "react";
import { digitsOnly, type HMS } from "@/format/clock";

/**
 * Un chrono se saisit en trois cases de deux chiffres, jamais en boutons plus
 * ou moins ni en champ unique. Les décisions du canvas le posent ainsi, et
 * une durée de course se relit à l'œil comme sur une montre.
 */
export function ChronoInput({
  value,
  onChange,
  taille = "md",
}: {
  value: HMS;
  onChange: (value: HMS) => void;
  taille?: "sm" | "md";
}) {
  const minute = useRef<HTMLInputElement>(null);
  const seconde = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-end gap-1.5">
      <Case
        label="h"
        taille={taille}
        value={value.h}
        onChange={(h) => {
          onChange({ ...value, h });
          if (h.length === 2) minute.current?.focus();
        }}
      />
      <Case
        ref={minute}
        label="min"
        taille={taille}
        value={value.m}
        onChange={(m) => {
          onChange({ ...value, m });
          if (m.length === 2) seconde.current?.focus();
        }}
      />
      <Case
        ref={seconde}
        label="s"
        taille={taille}
        value={value.s}
        onChange={(s) => onChange({ ...value, s })}
      />
    </div>
  );
}

function Case({
  label,
  value,
  onChange,
  taille,
  ref,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  taille: "sm" | "md";
  ref?: Ref<HTMLInputElement>;
}) {
  return (
    <label className="flex flex-1 flex-col items-center gap-1">
      <input
        ref={ref}
        value={value}
        onChange={(event) => onChange(digitsOnly(event.target.value))}
        inputMode="numeric"
        placeholder="00"
        aria-label={label}
        className={`w-full rounded-[var(--radius-control)] border border-line bg-paper text-center font-mono text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent ${
          taille === "sm" ? "py-1.5 text-base" : "py-2 text-lg"
        }`}
      />
      <span className="text-[10px] text-ink-soft uppercase">{label}</span>
    </label>
  );
}
