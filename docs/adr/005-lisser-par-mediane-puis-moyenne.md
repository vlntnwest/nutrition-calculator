# 005. Lisser par médiane puis moyenne

## Statut

Accepté — 2026-08-07
**Remplacé par [006](006-couper-la-moyenne-par-defaut.md) — 2026-08-07**

Le raisonnement sur les deux natures de bruit et sur l'ordre des filtres reste
valable. Ce sont les fenêtres — annoncées ici comme indéfendables tant que les
fichiers de référence n'auraient pas parlé — que la mesure a invalidées : la
moyenne à 50 m retire du relief réel sans rien retirer d'autre sur les traces
barométriques, qui sont les seules qu'on rencontre en pratique.

## Contexte

Le D+ est une **somme de différences**. Une altitude fausse y coûte donc deux
fois : une fois en montant vers elle, une fois en redescendant. C'est ce qui rend
le lissage indispensable — sans lui, le seul bruit d'altitude produit plusieurs
centaines de mètres de dénivelé fictif sur un ultra.

Or ce bruit n'est pas d'une seule espèce :

**Le pic isolé.** Un décrochage GPS, un tunnel, un passage sous un couvert dense :
un point, parfois deux, s'écartent brutalement de plusieurs dizaines de mètres.

**L'oscillation continue.** L'altimètre barométrique dérive en permanence de un à
trois mètres, à chaque point, sur toute la trace.

La spécification initiale retenait une **moyenne glissante** sur une fenêtre en
mètres. Elle traite bien le second cas. Elle traite mal le premier : une moyenne
ne supprime pas un pic, elle l'**étale** sur ses voisins. Sur cinq points à 100 m
dont un à 130, une fenêtre de 30 m rend `100, 110, 110, 110, 100` — le pic a
disparu mais son excédent s'est réparti, et le D+ reste à 10 m au lieu de 0.

## Décision

**Deux filtres enchaînés, dans cet ordre : médiane puis moyenne.**

```
brut → medianFilter(30 m) → meanFilter(50 m) → elevationGain
```

**La médiane passe en premier** et supprime les pics au lieu de les étaler. Sur le
même jeu, elle rend `100, 100, 100, 100, 100`.

**Sa fenêtre est étroite — 30 m, soit 3 points** après rééchantillonnage. Une
médiane large effacerait des reliefs réels.

**La moyenne passe ensuite, sur 50 m**, et traite l'oscillation résiduelle. Elle
reçoit une trace déjà débarrassée de ses valeurs aberrantes, donc elle n'a plus
rien à étaler.

`smooth` compose les deux ; chaque filtre reste exporté et testé séparément.

## Alternatives écartées

**Moyenne glissante seule**, comme prévu initialement. C'est le choix de la
spécification, et il n'est pas absurde : le seuil à hystérésis d'`elevationGain`
rattrape une partie du dénivelé fictif restant. Mais faire porter à un seuil le
travail d'un filtre revient à masquer le problème plutôt qu'à le traiter, et rend
le seuil impossible à régler pour ce qu'il est censé faire.

**Médiane seule.** Elle tue les pics mais ne réduit pas l'oscillation permanente,
qui est le bruit majoritaire en volume. Sur une trace barométrique qui vibre de
deux mètres à chaque point, une médiane sur trois points laisse passer presque
tout.

**Moyenne puis médiane.** L'ordre inverse ne marche pas : la moyenne étale
d'abord le pic sur ses voisins, et la médiane ne peut plus le distinguer du
terrain. On aurait le coût des deux filtres pour le résultat du plus faible.

**Une moyenne sur une fenêtre beaucoup plus large.** Diluer davantage le pic
plutôt que le supprimer. Mais une fenêtre de 200 m écrase aussi les côtes courtes,
qui sont précisément ce qu'un traileur veut voir sur son profil.

## Conséquences

**Deux paramètres au lieu d'un**, donc deux fois plus de réglages à défendre. Et
ils interagissent : élargir la médiane rend la moyenne moins utile, et
inversement. Personne ne pourra régler l'un sans reconsidérer l'autre.

**La médiane efface les reliefs plus étroits que la moitié de sa fenêtre.** À 30 m
de fenêtre et 10 m de pas, cela ne concerne que les accidents d'un seul point —
qui, à cette échelle, sont du bruit dans l'immense majorité des cas. Mais une
marche réelle et brève, un ressaut rocheux, un passage de pont, disparaît sans
qu'on le sache. C'est une perte d'information acceptée, pas évitée.

**Les deux fenêtres sont pour l'instant indéfendables.** 30 et 50 m sont des
ordres de grandeur repris de la spécification, pas des valeurs mesurées. Seuls les
dix GPX de référence, confrontés à leur D+ officiel, permettront de dire si elles
sont justes — et il faudra alors les rejouer avec plusieurs couples de valeurs
plutôt que d'ajuster à l'aveugle.

**Le coût de calcul double**, et la médiane trie une fenêtre à chaque point. Sur
une trace rééchantillonnée à 10 m, un ultra de 170 km fait 17 000 points et trois
comparaisons par point : négligeable. Ce ne le serait plus avec une fenêtre large
ou un pas plus fin.
