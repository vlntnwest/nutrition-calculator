import Link from "next/link";
import { entier, km } from "@/format/number";
import { ArrowLeftIcon } from "@/ui/icons";

/**
 * L'identité du plan, tenue en haut de chaque destination : de quelle course
 * on parle, et sur quelle distance. Sous `lg`, elle porte aussi le retour
 * vers l'import, que le rail assure ailleurs.
 */
export function PlanTopBar({
  nom,
  distanceM,
  ascentM,
}: {
  nom: string;
  distanceM: number;
  ascentM: number;
}) {
  return (
    <header className="flex shrink-0 items-center gap-3 border-line border-b bg-paper px-4 py-3 sm:px-6">
      <Link
        href="/"
        aria-label="Revenir à l'import"
        className="-ml-2 flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-ink-soft transition-colors hover:bg-paper-dim hover:text-ink lg:hidden"
      >
        <ArrowLeftIcon className="size-5" />
      </Link>

      <div className="flex min-w-0 flex-1 items-baseline gap-3">
        <h1 className="truncate font-semibold text-[17px] text-ink tracking-tight">
          {nom}
        </h1>
        <p className="hidden shrink-0 font-mono text-[12px] text-ink-soft sm:block">
          {km(distanceM)} km
          <span className="px-1.5 text-ink-faint">·</span>
          D+ {entier(ascentM)} m
        </p>
      </div>

      <p className="shrink-0 font-mono text-[12px] text-ink-soft sm:hidden">
        {km(distanceM)} km
      </p>
    </header>
  );
}
