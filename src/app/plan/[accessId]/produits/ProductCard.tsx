"use client";

import Image from "next/image";
import type { CatalogueEntry } from "@/app/plans/catalogue";
import { entier, quantite } from "@/format/number";
import { formatFr, nomProduit } from "@/format/produit";
import { CheckIcon, PlusIcon } from "@/ui/icons";
import { Onglet } from "@/ui/Panel";

/**
 * Une fiche du catalogue. Le corps ouvre le détail, le pied pose ou retire
 * du sac : deux gestes distincts, jamais imbriqués l'un dans l'autre.
 *
 * L'image est un substitut commun à tout le catalogue tant qu'aucune photo
 * n'est en base. Le jour où elles arrivent, seule sa source change.
 */
export function ProductCard({
  produit,
  dansLeSac,
  onOuvrir,
  onBasculer,
}: {
  produit: CatalogueEntry;
  dansLeSac: boolean;
  onOuvrir: () => void;
  onBasculer: () => void;
}) {
  return (
    <article
      className={`flex flex-col overflow-hidden rounded-[var(--radius-panel)] border transition-colors ${
        dansLeSac
          ? "border-ink bg-paper"
          : "border-line bg-paper hover:border-line-strong"
      }`}
    >
      <button
        type="button"
        onClick={onOuvrir}
        className="flex flex-1 cursor-pointer flex-col text-left"
      >
        <span className="relative block aspect-[3/2] w-full overflow-hidden bg-paper-dim">
          <Image
            src="/ref.webp"
            alt=""
            fill
            sizes="(min-width: 1280px) 22vw, (min-width: 640px) 30vw, 48vw"
            className="object-cover"
          />
          <span className="absolute top-2 left-2.5">
            <Onglet>{formatFr(produit.formatLabel)}</Onglet>
          </span>
        </span>

        <span className="flex flex-1 flex-col gap-0.5 px-3 pt-2.5 pb-3">
          <span className="font-mono text-[10px] text-ink-soft uppercase tracking-[0.14em]">
            {produit.brandName}
          </span>
          <span className="text-[14px] text-ink leading-snug">
            {nomProduit(produit.name)}
          </span>
          <span className="mt-1 font-mono text-[11px] text-ink-soft">
            {quantite(produit.carbsG)} g glucides
            <span className="px-1 text-ink-faint">·</span>
            {entier(produit.sodiumMg)} mg sodium
          </span>
        </span>
      </button>

      <div className="flex items-center justify-between gap-2 border-line border-t px-3 py-2">
        <span className="font-mono text-[11px] text-ink-faint">
          {produit.fluidMl && produit.fluidMl > 0
            ? `${entier(produit.fluidMl)} mL`
            : `${entier(produit.weightG)} g`}
        </span>

        <button
          type="button"
          onClick={onBasculer}
          aria-pressed={dansLeSac}
          className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 font-medium text-[12px] transition-colors ${
            dansLeSac
              ? "border-ink bg-ink text-paper"
              : "border-line-strong text-ink hover:border-ink hover:bg-paper-dim"
          }`}
        >
          {dansLeSac ? (
            <>
              <CheckIcon className="size-3.5" />
              dans le sac
            </>
          ) : (
            <>
              <PlusIcon className="size-3.5" />
              ajouter
            </>
          )}
        </button>
      </div>
    </article>
  );
}
