---
name: Plan nutritionnel de course
description: Un carnet d'expédition sur écran, papier blanc et encre, où la trace fait le fond et le papier porte l'écriture.
colors:
  ink: "#17130f"
  ink-soft: "#635c52"
  ink-faint: "#6f675c"
  paper: "#ffffff"
  paper-dim: "#f6f3ee"
  paper-sunk: "#efeae2"
  line: "#17130f1f"
  line-strong: "#17130f33"
  accent: "#c2410c"
  accent-dark: "#3a1306"
  accent-tint: "#fbe7d9"
  pente-moyenne: "#eeb27a"
  pente-forte: "#7a2c08"
  warn: "#8a5a00"
  warn-tint: "#fdf3dd"
  go: "#2f6b3f"
  go-mark: "#369d51"
typography:
  display:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    letterSpacing: "-0.025em"
  title:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    letterSpacing: "-0.025em"
  subtitle:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  body:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "14px"
    lineHeight: "1.5"
  body-small:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "13px"
    lineHeight: "1.625"
  label:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  hint:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "11px"
    lineHeight: "1.625"
  measure:
    fontFamily: "var(--font-geist-mono), ui-monospace, monospace"
    fontSize: "20px"
    fontFeature: "tabular-nums"
  measure-inline:
    fontFamily: "var(--font-geist-mono), ui-monospace, monospace"
    fontSize: "inherit"
    fontFeature: "tabular-nums"
  onglet:
    fontFamily: "var(--font-geist-mono), ui-monospace, monospace"
    fontSize: "10px"
    letterSpacing: "0.14em"
  wordmark:
    fontFamily: "var(--font-geist-mono), ui-monospace, monospace"
    fontSize: "12px"
    letterSpacing: "0.2em"
rounded:
  control: "8px"
  panel: "12px"
  sheet: "20px"
  pill: "9999px"
spacing:
  micro: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  screen: "24px"
components:
  button-encre:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "40px"
  button-encre-disabled:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  button-contour:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "40px"
  button-contour-hover:
    backgroundColor: "{colors.paper-dim}"
  button-retrait:
    textColor: "{colors.ink-soft}"
    typography: "{typography.body}"
  button-retrait-hover:
    textColor: "{colors.accent}"
  icon-button:
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.control}"
    size: "36px"
  chip-toggle:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "32px"
  chip-toggle-actif:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.accent-dark}"
  tag-accent:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.accent-dark}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
    typography: "{typography.onglet}"
  panel:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.panel}"
  panel-creux:
    backgroundColor: "{colors.paper-dim}"
    rounded: "{rounded.panel}"
  field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  field-focus:
    backgroundColor: "{colors.paper}"
  notice-alerte:
    backgroundColor: "{colors.warn-tint}"
    textColor: "{colors.warn}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  error-note:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.accent-dark}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  rail-item-actif:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  modal:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
---

# Design System: Plan nutritionnel de course

## Overview

**Creative North Star: « Le carnet d'expédition »**

Le système s'écrit en toutes lettres en tête de `src/app/globals.css` : papier blanc,
encre, un accent brûlé. Le produit est un atelier de préparation, pas un tunnel
d'inscription. Ce que le coureur manipule ressemble à une feuille de relevé posée
sur une table : du papier cerné d'un filet d'un pixel, des mesures alignées en
colonne, et une seule couleur chaude qui ne sert qu'à marquer la course elle-même.

Le carnet est clair par nature et l'écran s'imprime. `color-scheme: light` est
déclaré, il n'y a pas de thème sombre, et aucun jeton n'a de variante nocturne. Le
livrable est une feuille en noir et blanc pliée dans une poche : toute information
portée par une teinte porte aussi un signe, une forme ou un mot, faute de quoi elle
disparaît à l'impression.

Deux compositions cohabitent, et c'est délibéré. L'accueil est une affiche de
terrain : photographie plein cadre, panneau de dépôt vitré posé dessus, titres
lourds, cartes-affiche à fond photo. Les quatre destinations d'un plan sont
l'inverse : hauteur fixe, rail à gauche, papier partout, aucune image sauf la
vignette d'un produit et le fond de carte, lui-même ramené au papier par un filtre.
La photographie ne franchit jamais la porte du plan.

**Key Characteristics:**

- Papier blanc pur, encre quasi noire, un seul accent brûlé.
- Filets d'un pixel plutôt que cartes flottantes ; deux ombres seulement, pour ce
  qui se pose par-dessus le reste.
- Geist Mono tabulaire pour toute mesure, Geist Sans pour tout le reste.
- Un seul jeu d'icônes dessinées, grille de 24, trait 1,6, jamais de remplissage.
- Un seul moment de mouvement : la fiche qui monte.
- La couleur ne porte jamais seule une information.

## Colors

Une palette de papier et d'encre, deux familles neutres qui font tout le travail,
plus un accent brûlé tenu en réserve. Aucune couleur n'existe hors de
`src/app/globals.css`. Le seul endroit qui recopie des valeurs est
`src/ui/track/ElevationChart.tsx`, parce qu'un `<canvas>` dessine avec l'API 2D et
ne résout pas les variables CSS ; le miroir y est signalé en commentaire.

### Primary

