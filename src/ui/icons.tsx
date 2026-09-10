import type { SVGProps } from "react";

/**
 * Un seul jeu, un seul trait : grille de 24, contour de 1,6, bouts et
 * jonctions arrondis, jamais de remplissage. Les wireframes notaient les
 * pictogrammes en caractères Unicode ; ils se dessinent ici.
 */
function Glyph({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

type IconProps = Omit<SVGProps<SVGSVGElement>, "children">;

/** Course : le relief, et la borne qu'on y pose. */
export function RouteIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M3 17 8.2 8.5l3.4 5.2L15.5 6 21 17" />
      <path d="M3 20.2h18" strokeOpacity={0.35} />
      <circle cx="11.6" cy="13.7" r="1.5" />
    </Glyph>
  );
}

/** Cibles : ce qu'on vise par heure. */
export function TargetIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.4" />
      <path d="M12 4v3.2M12 16.8V20M4 12h3.2M16.8 12H20" />
    </Glyph>
  );
}

/** Produits : la dosette et ce qu'elle porte. */
export function PouchIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M7.5 6.5h9l-1 12a1.6 1.6 0 0 1-1.6 1.5h-3.8a1.6 1.6 0 0 1-1.6-1.5z" />
      <path d="M6.5 4h11l-1 2.5h-9z" />
      <path d="M10 11.5h4" strokeOpacity={0.45} />
    </Glyph>
  );
}

/** Roadbook : la feuille qu'on plie dans une poche. */
export function SheetIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M5.5 3.5h13v17h-13z" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4" strokeOpacity={0.55} />
    </Glyph>
  );
}

/** La borne posée sur la trace. */
export function PinIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 21c4-4.6 6-7.9 6-10.6A6 6 0 0 0 6 10.4C6 13.1 8 16.4 12 21z" />
      <circle cx="12" cy="10.4" r="2.2" />
    </Glyph>
  );
}

/** La flasque, et ce qu'on y verse. */
export function FlaskIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M9.5 3.5h5v2.2c0 .8.3 1.5.9 2l.8.8c.7.7 1.1 1.6 1.1 2.6v7.3a2.1 2.1 0 0 1-2.1 2.1H8.8a2.1 2.1 0 0 1-2.1-2.1v-7.3c0-1 .4-1.9 1.1-2.6l.8-.8c.6-.5.9-1.2.9-2z" />
      <path d="M6.7 14h10.6" strokeOpacity={0.5} />
    </Glyph>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="11" cy="11" r="6.2" />
      <path d="M15.6 15.6 20 20" />
    </Glyph>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 5.5v13M5.5 12h13" />
    </Glyph>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M5.5 12h13" />
    </Glyph>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
    </Glyph>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M5 12.5 10 17.5 19 7" />
    </Glyph>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M6.5 9.5 12 15l5.5-5.5" />
    </Glyph>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M19 12H5.5M11 6l-5.5 6 5.5 6" />
    </Glyph>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M5 12h13.5M13 6l5.5 6-5.5 6" />
    </Glyph>
  );
}

/** Recadrer : ramener la vue sur ce qu'elle a perdu de vue. */
export function FrameIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 8.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3" />
      <path d="M15.5 4h3A1.5 1.5 0 0 1 20 5.5v3" />
      <path d="M20 15.5v3a1.5 1.5 0 0 1-1.5 1.5h-3" />
      <path d="M8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-3" />
      <circle cx="12" cy="12" r="2.2" />
    </Glyph>
  );
}

export function RecomputeIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.6-5.7" />
      <path d="M19.8 4.6v4.2h-4.2" />
    </Glyph>
  );
}

export function WarnIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 4.2 21 19.8H3z" />
      <path d="M12 10v4.2" />
      <path d="M12 17.2h.01" />
    </Glyph>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 16V4M12 4 7 9M12 4l5 5" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </Glyph>
  );
}

/** Le partage : le lien d'un plan, passé à qui doit l'ouvrir. */
export function ShareIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="17.5" cy="5.8" r="2.6" />
      <circle cx="6.5" cy="12" r="2.6" />
      <circle cx="17.5" cy="18.2" r="2.6" />
      <path d="M8.8 10.7 15.2 7.1" />
      <path d="M8.8 13.3 15.2 16.9" />
    </Glyph>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4.5 6.5h15" />
      <path d="M9.5 6.5V4.8a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7" />
      <path d="M6.6 6.5 7.5 19a1.6 1.6 0 0 0 1.6 1.5h5.8a1.6 1.6 0 0 0 1.6-1.5l.9-12.5" />
    </Glyph>
  );
}

/**
 * L'attente. Le tour complet plutôt qu'un fondu : c'est la seule pièce du jeu
 * qui bouge, elle doit se lire comme un travail en cours.
 */
export function SpinnerIcon(props: IconProps) {
  return (
    <Glyph {...props} className={`animate-spin ${props.className ?? ""}`}>
      <circle cx="12" cy="12" r="8.2" strokeOpacity={0.25} />
      <path d="M20.2 12a8.2 8.2 0 0 0-8.2-8.2" />
    </Glyph>
  );
}

/**
 * La pastille d'état d'une destination : vide, remplie, ou à recalculer.
 * Jamais la couleur seule, la forme dit déjà laquelle des trois.
 */
export function StatusDot({
  state,
  className,
}: {
  state: "vide" | "rempli" | "perime";
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <circle
        cx="6"
        cy="6"
        r="4"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeOpacity={state === "vide" ? 0.5 : 1}
      />
      {state === "rempli" && (
        <circle cx="6" cy="6" r="2.2" fill="currentColor" />
      )}
      {state === "perime" && (
        <path d="M6 2.2A3.8 3.8 0 0 1 6 9.8z" fill="currentColor" />
      )}
    </svg>
  );
}
