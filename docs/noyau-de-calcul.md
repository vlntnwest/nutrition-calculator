# Le noyau de calcul

`src/core/` contient l'intégralité du calcul. Ce sont des fonctions pures sur des
tableaux : aucun import de React, de Next ou de la base, aucune entrée-sortie. Ce
document décrit chaque fonction, ses hypothèses et ses seuils.

Le pipeline, dans l'ordre :

| Fonction | Entrée → sortie |
| --- | --- |
| `parseGpx` | XML → points bruts |
| `withCumulativeDistance` | points → points ancrés sur `d` |
| `fillMissingElevation` | points → altitudes toutes renseignées |
| `resample` | points → pas de distance constant |
| `smooth` | points → altitudes filtrées |
| `elevationGain` | points → D+ |
| `simplifyPoints` | points → ~2 000 points pour l'affichage |
| `paceModel` | pente → coefficient de coût |
| `splitBySlope` | points → tronçons de pente homogène |
| `movingTimeS` | temps visé + ravitos → temps visé, arrêts déduits |
| `fixedSpans` | ravitos → portions de trace à durée imposée |
| `distributeTime` | points + temps de mouvement → temps cumulé sur chaque point |
| `nutritionPlan` | plan + produits → besoins et unités |

## Lecture du GPX

`parseGpx` lit les deux structures du format : `<trk>`, une trace enregistrée dont
les segments sont concaténés, et `<rte>`, un itinéraire planifié — celui que
produisent Openrunner ou Komoot, d'où provient une bonne part des parcours publiés
par les organisateurs. Quand un fichier contient les deux, le `<trk>` l'emporte
s'il contient au moins un `<trkpt>` — valide ou non, la sélection se fait avant la
validation : donnée mesurée, plus dense, plus fidèle au relief. Elles ne sont
jamais concaténées.

La source se choisit sur ce qu'elle donne de **lisible**, pas sur ce qu'elle
contient : un `<trk>` peuplé de points sans coordonnées est aussi inexploitable
qu'un `<trkseg>` vide, et le tester par sa longueur condamnerait un `<rte>`
parfaitement lisible du même fichier. On bascule donc sur le `<rte>` quand aucun
`<trkpt>` n'est exploitable — mais jamais sur un simple point invalide : un
décrochage GPS isolé ne doit pas faire changer de source.

Chaque `<trk>` et chaque `<rte>` est une **source** à part entière, exposée dans
`RawTrack.sources`. Les `<trkseg>` d'une même trace, eux, se concatènent sans
compter comme des jointures : leur coupure est une pause ou une perte de signal
dans un même effort.

`points` contient **toutes** les sources lisibles, bout à bout, et chaque
raccord est mesuré dans `RawTrack.joins`. Voir
[ADR 009](adr/009-combiner-les-traces-et-mesurer-la-jointure.md).

La jointure est ce qui distingue les deux familles de fichiers à plusieurs
traces, sans qu'on ait à deviner :

| Jointure | Ce que c'est | Combiner |
| --- | --- | --- |
| quelques mètres | enregistrement scindé — pause, batterie, transition | juste |
| plusieurs kilomètres | export groupé — itinéraires sans rapport | faux |

Le noyau rend la mesure et **n'applique aucun seuil** : la donnée pour le
calibrer n'existe pas, et le projet s'est déjà brûlé sur un seuil posé sans
mesure — voir l'ADR 006, qui a dû défaire le 005.

Mesuré le 13 août 2026 sur un export Strava à deux `<trk>` : 17 points pour 50 m
d'un côté, 1787 points pour 5,18 km de l'autre, une seconde et dix mètres entre
les deux. Un enregistrement scindé, donc, où ne retenir que la première trace
rendait 50 m au lieu de 5,24 km, en silence. Garmin Connect ne lit que le premier
`<trk>` sur ce même fichier — c'est le comportement dont on s'écarte
délibérément.

`RawTrack.skipped` ne porte que sur la source retenue. Les points de celle qu'on
abandonne ne sont pas « écartés », ils n'ont jamais été lus. Le nom suit la même
règle : celui de la source retenue, puis `<metadata><name>`, jamais celui d'une
autre.

Ce qui reste écarté : choisir la source la plus **riche** plutôt que la première
lisible supposerait un seuil qu'aucune donnée ne permet aujourd'hui de placer —
le même argument que celui qui écarte le ratio de points dans l'[ADR 004](adr/004-ecarter-les-points-invalides-plutot-que-refuser-le-fichier.md).

Un point aux coordonnées illisibles est écarté et compté dans `RawTrack.skipped`
plutôt que de faire échouer l'import — voir
[ADR 004](adr/004-ecarter-les-points-invalides-plutot-que-refuser-le-fichier.md).
Une altitude absente vaut `null` et jamais `0` : le niveau de la mer est une
altitude légitime, et la distinction conditionne l'interpolation à venir.

## Distance cumulée

`withCumulativeDistance` ancre chaque point sur `d`, sa distance en mètres depuis
le départ, par la formule de haversine. Deux conventions y sont figées :

- **Rayon terrestre de 6 371 008,8 m**, rayon moyen `(2a + b)/3` de l'ellipsoïde
  WGS84 (convention IUGG). La valeur exacte importe peu — 14 cm d'écart sur 100 km
  face à un ou deux kilomètres de bruit GPS accumulé. Ce qui compte est qu'elle ne
  change jamais : deux lectures d'un même plan doivent donner le même chiffre.
- **Distance projetée au sol, jamais dans l'espace.** Compter la composante
  verticale ferait diverger l'outil de la distance officielle de la course, et le
  dénivelé a déjà son traitement propre via la distance équivalente.

