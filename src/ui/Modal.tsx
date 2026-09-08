"use client";

import { type ReactNode, useEffect, useRef } from "react";

/**
 * La fiche qui s'ouvre par-dessus le reste. `<dialog>` natif : il porte
 * lui-même le focus, le piège au clavier et la fermeture sur Échap, et
 * `onClose` écoute la fermeture quelle qu'en soit la cause.
 *
 * En dessous de `sm` elle monte du bas et s'ancre au pied de l'écran, au
 * pouce ; au-dessus elle se centre. Même fiche, deux ancrages.
 *
 * Les deux ancrages se posent par `inset`, jamais par les marges. La feuille
 * de style du navigateur centre un `<dialog>` avec `margin: auto` et le borne
 * à `calc(100% - 6px - 2em)` : neutraliser cette marge pour l'ancrer en bas
 * lui retirait aussi son centrage, et la fiche tombait dans le coin bas
 * gauche, plus étroite que l'écran d'une quarantaine de pixels. `max-w-none`
 * relève la borne, `inset-x-0` tient les deux bords.
 */
export function Modal({
  labelledBy,
  onClose,
  largeur = "max-w-lg",
  children,
}: {
  /** L'identifiant du titre de la fiche, pour la nommer au lecteur d'écran. */
  labelledBy: string;
  onClose: () => void;
  largeur?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    dialog.showModal();

    function fermeture() {
      onCloseRef.current();
    }

    dialog.addEventListener("close", fermeture);

    return () => dialog.removeEventListener("close", fermeture);
  }, []);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: ferme sur le clic hors contenu ; le clavier ferme déjà nativement, via Échap.
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClick={(event) => {
        // Un clic sur le fond (`::backdrop`) cible la boîte elle-même, jamais
        // son contenu : c'est ce qui distingue « en dehors ».
        if (event.target === ref.current) ref.current?.close();
      }}
      className={`fixed inset-x-0 top-auto bottom-0 m-0 max-h-[92dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-[var(--radius-sheet)] border border-line border-b-0 bg-paper p-0 text-ink shadow-[var(--shadow-lifted)] backdrop:bg-[var(--veil-ink)] backdrop:backdrop-blur-md sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[88dvh] sm:w-[calc(100%-2rem)] sm:rounded-[var(--radius-sheet)] sm:border-b ${largeur}`}
    >
      {children}
    </dialog>
  );
}

/**
 * Le pied d'une fiche : ce qui l'annule à gauche, ce qui l'engage à droite.
 *
 * Ancré au bord bas de l'écran au pouce, il reprend la réserve du système
 * sous lui : sans elle, le bouton d'engagement passe derrière la barre de
 * navigation du téléphone.
 */
export function ModalFoot({ children }: { children: ReactNode }) {
  return (
    <footer className="sticky bottom-0 flex items-center justify-between gap-4 border-line border-t bg-paper-dim px-5 pt-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:pb-3.5">
      {children}
    </footer>
  );
}