- **Ocre brûlé** (`{colors.accent}`) : la marque de la course et rien d'autre.
  Bornes de ravitaillement sur le profil et sur la carte, tracé du parcours,
  destination active du rail, curseur du slider, anneau de focus, curseur de
  saisie, sélection de texte, pastille d'un secteur périmé, écart de glucides
  au-dessus du besoin.
- **Ocre profond** (`{colors.accent-dark}`) : le texte posé sur `accent-tint`, où
  l'ocre plein ne tiendrait pas le contraste. Chips actives, filtres posés,
  message de refus.
- **Ocre pâle** (`{colors.accent-tint}`) : le fond d'un état retenu. Chip cochée,
  filtre posé, étiquette de consigne imposée, message de refus, sélection de
  texte, et le palier le plus faible de l'échelle de pente.

### Secondary

L'échelle de pente du profil altimétrique (`src/ui/track/slopeColor.ts`), cinq
paliers plutôt qu'un dégradé continu, et cinq gris plutôt qu'une teinte : une
échelle de valeur dit une intensité mieux qu'une échelle de teinte, elle survit à
l'impression en noir et blanc, et elle laisse l'accent libre de porter l'allure
par-dessus le même graphique.

- `#d9d9d9` jusqu'à 5 %, `#a8a8a8` jusqu'à 7 %, `#787878` jusqu'à 10 %, `#454545`
  jusqu'à 15 %, `#000000` au-delà. Le signe de la pente n'y change rien.

**La rampe d'allure** (`src/ui/track/paceColor.ts`), seule couleur hors palette du
produit et seule rampe continue : `#2b7bd6` bleu pour le plus lent, `#3fa9c9`,
`#3f9e4d` vert au passage de l'allure moyenne, `#e0a91b`, `#e2721f`, `#cf3b1f`
rouge pour le plus rapide. Elle est empruntée telle quelle au PacePro des montres
de course, où les coureurs la lisent déjà : lui substituer une échelle de gris
demanderait de la réapprendre, pour dire la même chose moins vite. Elle est
continue là où l'échelle de pente est à paliers, parce qu'une allure n'a pas de
seuil naturel où basculer.

Elle se pose sur la **hauteur**, pas sur le tronçon : un `CanvasGradient` vertical, et
le trait prend la couleur de l'endroit où il passe, contremarches comprises, qui se
dégradent donc sur toute leur longueur. Il est tendu entre les deux allures extrêmes
de la trace affichée, jamais entre les bords du cadre : l'axe se donne 8 % de marge
au-dessus et en dessous des données, et le tronçon le plus rapide n'atteindrait donc
jamais le rouge. Les deux moitiés du dégradé s'étirent séparément pour que le vert
tombe pile sur l'allure moyenne : elle n'est presque jamais à mi-hauteur, la queue
lente étant plus longue que la rapide, et un dégradé régulier mettrait le vert là où
rien ne se passe. Le revers assumé est qu'une couleur ne se compare pas d'un plan à
l'autre : elle double l'axe gradué qu'elle longe, elle ne le remplace pas.

Les deux échelles de couleur ne coexistent jamais sur un même cadre : sous une bande
d'allure, le relief rend sa couleur de pente et redevient une silhouette
`line-strong` d'un pixel, et la légende ne montre que la rampe.

### Tertiary

Des teintes de service, chacune sur un seul usage.

- **Ambre d'avertissement** (`{colors.warn}` sur `{colors.warn-tint}`) : une
  remarque du calcul (`Notice`, `Tag ton="alerte"`). Jamais employée seule, un
  pictogramme et un mot portent l'alerte.
- **Vert de confirmation** (`{colors.go}`) : le seul mot « Enregistré » de la barre
  d'enregistrement, accompagné d'une coche. Tenu à 4,5:1 sur le papier, parce qu'il
  habille du texte.
- **Vert de marqueur** (`{colors.go-mark}`) : le disque de départ sur la carte, et
  lui seul. Six pixels posés sur un fond de tuiles : il lui faut de la lumière
  plutôt que du contraste, et c'est pourquoi il ne se confond pas avec `{colors.go}`.

### Neutral

- **Encre** (`{colors.ink}`) : tout le texte de premier plan, le fond des boutons
  d'action, le voile d'une modale (à 70 %), le fond des cartes-affiche de l'accueil.
- **Encre douce** (`{colors.ink-soft}`) : texte secondaire, libellés de champ,
  étiquettes de relevé, boutons discrets.
- **Encre pâle** (`{colors.ink-faint}`) : aides, unités, séparateurs médians,
  pastilles au repos. Plus claire des trois encres, elle tient 5,5:1 sur le papier :
  rien de ce qui se lit ne descend sous le seuil.
- **Papier** (`{colors.paper}`) : le fond de page et de toute surface de travail.
- **Papier terne** (`{colors.paper-dim}`) : le rail de navigation, le pied d'une
  fiche, le bandeau d'agrégats d'un secteur, le survol d'un bouton contour.
- **Papier enfoncé** (`{colors.paper-sunk}`) : la piste d'un slider, l'état actif
  d'un bouton contour.
- **Filet** (`{colors.line}`) et **filet appuyé** (`{colors.line-strong}`) : de
  l'encre à 12 % et 20 % d'opacité. Toute bordure, tout séparateur, la barre de
  défilement.

### Named Rules

