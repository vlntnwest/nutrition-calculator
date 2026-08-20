# 010. Retrancher les arrêts du temps visé, ne pas les diluer

## Statut

Accepté — 2026-08-20

## Contexte

`AidStation` ne portait que `name` et `distanceM`, et `distributeTime` recevait
le temps visé brut. Un objectif de 15 h 30 dont 50 min de ravitaillements
décrivait donc un coureur uniformément plus lent partout, au lieu d'un coureur à
son allure qui s'arrête trois fois. Les arrêts n'étaient pas ignorés : ils
étaient **répartis sur la trace**, au prorata de la géométrie, comme s'ils
étaient du terrain.

Mesuré sur l'UTHK — 103,3 km, objectif 15 h 30, trois ravitos à 22,6, 39,8 et
46,8 km pour 15, 20 et 15 min d'arrêt :

| Secteur | Mouvement réel | Temps dilué | Écart |
| --- | --- | --- | --- |
| Départ → Frankenbourg | 3 h 08 | 3 h 18 | +11 min |
| Frankenbourg → Lièpvre | 2 h 30 | 2 h 38 | +9 min |
| Lièpvre → Trotters | 1 h 04 | 1 h 08 | +4 min |
| Trotters → Arrivée | 7 h 58 | 8 h 25 | +27 min |

Deux conséquences, toutes deux silencieuses.

**Le roadbook se trompe d'heure, et pas toujours dans le même sens.** Le
passage à Frankenbourg est annoncé à 3 h 18 alors qu'il tombe à 3 h 08 ; celui à
Trotters est annoncé à 7 h 05 alors qu'il tombe à 7 h 17, les 35 min d'arrêt
amont s'étant accumulées entre-temps. L'erreur part en avance, bascule en
retard, et seule l'arrivée retombe juste — ce qui la rend indétectable en la
lisant.

**On emporte de quoi manger debout à une table.** Les besoins d'un secteur se
calculent sur sa durée : le dernier secteur reçoit 505 g de glucides à 60 g/h
au lieu de 478, soit les 27 min d'arrêt amont converties en gels. Sur la course
entière, 49 g de trop — exactement les 50 min d'arrêt. C'est du poids porté
pour un moment où le coureur mange les produits de l'organisation.

## Décision

**Un arrêt se retranche du temps visé avant que l'allure ne soit placée, il ne
se répartit jamais sur la trace.** `AidStation` gagne `stopS`, et
`movingTimeS(targetTimeS, aidStations, totalDistanceM)` rend le temps visé moins
la somme des arrêts. **C'est elle qu'on passe à `distributeTime`**, jamais le
temps visé brut. Dix minutes de ravito demandent d'aller plus vite entre les
ravitos, pas partout un peu moins vite.

Les arrêts sont ensuite **réintroduits par `splitByAidStation`**, en décalant
les deux bornes de chaque secteur du cumul des arrêts en amont. Les deux bornes
reçoivent le même décalage : un arrêt tombe *entre* l'arrivée d'un secteur et le
départ du suivant, jamais à l'intérieur d'un secteur.

D'où la règle qui gouverne `Leg` :

- `startS` et `arrivalS` sont du temps **écoulé** — l'heure au chronomètre,
  celle qu'on lit sur un roadbook ;
- `durationS` est du temps de **mouvement**, et vaut toujours
  `arrivalS - startS` ;
- `stopS` est l'arrêt du ravito qui **clôt** le secteur, nul sur le dernier.

Deux unités dans le même objet est inhabituel, et c'est délibéré : ce sont deux
questions différentes. « À quelle heure je passe ? » se répond en temps écoulé.
« De quoi ai-je besoin sur ce secteur ? » se répond en temps de mouvement,
puisque le temps passé debout se ravitaille sur place. Les confondre, c'est
l'une des deux erreurs mesurées ci-dessus.

