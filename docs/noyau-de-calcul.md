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
| `simplify` | points → ~2 000 points pour l'affichage |
| `paceModel` | pente → coefficient de coût |
| `splitBySlope` | points → tronçons de pente homogène |
| `distributeTime` | points + temps visé → temps cumulé sur chaque point |
| `nutritionPlan` | plan + produits → besoins et unités |

## Lecture du GPX

`parseGpx` lit les deux structures du format : `<trk>`, une trace enregistrée dont
les segments sont concaténés, et `<rte>`, un itinéraire planifié — celui que
produisent Openrunner ou Komoot, d'où provient une bonne part des parcours publiés
par les organisateurs. Quand un fichier contient les deux, le `<trk>` l'emporte
s'il contient au moins un `<trkpt>` — valide ou non, la sélection se fait avant la
validation : donnée mesurée, plus dense, plus fidèle au relief. Elles ne sont
jamais concaténées.

Conséquence assumée : un fichier dont le `<trk>` est intégralement corrompu et dont
le `<rte>` serait exploitable échoue à l'import. Choisir la source la plus riche
plutôt que la première non vide supposerait un seuil qu'aucune donnée ne permet
aujourd'hui de placer — le même argument que celui qui écarte le ratio de points
dans l'[ADR 004](adr/004-ecarter-les-points-invalides-plutot-que-refuser-le-fichier.md).
Les dix GPX de référence trancheront.

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

`smooth` enchaîne deux filtres, parce que le bruit d'altitude n'est pas d'une
seule espèce : `medianFilter` sur 30 m supprime les pics isolés — décrochages GPS,
tunnels — puis `meanFilter` sur 50 m réduit l'oscillation permanente de
l'altimètre.

L'ordre n'est pas interchangeable : une moyenne ne supprime pas un pic, elle
l'étale sur ses voisins, et la médiane ne saurait plus l'en distinguer. Voir
[ADR 005](adr/005-lisser-par-mediane-puis-moyenne.md), qui détaille pourquoi ce
choix s'écarte de la moyenne glissante seule prévue à l'origine.

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
- **Seuil à hystérésis sur l'accumulation du D+** : une montée n'est comptée
  qu'au-delà d'un gain net de ~3–5 m depuis le dernier minimum local sur une trace
  issue d'un modèle numérique de terrain, ~10 m sur une trace GPS brute. Sans ce
  seuil, le bruit d'altitude seul produit plusieurs centaines de mètres de D+
  fictif sur un ultra. L'abaisser gonfle le chiffre, l'augmenter écrase les
  reliefs courts.
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