**La règle de l'accent réservé.** L'accent marque la course et l'endroit où l'on se
trouve. Aucun bouton n'en est rempli : l'encre porte les actions de l'outil, le
papier les actions secondaires, le texte nu ce qui se défait. La seule apparition
de l'accent dans un bouton est le survol d'un bouton `retrait`, qui n'a ni fond ni
bordure.

**La règle des deux verts.** `{colors.go}` et `{colors.go-mark}` ne sont pas un
doublon à unifier : le premier habille une confirmation écrite et doit tenir le
contraste d'un texte, le second habille un disque de six pixels posé sur des tuiles
de carte et cherche la lumière. Un jeton nouveau se justifie par un besoin de
lisibilité distinct, jamais par une nuance de goût.

**La règle du refus sans rouge.** Un message d'erreur emprunte l'accent
(`{colors.accent-tint}` et `{colors.accent-dark}`) plutôt que d'introduire un rouge
d'alerte. Le carnet n'a pas de sixième teinte.

**La règle du signe.** La couleur ne peut jamais porter seule une information. La
pastille d'état a trois formes (cercle vide, cercle plein, demi-disque), l'écart de
glucides porte un signe (`+` ou `−`), la légende de pente écrit ses cinq seuils, la
bande d'allure du roadbook écrit l'allure dans le remplissage. Un écran qui perd sa
couleur doit dire la même chose.

## Typography

**Body Font:** Geist Sans (avec `system-ui, sans-serif`), chargée par `next/font`.
**Label/Mono Font:** Geist Mono (avec `ui-monospace, monospace`).

Il n'y a pas de fonte d'affichage distincte : le titre de l'accueil est du Geist
Sans en 600, à la même famille que le corps. La tension du système vient du couple
sans/mono, pas d'un contraste de caractères.

**Character:** une grotesque neutre pour la langue, une monospace pour les relevés.
Rien de calligraphié, rien d'éditorialisé. Les tailles sont petites et nombreuses,
posées au pixel plutôt que sur une gamme géométrique : un écran d'atelier porte
beaucoup de mentions, chacune à sa juste taille.

### Hierarchy

- **Display** (600, `2.25rem`, `sm:3rem`, `tracking-tight`, `text-balance`) : le
  seul titre de l'accueil, « Importez la trace de votre course ».
- **Headline** (600, 22px, `tracking-tight`) : le titre d'un écran du plan, Cibles
  horaires, Produits, Roadbook.
- **Title** (600, 17px, `tracking-tight`) : le nom de la course dans la barre
  d'identité. La fiche produit monte à 18px, la carte d'un secteur descend à 15px.
- **Subtitle** (500, 13px) : l'en-tête d'un panneau (`PanelHead`).
- **Body** (400, 14px, `leading-normal`) : la ligne courante d'une liste, le nom
  d'un produit, l'apport d'un secteur. Les champs de saisie montent à 15px.
- **Body small** (400, 13px, `leading-relaxed`) : les phrases explicatives sous un
  panneau.
- **Label** (400, 12px, `ink-soft`) : le libellé d'un champ. C'est un nom, jamais
  une phrase à l'impératif.
- **Hint** (400, 11px, `ink-faint`, `leading-relaxed`) : ce qui précise sans être
  nécessaire à la lecture.
- **Measure** (Geist Mono, tabulaire) : toute mesure. `Stat` la pose en 16, 20 ou
  30px selon l'importance, `Val` la pose au fil du texte à la taille du texte.
- **Onglet** (Geist Mono, 10px, capitales, `tracking-[0.14em]`, `ink-soft`) :
  l'étiquette d'une colonne ou d'un relevé sans titre à lui, le nom d'une marque sur
  une fiche produit, le format d'un produit sur sa vignette.
- **Wordmark** (Geist Mono, 12px, capitales, `tracking-[0.2em]`, `ink-soft`) :
  « plan nutrition », en tête de l'accueil et en tête du rail.

### Named Rules

**La règle du relevé.** Une distance, un dénivelé, un chrono, une allure, une masse,
un volume, un compte : tout passe par `src/format/` et s'affiche en Geist Mono. La
classe `.font-mono` porte `font-variant-numeric: tabular-nums` globalement, donc
une mesure ne bouge pas quand le chiffre change.

**La règle de l'unité dans la fonte du texte.** Le chiffre garde le mono, l'unité
reprend la fonte du texte (`Val` dans `src/ui/Measure.tsx`). Dans la fonte mono
l'espace de séparation est large et « 225 g » se lisait « 225  g ». Dans un champ
de saisie, l'unité est posée à l'intérieur du cadre, à droite, en 12px `ink-soft`.

**La règle de l'étiquette basse.** L'`Onglet` en capitales espacées nomme une
colonne ou un relevé. Il ne se pose jamais au-dessus d'un titre, où il ne serait
qu'un surtitre décoratif.

## Layout

**La coquille du plan est à hauteur fixe.** `h-dvh overflow-hidden` : la page ne
défile pas, chaque écran gère son propre défilement (`min-h-0 flex-1
overflow-y-auto`), et la barre d'enregistrement est un pied posé hors de la zone qui
défile. Rien ne passe derrière le bouton, et il reste sous le pouce sur un
formulaire long.

