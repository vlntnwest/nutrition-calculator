# La voix, et ce qui la trahit

Ce fichier vaut pour **tout texte lu par un coureur** : libellés, boutons, aides
de champ, messages d'erreur, titres, états vides. Il ne régit ni les
commentaires de code ni les ADR.

La voix visée est déjà décrite dans `PRODUCT.md` : française, précise, sans
superlatif, elle explique le mécanisme plutôt que de vanter le résultat. Ce
fichier dit comment on la tient, en interdits vérifiables.

## Pourquoi des interdits plutôt qu'un ton

Un texte écrit par un modèle se reconnaît rarement à un mot. Il se reconnaît à
une accumulation : la ponctuation trop propre, les paragraphes de longueur
égale, les listes qui tombent toujours à trois, la phrase finale qui ménage les
deux côtés. Les études de 2026 mesurent le tiret cadratin autour de 10 pour
mille mots chez un modèle contre 3 chez un essayiste publié, avec un
recouvrement tel qu'il ne prouve rien tout seul. C'est la convergence des
signes qui trahit, pas le signe.

Un produit n'a pas à se défendre d'un détecteur. Mais chacun de ces signes est
aussi, pris à part, une facilité d'écriture : le tiret cadratin évite de
choisir entre la virgule et le point, la triade évite de trancher lequel des
trois éléments compte, le superlatif évite d'aller chercher la mesure. Les
interdire fait mieux écrire, la question du modèle mise à part.

## Les dix interdits

### 1. Pas de tiret cadratin ni de demi-cadratin dans le texte affiché

`—` et `–` sont bannis de l'interface. Il faut choisir : une virgule, un point,
deux points, ou une parenthèse. Chaque choix dit une chose différente, et le
tiret cadratin sert justement à ne pas la dire.

- Avant : « soit 05:36 /km de moyenne — ajustable ensuite »
- Après : « soit 05:36 /km de moyenne, ajustable ensuite »

Restent autorisés, parce que ce ne sont pas de la ponctuation : le signe moins
`−` d'un écart chiffré, le séparateur `·` entre deux mesures, et le trait
d'union d'un mot composé.

### 2. Pas d'antithèse de balancier

« Ce n'est pas X, c'est Y », « non seulement X mais aussi Y », « moins X que
Y ». La figure donne une impression de profondeur sans rien ajouter. On écrit
la moitié qui compte.

### 3. Pas de triade décorative

Trois éléments seulement quand il y en a vraiment trois. Un troisième terme
ajouté pour le rythme se voit.

### 4. Pas de superlatif ni d'adverbe de renfort

Bannis : parfaitement, simplement, facilement, instantanément, entièrement,
en toute simplicité, puissant, complet, optimal, idéal, précis (sur soi-même).
Une mesure remplace toujours un adjectif : « 2 041 points lus » vaut mieux que
« trace détaillée ».

### 5. Pas de verbe d'accroche

Découvrez, plongez, profitez, libérez, boostez, maîtrisez, transformez. On
décrit ce que l'écran fait, à l'indicatif ou à l'impératif nu : « Importez la
trace de votre course ».

### 6. Pas de queue participiale

« …, vous permettant de », « …, garantissant que », « …, assurant une ». La
subordonnée en `-ant` colle une conséquence à une phrase qui était finie. Deux
phrases, ou rien.

### 7. Pas de méta-commentaire

« Il est important de noter que », « à noter que », « en effet », « par
ailleurs » en tête de phrase. Si l'information mérite d'être là, elle n'a pas
besoin d'être annoncée.

### 8. Pas de deux-points théâtral

Les deux points énumèrent ou définissent. Ils n'annoncent pas une révélation.

- Non : « Le résultat : un sac juste. »
- Oui : « Le fichier n'est pas conservé : seuls la trace et le profil sont
  enregistrés. »

### 9. Un message d'erreur dit quoi faire

Il nomme ce qui bloque et l'action qui débloque, dans cet ordre, sans
s'excuser. « Le fichier doit être un fichier GPX » plutôt que « Une erreur est
survenue lors de l'import ».

### 10. Pas d'emoji

Les pictogrammes du carnet forment un jeu fermé, hérité des wireframes :
`○ ● ◍` pour les pastilles d'état, `⚠` pour un avertissement, `▸ ◂ ⌃ ⌄` pour
une direction, `·` pour séparer, `+ −` pour une quantité. Rien d'autre
n'entre.

## Deux règles positives

**Les mesures en Geist Mono, tabulaires.** Une distance, un dénivelé, un
chrono, une allure, une masse en grammes : ce sont des relevés, ils s'alignent
en colonne et ne bougent pas quand le chiffre change.

**Les libellés sont des noms, les actions des verbes.** « Chrono visé », pas
« Entrez votre chrono ». « Enregistrer », pas « Valider mes modifications ».

## Vérifier

```bash
# Aucun tiret cadratin ni demi-cadratin dans une chaîne affichée.
rg '[—–]' src --glob '*.tsx'
```

Le motif ressort aussi les commentaires de code, qui eux ont le droit. La
lecture reste manuelle.
