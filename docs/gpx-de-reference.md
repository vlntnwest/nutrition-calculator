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
lissage. Les valeurs qui tombent dans la fourchette des outils sortent en vert,
et celle qui approche le plus la référence Strava en vert gras.

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
| `course-hugo-iphone.gpx` | trace téléphone | 22,80 / 22,34 | 30 / 291 |
| `utdc-karim.gpx` | trace montre | 159,41 / 162,19 | 5450 / 5381 |
| `strasparis.gpx` | vélo, appareil A | 518,44 / 519,48 | 2914 / 2222 |
| `strasparis-karim.gpx` | vélo, appareil B | 511,08 / 516,72 | 2569 / 1757 |

**La paire Strasbourg–Paris est la pièce la plus utile du corpus.** Même sortie,
même moment, deux appareils : tout ce qui diffère entre les deux fichiers vient
du capteur. Elle donne un test de cohérence qui ne dépend d'aucun outil externe —
notre pipeline doit sortir des valeurs proches sur les deux.

| | fichier A | fichier B | écart |
| --- | --- | --- | --- |
| Garmin | 2222 | 1757 | 26,5 % |
| Strava | 2914 | 2569 | 13,4 % |
| **nous** | 3177 | 2950 | **7,7 %** |

Deux fois plus reproductible que Strava, trois fois plus que Garmin. Une part des
7,7 % restants tient à l'échantillonnage : l'appareil B pose un point tous les
19,5 m contre 7,2 m pour A, et `resample` ne peut pas inventer un relief qui n'a
pas été mesuré.

*(Le vélo est hors périmètre V1. Ces deux fichiers servent de test de robustesse,
pas de référence de calibrage — 2500 m de D+ sur 518 km, c'est un rapport
signal/bruit où le seuil optimal remonte à 2, contre 0 sur les trails.)*

**Le fichier téléphone ne vaut que pour la distance.** Son D+ de référence est
inexploitable : Strava annonce 30 m sur la course, Garmin 291 m, sur le même
fichier. Et 291 est impossible à extraire d'un fichier dont la somme
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

**Le D+ est mesuré contre Strava seule.** Garmin est écarté depuis qu'on a
constaté qu'il annonce 2222 m sur `strasparis.gpx` depuis le créateur de parcours
et 3263 m après réimport du même fichier : 47 % d'écart à l'intérieur du même
produit. Un chiffre qui dépend de la surface où on le lit ne mesure pas le
fichier. Il reste dans le manifeste à titre indicatif.

Sur les fichiers de course à pied, au seuil 0 :

| Fichier | brut | resample | + médiane | effet médiane |
| --- | --- | --- | --- | --- |
| utdc | +1,7 % | +1,0 % | **−0,2 %** | −1,2 |
| uthk | +2,1 % | −0,2 % | −1,7 % | −1,5 |
| andlau | +2,5 % | +0,2 % | −1,7 % | −1,9 |
| saintelyon-benj | +10,0 % | +7,1 % | **+4,3 %** | −2,8 |
| utdc-karim | +12,4 % | +7,7 % | **+3,1 %** | −4,6 |
| saverne | −1,6 % | −4,8 % | −9,4 % | −4,6 |

Écart absolu moyen : **3,4 % avec la médiane, 3,5 % sans.** La moyenne ne
départage pas — mais la structure du tableau, si.

**Plus un fichier est bruité, plus la médiane l'aide.** Les deux dont le brut
dépasse +10 % sont ceux où elle rattrape le plus : 2,8 et 4,6 points. Ce sont
précisément ceux qui contiennent du bruit réel — `utdc-karim` est le premier
fichier du corpus où le lissage retire du bruit plutôt que du relief.

Saverne va dans l'autre sens, mais son brut est **déjà sous** la référence
(−1,6 %) : tout filtrage ne peut que l'en éloigner. Garmin lit d'ailleurs 1318 sur
ce fichier contre 1450 pour Strava, et notre brut à 1427 tombe entre les deux —
c'est vraisemblablement Strava qui lit haut ici.

Le pire cas départage : **9,4 % avec la médiane, 7,7 % sans**. Elle reste
conservée, parce que ce qu'elle coûte est borné et systématique quand ce qu'elle
évite ne l'est pas — un seul décrochage GPS ajoute des dizaines de mètres sans
que rien ne le signale. C'est l'arbitrage de l'ADR 006, désormais chiffré au lieu
d'être supposé.

