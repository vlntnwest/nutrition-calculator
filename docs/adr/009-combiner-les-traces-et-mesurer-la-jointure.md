# 009. Combiner les traces, et mesurer la jointure

## Statut

Accepté — 2026-08-13

Remplace l'[ADR 008](008-ne-pas-souder-deux-traces-independantes.md), dont le
constat — deux `<trk>` ne sont pas forcément un seul parcours — reste juste,
mais dont le défaut a été démenti par le premier fichier réel.

## Contexte

L'ADR 008, écrit le matin même, ne retenait que la **première** source d'un
fichier à plusieurs traces, pour ne pas fabriquer un tronçon fantôme entre deux
parcours indépendants. Il listait lui-même le risque :

> un `<trk>` de trois points laissé par une reprise d'enregistrement, qui
> deviendrait la source retenue parce qu'il est le premier

Le premier vrai fichier à deux `<trk>` est arrivé le jour même, et c'est
exactement ce cas. Export Strava d'une sortie d'une demi-heure :

| Source | Points | Distance | Horodatage |
| --- | --- | --- | --- |
| `Bientôt le kilomètre` | 17 | 0,05 km | 12:36:10 → 12:36:26 |
| `Boucle du soir` | 1787 | 5,18 km | 12:36:27 → 13:06:15 |

Une seconde et dix mètres séparent les deux. Ce n'est pas un parcours
indépendant, c'est **un enregistrement scindé** — reprise après pause. Retenir
la première source rendait 50 mètres au lieu de 5,24 km, sans rien signaler.

Les deux familles de fichiers à plusieurs traces n'ont pas le même poids :

- **l'enregistrement scindé** — pause, changement de batterie, transition
  multisport — où les traces sont contiguës et où la combinaison reconstitue le
  parcours réel. C'est le cas dominant pour un fichier d'activité ;
- **l'export groupé** — bibliothèque d'itinéraires, trek en étapes — où la
  combinaison est fausse. Mais un tel fichier n'a pas de raison d'être téléversé
  dans un calculateur de nutrition, qui attend **une** course.

Et les deux erreurs ne coûtent pas la même chose. Combiner un export groupé
produit une distance absurde, que l'utilisateur voit immédiatement. N'en retenir
qu'une tronque le parcours **en silence** — 30 km au lieu de 42, plausible et
faux.

Garmin Connect ne lit lui aussi que le premier `<trk>`, mesuré sur ce fichier.
C'est une donnée, pas un argument : Garmin est un visualiseur d'activités
généraliste, et sa règle est plus vraisemblablement un raccourci
d'implémentation qu'une position sur les parcours de course.

## Décision

**`RawTrack.points` contient toutes les sources lisibles, bout à bout.**
`skipped` additionne les leurs.

**Chaque jointure est mesurée et rendue** — `RawTrack.joins`, une entrée par
raccord, portant la distance à vol d'oiseau entre la fin d'une source et le
début de la suivante. C'est elle qui distingue les deux familles sans qu'on ait
à deviner : dix mètres, un enregistrement scindé ; quinze kilomètres, autre
chose.

**Aucun seuil n'est appliqué.** Le noyau rend la mesure ; il ne décide pas à
partir de quand elle est suspecte. Les `<trkseg>` d'une même trace continuent
de se concaténer sans être comptés comme des jointures — leur coupure est une
pause dans un même effort, et `resample` la traite.

**`sources` reste exposé** pour qui voudrait n'en retenir qu'une :
`sources[i].points` suffit, et `combineSources` disparaît, devenue le défaut.

## Alternatives écartées

**Retenir la première source (ADR 008).** Démentie par le premier fichier réel,
le lendemain de sa rédaction. L'erreur est silencieuse, ce qui la rend plus
coûteuse que son inverse.

**Suivre Garmin.** Tentant — l'utilisateur compare souvent les deux. Écartée
parce qu'un visualiseur d'activités et un importateur de parcours de course
n'ont pas le même contrat, et parce que le comportement mesuré perd 99 % du
fichier d'exemple.

**Décider automatiquement à partir d'un seuil de jointure** — combiner en deçà,
n'en retenir qu'une au-delà. C'est probablement la bonne réponse à terme, et la
donnée pour la calibrer n'existe pas : un seul fichier à deux traces, versé
nulle part. Le projet s'est déjà brûlé sur un seuil posé sans mesure — voir
l'[ADR 006](006-couper-la-moyenne-par-defaut.md), qui a dû défaire l'[ADR 005](005-lisser-par-mediane-puis-moyenne.md).

**Poser la question à l'utilisateur**, comme l'ADR 008 le prévoyait. Coûte un
écran et une décision à quelqu'un qui n'a pas les éléments pour la prendre, dans
un cas rare, alors que le défaut combiné est juste dans le cas dominant.

## Conséquences

**Un export groupé donnera une distance absurde, et rien ne l'arrêtera.** Trois
itinéraires sans rapport produiront un parcours de trois fois la bonne longueur,
avec des tronçons fantômes de plusieurs kilomètres. Le pari est que l'utilisateur
le voie — il connaît la distance de sa course. Mais quelqu'un qui découvre un
parcours qu'il n'a jamais fait n'a pas ce repère, et prendra le chiffre pour
argent comptant.

**La dette de l'ADR 008 est déplacée, pas éteinte.** `joins` existe, personne ne
le regarde. Tant qu'aucun écran ne l'affiche, l'information est produite sans
être vue — c'est le même reproche qu'on faisait au défaut précédent, à ceci près
que la valeur affichée est maintenant la bonne dans le cas courant.

**On s'écarte de Garmin.** Un utilisateur qui ouvre le même fichier des deux
côtés verra deux distances, et c'est nous qui devrons expliquer pourquoi.

**Le corpus ne contient toujours aucun fichier à plusieurs traces.** Le seul
connu n'y est pas versé, et le chemin reste éprouvé par des fixtures
synthétiques. Cet ADR repose donc sur **un** fichier — c'est plus que le
précédent, qui reposait sur zéro, et beaucoup moins qu'il n'en faudrait.
