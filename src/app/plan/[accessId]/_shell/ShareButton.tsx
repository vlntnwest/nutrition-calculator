"use client";

import { useEffect, useState } from "react";
import { IconButton } from "@/ui/Button";
import { CheckIcon, ShareIcon } from "@/ui/icons";

/** Ce que le bouton vient de faire, le temps qu'on le lise. */
type Etat = "repos" | "copie" | "refus";

/** Assez pour lire une ligne, trop court pour rester en travers du titre. */
const TENUE_MS = 5000;

/**
 * Ce que le bouton dit une fois le lien parti. Le refus nomme ce qui bloque
 * puis l'action qui débloque : la barre d'adresse porte le même lien.
 */
const MESSAGES: Record<Etat, string> = {
  repos: "",
  copie: "Lien copié. Qui l'ouvre peut modifier le plan.",
  refus: "La copie a échoué. Prenez le lien dans la barre d'adresse.",
};

/**
 * Le lien du plan, passé à qui doit l'ouvrir.
 *
 * Le lien *est* le droit d'entrée : il n'y a pas de compte, et qui l'ouvre
 * peut modifier le plan (ADR 003). La phrase le dit au moment où le lien
 * part, seul moment où elle a une chance d'être lue.
 *
 * Le partage du système d'abord, là où il existe : sur un téléphone il ouvre
 * les applications de messagerie, ce que le presse-papier ne fait pas. Ailleurs,
 * la copie. Un partage refermé sans choisir n'est pas un échec et ne retombe
 * pas sur la copie.
 *
 * Le lien se reconstruit sur `/plan/{accessId}` plutôt que de reprendre
 * l'adresse courante : on partage un plan, pas la destination où l'on se
 * trouve dedans.
 */
export function ShareButton({
  accessId,
  nom,
}: {
  accessId: string;
  nom: string;
}) {
  const [etat, setEtat] = useState<Etat>("repos");

  useEffect(() => {
    if (etat === "repos") return;

    const timer = setTimeout(() => setEtat("repos"), TENUE_MS);

    return () => clearTimeout(timer);
  }, [etat]);

  async function partager() {
    const lien = `${window.location.origin}/plan/${accessId}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: nom, url: lien });

        return;
      } catch (error) {
        // La feuille de partage refermée : rien à annoncer, rien à copier.
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(lien);
      setEtat("copie");
    } catch {
      setEtat("refus");
    }
  }

  const message = MESSAGES[etat];

  return (
    <>
      <IconButton
        libelle={etat === "copie" ? "Lien copié" : "Partager le plan"}
        onClick={() => void partager()}
        className="-my-1.5 self-center"
      >
        {etat === "copie" ? (
          <CheckIcon className="size-4.5" />
        ) : (
          <ShareIcon className="size-4.5" />
        )}
      </IconButton>

      {/* Deux pièces, une besogne chacune. `<output>` porte `role="status"`
          de lui-même et reste hors du flux : il annonce le résultat du geste
          sans voler le focus ni pousser le titre. Le texte visible, lui, ne
          paraît qu'à partir de `sm`, où il reste de la place à côté du nom de
          la course. */}
      <output className="sr-only">{message}</output>

      {message && (
        <span
          aria-hidden="true"
          className="hidden min-w-0 truncate text-[11px] text-ink-soft sm:block"
        >
          {message}
        </span>
      )}
    </>
  );
}
