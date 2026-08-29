# 011. Une retouche est une consigne au calcul, pas une sortie modifiée

## Statut

Accepté — 2026-08-29

## Contexte

L'écran 5 est en lecture seule : le noyau propose, on lit, et c'est tout. Le
plan `9846b45d` — WeRun, 108,6 km, 4 460 m D+, 12 h 30, 77 kg — montre pourquoi
ça ne suffit pas. Son secteur 1 propose **0,5 gaufre, 0,5 barre, 0,5 sachet de
boisson et 0,5 sachet de soupe salée**, et sept secteurs sur neuf portent au
moins une ration à 0,5. Le plan est arithmétiquement juste. Personne ne part
avec un demi-sachet de boisson sur 100 km, et personne ne mélange deux poudres
au même moment.

C'est une classe d'erreurs que le noyau ne saura pas fermer par un seuil de
plus. Le coureur sait des choses que le modèle n'a pas : que cette barre lui
reste sur l'estomac en montée, qu'il a déjà cette purée dans son sac, que le
ravito du km 62 sert du bouillon. Il faut qu'il puisse corriger.

Deux difficultés le rendent moins simple qu'il n'y paraît.

**Les remarques deviennent fausses en silence.** `warnings()` n'est appelée que
sur le chemin de la génération (`nutrition.ts:140`). Un plan retouché sans la
rejouer afficherait `leg-fluid-above-carry` sur un secteur dont on vient de
retirer la boisson, et tairait le `carbs-above-target` qu'on vient de créer.
L'écran affirmerait des choses sur un plan qui n'existe plus.

**Rien ne dit qu'un plan a été touché.** La PR #30 a appris à `updatePlan`
*quand un calcul devient faux* — `survives()` sur une liste blanche de réglages.
Elle ne dit rien de *quand un plan a été retouché*, qui est une autre question :
la première regarde les entrées, la seconde regarde la sortie.

## Décision

**Une retouche à la main est une entrée du calcul.** Elle rejoint les cibles
imposées par ravito et les durées de secteur imposées : une consigne que le
noyau reçoit et respecte, pas une sortie qu'on modifierait après coup.

`nutritionPlan` gagne une consigne `imposed` à côté de `parts` et
`finishTargets` : les rations et les remplissages, un tableau par secteur.
Le calcul se déroule ensuite normalement. `splitByAidStation`, `carrySpans` et
`needOf` ne lisent pas les rations et ne bougent pas d'une ligne. Là où
`provision` répartirait, elle prend ce qu'on lui donne. `assemble` resomme
`supply`, `marginG` et `plainWaterMl` comme d'habitude, et `warnings()` est
appelée au même endroit, sur les secteurs retouchés.

Trois propriétés en découlent, plutôt que d'avoir à être décidées à part :

- **Un seul écrivain.** `nutritionPlan` rend un `NutritionPlan` ordinaire, donc
  le `write()` de `regeneratePlan` écrit un plan retouché sans savoir qu'il
  l'est. Pas de second chemin d'écriture à tenir d'accord avec le premier.
- **Les remarques sont vraies après chaque enregistrement**, sans qu'aucun seuil
  ni aucun des dix codes n'existe ailleurs que dans le noyau.
- **Une retouche ne se refuse jamais.** C'est déjà écrit en tête de `warnings()`
  — « des remarques, jamais des interdits, la valeur saisie est toujours
  respectée ». La règle valait pour les réglages ; elle vaut pour les rations
  sans qu'on ait à la réécrire.

**Une quantité imposée se range sur le pas du produit.** `divisibleBy` décrit
ce que le produit admet physiquement — entier, ou demi pour ce qui se coupe —
et cette propriété ne dépend pas de qui décide de la quantité. Un demi-gel
n'existe pas plus parce qu'un humain l'a saisi. L'enregistrement arrondit donc
au multiple de `1 / divisibleBy` le plus proche avant de passer la consigne au
noyau, et l'invariant de `Serving.units` tient sur un plan retouché comme sur
un plan calculé.

**`plans` gagne `editedAt`**, posée par l'enregistrement, effacée par une
génération, dans la même transaction que l'écriture. Un recalcul sur un plan
retouché prévient, puis repart de zéro : il ne tente pas de fusionner.

## Alternatives écartées

