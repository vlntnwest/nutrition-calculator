"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeftIcon,
  PouchIcon,
  RouteIcon,
  SheetIcon,
  StatusDot,
  TargetIcon,
} from "@/ui/icons";
import type { Destination } from "./destinations";

const ICONES: Record<
  Destination["segment"],
  (p: { className: string }) => ReactNode
> = {
  "": RouteIcon,
  cibles: TargetIcon,
  produits: PouchIcon,
  roadbook: SheetIcon,
};

/** L'accent marque où l'on se trouve, la pastille dit ce qui reste à faire. */
function teinte(etat: Destination["etat"]) {
  return etat === "perime" ? "text-accent" : "text-ink-faint";
}

/**
 * Le rail des quatre destinations, à gauche à partir de `lg`. Il porte le
 * nom du produit, les quatre entrées avec leur pastille, et la sortie vers
 * un nouvel import.
 */
export function PlanRail({
  accessId,
  items,
}: {
  accessId: string;
  items: Destination[];
}) {
  const segment = useSelectedLayoutSegment();

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-line border-r bg-paper-dim lg:flex">
      <Link
        href="/"
        className="flex items-center px-5 py-5 font-mono text-ink-soft text-xs uppercase tracking-[0.2em] transition-colors hover:text-ink"
      >
        plan nutrition
      </Link>

      <nav className="flex flex-col gap-0.5 px-3 py-2">
        {items.map((item) => {
          const Icone = ICONES[item.segment];
          const actif = (segment ?? "") === item.segment;

          return (
            <Link
              key={item.nom}
              href={`/plan/${accessId}/${item.segment}`}
              aria-current={actif ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 transition-colors ${
                actif
                  ? "bg-paper text-ink shadow-[var(--shadow-panel)]"
                  : "text-ink-soft hover:bg-paper/60 hover:text-ink"
              }`}
            >
              <Icone
                className={`size-5 shrink-0 ${actif ? "text-accent" : "text-ink-faint"}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] leading-tight">
                  {item.nom}
                </span>
                {item.mention && (
                  <span className="block text-[11px] text-ink-faint leading-tight">
                    {item.mention}
                  </span>
                )}
              </span>
              <StatusDot
                state={item.etat}
                className={`size-3 shrink-0 ${teinte(item.etat)}`}
              />
            </Link>
          );
        })}
      </nav>

      <Link
        href="/"
        className="mt-auto flex items-center gap-2 border-line border-t px-5 py-4 text-[13px] text-ink-soft transition-colors hover:text-accent"
      >
        <ArrowLeftIcon className="size-4" />
        Nouvel import
      </Link>
    </aside>
  );
}

/**
 * Les mêmes quatre destinations au pouce, sous `lg`. Barre fixée au bas de
 * l'écran : c'est la seule navigation en mobile, elle ne défile pas avec le
 * contenu.
 */
export function PlanTabs({
  accessId,
  items,
}: {
  accessId: string;
  items: Destination[];
}) {
  const segment = useSelectedLayoutSegment();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-line border-t bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden">
      {items.map((item) => {
        const Icone = ICONES[item.segment];
        const actif = (segment ?? "") === item.segment;

        return (
          <Link
            key={item.nom}
            href={`/plan/${accessId}/${item.segment}`}
            aria-current={actif ? "page" : undefined}
            className={`relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
              actif ? "text-ink" : "text-ink-soft"
            }`}
          >
            <span className="relative">
              <Icone
                className={`size-5 ${actif ? "text-accent" : "text-ink-faint"}`}
              />
              {item.etat !== "rempli" && (
                <StatusDot
                  state={item.etat}
                  className={`-top-0.5 -right-1.5 absolute size-2.5 ${teinte(item.etat)}`}
                />
              )}
            </span>
            {item.nom}
            {actif && (
              <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-accent" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
