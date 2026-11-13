import { DownloadIcon } from "@/ui/icons";

type Tenue = "icone" | "bouton";

const LIBELLE = "Télécharger la feuille";

/**
 * Le déclencheur du PDF, dans ses deux tenues : l'icône contre le partage en
 * haut de la coquille, le bouton nommé en bas du Roadbook.
 *
 * La feuille ne rend que l'état de la base (voir `docs/pdf-du-roadbook.md`,
 * section 2.2). Chaque retouche s'y écrit au clic : il n'y a plus d'écart à
 * attendre, et le lien part toujours.
 *
 * Une ancre et non un appel : le fichier a une URL, le navigateur sait la
 * télécharger, et le serveur envoie déjà le bon nom avec son
 * `Content-Disposition`.
 */
export function PdfLink({
  accessId,
  tenue,
}: {
  accessId: string;
  tenue: Tenue;
}) {
  const href = `/plan/${accessId}/roadbook/pdf`;

  if (tenue === "icone") {
    return (
      <a
        href={href}
        aria-label={LIBELLE}
        title={LIBELLE}
        className="-my-1.5 inline-flex size-9 shrink-0 cursor-pointer items-center justify-center self-center rounded-[var(--radius-control)] text-ink-soft transition-colors hover:bg-paper-dim hover:text-ink"
      >
        <DownloadIcon className="size-4.5" />
      </a>
    );
  }

  return (
    <a
      href={href}
      title={LIBELLE}
      className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-paper px-5 font-medium text-ink text-sm transition-colors hover:bg-paper-dim active:bg-paper-sunk"
    >
      <DownloadIcon className="size-4" />
      {LIBELLE}
    </a>
  );
}
