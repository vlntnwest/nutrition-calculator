"use client";

import { type Ref, useRef } from "react";
import { digitsOnly, type HM, type HMS } from "@/format/clock";

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
  unite = true,
  ref,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  taille: "sm" | "md";
  /** L'unité écrite sous la case. Une heure de la journée s'en passe. */
  unite?: boolean;
  ref?: Ref<HTMLInputElement>;
}) {
  return (
    <label className="flex flex-col items-center gap-1">
      <input
        ref={ref}
        value={value}
        onChange={(event) => onChange(digitsOnly(event.target.value))}
        inputMode="numeric"
        placeholder="00"
        aria-label={label}
        // Une case tient deux chiffres, jamais la largeur qu'un parent lui
        // cède : en `flex-1` elle s'étirait à la largeur de la colonne, un
        // chrono ne se lit plus alors comme sur une montre.
        className={`rounded-[var(--radius-control)] border border-line bg-paper text-center font-mono text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent ${
          taille === "sm" ? "w-11 py-1.5 text-base" : "w-14 py-2 text-lg"
        }`}
      />
      {unite && (
        <span className="text-[10px] text-ink-soft uppercase">{label}</span>
      )}
    </label>
  );
}

/**
 * Une heure de la journée : deux cases séparées d'un deux-points.
 *
 * Elle se saisit ainsi et pas par `<input type="time">`, dont chaque
 * navigateur dessine une horloge différente, en Arial et sans les chiffres
 * tabulaires du carnet. Le focus saute au deuxième chiffre, comme sur le
 * chrono dont elle reprend la grammaire.
 *
 * Une différence avec lui, et c'est ce qui les distingue à l'œil : le chrono
 * écrit `h`, `min`, `s` sous ses cases parce qu'une durée peut porter
 * n'importe laquelle des trois. Une heure n'en a qu'une lecture possible, le
 * deux-points la donne, et les libellés ne feraient que hausser le champ —
 * il ne s'alignerait plus sur ce qui l'accompagne. Le lecteur d'écran, lui,
 * garde les deux noms.
 */
export function HeureInput({
  value,
  onChange,
  taille = "sm",
}: {
  value: HM;
  onChange: (value: HM) => void;
  taille?: "sm" | "md";
}) {
  const minute = useRef<HTMLInputElement>(null);

  return (
    <div className="flex w-[6.5rem] items-center gap-1.5">
      <Case
        label="heures"
        unite={false}
        taille={taille}
        value={value.h}
        onChange={(h) => {
          onChange({ ...value, h });
          if (h.length === 2) minute.current?.focus();
        }}
      />
      <span aria-hidden="true" className="font-mono text-ink-faint">
        :
      </span>
      <Case
        ref={minute}
        label="minutes"
        unite={false}
        taille={taille}
        value={value.m}
        onChange={(m) => onChange({ ...value, m })}
      />
    </div>
  );
}
