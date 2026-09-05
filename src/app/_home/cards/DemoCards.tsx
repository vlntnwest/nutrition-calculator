import Image from "next/image";
import Link from "next/link";

/**
 * Deux dossiers hardcodés pour peupler l'écran tant que le catalogue de
 * courses officielles et l'historique serveur n'existent pas — cf. le
 * commentaire de contrat dans layout.tsx.
 */
const DEMO_CARDS = [
  {
    kind: "modele" as const,
    name: "Traversée des Cimes — 2026",
    photo: "/card-modele.webp",
    distanceKm: "176",
    ascentM: "10 000",
    detail: "12 ravitos posés",
    // Relevé réel rééchelonné en viewBox 0..400 / 0..160 (D+, densité de
    // pics) plutôt qu'une silhouette dessinée à la main : la carte lit
    // comme un instrument de relevé, pas comme une icône décorative.
    profile:
      "M0,154 L7.7,147.2 L15.7,142.3 L23.4,126.4 L31.2,91.6 L39,126.9 L47,140 L54.4,140.2 L62.4,148.2 L70.3,132.4 L77.7,115.6 L85.6,75.4 L93.6,103.1 L101.5,37.3 L109.5,37.9 L117.2,47 L124.9,100.3 L132.8,71.1 L140.8,41.5 L148.4,98 L156.4,139.8 L163.9,115.9 L171.8,130.1 L179.9,62.9 L187.4,43.8 L194.7,10.7 L202.9,47.1 L210.8,51 L218.8,51.1 L226.8,47.8 L234.7,57.8 L242.7,62.7 L250.5,76.3 L258.4,95.8 L266.4,112.2 L274.2,91.3 L282.1,72.6 L289.6,60.8 L297.4,96.3 L305.1,82.8 L313.2,106.5 L320.6,138.4 L328.2,112.5 L336.3,137 L344.1,138.9 L351.8,112.2 L359.6,80.1 L367.6,60.5 L375.4,97.5 L382.3,43.8 L390.3,120.1 L397.7,147.4 L400,150.8",
  },
  {
    kind: "personnel" as const,
    name: "Saverne Trail",
    photo: "/card-saverne.webp",
    distanceKm: "28,4",
    ascentM: "1 314",
    detail: "◍ à recalculer",
    profile:
      "M0,150 L40,120 L70,135 L100,90 L130,105 L160,60 L190,80 L220,40 L250,65 L280,45 L310,90 L340,70 L370,110 L400,95",
  },
];

/** Les deux cartes-affiche : photo pleine, profil tracé, plaque de relevé. */
export function DemoCards() {
  return (
    <>
      {DEMO_CARDS.map((card) => (
        <article
          key={card.name}
          className="relative min-h-[280px] min-w-[280px] flex-1 overflow-hidden rounded-[20px] bg-ink"
        >
          <Link href="/demo" className="absolute inset-0 flex flex-col">
            <Image
              src={card.photo}
              alt=""
              fill
              sizes="(min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
            {/* Un seul fondu, haut et bas : sombre pour le titre, clair sur
                le tracé, puis noyé dans l'encre pour la plaque de relevé —
                pas de panneau plaqué, juste la photo qui s'éteint. */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(23,19,15,.75) 0%, rgba(23,19,15,.14) 24%, transparent 42%, transparent 56%, rgba(23,19,15,.55) 72%, rgba(23,19,15,.9) 88%, rgba(23,19,15,.98) 100%)",
              }}
            />

            <div className="relative z-10 flex items-start justify-between gap-2 p-5">
              <h3 className="max-w-[70%] text-2xl font-bold text-balance tracking-tight text-paper leading-[1.05] sm:text-3xl">
                {card.name}
              </h3>
              <span className="shrink-0 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 font-mono text-[10px] text-paper tracking-wide backdrop-blur-sm">
                {card.kind === "modele" ? "Modèle" : card.detail}
              </span>
            </div>

            <div className="relative z-10 flex flex-1 items-center px-1">
              <svg
                viewBox="0 0 400 160"
                preserveAspectRatio="none"
                className="h-20 w-full sm:h-24"
                aria-hidden="true"
              >
                <path
                  d={card.profile}
                  fill="none"
                  stroke="var(--paper)"
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {card.kind === "personnel" && (
                  <>
                    <line
                      x1={130}
                      y1={0}
                      x2={130}
                      y2={160}
                      stroke="var(--accent)"
                      strokeWidth={2.5}
                    />
                    <line
                      x1={280}
                      y1={0}
                      x2={280}
                      y2={160}
                      stroke="var(--accent)"
                      strokeWidth={2.5}
                    />
                  </>
                )}
              </svg>
            </div>

            <div className="relative z-10 flex items-center justify-between gap-2 px-5 pt-3 pb-5">
              <p className="font-mono text-paper text-xs tracking-wide sm:text-sm">
                {card.distanceKm} km · D+ {card.ascentM} m
                {card.kind === "modele" ? ` · ${card.detail}` : ""}
              </p>
            </div>
          </Link>
        </article>
      ))}
    </>
  );
}