`movingTimeS` **lève** quand les arrêts valent ou dépassent l'objectif, comme
`resample` le fait pour un pas non positif : un tel objectif n'a pas de solution
plus lente, il n'en a aucune, et rendre zéro donnerait une allure nulle qui
contaminerait toute la trace sans rien dire.

Enfin, `movingTimeS` et `splitByAidStation` filtrent les ravitos hors parcours
par **la même fonction**, `onCourse`. Filtrer différemment de part et d'autre
retrancherait du temps visé l'arrêt d'un ravito que le découpage n'applique
jamais : l'arrivée manquerait l'objectif, en silence, d'exactement cet arrêt.

Les durées imposées — `AidStation.legDurationS`, `fixedSpans`, le quatrième
paramètre de `distributeTime` — suivent le même principe un cran plus loin : une
consigne se sert d'abord, le reste s'ajuste autour. Elles ne se diluent pas
davantage.

## Alternatives écartées

**Diluer les arrêts sur la trace** — l'état antérieur, non pas choisi mais subi.
Le tableau ci-dessus le chiffre : le roadbook faux dans les deux sens, et 49 g
de glucides portés pour du temps passé à l'arrêt. Sa seule vertu est de tomber
juste à l'arrivée, ce qui masque tout le reste.

**Faire porter l'arrêt par `durationS`**, en gonflant le secteur qui se termine
au ravito. L'invariant `arrivalS - startS === durationS` tient encore, mais les
besoins du secteur repartent sur le temps de table : c'est la moitié du bug
qu'on corrige, réintroduite par la porte de service. On aurait en plus deux
sens de `durationS` selon qu'un ravito clôt le secteur ou non.

**Un secteur « arrêt » de longueur nulle entre deux secteurs.** Séduisant : une
seule unité, `elapsedS` devient la somme des durées. Écarté parce qu'un secteur
de zéro mètre casse tout ce qui divise par la distance — vitesse, VAM, part de
la course — et parce que `NutritionPlan.legs` est l'unité d'**affichage** : le
roadbook afficherait une ligne « Lièpvre → Lièpvre, 0,0 km, 20 min ».

**Un facteur d'arrêt global, en pourcentage du temps visé.** Plus simple à
saisir qu'un arrêt par ravito, et strictement équivalent à la dilution : c'est
la même erreur, exprimée en pourcentage.

## Conséquences

**Le même objectif ne produit plus le même plan qu'hier.** Déclarer 50 min
d'arrêts sur un objectif de 15 h 30 accélère toute la course : le premier
secteur passe de 3 h 18 à 3 h 08. C'est le comportement voulu, mais quiconque
avait calé ses allures sur une version antérieure verra ses chiffres bouger sans
avoir rien changé à sa saisie.

**L'objectif devient plus dur à tenir sans qu'on le dise.** Un coureur qui
saisit 15 h 30 et 50 min d'arrêts demande 14 h 40 de mouvement, soit environ 6 %
plus vite. Le noyau ne l'alerte pas : il n'a aucun repère pour juger qu'une
allure est irréaliste, et il n'en aura pas tant qu'il ne connaîtra pas le
coureur autrement que par sa masse.

**Deux unités de temps cohabitent dans `Leg`.** `startS` et `arrivalS` en temps
écoulé, `durationS` en temps de mouvement. C'est documenté et testé, et ça reste
un piège : quiconque écrit `arrivalS - startS` pour obtenir « le temps passé sur
le secteur, ravito compris » obtiendra autre chose. Le total est le seul endroit
où les trois valeurs coexistent — `durationS`, `stopS`, `elapsedS`.

**Un arrêt saisi n'est pas un arrêt vécu.** L'outil prend `stopS` pour argent
comptant. Cinq minutes annoncées en valent douze quand on cherche ses affaires,
et rien dans le plan ne le rattrape : l'erreur se reporte intégralement sur
l'heure d'arrivée. C'est le prix à payer pour ne plus la diluer — la dilution
absorbait cette imprécision, en échange d'une fausseté partout.
