# Décisions d'architecture

Un fichier par décision structurante. On y consigne le *pourquoi* — le code dit
déjà le *quoi*, et l'historique Git dit le *quand*.

| N° | Décision | Statut |
| --- | --- | --- |
| [001](001-ne-pas-stocker-le-fichier-gpx.md) | Ne pas stocker le fichier GPX | Accepté |
| [002](002-ancrer-les-points-sur-la-distance-cumulee.md) | Ancrer les points sur la distance cumulée | Accepté |
| [003](003-pas-d-authentification-uuid-dans-l-url.md) | Pas d'authentification, un UUID dans l'URL | Accepté |
| [004](004-ecarter-les-points-invalides-plutot-que-refuser-le-fichier.md) | Écarter les points invalides plutôt que refuser le fichier | Accepté |

## Convention

Cinq sections : `Statut`, `Contexte`, `Décision`, `Alternatives écartées`,
`Conséquences`. Une page, pas trois — au-delà, c'est qu'on documente le code au
lieu de la décision.

Deux règles :

- **Un ADR sans alternative écartée n'est pas un ADR.** Une décision sans
  concurrent sérieux est une note de documentation.
- **La section `Conséquences` doit contenir au moins un point qui dérange.** Si
  elle ne liste que des avantages, c'est un argumentaire, pas une décision.

**Un ADR ne se modifie pas.** En cas de changement d'avis, on écrit un nouvel ADR
qui remplace le précédent, et on passe le statut de l'ancien à
« Remplacé par NNN ». Le fichier est daté : il enregistre ce que l'on savait ce
jour-là, et le réécrire effacerait précisément ce que l'on cherche à conserver.