**Navigation.** Rail vertical de `14rem` (`w-56`) à gauche à partir de `lg`, sur
`paper-dim`, cerné d'un filet à droite. En dessous de `lg`, il disparaît au profit
d'une barre d'onglets fixée au bas de l'écran (`fixed inset-x-0 bottom-0`, fond
`paper/95` et `backdrop-blur-sm`, `pb-[env(safe-area-inset-bottom)]`), et le contenu
principal se réserve `pb-[4.75rem]`. La barre d'identité de la course est commune
aux deux et ne défile jamais.

**Largeurs de lecture.** Roadbook `max-w-4xl`, Cibles `max-w-5xl`, en-tête de
l'accueil `max-w-6xl`, colonne de saisie de la fiche d'import `300px`. Les écrans
respirent en `px-4`, `sm:px-6`.

**Deux colonnes quand l'écran le permet.** Course : la feuille de papier à gauche
(`lg:w-[27rem]`, largeur fixe), la carte à droite en `flex-1`. Cibles : le
formulaire en `flex-1`, une synthèse `lg:w-80` collante à `lg:top-6`. Roadbook : le
titre, le bouton Calculer et le départ défilent avec les secteurs — sur un petit
écran, ils ne doivent pas retenir en permanence la place que la liste réclame —, le
profil devient collant (`sticky top-0`) une fois qu'on a défilé jusqu'à lui, et le
pied d'enregistrement reste collant en bas.

**Le repli mobile de l'écran Course.** La carte passe en fond plein cadre
(`absolute inset-0`, dans un contexte `isolate` que Leaflet impose), la feuille de
papier monte du bas, ancrée au pied de l'écran, à `46dvh` repliée et `74dvh`
dépliée, avec une poignée qui bascule entre les deux.

**Grilles.** Le catalogue produits : deux colonnes, trois à `sm`, quatre à `xl`,
gouttière de 12px. Les agrégats du sac complet : deux colonnes, cinq à `sm`.

**Rythme.** L'échelle Tailwind par pas de 4px, exploitée surtout entre 6 et 24px.
Un panneau : `px-4 pt-3.5 pb-3` pour son en-tête, `p-4` pour son corps. Une barre
de pied : `px-4 py-3`, `sm:px-6`. Une pile de panneaux : `gap-4` à `gap-6`.