L'itinéraire planifié `saintelyon.gpx` reste à part, à +10,3 % de l'annonce
officielle. C'est attendu : sa référence porte sur un parcours qui n'est pas
exactement celui du fichier — 82,86 km contre 79,09 pour la trace de course.

Comment on en est arrivé là : la configuration initiale, médiane 30 et moyenne
50, plaçait le D+ à −4 % en moyenne, avec un seul fichier dans la fourchette. Un
balayage des fenêtres a montré une dégradation **monotone** — pas d'optimum
intermédiaire, chaque cran de lissage supplémentaire éloigne du but. Voir
l'[ADR 006](adr/006-couper-la-moyenne-par-defaut.md), qui remplace le 005 et
détaille pourquoi la médiane est malgré tout conservée.

### Les dénominateurs de l'ADR 006

L'ADR compte tantôt en huit fichiers, tantôt en cinq, sans dire lesquels. Il est
daté et ne se modifie pas ; voici donc de quoi le relire.

Au 7 août 2026, jour de sa rédaction, le corpus comptait **huit** fichiers :

| Catégorie | Nombre | Rôle dans l'ADR |
| --- | --- | --- |
| `trace-montre` | 5 | le balayage des fenêtres — « un seul fichier sur cinq » |
| `trace-telephone` | 2 | vérifier que le baromètre est bien la norme |
| `itineraire-planifie` | 1 | sans référence Strava, hors mesure |

Le balayage ne porte que sur les cinq traces de montre : ce sont les seules à
réunir un altimètre barométrique et une lecture Strava sur le **même** fichier.
Les deux traces de téléphone servent l'argument sur la nature du bruit, pas le
réglage ; `saintelyon.gpx` est un itinéraire planifié, dont la référence porte
sur un autre tracé que le fichier.

Une coquille subsiste, et elle reste : la conclusion de l'ADR annonce « les six
traces de montre » là où il n'y en avait que **cinq** ce jour-là. La sixième,
`utdc-karim.gpx`, n'a été versée que le 9 août avec les deux traces de vélo —
le corpus est passé de huit à onze fichiers. Le chiffre de ±1,7 % vaut donc pour
cinq traces, pas six. Corriger l'ADR effacerait ce qu'on savait ce jour-là ;
c'est ici que la rectification a sa place.

## Le test de caractérisation

`src/core/pipeline.caracterisation.test.ts` fige les valeurs que le noyau produit
aujourd'hui sur les dix fichiers. Il n'affirme pas qu'elles sont justes — ce
document explique pourquoi personne ne peut l'affirmer — il affirme qu'elles
**n'ont pas changé**.

Sa valeur est dans le diff : déplacer un seuil ou une fenêtre le fait virer au
rouge sur les dix lignes à la fois, et le rapport d'échec devient un rapport
d'impact lisible dans la PR. Sans lui, une modification de paramètre passe
inaperçue jusqu'à ce que quelqu'un pense à relancer `npm run analyze`.

**Quand il passe au rouge, on justifie avant de mettre à jour.** Les valeurs sont
écrites à la main dans le fichier, sans script de régénération, et c'est
délibéré : la friction est la fonctionnalité. Un test de caractérisation
régénéré par réflexe n'enregistre plus les régressions, il les entérine.

Les réglages qu'il verrouille sont rassemblés dans `SETTINGS`, en tête de
`src/core/pipeline.ts` — un seul endroit à lire, un seul à changer.

C'est le test le plus lent du dépôt : ~3,5 s pour 88 Mo de GPX, contre 200 ms
pour tout le reste.

## Ajouter un fichier

1. Déposer le `.gpx` dans `src/core/fixtures/references/`.
2. **Le nettoyer** : `npm run strip-gpx -- src/core/fixtures/references/<nom>.gpx`.
   Retire horodatages et extensions constructeur — fréquence cardiaque, cadence,
   température — que le noyau ne lit jamais. Sur un export d'activité, cela
   divise la taille par quatre ; sur un export d'itinéraire, déjà minimal, il n'y
   a rien à retirer. Le nettoyage est textuel : namespaces, structure et ordre
   des points restent ceux du fichier d'origine, pour que les fixtures continuent
   d'éprouver `parseGpx` sur de vrais exports.
3. Ajouter son entrée dans `manifest.json` : distance et D+ lus dans Strava sur
   **ce fichier**, pas sur la page de la course.
4. Relancer `npm run analyze` et vérifier que le résultat reste plausible.
5. Ajouter la ligne correspondante au test de caractérisation.

Noter la provenance et la date de téléchargement : un parcours change d'une
édition à l'autre, et le dépôt est public.
