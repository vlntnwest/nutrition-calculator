# 006. Couper la moyenne par défaut

## Statut

Accepté — 2026-08-07

Remplace l'[ADR 005](005-lisser-par-mediane-puis-moyenne.md), dont le
raisonnement sur les deux natures de bruit reste valable mais dont les fenêtres
ne le sont pas.

## Contexte

L'ADR 005 retenait deux filtres enchaînés — médiane sur 30 m puis moyenne sur
50 m — et énonçait lui-même sa limite : *« les deux fenêtres sont pour l'instant
indéfendables ; 30 et 50 m sont des ordres de grandeur repris de la
spécification, pas des valeurs mesurées »*.

Huit fichiers de référence ont depuis été constitués et confrontés aux lectures
de Strava et Garmin sur les **mêmes fichiers** — voir
[`docs/gpx-de-reference.md`](../gpx-de-reference.md). Ils disent trois choses.

**Le lissage à 30/50 place systématiquement le D+ sous les deux outils.** Un seul
fichier sur cinq tombait dans la fourchette, avec un écart moyen de −4 %.

**Chaque cran de lissage supplémentaire dégrade le résultat, sans optimum
intermédiaire.** Un balayage des fenêtres a classé les configurations par nombre
de fichiers dans la fourchette : la meilleure était l'absence totale de lissage
(3 sur 5, +0,8 % d'écart moyen), et le résultat se dégradait de façon monotone à
mesure qu'on élargissait l'une ou l'autre fenêtre.

**Le bruit que la moyenne devait traiter n'existe pas dans la donnée réelle.**
Les huit fichiers viennent de montres ou de téléphones, tous équipés d'un
altimètre barométrique. Un baromètre mesure une pression, qui varie lentement et
continûment : il dérive sur plusieurs heures avec la météo, mais ne saute pas
d'un point à l'autre. L'oscillation permanente de ±2 m que l'ADR 005 prêtait à
l'altimètre est en réalité l'apanage de l'**altitude GPS**, que plus aucun
appareil courant n'utilise seule — y compris les iPhone, qui ont un baromètre
depuis l'iPhone 6.

## Décision

**La moyenne n'est plus appliquée par défaut.** `smooth` n'exécute que le filtre
médian, sur une fenêtre de 30 m — trois points après rééchantillonnage.

```ts
smooth(points, medianM = 30, meanM = 0)
```

**Le passage par la moyenne devient explicite**, et non le résultat d'une
arithmétique de bord : une fenêtre nulle ou négative saute le filtre au lieu de
produire une fenêtre d'un point.

**`meanFilter` reste exportée et testée.** Elle traite un cas réel — l'altitude
GPS sans baromètre — que le corpus ne contient pas encore. La retirer du code
reviendrait à décider que ce cas n'existe pas ; la couper par défaut se contente
de constater qu'on ne l'a pas rencontré.

**La médiane est conservée malgré son coût mesuré** de 1,6 % contre 0,8 % pour
l'absence totale de filtrage. Elle est la seule protection contre un décrochage
GPS franc — un pic isolé de plusieurs dizaines de mètres — dont un seul suffit à
fausser un D+ sans que rien ne le signale. On paie 0,8 point d'écart pour une
assurance contre un mode de défaillance silencieux.

Résultat sur les six traces de montre : toutes dans **±1,7 %** de la borne la
plus proche, là où Strava et Garmin divergent eux-mêmes de 3 % sur ces fichiers.

## Alternatives écartées

**Garder 30/50.** Démentie par la mesure sur huit fichiers : −4 % d'écart moyen,
et un seul fichier dans la fourchette.

**Tout couper, médiane comprise.** C'est la configuration qui colle le mieux au
corpus — 3 fichiers sur 5 dans la fourchette contre 0. Écartée parce que le
corpus ne contient aucun décrochage GPS, et qu'un corpus sans le cas dangereux ne
peut pas décider de retirer la protection contre ce cas. Optimiser sur les
fichiers qu'on a, c'est se rendre aveugle à ceux qu'on n'a pas.

**Chercher une fenêtre intermédiaire.** Il n'y en a pas : le balayage montre une
dégradation monotone. Entre « pas de moyenne » et « moyenne à 30 m », il n'existe
rien qui améliore le résultat.

**Adapter la fenêtre au bruit mesuré du fichier** — estimer la variance des
différences secondes d'altitude, et régler le filtre en conséquence. C'est
probablement la bonne réponse à terme, puisque le problème est précisément que
deux fichiers demandent deux traitements. Écartée aujourd'hui faute de données
pour calibrer : sans un seul fichier bruité au corpus, le seuil de bascule serait
inventé.

## Conséquences

**Le pipeline ne se défend plus contre l'oscillation continue.** Un fichier issu
d'un appareil sans baromètre — vieux GPS de randonnée, téléphone Android
d'entrée de gamme, export sans données barométriques — produira un D+ nettement
surestimé, et rien dans le code ne le détectera. `meanFilter` existe pour ce cas,
mais il faudra le reconnaître à la main pour l'activer.

**Le corpus reste borgne.** Huit fichiers, aucun avec de l'altitude GPS pure. Les
conclusions de cet ADR ne valent que pour la donnée barométrique, qui est
majoritaire mais pas universelle. Le premier fichier bruité qui arrivera pourra
tout rouvrir — et c'est souhaitable.

**On s'est calé sur deux algorithmes commerciaux, pas sur la vérité.** Strava et
Garmin ne sont d'accord ni entre eux, ni avec l'organisateur, et sur les traces
de téléphone Garmin remplace purement et simplement les altitudes du fichier par
une lecture dans son modèle de terrain — il annonce 291 m là où la somme des
variations positives du fichier vaut 59. Tomber dans leur fourchette rend le
chiffre *défendable*, ce qui n'est pas la même chose que juste.

**Le réglage est daté.** Il vaut pour huit fichiers mesurés le 7 août 2026. Il
devra être rejoué à chaque ajout au corpus, et `npm run analyze` existe pour ça.
