import type { ReactNode } from "react";

/**
 * Un relevé : la valeur en Geist Mono, son unité en retrait, ce qu'elle
 * mesure en dessous. Toutes les mesures du carnet passent par là, donc elles
 * s'alignent d'un écran à l'autre.
 */
export function Stat({
  value,
  unite,
  label,
  taille = "md",
}: {
  value: ReactNode;
  unite?: string;
  label: string;
  taille?: "sm" | "md" | "lg";
}) {
  const tailles = { sm: "text-base", md: "text-xl", lg: "text-3xl" };

  return (
    <div>
      <div className="flex items-baseline gap-1">
        <span className={`font-mono text-ink ${tailles[taille]}`}>{value}</span>
        {unite && <span className="text-ink-soft text-xs">{unite}</span>}
      </div>
      <p className="text-[11px] text-ink-faint">{label}</p>
    </div>
  );
}

/**
 * Une suite de mesures sur une ligne, séparées par le point médian. Les
 * entrées absentes disparaissent sans laisser de séparateur orphelin.
 */
export function Releve({
  items,
  className = "",
}: {
  items: (ReactNode | null | false)[];
  className?: string;
}) {
  const gardes = items.filter(Boolean);

  return (
    <p className={`text-[13px] text-ink-soft ${className}`}>
      {gardes.map((item, i) => (
        // Les entrées d'un relevé n'ont que leur rang pour identité, et la
        // liste se reconstruit entièrement à chaque rendu.
        // biome-ignore lint/suspicious/noArrayIndexKey: le rang est l'identité
        <span key={i}>
          {i > 0 && <span className="px-1.5 text-ink-faint">·</span>}
          {item}
        </span>
      ))}
    </p>
  );
}

/**
 * Une valeur chiffrée au fil du texte. L'unité se passe à part : dans la
 * fonte mono son espace de séparation est large, et « 225 g » se lisait
 * « 225  g ». Le chiffre garde le mono, l'unité reprend la fonte du texte.
 */
export function Val({
  children,
  unite,
}: {
  children: ReactNode;
  unite?: string;
}) {
  return (
    <>
      <span className="font-mono text-ink">{children}</span>
      {unite && <> {unite}</>}
    </>
  );
}
