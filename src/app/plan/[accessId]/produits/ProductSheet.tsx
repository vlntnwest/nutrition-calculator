"use client";

import Image from "next/image";
import { useId } from "react";
import type { CatalogueEntry } from "@/app/plans/catalogue";
import type { Targets } from "@/core/type";
import { entier, quantite } from "@/format/number";
import { coupeFr, formatFr, nomProduit } from "@/format/produit";
import { Button, IconButton } from "@/ui/Button";
import { CheckIcon, CloseIcon, PlusIcon } from "@/ui/icons";
import { Stat, Val } from "@/ui/Measure";
import { Modal, ModalFoot } from "@/ui/Modal";
import { Rule } from "@/ui/Panel";

/**
 * Le détail d'un produit, ouvert au clic sur une fiche. Fenêtre centrée sur
 * grand écran, feuille montante au pouce : `Modal` porte les deux ancrages.
 */
export function ProductSheet({
  produit,
  dansLeSac,
  cibles,
  onBasculer,
  onFermer,
}: {
  produit: CatalogueEntry;
  dansLeSac: boolean;
  /** Les cibles du plan, pour dire ce que ce produit y couvre. */
  cibles: Targets | undefined;
  onBasculer: () => void;
  onFermer: () => void;
}) {
  const titreId = useId();
  // Combien de doses il faut par heure pour tenir la cible : la seule
  // question qu'on se pose vraiment devant un produit.
  const parHeure =
    cibles && produit.carbsG > 0 ? cibles.carbsGH / produit.carbsG : null;

  return (
    <Modal labelledBy={titreId} onClose={onFermer} largeur="sm:max-w-lg">
      <div className="flex items-start gap-3 p-4 pb-3">
        <span className="relative size-20 shrink-0 overflow-hidden rounded-[var(--radius-control)] bg-paper-dim">
          <Image
            src="/ref.webp"
            alt=""
            fill
            sizes="80px"
            className="object-cover"
          />
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] text-ink-soft uppercase tracking-[0.14em]">
            {produit.brandName}
          </p>
          <h2
            id={titreId}
            className="mt-0.5 font-semibold text-[18px] text-ink leading-tight"
          >
            {nomProduit(produit.name)}
          </h2>
          <p className="mt-1 text-[12px] text-ink-soft">
            {formatFr(produit.formatLabel)}
            <span className="px-1.5 text-ink-faint">·</span>
            {entier(produit.weightG)} g l'unité
            <span className="px-1.5 text-ink-faint">·</span>
            {coupeFr(produit.divisibleBy)}
          </p>
        </div>

        <IconButton libelle="Fermer la fiche" onClick={onFermer}>
          <CloseIcon className="size-4" />
        </IconButton>
      </div>

      <Rule />

      <div className="flex gap-8 px-4 py-4">
        <Stat
          value={quantite(produit.carbsG)}
          unite="g"
          label="glucides"
          taille="lg"
        />
        <Stat
          value={entier(produit.sodiumMg)}
          unite="mg"
          label="sodium"
          taille="lg"
        />
        <Stat
          value={entier(produit.energyKcal)}
          unite="kcal"
          label="énergie"
          taille="lg"
        />
      </div>

      <Rule />

      <dl className="px-4 py-1">
        <Ligne nom="Mélange de sucres">
          {produit.multiTransportable
            ? "glucose et fructose annoncés, au-delà de 60 g/h c'est ce qui passe"
            : "une seule source annoncée, à compléter au-delà de 60 g/h"}
        </Ligne>
        <Ligne nom="Ce qu'il apporte à boire">
          {produit.fluidMl && produit.fluidMl > 0 ? (
            <>
              se dilue dans <Val unite="mL">{entier(produit.fluidMl)}</Val>
            </>
          ) : (
            "rien, il se prend à part de la boisson"
          )}
        </Ligne>
        <Ligne nom="Poids embarqué">
          <Val unite="g">{entier(produit.weightG)}</Val> l'unité
        </Ligne>
      </dl>

      {parHeure && cibles && (
        <p className="px-4 pt-2 pb-4 text-[13px] text-ink-soft leading-relaxed">
          À <Val unite="g/h">{cibles.carbsGH}</Val> visés, il en faut{" "}
          <Val>
            {parHeure.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
          </Val>{" "}
          par heure pour couvrir la cible à lui seul, soit{" "}
          <Val unite="mg">{entier(parHeure * produit.sodiumMg)}</Val> de sodium
          dans le même temps.
        </p>
      )}

      <ModalFoot>
        <Button ton="retrait" onClick={onFermer}>
          fermer
        </Button>
        <Button
          ton={dansLeSac ? "contour" : "encre"}
          icone={
            dansLeSac ? (
              <CheckIcon className="size-4" />
            ) : (
              <PlusIcon className="size-4" />
            )
          }
          onClick={onBasculer}
        >
          {dansLeSac ? "Retirer du sac" : "Ajouter à mon sac"}
        </Button>
      </ModalFoot>
    </Modal>
  );
}

function Ligne({ nom, children }: { nom: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-line border-b py-2.5 last:border-b-0">
      <dt className="shrink-0 text-[13px] text-ink-soft">{nom}</dt>
      <dd className="text-right text-[13px] text-ink">{children}</dd>
    </div>
  );
}
