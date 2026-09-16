# Le PDF du roadbook

`PRODUCT.md` pose le PDF comme le livrable et l'écran comme l'atelier. Ce
document dit comment on le fabrique. Il décrit un sous-système à écrire, pas du
code existant : il périmera le jour où le code le dira mieux que lui.

Les sections sont numérotées pour se citer.

## 1. Ce qu'on fabrique

Une feuille A4 que le coureur plie dans une poche, imprimée sur une imprimante
de bureau, souvent en noir et blanc. Elle porte, de haut en bas :

1. l'identité de la course ;
2. la carte, sur fond OpenStreetMap ;
3. le profil et la bande d'allure ;
4. les temps de passage et les rations ;
5. la liste de courses, le sac complet.

La mise en page des tableaux a été tranchée après comparaison de deux formes
(section 6).

## 2. Décisions arrêtées

### 2.1 Le PDF se fabrique côté serveur

Un route handler, `GET /plan/[accessId]/roadbook/pdf`, qui lit la base et rend
`application/pdf` avec `Content-Disposition: attachment`.

La raison décisive est le profil pleine résolution. La bande d'allure est celle
de l'écran Course, calculée par `paceSegments` puis `paceBand` sur le `profile`
à dix mètres, et `getTrack.ts` documente que le Roadbook ne charge que les
points simplifiés — deux cents kilo-octets à un mégaoctet et demi, qu'on ne
veut pas faire traverser le réseau pour dessiner une image. Côté serveur, le
profil est lu et consommé sur place.

