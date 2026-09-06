import type { ReactNode } from "react";
import { WarnIcon } from "./icons";

/**
 * Une remarque du calcul. Le pictogramme et le mot portent l'alerte ; la
 * teinte ne fait que confirmer, pour que la feuille imprimée en noir et
 * blanc dise la même chose que l'écran.
 */
export function Notice({
  ton = "alerte",
  code,
  children,
}: {
  ton?: "alerte" | "neutre";
  /** Le code du noyau, gardé lisible : c'est lui qu'on cite dans un rapport. */
  code?: string;
  children: ReactNode;
}) {
  const alerte = ton === "alerte";

  return (
    <div
      className={`flex gap-2.5 rounded-[var(--radius-control)] border px-3 py-2.5 ${
        alerte
          ? "border-warn/25 bg-warn-tint text-warn"
          : "border-line bg-paper-dim text-ink-soft"
      }`}
    >
      {alerte && <WarnIcon className="mt-px size-4 shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-relaxed">{children}</p>
        {code && (
          <p className="mt-1 font-mono text-[10px] opacity-70">{code}</p>
        )}
      </div>
    </div>
  );
}

/** Le message d'un refus : ce qui bloque, puis ce qui débloque. */
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-[var(--radius-control)] border border-accent/30 bg-accent-tint px-3 py-2.5 text-[13px] text-accent-dark"
    >
      {children}
    </p>
  );
}

/** Ce qu'on lit quand il n'y a encore rien. */
export function EmptyNote({
  titre,
  children,
}: {
  titre: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-line border-dashed px-5 py-8 text-center">
      <p className="text-[15px] text-ink">{titre}</p>
      {children && (
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-ink-soft leading-relaxed">
          {children}
        </p>
      )}
    </div>
  );
}
