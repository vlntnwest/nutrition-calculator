"use client";

import { useId } from "react";

/**
 * Un réglage continu, avec sa valeur chiffrée en regard : la position du
 * curseur donne l'ordre de grandeur, le nombre donne la valeur. Les bornes
 * sont écrites sous la piste, jamais laissées à deviner.
 */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unite,
  bornes,
  aide,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** L'unité affichée à côté de la valeur. Vide pour un réglage sans unité. */
  unite?: string;
  /** Ce qu'on lit sous les deux extrémités de la piste. */
  bornes?: [string, string];
  aide?: string;
  onChange: (value: number) => void;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-ink text-[13px]" htmlFor={id}>
          {label}
        </label>
        {/* Un réglage sans unité déclarée n'a pas de nombre qui parle : le
            curseur se lit à sa position et aux bornes écrites dessous, pas à
            une valeur brute (0,25) que rien ne traduit. */}
        {unite && (
          <span className="font-mono text-[15px] text-ink">
            {value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
            <span className="pl-1 text-ink-soft text-xs">{unite}</span>
          </span>
        )}
      </div>

      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-6 w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-paper [&::-moz-range-thumb]:bg-accent [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-paper-sunk [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-paper-sunk [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-paper [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-[0_1px_3px_#13131359]"
      />

      {bornes && (
        <div className="flex justify-between text-[10px] text-ink-faint">
          <span>{bornes[0]}</span>
          <span>{bornes[1]}</span>
        </div>
      )}
      {aide && <p className="text-[11px] text-ink-faint">{aide}</p>}
    </div>
  );
}
