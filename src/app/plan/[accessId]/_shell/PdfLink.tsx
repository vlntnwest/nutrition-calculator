"use client";

import { Button, IconButton } from "@/ui/Button";
import { DownloadIcon } from "@/ui/icons";
import { useRetouches } from "./RetouchesEnCours";

type Tenue = "icone" | "bouton";

/**
 * Le déclencheur du PDF, dans ses deux tenues : l'icône contre le partage en
 * haut de la coquille, le bouton nommé en bas du Roadbook.
 *
 * Il refuse de partir tant que le Roadbook porte des retouches non
 * enregistrées. La feuille ne rend que l'état de la base (voir
 * `docs/pdf-du-roadbook.md`, section 2.2) : un lien qui marcherait
 * téléchargerait autre chose que ce qui est à l'écran. Un bouton inerte le
 * dit par le geste, au moment où le coureur le tente ; la barre du bas le dit
 * déjà en mots, et les deux se répondent.
 *
 * Une ancre et non un appel : le fichier a une URL, le navigateur sait la
 * télécharger, et le serveur envoie déjà le bon nom avec son
 * `Content-Disposition`.
 *
 * `sale` entre en propriété plutôt que de se lire ici : la décision se teste
 * alors sans DOM ni effet, et `PdfLink` n'a plus qu'à brancher le contexte.
 */
export function PdfTrigger({
  accessId,
  tenue,
  sale,
}: {
  accessId: string;
  tenue: Tenue;
  sale: boolean;
}) {
  const href = `/plan/${accessId}/roadbook/pdf`;
  const libelle = sale
    ? "Enregistrez les retouches avant de télécharger la feuille"
    : "Télécharger la feuille";

  if (tenue === "icone") {
    return sale ? (
      <IconButton libelle={libelle} disabled className="-my-1.5 self-center">
        <DownloadIcon className="size-4.5" />
      </IconButton>
    ) : (
      <a
        href={href}
        aria-label={libelle}
        title={libelle}
        className="-my-1.5 inline-flex size-9 shrink-0 cursor-pointer items-center justify-center self-center rounded-[var(--radius-control)] text-ink-soft transition-colors hover:bg-paper-dim hover:text-ink"
      >
        <DownloadIcon className="size-4.5" />
      </a>
    );
  }

  return sale ? (
    <Button
      icone={<DownloadIcon className="size-4" />}
      disabled
      title={libelle}
    >
      Télécharger la feuille
    </Button>
  ) : (
    <a
      href={href}
      title={libelle}
      className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-paper px-5 font-medium text-ink text-sm transition-colors hover:bg-paper-dim active:bg-paper-sunk"
    >
      <DownloadIcon className="size-4" />
      Télécharger la feuille
    </a>
  );
}

/** Le même, branché sur l'état que le Roadbook déclare. */
export function PdfLink({
  accessId,
  tenue,
}: {
  accessId: string;
  tenue: Tenue;
}) {
  return <PdfTrigger accessId={accessId} tenue={tenue} sale={useRetouches()} />;
}
