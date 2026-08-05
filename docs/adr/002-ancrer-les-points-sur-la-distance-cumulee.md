# 002. Ancrer les points sur la distance cumulée

## Statut

Accepté — 2026-08-05

## Contexte

Tout le produit repose sur une abscisse commune. Les ravitos sont placés à un
kilomètre donné, les tronçons sont délimités par ces ravitos, les temps de passage
et les besoins nutritionnels sont calculés par tronçon, et l'axe X du profil
altimétrique est cette même abscisse.

Cette abscisse doit rester valide alors que la trace subit plusieurs
transformations successives : interpolation des altitudes manquantes,
rééchantillonnage, lissage, simplification. Le nombre de points change à chaque
étape ; la distance parcourue, non.

Le placement des ravitos se fait par trois entrées équivalentes — saisie au
kilomètre, clic sur le profil, clic sur la carte — et le champ kilomètre est la
source de vérité. Les deux autres résolvent vers lui.

## Décision

Chaque point est un **objet auto-descriptif ancré sur la distance cumulée** :

```json
[{ "d": 0, "lat": 48.5734, "lon": 7.7521, "ele": 142 }]
```

`d` est le nombre de mètres depuis le départ. C'est la clé d'ancrage de tout le
reste du système.

Deux règles en découlent.

**Le rééchantillonnage à pas de distance constant (~10 m) précède tout filtrage.**
Jamais de filtre exprimé en nombre de points. L'espacement natif d'un GPX varie de
2 m (marche, 1 Hz) à 40 m (vélo, 1 Hz), et l'enregistrement intelligent aggrave
l'irrégularité. Une moyenne glissante « sur 5 points » représente donc une distance
physique différente sur chaque fichier — un bug déguisé en paramètre. Sur un pas
constant, elle est déterministe.

**Le GeoJSON est un format d'affichage, pas de stockage.** Il est produit à la
volée pour alimenter MapLibre, jamais persisté.

## Alternatives écartées

**Tuples positionnels** — `[[48.5734, 7.7521, 142], ...]`. Plus compacts, et c'est
leur seul mérite. Une altitude manquante et tout le tableau se décale
silencieusement ; rien dans la donnée ne dit ce que représente chaque case ; et
l'ordre lat/lon contre lon/lat est une source d'erreur permanente dès qu'on
échange avec une bibliothèque cartographique.

**L'index du point comme ancre** — désigner un ravito par « le point n° 1 240 ».
Casse à la première resimplification : changer le seuil de simplification déplace
tous les ravitos déjà placés. L'index dépend de la représentation, la distance
dépend du terrain.

**GeoJSON comme format de stockage.** Impose l'ordre `[lon, lat]`, n'a pas de place
naturelle pour `d`, et obligerait à recalculer la distance cumulée à chaque
lecture. On paierait un format d'interopérabilité pour un usage purement interne.

**Le pourcentage de parcours comme abscisse.** Séduisant parce que borné, mais
inutilisable : l'utilisateur saisit des kilomètres, et toute correction de la
distance totale invaliderait tous les placements.

## Conséquences

Le format est plus verbeux que des tuples — environ deux fois, à cause des clés
répétées. C'est assumé : le dérivé pèse ~150 ko, la compression HTTP absorbe la
répétition des clés, et la robustesse vaut largement ce prix.

`d` doit être recalculé intégralement dès que la géométrie change. Il n'est jamais
saisi ni transmis par le client comme une vérité — il est dérivé.

Le rééchantillonnage à 10 m fixe un plancher de résolution. Un détail de terrain
plus court que 10 m est perdu, y compris une micro-bosse réelle. C'est le compromis
accepté pour rendre le calcul reproductible d'un fichier à l'autre.

La simplification pour l'affichage ne peut pas se faire avec `turf.simplify`, qui
supprime la troisième coordonnée et optimise la vue en plan — il effacerait le
sommet d'un col aligné vu du dessus. Elle fera l'objet d'un traitement dédié.
