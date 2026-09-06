"use client";

import { type ReactNode, useEffect, useRef } from "react";

/**
 * La fiche qui s'ouvre par-dessus le reste. `<dialog>` natif : il porte
 * lui-même le focus, le piège au clavier et la fermeture sur Échap, et
 * `onClose` écoute la fermeture quelle qu'en soit la cause.
 *
 * En dessous de `sm` elle monte du bas et s'ancre au pied de l'écran, au
 * pouce ; au-dessus elle se centre. Même fiche, deux ancrages.
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
      className={`m-0 mt-auto max-h-[92dvh] w-full rounded-t-[var(--radius-sheet)] border border-line bg-paper p-0 text-ink shadow-[var(--shadow-lifted)] backdrop:bg-[var(--veil-ink)] backdrop:backdrop-blur-md sm:m-auto sm:max-h-[88dvh] sm:w-[calc(100%-2rem)] sm:rounded-[var(--radius-sheet)] ${largeur}`}
    >
      {children}
    </dialog>
  );
}

/** Le pied d'une fiche : ce qui l'annule à gauche, ce qui l'engage à droite. */
export function ModalFoot({ children }: { children: ReactNode }) {
  return (
    <footer className="sticky bottom-0 flex items-center justify-between gap-4 border-line border-t bg-paper-dim px-5 py-3.5">
      {children}
    </footer>
  );
}
