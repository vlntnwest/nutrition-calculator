import type { SelectHTMLAttributes } from "react";
import { ChevronIcon } from "./icons";

/**
 * Une liste déroulante native, habillée du chevron du carnet.
 *
 * `appearance: none` retire celui que le système dessine : à côté des
 * chevrons du jeu d'icônes, sur la même carte, deux traits différents se
 * voyaient. Le reste du comportement natif est gardé tel quel, c'est ce que
 * le clavier et le tactile attendent.
 */
export function Select({
  className = "",
  taille = "sm",
  mesure = false,
  children,
  ...props
}: {
  /** `sm` au fil d'une ligne, `md` quand la liste est le champ d'un formulaire. */
  taille?: "sm" | "md";
  /** La valeur retenue est un relevé : elle se lit en Geist Mono tabulaire. */
  mesure?: boolean;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  const tailles = {
    sm: "py-1.5 pr-8 pl-2.5 text-[13px]",
    md: "py-2 pr-9 pl-3 text-[15px]",
  };

  return (
    <span className={`relative inline-flex ${className}`}>
      <select
        {...props}
        className={`w-full cursor-pointer appearance-none rounded-[var(--radius-control)] border border-line bg-paper text-ink outline-none transition-colors focus:border-accent ${tailles[taille]} ${mesure ? "font-mono" : ""}`}
      >
        {children}
      </select>
      <ChevronIcon
        className={`pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-ink-faint ${taille === "md" ? "right-3" : "right-2"}`}
      />
    </span>
  );
}