**Points de rupture** (défauts Tailwind v4, aucun n'est redéfini) : `sm` 640px, `lg`
1024px, `xl` 1280px. `sm` fait passer une fiche de feuille montante à fenêtre
centrée ; `lg` fait passer la navigation d'onglets à rail.

## Elevation & Depth

Le système est plat par construction. La profondeur vient du filet d'un pixel et de
la nuance de papier, jamais de l'ombre : `Panel` est du papier cerné, pas une carte
qui flotte. Deux ombres seulement existent, et toutes deux servent à dire « ceci
est posé par-dessus le reste ».

### Shadow Vocabulary

- **Panneau** (`var(--shadow-panel)`, `0 1px 2px #17130f0f, 0 8px 24px -16px
  #17130f4d`) : la seule entrée active du rail, décollée de son fond `paper-dim`.
- **Soulevé** (`var(--shadow-lifted)`, `0 2px 6px #17130f14, 0 24px 48px -24px
  #17130f59`) : une fiche modale, et la feuille montante de l'écran Course en
  mobile.
- **Bouton d'encre** (`0 1px 2px #17130f26`) : un liseré sous le seul bouton plein,
  pas une élévation.
- **Curseur de slider** (`0 1px 3px #17130f59`) : ce qui détache la pastille de sa
  piste.

Le voile d'une modale est de l'encre à 70 % avec `backdrop-blur-sm`.

### Named Rules

**La règle du filet.** Un séparateur est un trait d'un pixel : `border-line`, ou la
`Rule` (`h-px bg-line`). C'est le seul séparateur du carnet. On ne creuse pas une
zone à l'ombre, on la pose sur `paper-dim`.

**La règle des deux ombres.** Une ombre annonce un survol du reste de la page. Ni
au repos, ni au survol, ni au focus : rien d'autre ne s'élève.

## Shapes

Trois rayons, déclarés en variables et jamais improvisés :

- **Contrôle** (`{rounded.control}`) : bouton, champ, chip carrée, bouton icône,
  entrée du rail, message, étiquette d'un produit. C'est le rayon par défaut.
- **Panneau** (`{rounded.panel}`) : toute surface de travail, carte de ravito, carte
  de produit, carte d'un secteur, état vide.
- **Feuille** (`{rounded.sheet}`) : ce qui s'ouvre par-dessus le reste. Une modale
  au-dessus de `sm`, la feuille montante en dessous (deux coins hauts seulement),
  la feuille de l'écran Course.
- **Pilule** (`{rounded.pill}`) : ce qui se pose et se retire ou compte quelque
  chose. Chip, filtre, étiquette, pastille de rang d'un ravito, poignée de repli,
  curseur de slider, bande d'allure.

Ces rayons se citent par leur variable, jamais par leur valeur : `rounded-[var(--radius-panel)]`
et non `rounded-[12px]`. Deux littéraux subsistent et sont les seuls admis, chacun
pour une raison écrite : les 28px du panneau de dépôt de l'accueil, qui appartient à
sa composition, et les 4px de la bande d'allure du roadbook, où un secteur peut
descendre à quelques pixels de large et où le rayon de contrôle l'avalerait.

Les bordures font toujours 1px. La seule bordure épaisse du système est le cadre
plein écran du glisser-déposer (2px blanc), et les deux anneaux de 2px `paper`
autour des marqueurs de la carte, qui les détachent du fond.

Les icônes forment un jeu unique dans `src/ui/icons.tsx` : `viewBox` de 24,
`stroke-width` 1,6, bouts et jonctions arrondis, `fill="none"`, `aria-hidden`. Elles
héritent de `currentColor` et se posent en 12, 14, 16, 20 ou 24px, le plus souvent
16px. Aucun emoji, aucun glyphe Unicode ne tient lieu d'icône : les seuls caractères
admis sont le point médian `·` qui sépare deux mesures, le signe moins `−` d'un
écart, et le `+` d'une quantité.

**La règle du dessin.** La pastille d'état (`StatusDot`) se dessine sur sa propre
grille de 12 avec un trait de 1,4, parce qu'à 12px le trait de 1,6 du jeu devient
lourd. C'est la seule exception, et elle est locale à ce composant.

## Components

### Buttons

- **Shape:** rayon de contrôle (8px), `font-medium`, deux tailles : `md` 40px de
  haut et 20px de flancs, `sm` 32px de haut et 12px de flancs.
- **Encre** (`{components.button-encre}`) : l'action de l'outil. Fond encre, texte
  papier, liseré d'un pixel. Survol à 85 % d'encre, désactivé à 40 % d'encre plus
  `opacity-50`.
- **Contour** (`{components.button-contour}`) : l'action secondaire. Papier cerné de
  `line-strong`, survol `paper-dim`, actif `paper-sunk`.
- **Discret** : texte `ink-soft` sans cadre, qui prend `paper-dim` au survol.
- **Retrait** : ce qui se défait. Texte souligné (`underline-offset-2`), `ink-soft`,
  accent au survol. Pas de hauteur imposée, pas de cadre : il ne pèse pas comme un
  bouton.
- **Bouton icône** (`{components.icon-button}`) : carré de 36px, `ink-soft`, survol
  `paper-dim`. Le libellé passe en `aria-label` et en `title`, rien ne se pilote à
  l'icône seule.
- **Focus:** anneau global, 2px `accent`, `outline-offset: 2px`.

### Chips

- **ToggleChip:** pilule de 32px, 13px. Au repos, papier cerné de `line`, texte
  `ink-soft` ; la bordure passe à `line-strong` au survol. Cochée, elle prend
  `accent-tint`, la bordure accent, le texte `accent-dark`, **et une coche** :
  `aria-pressed` porte l'état pour le lecteur d'écran, la coche le porte pour
  l'œil.
- **FilterChip:** un filtre déjà posé. Mêmes teintes que la chip cochée, bordure à
  40 % d'accent, avec la croix qui le défait dans un disque de 20px.
- **Tag:** une mention sur une fiche, en Geist Mono 10px capitales. Trois tons :
  neutre (`paper-dim`), accent (une consigne imposée), alerte (`warn-tint`).

### Cards / Containers

- **Panel** (`{components.panel}`) : la surface de travail. Rayon de panneau, un
  filet, trois tons : `papier`, `creux` (`paper-dim`, pour ce qui est dérivé et non
  saisi), et `marque` (bordure accent à 40 % plus un anneau à 15 %).
- **PanelHead:** un nom à gauche en 13px/500, une mesure ou une action à droite,
  alignés sur la ligne de base, puis une `Rule` avant le corps.
- **Shadow Strategy:** aucune. Un panneau ne s'élève pas.
- **Internal Padding:** 16px, en-tête `px-4 pt-3.5 pb-3`.
- **Carte de ravito, carte de produit, carte de secteur** : même rayon de panneau,
  même filet. Une carte ouverte ou retenue prend une bordure pleine, accent pour un
  ravito ouvert, encre pour un produit dans le sac.

### Inputs / Fields

- **Style:** papier cerné de `line`, rayon de contrôle, `px-3 py-2`, texte 15px,
  `placeholder:text-ink-faint`.
- **Focus:** la bordure passe à l'accent (`focus:border-accent`, ou
  `focus-within:border-accent` quand le cadre entoure plusieurs éléments). Les
  champs annulent l'anneau global (`outline-none`) : c'est la bordure qui dit le
  focus, et elle seule.
- **MeasureField:** le nombre en Geist Mono, l'unité posée dans le cadre à droite en
  12px `ink-soft`. Le texte tapé sort tel quel, la conversion attend
  l'enregistrement.
- **ChronoInput:** un chrono se saisit en trois cases de deux chiffres, jamais en
  boutons plus ou moins ni en champ unique. Chiffres centrés en Geist Mono 18px
  (`sm` 16px), l'unité `h`, `min`, `s` écrite sous la case en 10px capitales, et le
  focus qui saute à la case suivante au deuxième chiffre.
- **Slider:** libellé à gauche, valeur chiffrée à droite en Geist Mono 15px, unité
  en 12px `ink-soft`. Piste de 4px sur `paper-sunk`, curseur de 16px en accent cerné
  de 2px de papier. Les bornes de la piste sont écrites dessous en 10px
  `ink-faint`, jamais laissées à deviner.
- **Stepper:** deux crans de 36px encadrant la quantité en Geist Mono 15px, dans un
  cadre commun. Le pas suit le produit : un gel se finit, une barre se casse en
  deux.
