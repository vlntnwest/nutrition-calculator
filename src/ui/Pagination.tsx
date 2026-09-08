"use client";

import { IconButton } from "./Button";
import { ArrowLeftIcon, ArrowRightIcon } from "./icons";

/**
 * Une pagination numérotée : un jeu de pages qu'on saisit d'un coup d'œil,
 * jamais un défilement qui cache combien il en reste.
 */
export function Pagination({
  page,
  total,
  onChange,
}: {
  /** La page courante, à partir de 1. */
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (total <= 1) return null;

  return (
    <nav
      aria-label="Pages"
      className="flex items-center justify-center gap-1.5"
    >
      <IconButton
        libelle="Page précédente"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ArrowLeftIcon className="size-4" />
      </IconButton>

      {pageNumbers(page, total).map((p, i) =>
        p === null ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: un point de suspension n'a pas d'identité propre.
          <span key={i} className="px-1 text-ink-faint">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={`flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-control)] font-mono text-[13px] transition-colors ${
              p === page
                ? "bg-ink text-paper"
                : "text-ink-soft hover:bg-paper-dim hover:text-ink"
            }`}
          >
            {p}
          </button>
        ),
      )}

      <IconButton
        libelle="Page suivante"
        disabled={page >= total}
        onClick={() => onChange(page + 1)}
      >
        <ArrowRightIcon className="size-4" />
      </IconButton>
    </nav>
  );
}

/**
 * Les numéros à montrer : les deux bouts toujours entiers, un voisinage
 * autour de la page courante, des points de suspension entre les deux. `null`
 * marque un point de suspension.
 */
function pageNumbers(page: number, total: number): (number | null)[] {
  const voisinage = 1;
  const gardees = new Set<number>([1, total]);

  for (let p = page - voisinage; p <= page + voisinage; p++) {
    if (p >= 1 && p <= total) gardees.add(p);
  }

  const triees = [...gardees].sort((a, b) => a - b);
  const rendu: (number | null)[] = [];

  for (const [i, p] of triees.entries()) {
    if (i > 0 && p - triees[i - 1] > 1) rendu.push(null);
    rendu.push(p);
  }

  return rendu;
}
