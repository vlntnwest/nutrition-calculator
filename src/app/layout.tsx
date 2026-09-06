import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
  impeccable:direction bagage-02
  THESIS: un plan est un dossier qu'on rouvre, jamais un tunnel. L'accueil
  reste une affiche de terrain ; les quatre destinations sont un atelier de
  relevé, où la trace fait le fond et le papier porte l'écriture.
  OWN-WORLD: papier blanc, encre quasi noire, un seul accent brûlé réservé
  aux marques de la course (bornes, destination active, curseur) et jamais
  posé dans un bouton. Filets d'un pixel plutôt que cartes flottantes ;
  Geist Mono tabulaire pour toute mesure, Geist Sans pour le reste ; icônes
  dessinées, trait 1,6 sur grille de 24. Photographie plein cadre sur le
  seul accueil.
  STORY: déposer la trace, confirmer la course, poser les ravitos sur le
  relief, régler les cibles, remplir le sac, corriger un roadbook qui montre
  toujours l'écart au calcul.
  FIRST VIEWPORT: accueil, hero photo pleine et panneau de dépôt vitré.
  Plan, rail à gauche et identité de course en tête, puis l'écran en pleine
  hauteur : carte en fond sur Course, profil collant sur Roadbook.
  FORM: brief-pinné par le canvas « Wireframes post-import », sept écrans
  desktop et huit mobile ; tournoi de concepts sauté (new-work §3).
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