**Exporter `warnings()` et refabriquer les secteurs côté application.** Le plus
petit diff possible du noyau — un mot-clé. Mais un `Leg` porte `need`, `supply`,
`marginG`, `plainWaterMl`, `stopS`, `expenditureKcal` et `durationS` : l'app
devrait refaire une bonne part de `provision` pour en fabriquer un. Deux
définitions de ce qu'est un secteur, qui doivent rester d'accord sans que rien
ne les y oblige. La dette se paie au premier champ ajouté, et elle se paie en
silence.

**Un module de contrôle sur la forme du roadbook.** Zéro touche au noyau, et
`CARBS_GUIDE_G_H`, `CARBS_OVERSHOOT_MAX` et les dix codes relus ailleurs. On
écarte pour la même raison qu'au-dessus, en pire.

**Fusionner les retouches au recalcul.** Séduisant : on garde les rations posées
à la main et on ne recalcule que le reste. Écarté parce qu'aucune règle ne dit
ce que devient « 2 gels sur le secteur 3 » quand le secteur 3 ne dure plus la
même chose, ni ce qu'on fait d'une ration posée sur un secteur qui a disparu.
Et parce qu'une fusion se ferait en silence, là où repartir de zéro se voit.

**Un brouillon en base.** Les retouches non enregistrées stockées, pour ne rien
perdre en fermant l'onglet. Écarté : deux états du plan en base, donc un jeu de
tables ou une colonne de plus sur chacune, pour un gain qu'un bouton couvre déjà
en grande partie.

**Laisser passer une quantité hors grille.** Défendable au nom de « la valeur
saisie est toujours respectée » : le coureur sait ce qu'il emporte. Écartée
parce que `Serving.units` porte l'invariant par écrit et que tout le noyau le
suppose ; l'entorse se paierait loin d'ici, sur un plan où plus personne ne se
souviendrait qu'une ration peut valoir 0,3.

**Une provenance par ration** — une colonne `calculé` / `manuel` sur `servings`
et `fill`. Elle permettrait de nommer les secteurs dans l'avertissement et de
marquer à l'écran ce qui s'écarte de la proposition. Écartée parce que
l'avertissement n'a besoin que de savoir *s'il* y a des retouches, ce qu'une
date dit avec une colonne et aucune comparaison ligne à ligne.

## Conséquences

**Un plan retouché peut être un plan que le noyau n'aurait jamais proposé.**
C'est le but, et c'est aussi le prix : les garanties que la répartition tenait —
une seule boisson par secteur, des flasques pleines, des doses entières — ne
tiennent plus sur un plan enregistré. Les remarques en rattrapent une partie,
pas toutes. `energyCost` et le polynôme de Minetti, seul garde-fou contre un
plan absurde selon l'ADR 007, ne protègent plus rien de ce côté.

**La retouche enregistrée n'est pas toujours celle qui a été saisie.** C'est la
seule entorse à « la valeur saisie est toujours respectée », et elle est
délibérée : 0,3 gel devient 0, 0,8 devient 1. Le principe cède ici parce que la
divisibilité n'est pas une opinion du noyau sur ce qui est raisonnable — c'est
une propriété du produit, posée par l'ADR 007, que le coureur ne peut pas
davantage contredire que le noyau. L'écran doit donc montrer la valeur retenue
après arrondi, sans quoi la saisie et le plan divergent en silence.

**`nutritionPlan` gagne un mode.** Une fonction qui calculait obéit maintenant
parfois. La branche est courte et se pose sur une couture qui existait déjà —
`assemble` est séparée du choix des pas — mais c'est un second chemin dans
`provision`, et toute évolution future de la répartition devra se demander si
elle vaut aussi pour le cas imposé. Personne ne le rappellera.

**Les chiffres affichés sont en retard pendant la retouche.** Avec un
enregistrement explicite, `supply`, `marginG` et les remarques décrivent l'état
d'avant tant qu'on n'a pas cliqué. On choisit de les estomper plutôt que de les
resommer dans le navigateur — refaire la somme côté client rouvrirait la
divergence contre laquelle `getRoadbook` a été écrite. L'écran est donc
délibérément en retard sur ce qu'il montre.

**L'avertissement est tout ou rien.** `editedAt` dit qu'un plan a été touché,
jamais où. « Tu perdras tes retouches » ne peut pas devenir « tu perdras celles
des secteurs 3 et 7 ». Si l'écran doit un jour montrer ce qui s'écarte de la
proposition, cet ADR aura été trop économe et il faudra la provenance par
ration.

**Fermer l'onglet perd les retouches.** Il n'y a pas de brouillon.
