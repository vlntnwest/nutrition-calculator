import type { ReactNode } from "react";

/**
 * La surface de travail du plan : du papier cerné d'un filet, pas une carte
 * qui flotte. L'ombre reste au repli mobile et aux fiches qui s'ouvrent
 * par-dessus le reste.
 */
export function Panel({
  children,
  className = "",
  ton = "papier",
}: {
  children: ReactNode;
  className?: string;
  ton?: "papier" | "creux" | "marque" | "nu";
}) {
  const fonds = {
    papier: "bg-paper border-line",
    creux: "bg-paper-dim border-line",
    marque: "bg-paper border-accent ring-1 ring-accent/15",
    /* Sur un voile, pour les blocs qui ne portent pas de saisie : le papier
       plein est réservé aux surfaces où l'on écrit et où l'on lit. */
    nu: "bg-transparent border-line",
  };

  return (
    <section
      className={`rounded-[var(--radius-panel)] border ${fonds[ton]} ${className}`}
    >
      {children}
    </section>
  );
}

/** L'en-tête d'un panneau : un nom à gauche, une mesure ou une action à droite. */
export function PanelHead({
  titre,
  aide,
  children,
}: {
  titre: ReactNode;
  aide?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex items-baseline justify-between gap-3 px-4 pt-3.5 pb-3">
      <div className="min-w-0">
        <h2 className="font-medium text-[13px] text-ink">{titre}</h2>
        {aide && <p className="mt-0.5 text-[11px] text-ink-faint">{aide}</p>}
      </div>
      {children}
    </header>
  );
}

/** Un filet horizontal. Le seul séparateur du carnet. */
export function Rule({ className = "" }: { className?: string }) {
  return <div className={`h-px bg-line ${className}`} aria-hidden="true" />;
}

/**
 * L'étiquette d'un relevé, en capitales espacées et en Geist Mono : elle
 * nomme une colonne ou une mesure qui n'a pas de titre à elle. Jamais posée
 * au-dessus d'un titre, où elle ne serait qu'une surtitre décorative.
 */
export function Onglet({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[10px] text-ink-soft uppercase tracking-[0.14em]">
      {children}
    </span>
  );
}