- **Select:** liste déroulante native, `appearance: none`, habillée du chevron du
  jeu d'icônes. Le comportement natif est gardé tel quel, c'est ce que le clavier
  et le tactile attendent.

### Navigation

- **Rail** (`lg` et au-delà) : fond `paper-dim`, wordmark en tête, quatre entrées.
  L'entrée active passe sur du papier avec l'ombre de panneau, son icône prend
  l'accent ; les autres restent `ink-soft` sur fond transparent. Chaque entrée porte
  son nom en 14px, une mention en 11px `ink-faint` (« 2 ravitos », « sac vide »,
  « à calculer ») et sa pastille d'état à droite. La sortie vers un nouvel import
  est poussée en bas, derrière un filet.
- **Onglets** (sous `lg`) : icône et nom en 11px, actif en encre, icône accent, plus
  un trait accent de 2px collé en haut de l'onglet. La pastille d'état se pose en
  exposant de l'icône, sauf quand la destination est remplie.
- **Barre d'identité :** le nom de la course en 17px/600 tronqué, puis distance et
  D+ en Geist Mono 12px séparés d'un point médian. Sous `sm`, le D+ tombe et la
  distance reste. Sous `lg`, une flèche de retour prend la place que le rail tenait.

### Modal

Un `<dialog>` natif : il porte lui-même le focus, le piège au clavier et la
fermeture sur Échap. En dessous de `sm`, la fiche monte du bas et s'ancre au pied de
l'écran, deux coins hauts arrondis en rayon de feuille, `max-h-[92dvh]`. Au-dessus,
elle se centre, quatre coins arrondis, `max-h-[88dvh]`. Le pied (`ModalFoot`) est
collant, sur `paper-dim` derrière un filet : ce qui annule à gauche en bouton
`retrait`, ce qui engage à droite en bouton d'encre.

### SaveBar

Le pied d'un écran de saisie, hors de la zone qui défile, derrière un filet. À
droite, un état en 12px puis le bouton d'encre « Enregistrer », désactivé tant que
rien n'a bougé. L'état a trois formes : en cours (roue et « Enregistrement »),
abouti (coche et « Enregistré » en `go`), ou la conséquence annoncée avant le geste
(« le roadbook devra être recalculé »).

### Notice / ErrorNote / EmptyNote

- **Notice** : une remarque du calcul. Pictogramme d'alerte, texte 13px, fond
  `warn-tint` cerné de `warn/25`. La phrase se suffit : le code du noyau ne
  s'affiche pas sous elle, il ne disait rien au coureur que la phrase ne dise
  déjà. Le ton `neutre` retombe sur `paper-dim`.
- **ErrorNote** : un refus, en `accent-tint` et `accent-dark`, avec `role="alert"`.
  Il nomme ce qui bloque puis l'action qui débloque, dans cet ordre, sans s'excuser.
- **EmptyNote** : un filet **en tirets**, `px-5 py-8`, centré. Un titre en 15px,
  une phrase en 13px `ink-soft`. Le tiret est le seul endroit du système où une
  bordure n'est pas pleine, et il dit exactement une chose : il n'y a encore rien
  ici.

### Measure

Trois formes, et elles couvrent tout ce qui se chiffre.

- **Stat** : la valeur en Geist Mono (16, 20 ou 30px), l'unité en 12px `ink-soft` en
  retrait, ce qu'elle mesure en dessous en 11px `ink-faint`.
- **Releve** : une suite de mesures sur une ligne, séparées par le point médian en
  `ink-faint`. Une entrée absente disparaît sans laisser de séparateur orphelin.
- **Val** : une valeur au fil du texte, chiffre en mono, unité dans la fonte du
  texte.

### ElevationChart (composant signature)

