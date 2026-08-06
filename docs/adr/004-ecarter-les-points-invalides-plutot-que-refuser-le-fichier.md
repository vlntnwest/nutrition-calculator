# 004. Écarter les points invalides plutôt que refuser le fichier

## Statut

Accepté — 2026-08-06

## Contexte

Un GPX réel contient des anomalies. Un `<trkpt>` peut arriver sans attribut `lat`,
avec un attribut vide, avec une valeur non numérique, avec une latitude hors des
bornes physiques, ou aux coordonnées (0, 0) — la fameuse *Null Island* du golfe de
Guinée, valeur par défaut de la plupart des systèmes géographiques quand la
position manque.

Sur une trace d'ultra de 30 000 points, quelques points corrompus sont la norme,
pas l'exception.

L'utilisateur n'ouvrira pas son fichier. Il télécharge le GPX depuis le site de
l'organisateur ou l'exporte de sa montre, le dépose, et attend un plan. Lui
renvoyer un message technique désignant un `<trkpt>` fautif ne lui donne aucun
moyen d'agir.

En face, le §14.2 de la spécification met en garde contre le mode de défaillance
inverse : un parseur qui rend une trace vide, ou tronquée, sans rien signaler. Un
trou de quelques centaines de points au milieu d'une montée produit une ligne
droite entre ses deux bords — la distance raccourcit, le D+ s'effondre, et le plan
sort crédible mais faux.

## Décision

**Un point invalide est écarté, pas fatal.** `toRawPoint` rend `null` au lieu de
lever, et le point disparaît de la trace.

**Le nombre de points écartés est exposé**, dans `RawTrack.skipped`. Il est
*déduit* — différence entre le nombre de points en entrée et en sortie — et jamais
incrémenté par un compteur, qui pourrait se désynchroniser du tableau.

**Un seul refus subsiste : aucun point exploitable.** Écarter quelques points est
normal ; les écarter tous signifie qu'on n'a pas su lire le fichier, et c'est le
seul cas où l'import doit échouer.

## Alternatives écartées

**Refuser le fichier entier au premier point invalide.** C'était l'implémentation
initiale, et elle a la vertu d'être bruyante : rien ne passe en silence. Mais elle
échange une course entière contre un point corrompu sur 30 000, pour un utilisateur
qui n'a aucun moyen de corriger le fichier. Le rapport coût/bénéfice est mauvais.

**Écarter en silence, sans compter.** La solution la plus simple, et la plus
dangereuse. Elle rend indétectable le cas où le parseur écarte massivement des
points pour une raison qui lui est propre — un attribut mal nommé, un namespace
non géré. Le fichier passerait pour valide et le plan serait faux sans que rien
ne l'indique.

**Refuser au-delà d'un ratio de points écartés** (1 %, par exemple). Séduisant,
mais le seuil serait inventé : aucune donnée ne permet aujourd'hui de le placer.
La décision est reportée au moment où les dix GPX de référence donneront des
valeurs réelles. Le compteur, lui, ne coûte rien et fournira ces valeurs.

**Corriger le point plutôt que l'écarter** — interpoler la coordonnée manquante
entre ses voisins. Défendable pour une altitude, qui suit une courbe lisse. Pas
pour une position : deux points valides encadrant un trou peuvent être distants de
plusieurs centaines de mètres, et le point inventé n'aurait aucun rapport avec le
tracé réel. On préfère un trou honnête à une donnée fabriquée.

## Conséquences

**Une trace peut être tronquée sans que l'import échoue.** C'est le prix assumé de
la tolérance. `skipped` est le seul garde-fou, et il ne sert à rien tant que
personne ne le regarde : il devra être affiché à l'écran 1, sous le profil, avec
la trace. « 12 points ignorés sur 28 430 » est de l'information ; le même chiffre
enfermé dans un type ne l'est pas.

**Le comptage global ne dit pas où sont les trous.** Douze points écartés répartis
sur toute la trace et douze points consécutifs au sommet d'un col donnent le même
chiffre et n'ont pas les mêmes conséquences. Une détection des trous *contigus*
serait plus fine ; elle n'est pas faite, et le sujet reste ouvert.

**Le message d'erreur a disparu avec l'exception.** Pendant la phase des dix GPX
de référence, un fichier qui sort un `skipped` anormalement élevé demandera une
investigation manuelle : le code ne dit plus *pourquoi* un point a été écarté, il
dit seulement combien l'ont été.

**L'altitude ne suit pas la même règle.** Une altitude illisible ou absente vaut
`null` et le point est conservé — elle sera interpolée plus tard, ce que la
position ne permet pas. Deux données du même point, deux traitements : c'est
délibéré, et c'est la seule asymétrie du parseur.
