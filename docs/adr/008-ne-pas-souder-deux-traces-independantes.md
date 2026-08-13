# 008. Ne pas souder deux traces indépendantes

## Statut

Accepté — 2026-08-13
**Remplacé par [009](009-combiner-les-traces-et-mesurer-la-jointure.md) — 2026-08-13**

Le constat reste juste : deux `<trk>` ne sont pas forcément un seul parcours, et
les souder peut fabriquer un tronçon fantôme. C'est le **défaut** retenu ici —
ne garder que la première source — que le premier fichier réel a démenti le jour
même. Il s'agissait d'un enregistrement scindé, et la première trace ne portait
que 50 des 5 240 mètres du parcours. Cet ADR listait pourtant ce risque dans ses
conséquences ; il l'a sous-estimé.

Précise l'[ADR 004](004-ecarter-les-points-invalides-plutot-que-refuser-le-fichier.md),
dont la politique — accepter le fichier plutôt que le refuser — reste entière.

## Contexte

`parseGpx` concaténait **tous** les `<trk>` du fichier en une seule liste de
points. Le raisonnement était écrit pour les `<trkseg>` d'une même trace : leur
coupure est une pause ou une perte de signal dans un même effort, `resample` la
traite, on veut une ligne continue. Il a été étendu aux `<trk>` sans être
réexaminé.

Or deux `<trk>` distincts peuvent être deux parcours sans rapport. Un fichier
contenant une boucle le matin à Lyon et une le soir à Genève produisait une
trace unique, et `withCumulativeDistance` comptait les 150 km qui les séparent
comme un tronçon parcouru — avec le D+ de la ligne droite qui les relie.

Le cas ne figure dans **aucun** des onze fichiers de référence : ils sont tous
mono-`<trk>` et mono-`<trkseg>`, à l'exception de la fixture synthétique
`multi-segment.gpx`. Il existe pourtant dans la nature — certaines montres
exportent une longue pause comme une nouvelle trace, certains planificateurs
écrivent plusieurs itinéraires dans un même fichier.

## Décision

**Chaque `<trk>` et chaque `<rte>` est une source à part entière**, exposée dans
`RawTrack.sources` avec son nom, son type, ses points et son propre `skipped`.
Les `<trkseg>` d'une même trace continuent de se concaténer : ce raisonnement-là
tient toujours.

**Seules les sources lisibles sont retenues.** Une trace peuplée de points sans
coordonnées est écartée comme une trace vide, et ses points ne comptent pas dans
`skipped` — ils n'ont jamais été lus.

**`RawTrack.points` ne contient que la première source.** Souder les suivantes
sans le demander est précisément ce qu'on corrige. `sources.length` au-delà de 1
est le signal qu'il faut poser la question à l'utilisateur : prendre une des
traces, ou les combiner.

**`combineSources` reste offerte** pour ceux qui choisissent la combinaison. Les
traces l'emportent toujours sur les itinéraires, et les deux ne se mélangent
jamais.

## Alternatives écartées

**Continuer de tout concaténer.** C'est le défaut corrigé. Le tronçon fantôme ne
plante pas, ne se signale pas, et fausse la distance comme le D+ — le mode de
défaillance le plus coûteux du projet.

**Refuser un fichier à plusieurs traces.** Contraire à l'ADR 004 : le fichier
est un GPX parfaitement valide, et le refuser reviendrait à faire échouer un
import pour une structure que le format autorise.

**Rendre `RawTrack[]` et imposer la pluralité à tous les appelants.** Le cas
courant — une seule trace — paierait alors le prix du cas rare, dans chaque
consommateur du parseur. Le champ `sources` laisse le choix à qui en a besoin.

**Retenir automatiquement la source la plus longue.** Un seuil que rien ne
permet de placer, et une décision prise à la place de l'utilisateur sur la
foi d'une heuristique — le même argument que celui qui écarte le ratio de points
dans l'ADR 004.

## Conséquences

**Le défaut est un choix silencieux, et c'est le point qui dérange.** Un fichier
à deux traces produit désormais un plan sur la première, sans que rien dans le
noyau ne dise qu'un choix a été fait. On a troqué une réponse bruyamment fausse
contre une réponse discrètement partielle. `sources.length` est le seul signal ;
si l'interface l'ignore, l'utilisateur ne saura jamais qu'il a perdu la moitié
de son fichier. Tant qu'aucun écran ne pose la question, le noyau est en dette.

**`combineSources` fabrique une fiction à la jointure.** La ligne droite entre
deux sources n'a jamais été parcourue, et `resample` l'interpole comme n'importe
quel autre intervalle. La distance et le D+ qu'elle porte sont inventés. C'est
assumé — c'est l'utilisateur qui demande la soudure — mais rien ne l'en avertit
au moment où il la demande.

**`RawTrack` porte un champ que la plupart des appelants ignoreront.** Onze
fichiers de référence sur onze n'ont qu'une source ; `sources` sera un tableau
d'un élément dans toute la vie normale du produit.

**Le corpus n'éprouve pas ce chemin.** Seuls des fichiers synthétiques couvrent
la trace multiple. Le premier vrai fichier à deux `<trk>` qui arrivera pourra
révéler des cas que ces tests n'imaginent pas — un `<trk>` de trois points laissé
par une reprise d'enregistrement, par exemple, qui deviendrait la source retenue
parce qu'il est le premier.