Le profil altimétrique, coloré par palier de pente. Deux tracés superposés : un
aplat unique sous la courbe (`#17130f0d`, l'encre à 5 %, la masse du relief) et le
trait de 2px seul porteur de la pente. Aucune animation. Les graduations sont en
Geist Mono 9px `ink-soft`, les lignes de grille en `line`, l'axe des ordonnées
arrondi au palier de 50 m, l'infobulle en encre pleine à 6px de rayon. Les bornes de
ravitaillement sont des traits accent d'un pixel surmontés d'un disque de 16px
portant le rang en Geist Mono 9px sur papier. Le point survolé est un disque accent
de 12px cerné de blanc, partagé avec la carte par le seul indice du point.

La légende de pente est écrite : cinq pastilles de 6px suivies de leur seuil en
toutes lettres, en 9px `ink-soft`. Elle n'est pas décorative, elle est la condition
pour que la couleur ait le droit d'exister ici.

**Les marches d'allure.** La prop `paceBand` superpose au relief l'allure de chaque
tronçon, en marches d'escalier de 2px teintées par la rampe d'allure, sur une échelle
qui lui est propre : le relief est ce que la course impose, l'allure ce que le coureur
y répond. Deux points par tronçon, la contremarche qui les joint traversant la rampe.
L'allure prend l'axe de gauche et renvoie l'altitude à
droite, parce qu'à gauche se lit ce qu'on est venu régler ; son échelle est inversée,
le rapide en haut du cadre. Un pointillé `line-strong` d'un pixel y pose l'allure
moyenne : sans lui, les marches disent laquelle est la plus lente mais pas laquelle est
en retard. La règle du signe tient parce que l'allure est d'abord une hauteur sur un axe
gradué en minutes par kilomètre, que le pointillé nomme la moyenne, et que l'infobulle
écrit l'allure du tronçon survolé sous son altitude : la teinte accélère la lecture,
elle ne la porte pas. C'est le seul endroit du produit qui montre en direct ce que le
chrono, la dérive et l'effort en montée font au parcours, avant tout enregistrement.

### RouteMap (composant signature)

Le tracé sur un vrai fond OpenStreetMap. La classe `.fond-carnet` ramène les tuiles
au papier (`grayscale(0.92) sepia(0.28) brightness(1.06) contrast(0.92)`), appliquée
au seul calque des tuiles pour que le tracé et les marqueurs gardent leurs couleurs.
Le tracé est en accent, 3,5px. Les bornes de ravitaillement sont des disques de 18px
en accent cernés de papier, le rang posé au centre en Geist Mono 10px papier, sans
le fond ni la flèche que Leaflet donne à ses infobulles : le chiffre est la borne.
Le départ est un disque de 12px en `go-mark`, l'arrivée un damier d'encre et de
papier posé en `<pattern>` SVG. Tous ces habillages passent par les variables CSS :
la SVG que Leaflet dessine vit dans le DOM et les résout, y compris dans le motif
injecté en `innerHTML`. La mention légale est ramenée à 9px `ink-faint` sur fond
transparent, et le préfixe de Leaflet est retiré, parce qu'il publie un drapeau en
emoji.

**Deux états, selon ce qu'on est venu y faire.** La prop `deplacable` est fausse par
défaut, et `dragging`, `scrollWheelZoom`, `doubleClickZoom`, `touchZoom` et
`keyboard` y sont tous liés d'un bloc. Fixe, la carte est une image : dans la fiche
d'import, c'est une confirmation d'un coup d'œil, et une carte qui se déplace y
volerait le geste au formulaire. Déplaçable, elle devient un instrument : sur
l'écran Course, seul endroit du produit qui la passe à `true`, on vient chercher un
endroit précis de la trace pour y poser une borne. Le clic sur le tracé continue d'y
poser un ravito dans les deux états.

**Les commandes sont dessinées, pas empruntées.** Le contrôle de zoom de Leaflet est
désactivé (`zoomControl={false}`) : il arrive en boîte blanche et en Arial, une
autre langue que le carnet. À sa place, trois boutons de 32px empilés au coin haut
droit dans un panneau papier cerné d'un filet, rayon de contrôle, séparés par un
filet d'un pixel, avec `--shadow-panel` : `PlusIcon`, `MinusIcon`, et `FrameIcon`
pour recadrer, une icône du jeu comme les autres, cadre à coins marqués sur la
grille de 24 au trait 1,6. Le panneau appelle `DomEvent.disableClickPropagation` et
`disableScrollPropagation` : Leaflet écoute en natif sur le conteneur, un
`stopPropagation` React n'atteindrait pas ces écouteurs, et un clic sur « + »
poserait aussi un ravito.

**La carte suit la main et s'arrête avec elle.** `inertia={false}` : un geste vif
projetait la carte hors du tracé. Borner le déplacement par `maxBounds` a été essayé
et retiré, parce qu'à ce zoom la vue remplit déjà le cadre de la trace et que le
moindre geste rebondissait. C'est le bouton « recadrer » qui rattrape une vue
égarée, pas une laisse. Ce recadrage ne s'anime pas et coupe ce qui vole encore
(`map.stop()` puis `fitBounds` en `animate: false`) : un recadrage animé lancé sur
un zoom inachevé atterrissait court, et il fallait cliquer deux fois.

**Le recadrage automatique s'arrête à la première main posée.** Le
`ResizeObserver` qui rattrape l'ouverture d'un `<dialog>` recadrerait aussi à chaque
repli de la feuille du bas, qui change de hauteur au pouce : un témoin le désarme
dès que la carte a été manœuvrée. Il écoute les gestes plutôt que leurs
conséquences, `dragstart` et `zoomstart` sur la carte, et les deux boutons de zoom
se marquent eux-mêmes ; « recadrer » est le seul geste qui le remet à zéro.

### LegProfile, le profil du roadbook

Reprend telle quelle la lecture de l'écran Course : `ElevationChart` avec sa prop
`paceBand`, l'allure des secteurs superposée en dégradé sur le relief plutôt que
répétée dans une bande à part. Les bornes de secteur sont les mêmes pastilles
numérotées cliquables que sur Course (`marks`/`onChoisirMark`), et amènent la carte
du secteur sous les yeux. Une ancienne bande dédiée, découpée en secteurs et
sous-titrée de l'allure en Geist Mono 10px, existait avant elle : au pouce, ce texte
descendait sous la taille lisible et la cible de clic sous la largeur qu'on vise
juste. L'unification règle les deux du même geste, en plus de dire la même chose que
Course avec le même vocabulaire.

### L'accueil, une autre composition

L'accueil ne suit pas la grammaire du plan et c'est le contrat.

- **Hero** : une photographie plein cadre bornée à un écran (`h-dvh`), fondue au
  papier en haut (0 % à 22 %) et au papier en bas (90 % à 100 %) par un dégradé
  linéaire sur `--paper`, la section continuant ensuite sur le fond uni.
- **Panneau de dépôt** : le seul verre du système. `bg-white/10`,
  `border-white/40`, `backdrop-blur-sm`, une ombre large et un rayon de 28px, hors
  de l'échelle de rayons. Le bouton qu'il porte est une pilule de papier. Le
  glisser-déposer est actif sur toute la fenêtre : un fichier survolant la page
  ouvre un voile d'encre à 70 % avec un cadre blanc de 2px en retrait de 12px.
- **Cartes-affiche** : fond photo sur `ink`, rayon de feuille, un seul dégradé haut et
  bas, le titre en 24px/700 papier, le profil de la course tracé en SVG papier de
  5px sur toute la largeur, les bornes en traits accent, et le relevé en Geist Mono
  au pied. Aucun panneau plaqué : la photo s'éteint.
- **Tuiles de navigation** : papier plein sans bordure, rayon de feuille, une
  étiquette en Geist Mono 11px capitales au-dessus d'un intitulé en 18px/700.

Le poids typographique de l'accueil (700) et son verre n'ont pas cours de l'autre
côté de la porte : le plan ne monte jamais au-dessus de 600, et n'a pas une seule
surface translucide.

## Do's and Don'ts

### Do:

- **Do** réserver l'accent aux marques de la course, à la destination active, au
  curseur et au focus. Un bouton se remplit d'encre ou reste du papier.
- **Do** faire passer toute mesure par `src/format/` et l'afficher en Geist Mono.
  `km`, `entier`, `quantite`, `duree`, `ecart` pour les nombres, `toHMS` et
  `paceLabel` pour le temps, `nomProduit`, `formatFr` et `coupeFr` pour le
  vocabulaire des produits.
- **Do** doubler toute information colorée d'un signe, d'une forme ou d'un mot. Le
  test : passer l'écran en noir et blanc ; s'il perd du sens, il manque quelque
  chose.
- **Do** séparer avec un filet d'un pixel (`border-line`, `Rule`) et distinguer une
  zone avec `paper-dim`.
- **Do** prendre les icônes dans `src/ui/icons.tsx`, et en ajouter une là plutôt
  qu'ailleurs : `viewBox` 24, trait 1,6, bouts arrondis, jamais de remplissage.
- **Do** laisser chaque écran gérer son propre défilement et poser la barre
  d'enregistrement en dehors, en pied.
- **Do** écrire les bornes d'un réglage sous sa piste, et la conséquence d'un
  enregistrement avant de le déclencher.
- **Do** nommer un bouton icône par `aria-label` et par `title` : rien ne se pilote
  à l'icône seule.
- **Do** rappeler les jetons en dur quand le contexte de rendu ne résout pas les
  variables CSS (un `<canvas>`, une commande Chart.js), et signaler le miroir en
  commentaire comme le fait `ElevationChart`.

### Don't:

- **Don't** poser l'accent dans le fond d'un bouton, ni comme couleur de texte
  courant.
- **Don't** ajouter une ombre en dehors de `--shadow-panel` et `--shadow-lifted`.
  Un panneau au repos, au survol ou au focus reste plat.
- **Don't** introduire un rouge, un bleu, ou une sixième teinte. Un refus emprunte
  l'accent, une alerte l'ambre, une confirmation le vert de `--go`, et rien d'autre
  n'existe.
- **Don't** inventer un rayon, ni en écrire un en dur. Trois variables et la pilule
  couvrent tout ce que le plan contient, et se citent par leur nom ; les 28px du
  panneau de dépôt et les 4px de la bande d'allure sont les deux seules valeurs
  littérales du dépôt, chacune argumentée sur place.
- **Don't** poser un emoji ou un glyphe Unicode à la place d'une icône. Le point
  médian `·`, le signe moins `−` et le `+` restent, ce sont des signes
  typographiques.
- **Don't** ajouter un deuxième moment de mouvement. Le carnet en a un, la fiche qui
  monte (`fiche-monte`, 260ms, `cubic-bezier(0.16, 1, 0.3, 1)`, depuis un état déjà
  lisible), son voile (`voile-parait`, 200ms), la roue d'attente, et le repli de la
  feuille en mobile (300ms). Tout le reste est une transition de couleur. Toute
  animation nouvelle passe par `@media (prefers-reduced-motion: reduce)`.
- **Don't** écrire un tiret cadratin ou demi-cadratin dans une chaîne affichée, ni
  un superlatif, ni un verbe d'accroche. Les dix interdits de `docs/voix.md` valent
  pour tout texte lu par un coureur.
- **Don't** habiller un `<select>` autrement qu'en retirant le chevron du système
  pour poser celui du jeu. Le reste du comportement natif est ce que le clavier et
  le tactile attendent.
- **Don't** faire entrer une photographie dans les quatre destinations du plan. Elle
  vit sur l'accueil, et la vignette d'un produit est un substitut de catalogue, pas
  une image d'ambiance.

- **Don't** recopier la valeur d'un jeton là où la variable se résout. La SVG de
  Leaflet vit dans le DOM : ses marqueurs, son tracé et jusqu'au motif du damier
  posé en `innerHTML` prennent `var(--paper)`, `var(--ink)`, `var(--accent)` et
  `var(--go-mark)`. Le `<canvas>` du profil est le seul contexte qui l'interdit.
