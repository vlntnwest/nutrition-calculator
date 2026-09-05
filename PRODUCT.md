# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Des coureurs d'endurance qui préparent une épreuve à trace connue : un trail local
de 45 km, la SaintéLyon, un ultra, un brevet de 400 km. Ils construisent leur plan
au calme, en amont de la course, souvent plusieurs fois — on revient dessus quand
le temps visé bouge ou qu'on change de produit.

Le jour J, ils ne construisent plus : ils suivent. **Le livrable emporté est un
PDF**, l'écran n'est qu'un recours secondaire.

## Product Purpose

Produire, à partir d'un fichier GPX, les temps de passage par tronçon et la
quantité de glucides, d'eau et de sodium à emporter entre chaque ravitaillement.
L'utilisateur dépose une trace, renseigne un temps visé et une tolérance
digestive, place ses ravitos, choisit ses produits ; l'outil rend un roadbook.

Le succès : le coureur part avec un sac juste et une feuille qu'il peut suivre en
course sans la réinterpréter.

## Positioning

Les calculateurs existants sont édités par des fabricants — bien faits, et
systématiquement verrouillés sur leur propre catalogue : le plan qui en sort est
une liste de courses de la marque. Le plus abouti ne couvre par ailleurs que les
épreuves d'un seul circuit.

Deux choses qu'un voisin ne peut pas copier sans changer de nature :
**l'import GPX de n'importe quelle course**, et **l'indépendance totale des
marques**. Les seuils viennent de la littérature scientifique et affichent leurs
sources, jamais des documents commerciaux d'un fabricant.

## Operating Context

- **Pas de compte, pas d'installation.** Un plan s'ouvre par son `accessId`, se
  garde sur l'appareil, et expire au bout de six mois.
- **Quatre destinations, pas un tunnel** : Course · Cibles · Produits · Roadbook.
  Un plan est un dossier qu'on rouvre. Chaque entrée porte une pastille d'état
  (○ vide · ● rempli · ◍ à recalculer).
- **Le GPX est parsé dans le navigateur puis jeté.** Seules la trace dérivée et le
  profil sont enregistrés (ADR 001).
- **Le PDF est le format d'usage en course** ; l'écran est l'atelier de
  préparation.
- Parcours documenté en wireframes annotés : sept écrans desktop, huit mobile.

## Capabilities and Constraints

- Le noyau de calcul est complet et testé : lecture GPX, D+ par filtre médian sur
  30 m sans seuil d'accumulation, découpage en tronçons de pente homogène,
  modèle d'allure, répartition du temps puis de la nutrition.
- La persistance est bouclée : un plan s'écrit, se relit, se régénère.
- **Les produits retenus sont figés en snapshot** au moment du choix. Corriger le
  catalogue ne réécrit jamais un plan enregistré.
- Les valeurs nutritionnelles sont exprimées **par dose consommée** — l'unité pour
  un gel, la mesurette pour une poudre.
- Le roadbook est **modifiable, pas seulement lisible** : quantités au pas de 0,5
  quand le produit se coupe, ajout d'un produit par secteur, durée et cible
  glucides imposables. L'écart signé dit si la correction tient ; le sac complet
  reste dérivé.
- Dix codes d'avertissement existent en base et se rattachent à un secteur ou au
  plan entier (glucides au-dessus du guide, sodium sous la cible, boisson
  au-delà de ce que portent les flasques, etc.).
- **Il n'y a pas encore d'interface.** Phase 3 du projet.

Décisions produit explicitement ouvertes, à ne pas trancher à sa place :

- Le **nom du produit** n'est pas choisi.
- Une correction manuelle fige-t-elle son secteur au prochain recalcul ?
- Les avertissements restent-ils sous leur secteur ou remontent-ils en tête ?
- Où vit l'allure — sous le chrono dans Course, à confirmer une fois le calcul
  branché.
- La feuille de la carte doit-elle pouvoir se réduire à une poignée ?
- L'impression PDF : icône seule, ou dans un menu ⋯ ?

## Brand Commitments

Aucun nom, aucun logo, aucune identité arrêtée à ce jour. Un moodboard existe dans
le fichier Figma et sert de matière de départ, sans avoir valeur d'engagement.

Voix du produit, telle qu'elle s'écrit déjà dans le README et les wireframes :
française, précise, sans superlatif, elle explique le mécanisme plutôt que de
vanter le résultat. Elle assume les limites — « un plan se teste à l'entraînement
avant de s'appliquer en course ».

## Evidence on Hand

- **Dix fixtures GPX de courses françaises réelles** confrontées à leur D+ officiel
  publié (`src/core/fixtures/references/`) — SaintéLyon, Strasparis, UTDC, UTHK,
  Saverne, Andlau.
- Un catalogue produits réel, semé en base (`src/core/products.ts`).
- Les références scientifiques et la tension non résolue ACSM / ISSN sur les
  glucides en ultra : `docs/sources.md`.
- Les décisions structurantes : `docs/adr/`.
- Wireframes annotés et moodboard : fichier Figma `VsiFFS9zOQBy9vHkTsVy01`.

Il n'y a **aucun utilisateur, témoignage, chiffre d'usage, partenariat ni presse**.
Rien de tel ne doit être fabriqué dans une maquette ou une page.

## Product Principles

1. **Le PDF est le livrable, l'écran est l'atelier.** Ce qui compte se lit sur une
   feuille, en noir et blanc, pliée dans une poche.
2. **Indépendance des marques.** Le catalogue est ouvert et le restera ; jamais un
   tunnel d'achat déguisé en conseil.
3. **Les seuils sont sourcés et les fourchettes visibles.** L'outil ne fait pas de
   conseil nutritionnel individualisé et le dit.
4. **Un plan est un dossier qu'on rouvre**, pas un tunnel qu'on traverse.
5. **Le calculé est retouchable, et l'écart reste visible.** L'utilisateur garde la
   main, l'outil garde la mesure.

## Accessibility & Inclusion

- **La couleur ne peut jamais porter seule une information.** L'impression est
  souvent en noir et blanc, la lecture se fait en plein soleil, et l'écart signé
  doit se comprendre sans distinguer le rouge du vert. Toute donnée codée par la
  couleur porte aussi un signe, une forme ou un mot.
- Cibles tactiles : les steppers de quantité restent d'au moins 34 px de haut,
  atteignables au pouce sans loupe.
