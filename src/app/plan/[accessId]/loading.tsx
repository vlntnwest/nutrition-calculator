import { SpinnerIcon } from "@/ui/icons";

/**
 * Ce que Next montre pendant qu'une destination se rend.
 *
 * Sa raison d'être n'est pas d'occuper l'œil : sans limite de chargement, une
 * route dynamique n'est **pas** préextraite du tout, et le clic sur un onglet
 * attend l'aller-retour serveur entier sans que rien ne bouge à l'écran.
 * Posée ici, elle rend la coquille préextractible, Next bascule aussitôt et
 * laisse l'écran arriver en flux derrière.
 *
 * Une seule pour les quatre destinations : le rail, la barre du haut et les
 * onglets appartiennent à la disposition et ne clignotent pas. Et la roue
 * d'attente plutôt qu'un squelette : elle est l'un des quatre mouvements du
 * carnet, un squelette qui bat en serait un cinquième.
 */
export default function Loading() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <SpinnerIcon className="size-6 text-ink-faint" />
      <span className="sr-only">Chargement</span>
    </div>
  );
}