## Lissage

`smooth` peut enchaîner deux filtres, parce que le bruit d'altitude n'est pas
d'une seule espèce. `medianFilter` sur 30 m supprime les pics isolés —
décrochages GPS, tunnels — et **c'est le seul appliqué par défaut**.
`meanFilter`, qui réduit l'oscillation permanente de l'altimètre, se demande
explicitement : `meanM` vaut `0`, et une fenêtre nulle, négative ou `NaN` saute
le filtre au lieu de produire une fenêtre d'un point.

Ce défaut vient de la mesure sur le corpus — voir
[ADR 006](adr/006-couper-la-moyenne-par-defaut.md), qui remplace l'
[ADR 005](adr/005-lisser-par-mediane-puis-moyenne.md) : l'oscillation que la
moyenne devait traiter est l'apanage de l'altitude GPS, que les appareils à
altimètre barométrique n'utilisent plus. `meanFilter` reste exportée et testée
pour ce cas, qu'aucun fichier du corpus ne contient encore.

L'ordre, lui, n'est pas interchangeable : une moyenne ne supprime pas un pic,
elle l'étale sur ses voisins, et la médiane ne saurait plus l'en distinguer.

Les deux fenêtres sont des ordres de grandeur, pas des valeurs mesurées. Les dix
GPX de référence les trancheront.

## Simplification

`simplifyPoints` ramène ~16 000 points à ~2 000. C'est une compression **visuelle**,
pas une étape de calcul : elle produit ce qui part en `jsonb` et alimente la carte
et le profil, quand la distance et le D+ ont déjà été obtenus sur la trace pleine
résolution. Recâbler `elevationGain` sur sa sortie coûterait jusqu'à 1,7 % de D+.

Douglas-Peucker (`simplify-js`) ne fait que **sélectionner** : il ne déplace ni ne
crée aucun point. Mais « la forme » qu'il préserve dépend de l'espace où on le
lance, et deux consommateurs n'ont pas le même besoin :

| Consommateur | Espace | Tolérance |
| --- | --- | --- |
| Carte | `[lon, lat]` | 7,5e-5 degré (~8 m) |
| Profil | `[d, ele]` | 1,5 m d'altitude |

Le sommet d'un col sur une route rectiligne est **sur la droite** en vue plane :
la passe carte le supprime, à juste titre pour le dessin de la route. La passe
profil y voit le point le plus important de la trace.

**Les deux passes partent du tableau complet et leurs résultats sont unis** — un
point survit si l'une des deux le réclame. Les enchaîner donnerait leur
intersection : le sommet supprimé par la première ne pourrait plus être repêché.
L'asymétrie est sans coût, un point superflu pour un consommateur étant par
définition sur la droite qu'il aurait tracée.

Mesuré sur le corpus : 75 à 93 % de points en moins, un D+ recalculé à moins de
1,7 % du plein sur les traces de course à pied, et 145 ko pour le plus gros
fichier en périmètre — la cible du §4 était ~150 ko.

## Seuils du reste du pipeline

Arrêtés en amont de l'écriture, et la raison de chacun. Ils rejoindront les
sections ci-dessus au fur et à mesure que les fonctions seront écrites.

- **Rééchantillonnage à pas de distance constant (~10 m), avant tout filtrage.**
  L'espacement natif d'un GPX va de 2 m à 40 m selon l'activité et le mode
  d'enregistrement. Un filtre exprimé en nombre de points représente donc une
  distance physique différente sur chaque fichier — c'est un bug déguisé en
  paramètre. Voir [ADR 002](adr/002-ancrer-les-points-sur-la-distance-cumulee.md).
- **Aucun seuil à hystérésis sur l'accumulation du D+** — `SETTINGS.thresholdM`
  vaut `0`. C'est le filtre médian sur 30 m qui retire le bruit d'altitude, en
  amont ; poser un seuil par-dessus le retrancherait deux fois. La plupart des
  outils font l'inverse et ne comptent une montée qu'au-delà d'un gain net de
  ~3–5 m sur une trace issue d'un modèle numérique de terrain, ~10 m sur une
  trace GPS brute. `elevationGain` accepte ce seuil en paramètre — son défaut de
  3 m n'est utilisé que par les tests, le pipeline passe `0`.
  <br>Ce choix n'est adossé à **aucune ADR** : c'est le seul réglage du pipeline
  dans ce cas. `npm run analyze` affiche la grille complète seuil × filtrage
  contre le D+ publié, et sur Saverne le seuil 0 avec médiane rend 1 314 m
  contre 1 450 m annoncés par Strava et 1 318 m par Garmin.
- **Écrêtage de la pente à ±45 %**, qui est le domaine de validité du modèle de
  coût énergétique utilisé.
- **Paliers de 30, 60 et 90 g de glucides par heure, défaut à 60.** Chacun
  correspond à un seuil publié. 90 g/h est un **plafond de tolérance, jamais une
  recommandation de performance** — la littérature ne montre pas d'avantage à
  dépasser 90, et les symptômes digestifs augmentent.
- **Le poids de corps ne pilote pas la cible en glucides**, seulement
  l'hydratation et le sodium. L'oxydation des glucides exogènes dépend de
  l'absorption intestinale, pas de la masse corporelle.

Le D+ affiché est traité comme un chiffre **défendable et explicable**, pas comme
une vérité : les outils du marché divergent entre eux, et un champ « corriger le
D+ » permet à l'utilisateur de saisir la valeur officielle de sa course.