S'y ajoutent trois conséquences qui vont dans le même sens : aucun kilo-octet
de bibliothèque dans le bundle du Roadbook (`@react-pdf/renderer` pèse près
d'un mégaoctet), un fichier qui a une URL, et un contenu qui ne peut pas
diverger de la base puisqu'il en sort.

**Alternative écartée.** Fabriquer le PDF dans le navigateur avec
`pdf().toBlob()`. Les tuiles OSM seraient alors cherchées par le navigateur,
comme pour n'importe quelle carte affichée, ce qui est plus conforme à la
politique d'usage d'OSM que de les faire chercher par le serveur. C'est le seul
point où cette option est meilleure, et il ne pèse pas assez contre le profil.

**Ce qui dérange.** Le serveur devient consommateur de tuiles OSM, et deux
obligations suivent.

La première est de se nommer. Toute requête HTTP transporte un en-tête
`User-Agent` qui dit qui demande ; jusqu'ici c'était le navigateur du coureur
qui signait, puisque Leaflet y tourne. Un `fetch` depuis le serveur signe avec
un en-tête générique, et la politique d'usage d'OSM demande qu'une application
se nomme et laisse un moyen de la joindre, sous peine d'être bloquée. Les
tuiles sont servies par des dons : c'est leur seul moyen de couper un
consommateur sans couper les autres. Une ligne suffit.

```ts
fetch(url, {
  headers: { "User-Agent": "nutrition-calculator/0.1 (contact@exemple.fr)" },
});
```

La seconde est de garder les tuiles. Deux plans sur la même course, ou le même
plan réimprimé trois fois, demandent les mêmes carrés de carte : les
redemander à chaque PDF est du gaspillage sur une ressource offerte.

À un PDF par clic, le volume reste celui d'un affichage de carte. Si l'usage
monte, c'est la première chose à revoir.

### 2.2 On ne rend que l'état enregistré

Le bouton est inerte tant que le Roadbook porte des retouches non
enregistrées. Rendre l'état à l'écran était l'autre option ; l'inertie du
bouton a l'avantage de **dire** au coureur que ce qu'il voit n'est pas encore
enregistré. La barre du bas le dit déjà, en mots ; un bouton qui refuse de
partir le dit par le geste, au moment où le coureur le tente.

Conséquence : `sheet.ts` ne connaît pas les retouches en cours. Il lit
`roadbook.legs[].supply` et `roadbook.total` tels que `getRoadbook` les rend.
Rien de ce qui existe dans `roadbook/format.ts` pour recalculer en direct
(`liveSupply`, `liveTotal`) ne sert ici.

**Ce qui dérange.** Un coureur qui vient de corriger une quantité doit
enregistrer avant d'imprimer. C'est un pas de plus, assumé.

### 2.3 Rien n'est rastérisé, sauf les tuiles

`@react-pdf/renderer` 4.9.0 exporte `Svg`, `Path`, `Polyline`, `Polygon`,
`LinearGradient`, `Stop`, `ClipPath`, `Tspan`. Le profil et la trace sont donc
vectoriels : nets à n'importe quel zoom, quelques kilo-octets, et surtout
calculés par des fonctions pures qui se testent.

Chart.js ne sait sortir que du canvas ; « vectoriel » veut donc dire redessiner
le profil en primitives react-pdf à partir de `points`, `slopeColor` et
`paceGradientStops`, et non exporter le graphique de l'écran. La figure est la
même parce qu'elle part des mêmes données et des mêmes rampes, pas parce qu'on
copie un rendu.

**Alternative écartée.** Monter `ElevationChart` hors champ et appeler
`chart.toBase64Image()`. Une image floue à l'impression, un canvas à attendre
avant de l'exporter, et rien de testable.

Seules les tuiles OSM restent des images : `<Image>` posées à leur décalage
dans une `<View>`, la trace en `<Svg>` par-dessus.

### 2.4 La trace porte un liseré blanc

Les tuiles ne sont ni désaturées ni éclaircies : la carte est en couleur,
comme à l'écran. Une trace fine s'y perdrait une fois la feuille passée en
gris, donc elle se trace en deux passes, un trait blanc large puis un trait
d'encre étroit par-dessus. Elle ressort sur n'importe quel fond. Les bornes
prennent le même traitement, pastille blanche et chiffre noir.

La carte de l'écran Course gagnerait le même liseré. C'est un autre commit.

### 2.5 La bande d'allure est celle de l'écran Course

Celle de `_race/pacing.ts`, continue, calculée par tronçon de pente homogène.
Pas `legPaceBand` de `roadbook/format.ts`, qui donne la moyenne par secteur.
Elle garde ses couleurs (`paceColor`), avec son axe gradué à côté : la couleur
n'y porte jamais seule l'information.

`_race/pacing.ts` ne porte pas `"use client"`, il s'importe tel quel depuis le
route handler.

L'écran Roadbook lit désormais la même bande : la dérivation — temps de
mouvement relu sur les secteurs, réglages d'allure relus sur le plan — vit dans
`roadbook/racePaceBand.ts`, que la feuille et l'écran appellent tous deux. Deux
dérivations séparées finiraient par diverger, et le papier ne montrerait plus
l'écran. `legPaceBand` ne sert plus qu'à la réglette des secteurs, sous le
graphique, qui compare des moyennes entre elles et garde donc son échelle.

### 2.6 Deux déclencheurs, un nom de fichier

Le lien vit dans la barre du bas du Roadbook, contre « Enregistrer les
retouches », et en haut contre le bouton « Partager » de `PlanTopBar`. Le
partage et l'impression sont deux façons de faire sortir le plan, elles se
tiennent au même endroit.

En bas, les deux boutons ont des états **opposés** : on enregistre tant qu'il
reste des retouches, on emporte la feuille une fois qu'il n'en reste plus. Un
seul des deux est actif à la fois, et la barre se lit comme un seul choix
plutôt que comme deux commandes.

Le fichier s'appelle `nom-de-la-trace_date.pdf`, sur la date de course. Le nom
est assaini : minuscules, accents dépliés, tout ce qui n'est ni lettre ni
chiffre ramené à un tiret, tirets consécutifs fondus. Un plan sans date de
course garde le seul nom.

**Comment les deux déclencheurs s'accordent.** `PlanTopBar` vit dans
`_shell/` et sert les quatre destinations. Savoir si le plan est calculé ne
posait pas de problème, la coquille le lit déjà pour ses pastilles d'état.
Savoir s'il reste des retouches, si : cet état vit dans `RoadbookEditor`, et
la barre du haut en est la **sœur**, pas la descendante.

D'où `RetouchesEnCours`, un contexte client que la coquille pose au-dessus des
deux. Il ne porte rien d'autre qu'un booléen : ce n'est pas un magasin d'état,
c'est un fil entre deux points que l'arbre sépare. `RoadbookEditor` déclare le
sien par `useDeclarerRetouches`, dont le nettoyage remet à propre en quittant
l'écran — sans lui, revenir sur Cibles après une retouche laisserait la barre
croire qu'il reste quelque chose à enregistrer.

**Alternative écartée.** Ne garder que le déclencheur du bas, où `sale` est
connu, et se passer du contexte. Elle évitait la plomberie, au prix du geste
qu'on cherche là où le partage se trouve.

**Ce qui dérange.** La décision et la lecture du contexte sont séparées en
deux composants (`PdfTrigger` et `PdfLink`) parce que la suite de tests n'a
pas de DOM et ne joue donc aucun effet : seule la première se teste. Le fil
lui-même, du Roadbook à la barre, ne se vérifie qu'à la main dans un
navigateur.

## 3. Les modules

Tout est pur sauf le route handler et les composants.

| Fichier                                         | Rôle                                                                                                                                                             |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pdf/staticMap.ts`                          | Le cadrage. Un bbox et une taille de cadre entrent ; le zoom, le centre, la liste des tuiles `{z, x, y, dx, dy}` et la projection `(lat, lon) → (x, y)` sortent. |
| `src/pdf/profile.ts`                            | Le relief en polygones, un par suite de points de même palier de pente, plus les marches d'allure et les arrêts du dégradé.                                      |
| `src/pdf/sheet.ts`                              | Le plan et le roadbook entrent, les lignes de la feuille sortent. Il range, il ne dessine pas.                                                                   |
| `src/pdf/Sheet.tsx`                             | Le document : `Document`, `Page size="A4"`, et l'assemblage.                                                                                                     |
| `src/pdf/Map.tsx`                               | Les tuiles en `<Image>`, la trace et les bornes en `<Svg>`.                                                                                                      |
| `src/pdf/Profile.tsx`                           | Le relief, la bande d'allure, les deux axes.                                                                                                                     |
| `src/pdf/Tables.tsx`                            | Les tableaux des deux formes.                                                                                                                                    |
| `src/app/plan/[accessId]/roadbook/pdf/route.ts` | Lit, calcule la bande, `renderToBuffer`, rend le fichier.                                                                                                        |

`staticMap.ts`, `profile.ts` et `sheet.ts` passent par `vitest`, comme
`slopeColor.ts` et les données du graphique (`chart.test.ts`). Les composants
se vérifient à l'œil sur le fichier produit.

### 3.1 Le cadrage

Web Mercator, tuiles de 256 pixels. La largeur utile d'une A4 à marges de
15 mm fait 180 mm, soit environ 510 points PDF.

Le cadre visé pour le choix du zoom n'est pas celui-là mais son double,
1 020 pixels : le zoom retenu est le plus grand qui laisse le bbox y tenir, et
la mosaïque obtenue est ensuite réduite de moitié dans le cadre réel. Sans ce
facteur deux, le fond de carte est agrandi et devient flou à l'impression.

L'attribution OpenStreetMap part en pied de page, en texte.

### 3.2 Le route handler

```ts
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/plan/[accessId]/roadbook/pdf">,
);
```

`RouteContext` est global après `next typegen`, et `ctx.params` est une
promesse. Le handler lit le plan, le roadbook, les points et le profil,
appelle `paceSegments` puis `paceBand`, rend le document et renvoie le buffer.
Un plan sans roadbook calculé rend un 404.

## 4. Le contenu de la feuille

Commun aux deux formes, en tête de première page :

- **L'identité** : nom de la trace, date et heure de départ, distance, D+,
  chrono visé, allure moyenne en mouvement. Une ligne.
- **La carte**, pleine largeur, environ 200 points de haut.
- **Le profil et l'allure**, pleine largeur, environ 145 points de haut. Le
  relief est d'un seul ton, aplat gris et crête à l'encre, ses arêtes lissées.
  La rampe d'allure est la seule couleur. Les deux figures occupent **tout le
  cadre** et se superposent franchement : une allure se lit contre le relief
  qui l'impose, pas à côté de lui. Voir 4.2 pour la grille qu'elles
  partagent.
- **Les cibles** : glucides en g/h, boisson en mL/h, sodium en mg/L. Et le
  poids porté au départ.

- **Les avertissements du plan**, ceux que `roadbook.warnings` porte sans
  viser de secteur, rendus par `warningText` de `roadbook/warnings.ts` (une
  fonction pure, elle s'importe telle quelle). Un bloc court, en encre pleine,
  encadré d'un filet.

Puis les tableaux, qui débordent sur les pages suivantes en répétant leur ligne
d'en-tête. Les avertissements attachés à un secteur (`leg.warnings`) se posent
sous la ligne de ce secteur, dans les deux formes, au même traitement.

Un secteur se nomme par ses deux bornes, jamais par un numéro : `legBounds` de
`roadbook/format.ts` dit pourquoi, et le PDF s'en sert.

### 4.1 Une grille pour deux échelles

Superposer le relief et l'allure sur toute la hauteur demande de ne pas
superposer aussi leurs grilles : deux séries de lignes horizontales donnent un
quadrillage que l'œil ne démêle pas.

Il n'y a donc qu'une suite de lignes. Les **altitudes la commandent**, parce
qu'elles tombent sur des nombres ronds ; l'allure se lit ensuite à la hauteur
où chaque ligne passe, et ses valeurs ne sont donc pas rondes. C'est la
disposition du PacePro des montres de course, d'où vient déjà la rampe de
couleurs : altitude à droite, allure à gauche, mêmes lignes.

Les trois axes portent leur titre, les deux verticaux couchés le long de leur
gouttière : `Allure (/km)`, `Altitude (m)`, `Distance (km)`.

**L'écriture des graduations se déduit du pas.** Le pas rond peut valoir 2,5,
et l'écrire en entiers étiquetait « 3 » un trait tombant à 2,5 km ; sur une
trace de cinq kilomètres, la moitié des étiquettes se répétaient. `axe` compte
les décimales du pas et les applique à toutes, uniformément. Les distances se
graduent en kilomètres, pas en mètres, pour la même raison. `toFixed` et non
`toLocaleString` : ce dernier sépare les milliers d'une espace fine
insécable, et `pdfSafe` ne passe pas sur le profil (voir 5.1).

### 4.2 Le repère, qui relie la carte au tableau

La carte marque le départ d'un `D`, chaque ravito de son rang, l'arrivée d'un
`A`. Ces repères ne valaient rien tant que le tableau des temps de passage
nommait ses bornes sans les numéroter : on lisait `7` sur la carte sans
pouvoir retrouver la ligne. Le tableau porte donc une colonne `repere`, et
`bornesOf` produit exactement la même suite.

Sur une boucle, le départ et l'arrivée tombent au même endroit et leurs deux
pastilles se superposeraient en un glyphe illisible : l'arrivée saute alors.
Le recouvrement se mesure **en pixels du cadre**, contre le diamètre d'une
pastille, et jamais en degrés : ce qui décide est la place que les deux
pastilles prennent sur la feuille, et elle dépend du zoom retenu. Un seuil en
degrés ne valait qu'à un seul zoom, sautant l'arrivée d'un trail court dont
les deux bouts étaient pourtant bien séparés, et la gardant sur un ultra où
elles se chevauchaient.
Deux ravitos au même village se recouvrent de la même façon, et là on ne peut
rien : c'est le tableau qui porte l'information complète, la carte n'est qu'un
repérage.

## 5. Le traitement typographique

La feuille est pensée pour une imprimante noir et blanc. Aucun gris de texte
sous soixante pour cent d'opacité, aucun fond de cellule teinté : ce sont les
filets qui séparent. Les cinq gris de `slopeColor` passent l'impression tels
quels, c'est ce pour quoi ils ont été choisis. La rampe d'allure est la seule
couleur, et elle longe un axe gradué qui porte les mêmes nombres.

Polices Helvetica et Courier, celles que `@react-pdf/renderer` embarque. Pas
de fichier de police à charger, et Courier tient l'alignement des chiffres en
colonne.

`docs/voix.md` vaut pour tout texte lu par un coureur, donc pour cette feuille,
et il demande les mesures en Geist Mono tabulaire. Courier y déroge : c'est une
dette assumée, pas un choix.

### 5.1 Ce que WinAnsi ne porte pas

Les deux polices intégrées sont encodées en WinAnsi, et le premier rendu l'a
montré sans ambiguïté : `D+ 6 290 m` s'imprimait `D+ 6ℓ90 m`. Trois signes du
produit manquent à cet encodage.

| Signe | D'où il vient | Ce qui le remplace |
| --- | --- | --- |
| U+202F, espace fine insécable | `toLocaleString("fr-FR")`, entre les milliers | U+00A0, l'insécable ordinaire |
| U+2212, signe moins | `ecart()` et les dénivelés négatifs | `-`, le trait d'union |
| U+2192, flèche | les deux bornes d'un secteur | `>` |

`pdfSafe` fait la conversion, et `sheetOf` la passe sur la feuille entière
d'un seul coup, au dernier moment : ainsi rien n'y échappe, pas même le texte
d'un avertissement ou un champ ajouté plus tard. Les composants, eux, écrivent
directement des signes que WinAnsi porte, leurs libellés ne passant pas par
là.

Ce n'était pas une coquille de style mais un dénivelé faux. C'est le prix des
polices intégrées, et la première chose que règlerait une vraie police.

### 5.2 Deux pièges du profil vectoriel

**Le moiré.** `ElevationChart` prévient déjà qu'un aplat par palier de pente,
sous un pixel de large, se lit comme un code-barres ; il plafonne à
`POINTS_TRACES`. Sur le papier, plus étroit qu'un écran, ce plafond ne
suffisait pas : sur cent trente kilomètres le relief devenait un peigne.

Deux remèdes pris ensemble. Le plafond est indexé sur la largeur du cadre, un
aplat par quatre unités de `viewBox`, et non sur un nombre fixe. Et le relief
a perdu les cinq gris de pente : un seul ton, une crête à l'encre, les arêtes
lissées en cubiques de Bézier (`courbe`). Les gris de pente restent justes à
l'écran, où la largeur les porte ; ils ne survivent pas à une A4.

**La rampe d'allure.** Teindre une polyligne par un `<LinearGradient>` sort
en noir : le rendu PDF n'applique pas la teinture au trait. La géométrie
rendait de toute façon le dégradé inutile — un palier d'allure est horizontal,
la rampe est verticale, donc chaque palier prend une couleur unie. L'escalier
est donc fait de traits, chacun coloré par `couleurAllure`, qui inverse
l'étirement de `paceGradientStops` pour que le vert tombe pile sur la moyenne.

**Le sens de l'axe.** Écrit à l'envers du premier coup, et invisible tant
qu'on ne lit pas les graduations : le rapide va **en haut**, comme partout
ailleurs un sommet est un maximum. `ElevationChart` le dit, un test le tient
désormais. Les traits sont à bouts francs : paliers et contremarches partagent
leurs extrémités, et deux bouts arrondis superposés épaississent le joint au
lieu de le fermer.

## 6. La mise en page des tableaux

Deux formes ont été écrites et comparées sur un ultra de dix secteurs : l'une
séparait les temps de passage des rations, l'autre les fondait. **C'est la
seconde qui a été retenue**, le 15 septembre 2026. La première a été supprimée
au même commit, ainsi que la liste `passages` de `sheet.ts`, qui n'avait plus
de lecteur.

### 6.1 Une ligne par borne, ses rations dessous

Une ligne de secteur, en gras, portant la borne qui le clôt et ses colonnes de
temps — km, durée, heure de passage, arrêt — puis, à droite, son apport sur
son besoin avec l'écart signé. Dessous, ses rations : quantité, produit,
marque et format, et leurs propres glucides et sodium dans les deux colonnes
de droite. Les colonnes de temps y restent vides, elles ne disent rien d'une
ration.

Le secteur porte lui-même la borne qui le clôt (`arrivee`, `repere`,
`passage`, `arret`). Sans cela, fondre les deux tableaux demandait de faire
coïncider `passages[i + 1]` avec `secteurs[i]`, un couplage par indice qui
casse au premier changement.

Les largeurs sont des nombres et non des chaînes : la largeur des colonnes de
temps, laissée vide sur la ligne d'une ration, se déduit de la somme des
autres. Recopiée en dur, elle était déjà fausse au premier rendu.

**Ce qui dérange.** La forme retenue charge la ligne, et sur un ultra à quinze
ravitos le tableau sera long. Elle a en revanche l'avantage de ne jamais
demander de revenir en arrière en course, là où deux tableaux imposent
l'aller-retour entre deux pages.

**Ce qu'elle a coûté.** Le D+ et le D− de chaque secteur, et le temps écoulé
depuis le départ, que la forme à deux tableaux montrait et que celle-ci n'a
pas la place de porter. Ils restent dans `roadbook.legs`, à trois lignes de
distance si la refonte les réclame.

### 6.2 La liste de courses

En fin de document : le sac complet, quantité, produit, marque, puis les
totaux de `roadbook.total` — glucides et écart, énergie, sodium, boisson,
poids porté au départ.

## 7. Ordre d'écriture

Chaque étape se vérifie seule.

1. ~~**Éprouver `@react-pdf/renderer` dans un route handler.**~~ Fait.
   `serverExternalPackages` s'est révélé inutile : la bibliothèque figure déjà
   dans la liste d'opt-out intégrée de Next, et `next.config.ts` n'a pas
   bougé. Appris au passage : un fichier `route` n'accepte que `.js` et `.ts`,
   donc le document vit à côté et le handler l'appelle comme la fonction qu'il
   est.
2. ~~**`sheet.ts` et les tableaux, forme « deux ».**~~ Fait. Voir 5.1 pour ce
   que le premier rendu a révélé.
3. ~~**`staticMap.ts` et la carte.**~~ Fait. Les tuiles se posent en `<Image>`
   et la trace en `<Svg>` par-dessus, sans canevas. Appris au passage : les
   repères de la carte ne servaient à rien tant que le tableau nommait ses
   bornes sans les numéroter, d'où la colonne `repere` (voir 4.1).
4. ~~**`profile.ts`, le relief et la bande d'allure.**~~ Fait. Voir 5.2 pour
   les deux pièges du rendu vectoriel.
5. ~~**La forme « une »**, en variante du seul bloc qui change.~~ Fait. Le
   secteur porte désormais lui-même la borne qui le clôt (`arrivee`,
   `repere`, `passage`, `arret`) : fondre les deux tableaux demandait sinon de
   faire coïncider deux listes par leur indice.
6. ~~**Le bouton**, inerte tant que `sale`.~~ Fait. Deux déclencheurs, une
   icône contre le partage et un bouton nommé sous le sac, reliés par le
   contexte décrit en 2.6.

## 8. Ce qui reste ouvert

- **La vérification du fil `sale`** entre le Roadbook et la barre du haut.
  Elle demande un DOM que la suite de tests n'a pas. À faire à la main, ou en
  ajoutant un environnement de test au projet, ce qui déborde de ce
  sous-système.
- **Un ADR.** Les décisions 2.1 et 2.3 en méritent un une fois qu'elles auront
  tenu à l'usage. On ne grave pas ce qui n'a pas encore tourné.
