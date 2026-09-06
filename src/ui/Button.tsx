import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * L'encre porte les actions de l'outil, le papier les actions secondaires,
 * le texte nu ce qui se défait. L'accent ne descend jamais dans un bouton :
 * il est réservé aux marques de la course et à l'endroit où l'on se trouve.
 */
type Ton = "encre" | "contour" | "discret" | "retrait";
type Taille = "sm" | "md";

const TONS: Record<Ton, string> = {
  encre:
    "bg-ink text-paper hover:bg-ink/85 active:bg-ink disabled:bg-ink/40 shadow-[0_1px_2px_#17130f26]",
  contour:
    "border border-line-strong bg-paper text-ink hover:bg-paper-dim active:bg-paper-sunk",
  discret: "text-ink-soft hover:text-ink hover:bg-paper-dim",
  retrait: "text-ink-soft hover:text-accent underline underline-offset-2",
};

const TAILLES: Record<Taille, string> = {
  sm: "h-8 gap-1.5 px-3 text-[13px]",
  md: "h-10 gap-2 px-5 text-sm",
};

export function Button({
  ton = "contour",
  taille = "md",
  icone,
  iconeFin,
  children,
  className = "",
  ...props
}: {
  ton?: Ton;
  taille?: Taille;
  icone?: ReactNode;
  iconeFin?: ReactNode;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const forme =
    ton === "retrait"
      ? "inline-flex items-center gap-1.5 text-sm"
      : `inline-flex items-center justify-center rounded-[var(--radius-control)] font-medium ${TAILLES[taille]}`;

  return (
    <button
      type="button"
      {...props}
      className={`${forme} ${TONS[ton]} cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {icone}
      {children}
      {iconeFin}
    </button>
  );
}

/**
 * Un bouton qui ne porte qu'une icône. Le libellé passe en `title` et en nom
 * accessible : rien ne se pilote à l'icône seule au lecteur d'écran.
 */
export function IconButton({
  libelle,
  children,
  className = "",
  ...props
}: {
  libelle: string;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={libelle}
      title={libelle}
      {...props}
      className={`inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-control)] text-ink-soft transition-colors hover:bg-paper-dim hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}
