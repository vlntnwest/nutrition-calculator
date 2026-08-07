# Les GPX de référence

Le noyau calcule une distance et un dénivelé. Rien dans le code ne peut dire si
ces chiffres sont justes : il faut les confronter à des fichiers réels dont on
connaît la lecture par ailleurs. C'est le test qui porte le plus de valeur du
projet, et la seule façon de défendre les seuils.

## Contre quoi on se compare

**Pas contre l'annonce de l'organisateur.** Elle porte sur le parcours officiel,
pas sur le fichier qu'on a : autre édition, autre distance, trajectoire réelle du
coureur différente. Sur la SaintéLyon, le tracé Openrunner fait 82,86 km et la
trace de course 79,09 km. Le chiffre affiché est par ailleurs arrondi, et souvent
gonflé — c'est un argument commercial.

**Contre Strava et Garmin**, qui lisent *exactement le même fichier*. C'est la
seule comparaison qui isole notre algorithme du reste.

Et ces deux-là ne sont pas d'accord entre eux : sur `saintelyon-benj.gpx`, Strava
annonce 2139 m et Garmin 2208 m — 3,2 % d'écart sur la même donnée. Il n'y a donc
pas un chiffre vrai à atteindre.

> **L'objectif n'est pas de coller à une valeur, c'est de tomber dans la
> fourchette des outils de référence.** Pouvoir dire « Strava dit 2139, Garmin
> 2208, je dis 2172 » est ce que la spec appelle un chiffre défendable.

## Lancer l'analyse

```bash
npm run analyze                  # tous les fichiers du manifeste
npm run analyze -- uthk          # un seul
npm run analyze -- ./course.gpx  # n'importe quel GPX
```

La sortie donne la distance, le D+ à plusieurs seuils d'hystérésis, avec et sans
lissage, et marque d'un ✓ les valeurs qui tombent dans la fourchette.

## Le corpus

Les fichiers vivent dans `src/core/fixtures/references/`, et
`manifest.json` fait autorité pour les lectures de référence — c'est lui que
lisent le script et, à terme, le test de caractérisation.

| Fichier | Type | Distance Strava / Garmin | D+ Strava / Garmin |
| --- | --- | --- | --- |
| `saintelyon.gpx` | itinéraire Openrunner | — | officiel 2300 |
| `saintelyon-benj.gpx` | trace montre | 78,84 / 79,20 | 2139 / 2208 |
| `saverne.gpx` | trace montre | 28,76 / 28,38 | 1450 / 1318 |
| `andlau.gpx` | trace montre | 25,53 / 25,40 | 959 / 1005 |
| `uthk.gpx` | trace montre | 104,39 / 103,46 | 4449 / 4434 |
| `utdc.gpx` | trace montre | 160,63 / — | 6373 / — |
| `velo-hugo-iphone.gpx` | trace téléphone | 70,59 / 72,17 | 319 / 468 |
| `course-hugo-iphone.gpx` | trace téléphone | 22,80 / 22,34 | 30 / 291 |

**Les deux fichiers téléphone ne valent que pour la distance.** Leurs D+ de
référence sont inexploitables : Strava annonce 30 m sur la course, Garmin 291 m,
sur le même fichier. Et 291 est impossible à extraire d'un fichier dont la somme
des variations positives vaut 59 — aucun lissage n'ajoute du dénivelé. Garmin
**remplace** donc les altitudes par une lecture dans son propre modèle de terrain.
Ce ne sont pas deux mesures du même parcours, ce sont deux algorithmes répondant
à deux questions différentes.

**Ce qui manque encore :** un fichier réellement bruité, c'est-à-dire enregistré
sans altimètre barométrique. Les huit traces ci-dessus en ont toutes un — les
iPhone aussi, depuis l'iPhone 6 — et un baromètre mesure une pression, qui varie
lentement et continûment. Le bruit vertical de ±10 à 20 m propre à l'altitude GPS
n'apparaît nulle part dans le corpus, et c'est précisément celui que `meanFilter`
traite. Tant qu'il manque, la moyenne reste coupée par défaut.

Manquent aussi des profils contrastés : tout est du trail vosgien ou lyonnais, ou
du plat. Un aller-retour et de la haute montagne compléteraient le tableau.

## Ce que le corpus dit aujourd'hui

*Instantané du 7 août 2026. Regénérable avec `npm run analyze`.*

Configuration mesurée : rééchantillonnage à 10 m, médiane à 30 m, moyenne coupée,
seuil d'hystérésis à 0.

**La distance est validée.** 0,1 à 0,2 % de Garmin sur les huit fichiers, et
systématiquement ~1 à 2 % sous Strava — dont la mesure est elle-même au-dessus de
Garmin. Haversine et la distance cumulée ne sont pas en cause.

**Le D+ tient dans ±1,7 %** de la borne la plus proche sur les six traces de
montre, là où Strava et Garmin divergent eux-mêmes de 3 % sur ces mêmes fichiers.

| Fichier | brut | pipeline | fourchette | écart |
| --- | --- | --- | --- | --- |
| utdc | 6483 | 6362 | 6373 | −0,2 % |
| saverne | 1427 | 1314 | 1318 – 1450 | −0,3 % |
| saintelyon-benj | 2353 | 2232 | 2139 – 2208 | +1,1 % |
| uthk | 4542 | 4372 | 4434 – 4449 | −1,4 % |
| andlau | 983 | 943 | 959 – 1005 | −1,7 % |
| vélo iPhone | 387 | 378 | 319 – 468 | ✓ |
| course iPhone | 59 | 55 | 30 – 291 | ✓ |
| saintelyon planifié | 2622 | 2538 | officiel 2300 | +10,3 % |

L'itinéraire planifié reste à part, et son écart est attendu : sa référence est
une annonce d'organisateur portant sur un parcours qui n'est pas exactement celui
du fichier — 82,86 km contre 79,09 pour la trace de course.

Comment on en est arrivé là : la configuration initiale, médiane 30 et moyenne
50, plaçait le D+ à −4 % en moyenne, avec un seul fichier dans la fourchette. Un
balayage des fenêtres a montré une dégradation **monotone** — pas d'optimum
intermédiaire, chaque cran de lissage supplémentaire éloigne du but. Voir
l'[ADR 006](adr/006-couper-la-moyenne-par-defaut.md), qui remplace le 005 et
détaille pourquoi la médiane est malgré tout conservée.

## Ajouter un fichier

1. Déposer le `.gpx` dans `src/core/fixtures/references/`.
2. Ajouter son entrée dans `manifest.json` : distance et D+ lus dans Strava et
   dans Garmin sur **ce fichier**, pas sur la page de la course.
3. Relancer `npm run analyze` et vérifier que le résultat reste plausible.

Noter la provenance et la date de téléchargement : un parcours change d'une
édition à l'autre, et le dépôt est public.
