import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/chrome/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Plan nutritionnel de course",
  description:
    "Un plan de nutrition à partir d'un GPX : temps de passage par tronçon, " +
    "et quoi manger et boire entre chaque ravitaillement.",
};

/**
 * Le contrat de direction d'Impeccable doit survivre en tant que vrai
 * commentaire HTML dans le HTML émis — un commentaire JSX est effacé à la
 * compilation. `dangerouslySetInnerHTML` est le seul moyen d'émettre un
 * nœud commentaire littéral depuis React.
 */
const DIRECTION_CONTRACT = `<!--
  impeccable:direction bagage-01
  THESIS: déposer le GPX est le geste fondateur — l'écran le traite comme
  un instrument de relevé, pas comme un hero marketing générique.
  OWN-WORLD: papier blanc, encre quasi noire, un seul accent brûlé
  (ravitos, CTA) ; photographie plein cadre en guise d'imagerie forte —
  crête brumeuse en hero (100dvh, fondue au blanc de la page en haut et à
  l'encre en bas), photo de course + profil tracé par-dessus sur les
  cartes ; Geist Mono pour les mesures (distance, D+, coordonnées), Geist
  Sans pour le reste.
  STORY: le coureur dépose sa trace dans un panneau vitré flottant sur une
  photo de relief plein écran qui se fond dans la page ; deux dossiers déjà
  ouverts en dessous, chacun sa photo et son profil tracé — un modèle à
  dupliquer, un plan personnel — montrent tout de suite ce qu'elle devient.
  FIRST VIEWPORT: hero plein écran (photo de relief fondue + panneau de
  dépôt vitré), puis deux cartes-affiche à photo pleine et profil tracé.
  FORM: direction unique dérivée du brief (wireframe + 5 références) —
  brief-pinned, tournoi de concepts sauté (new-work §3).
  FINISH: unreviewed and undocumented is unfinished; this build ends
  with the finish review, the verdict, and DESIGN.md.
-->`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/** biome-ignore lint/security/noDangerouslySetInnerHtml: contrat de direction, texte statique. */}
        <div dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
        {children}
      </body>
    </html>
  );
}
