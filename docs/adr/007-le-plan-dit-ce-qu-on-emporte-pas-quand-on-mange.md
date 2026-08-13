# 007. Le plan dit ce qu'on emporte, pas quand on mange

## Statut

Accepté — 2026-08-12

Revient sur deux règles du §6 Notion — *« alterner les formats »* et
*« toujours arrondir à l'unité entière supérieure »*, cette dernière restant
vraie mais changeant d'échelle.

## Contexte

`nutritionPlan` traite chaque secteur inter-ravito comme une boîte close : on y
calcule un besoin, on l'arrondit, on passe au suivant. Trois mesures faites le
12 août 2026 montrent que cette unité est la mauvaise.

**Déclarer des ravitos gonfle le plan de 50 %.** Sur 21,1 km en 1 h 45 à 30 g/h
— 52,5 g de besoin — avec un seul gel Näak au catalogue :

| Découpage | Plan | Apporté |
| --- | --- | --- |
| 0 ravito | 2 gels | 54 g |
| 2 ravitos | 1 + 1 + 1 gel | **81 g** |

Même course, même coureur, même produit. Chaque secteur arrondit dans son coin et
les trois marges s'additionnent. Or sur un 21 km on part avec tout sur soi : le
ravito est un point d'eau, pas un point de rechargement.

**Tout cocher produit un plan inemportable.** 3 h à 60 g/h, catalogue entier :
9 articles, 6 références, 3 marques, 196,4 g pour 180 visés. À parts égales
`ideal = besoin / N`, donc plus on coche, plus le sac se fragmente. C'est
mathématiquement correct et personne ne part avec un exemplaire de chaque produit
du magasin.

**La boisson disparaît sans le dire.** Sur cette même sortie de 3 h, trois
boissons cochées se partagent 1200 ml → 400 ml chacune → `floor(400/500) = 0`
partout. Zéro dose, 1200 ml d'eau claire, **aucun warning**. La dose est traitée
comme insécable alors qu'une poudre ne l'est pas.

**Enfin, le noyau expose deux plans contradictoires.** `Serving.intervalS` est
calculé par produit indépendamment — sur le plan à 3 h ci-dessus : une purée
toutes les heures, une barre toutes les 1 h 30, un gel toutes les 3 h, six
horloges qui se percutent. Pendant ce temps `Leg.intakes` décrit une file unique
toutes les 20 min, formats alternés. Les deux champs ne décrivent pas le même
plan.

## Décision

**Le plan décrit ce qu'on charge, pas un programme de prises.** Les quatre points
qui suivent en découlent.

**1. Les glucides solides se calculent sur la course entière, puis se placent.**
Besoin total moins ce que la boisson couvre, un seul `allocate`, donc **un seul
arrondi de quantité**. La répartition entre secteurs se fait ensuite par la
méthode du plus fort reste, pondérée par le **déficit** de chaque secteur
(`besoin − glucides de boisson du secteur`) et non par sa durée : un secteur que
la boisson couvre déjà ne doit pas recevoir de solide. À égalité de fraction,
**le secteur le plus tardif l'emporte** — on ne mange pas dans la première
demi-heure. Répartir ne peut plus rien ajouter au total.

**2. Le liquide reste calculé par secteur.** La contenance d'une flasque est une
contrainte entre deux points d'eau, pas sur la course. `Runner` gagne le nombre
de flasques et leur volume ; chaque flasque porte un `onlyWater` qui la réserve à
l'eau claire. Un secteur dont le besoin dépasse ce qu'on peut porter produit une
remarque — ce n'est pas une erreur de calcul, c'est un secteur où il faudra boire
au ravito, et le noyau doit le dire au lieu de proposer 1375 ml à quelqu'un qui
porte deux flasques de 500.

**3. Le noyau ne prescrit ni ordre ni rythme.** `rotate`, `Intake` et
`Serving.intervalS` disparaissent. La sortie est une liste — produits, unités —
et des totaux : glucides, énergie, sodium, liquide. `Leg.supply` gagne donc
`energyKcal`, qui manquait.

**4. Les unités ne sont pas toutes entières.** `Product` gagne sa granularité
(`divisibleBy`) : poudre, gaufre et barre se coupent en deux, un gel et une
dosette non. C'est une propriété physique du produit, pas une souplesse de
l'algorithme.

`energyCost` et le polynôme de Minetti restent, malgré la disparition de la
dépense de l'affichage : c'est le seul garde-fou qui vérifie qu'un plan ne
raconte pas n'importe quoi.

## Alternatives écartées

**Garder le calcul par secteur.** C'est la mesure à 81 g contre 54 qui tranche.
Le raisonnement d'origine — *« ce qu'on charge dans le sac à un ravito pour tenir
jusqu'au suivant »* — reste juste sur un 100 km à sacs d'allure ; il est faux dès
que les ravitos ne sont pas des points de rechargement, ce qui est le cas le plus
fréquent.

**Qualifier chaque ravito par un drapeau `resupply`.** Première piste envisagée.
Écartée parce que le calcul global rend le drapeau inutile : « le secteur 3
reçoit 2 gels » se lit déjà comme « charge 2 gels au ravito 2 ». Un champ de
moins à saisir, même sortie.

**Pondérer le placement par la durée plutôt que par le déficit.** Les deux
coïncident tant que la boisson couvre les secteurs proportionnellement — ce que
l'arrondi à la dose entière interdit. Un secteur dont la boisson couvre déjà tout
recevrait quand même sa part de gels.

**Garder `intakes` en plus des totaux.** Défendable : la cadence n'est pas
cosmétique, 180 g avalés en trois fois ne sont pas 60 g/h. Écartée parce que le
noyau exposait deux rythmes incompatibles et qu'il fallait en tuer un ; et parce
qu'ordonner les prises est la seule chose que le noyau prescrivait au lieu de la
mesurer.

## Conséquences

**On renonce à la fonctionnalité annoncée comme différenciante.** Le §6 Notion
désigne les fenêtres de prise — *« prends ton gel avant la descente du km 34 »* —
comme ce qui sépare l'outil d'un tableur. Supprimer `intakes`, c'est abandonner
la brique sur laquelle elles se construisaient. Le pari est que la liste de
charge suffit à la V1 ; si les fenêtres reviennent, il faudra réécrire ce qu'on
efface, et cet ADR aura eu tort.

**Le débit par secteur n'est plus exactement la cible.** Sur 3 secteurs de
35 min et 2 gels : 0 g/h sur le premier, ~46 g/h sur les deux suivants, au lieu
de 30 partout. L'écart est borné à une unité par secteur — négligeable sur un
secteur long, visible sur un secteur court, qui de toute façon n'a pas besoin
d'être servi.

**Deux secteurs identiques peuvent recevoir des plans différents.** Même durée,
même besoin, même déficit, même plancher — mais l'étape du reste ne peut donner
l'unité supplémentaire qu'à un seul. 3 gels et 4 gels sur deux secteurs
rigoureusement semblables est un résultat correct. Un gel ne se coupe pas en deux
pour être partagé entre deux secteurs.

**`Runner` et `Product` s'élargissent.** Le modèle portait le coureur en un seul
nombre — sa masse. Il porte maintenant son matériel. C'est une porte ouverte :
sac, contenance totale, préférences de format suivront, et chaque champ ajouté
est un champ à saisir dans un formulaire qu'on voulait court.

**Rien ne garantit encore la variété dans un secteur.** Les produits sont placés
indépendamment : un secteur peut recevoir 3 gels et zéro barre pendant que le
suivant reçoit l'inverse. Le §6 Notion exigeait l'alternance ; on ne la remplace
par rien.
