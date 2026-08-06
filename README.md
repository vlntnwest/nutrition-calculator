# Nutrition calculator

Générateur de plan nutritionnel de course à partir d'un fichier GPX. On dépose une
trace, on renseigne un temps visé et une tolérance digestive, on place ses ravitos,
et l'outil produit les temps de passage par tronçon et la quantité de glucides,
d'eau et de sodium à emporter entre chaque. Sans compte, sans installation, et
sans être enfermé dans le catalogue d'une marque.

> **État : phase 1.** Le socle d'ingénierie est en place, et le noyau de calcul est
> en cours d'écriture — lecture du GPX et distance cumulée sont faites, le reste
> suit. Voir [Feuille de route](#feuille-de-route). Une capture sera ajoutée dès
> qu'il y aura une interface à montrer.

## Pourquoi il existe

Les calculateurs de nutrition existants sont édités par des fabricants. Ils sont
souvent bien faits, et systématiquement verrouillés sur leur propre catalogue : le
plan qui en sort est une liste de courses de la marque. Le plus abouti d'entre eux
ne couvre par ailleurs que les épreuves d'un seul circuit.

Un coureur qui prépare la SaintéLyon, un brevet de 400 km ou un trail local de
45 km n'a donc rien. C'est le créneau : **import GPX de n'importe quelle course, et
indépendance totale des marques.**

Deux conséquences assumées dans tout le produit :

- **Les seuils viennent de la littérature scientifique, jamais des documents
  commerciaux d'un fabricant.** Ceux-ci servent au mieux à retrouver les articles,
  jamais à les remplacer.
- **Les recommandations restent dans les fourchettes publiées et affichent leurs
  sources.** L'outil ne fait pas de conseil nutritionnel individualisé, et rappelle
  qu'un plan se teste à l'entraînement avant de s'appliquer en course.

## Démarrage

```bash
npm install
npm run dev
```

L'application tourne sur http://localhost:3000.

Aucune variable d'environnement ni base de données n'est nécessaire à ce stade — la
persistance arrive en phase 2, et cette section sera complétée avec le
`docker compose up` et les migrations à ce moment-là.

Les trois vérifications, qui sont exactement ce que rejoue la CI sur chaque PR :

```bash
npm run typecheck   # next typegen && tsc --noEmit
npm run lint        # biome check
npm test            # vitest run
```

## Architecture

Le parcours utilisateur tient en quatre écrans :

```
1. Upload GPX  →  2. Paramètres  →  3. Placement des ravitos  →  4. Plan généré
```

Le fichier GPX est parsé dans le navigateur, à l'intérieur d'un Web Worker, puis
**jeté**. Seules les ~150 ko de données dérivées sont persistées, et elles expirent
au bout de six mois — voir [ADR 001](docs/adr/001-ne-pas-stocker-le-fichier-gpx.md).

La frontière qui structure le dépôt est celle-ci :

```
src/
  core/   ← fonctions pures. Aucun import de React, de Next ou de la base.
  app/    ← Next.js : routage, écrans, accès aux données.
```

`src/core/` contient l'intégralité du calcul — profil, allure, nutrition. Ce sont
des fonctions pures sur des tableaux : elles se testent en millisecondes, sans DOM,
sans serveur et sans base, et elles survivraient à un changement de framework,
d'hébergeur ou de base de données. C'est là qu'est la difficulté réelle du projet,
et c'est pour cette raison qu'elle est tenue à l'écart du framework.

La règle pratique : **si une fonction de `core/` a besoin d'importer quoi que ce
soit de `app/`, c'est qu'elle est au mauvais endroit.**

## Le noyau de calcul

Le pipeline, dans l'ordre :

| Fonction | Entrée → sortie |
| --- | --- |
| `parseGpx` | XML → points bruts |
| `withCumulativeDistance` | points → points ancrés sur `d` |
| `resample` | points → pas de distance constant |
| `smooth` | points → altitudes filtrées |
| `elevationGain` | points → D+ |
| `simplify` | points → ~2 000 points pour l'affichage |
| `paceModel` | pente → coefficient de coût |
| `distributeTime` | tronçons + temps visé → durées |
| `nutritionPlan` | plan + produits → besoins et unités |

### Lecture du GPX

**`parseGpx`** lit les deux structures que le format autorise : `<trk>` (une trace
enregistrée, découpée en segments qu'on concatène) et `<rte>` (un itinéraire
planifié, produit par Openrunner, Komoot ou gpx.studio — d'où provient une bonne
part des parcours publiés par les organisateurs). Quand un fichier contient les
deux, **le `<trk>` l'emporte s'il contient des points** : c'est de la donnée
mesurée, plus dense, donc plus fidèle au relief. Les deux sources ne sont jamais
concaténées, ce qui produirait la course en double.

Un point aux coordonnées illisibles — attribut absent, vide, non numérique, hors
bornes, ou à (0, 0) — **n'interrompt pas l'import : il est écarté et compté** dans
`RawTrack.skipped`. Refuser une course entière pour un point corrompu sur 30 000
serait un mauvais échange, mais un écart silencieux creuserait un trou invisible
dans la trace. Le seul refus conservé est « aucun point exploitable », qui signifie
qu'on n'a pas su lire le fichier. Une altitude manquante, elle, vaut `null` et
jamais `0` — le niveau de la mer est une altitude légitime, et la distinction
conditionne l'interpolation à venir.

### Distance cumulée

**`withCumulativeDistance`** ancre chaque point sur `d`, sa distance en mètres
depuis le départ, par la formule de haversine. Deux conventions y sont figées :

- **Rayon terrestre de 6 371 008,8 m** — le rayon moyen `(2a + b)/3` de l'ellipsoïde
  WGS84, convention IUGG. La valeur exacte importe peu : l'écart avec un rayon
  arrondi représente 14 cm sur 100 km, quand l'approximation sphérique en coûte
  jusqu'à 500 m et le bruit GPS accumulé un à deux kilomètres. Ce qui compte est
  qu'elle **ne change jamais** — deux ouvertures d'un même plan doivent donner le
  même chiffre.
- **Distance projetée au sol, jamais dans l'espace.** Compter la composante
  verticale gonflerait le total de 1 à 3 % sur un ultra montagne et ferait diverger
  l'outil de la distance annoncée par l'organisateur, celle que le coureur a en
  tête. Le dénivelé a déjà son traitement propre, via la distance équivalente.

### Seuils du reste du pipeline

Arrêtés en amont de l'écriture, et la raison de chacun :

- **Rééchantillonnage à pas de distance constant (~10 m), avant tout filtrage.**
  L'espacement natif d'un GPX va de 2 m à 40 m selon l'activité et le mode
  d'enregistrement. Un filtre exprimé en nombre de points représente donc une
  distance physique différente sur chaque fichier — c'est un bug déguisé en
  paramètre. Voir [ADR 002](docs/adr/002-ancrer-les-points-sur-la-distance-cumulee.md).
- **Lissage sur une fenêtre en mètres (50–100 m)**, pour la même raison.
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

## Sources scientifiques

Les seuils nutritionnels s'appuient sur des positions officielles et des articles à
comité de lecture, majoritairement en accès libre. Les principales :

- **Thomas, Erdman & Burke 2016** — position conjointe Academy of Nutrition and
  Dietetics / Dietitians of Canada / ACSM, *Med Sci Sports Exerc* 48(3):543-568.
  L'échelle glucides/heure par durée.
- **Jeukendrup 2014** — *Sports Med* 44(S1):S25-33. Le mécanisme de saturation des
  transporteurs intestinaux, et l'argument pour raisonner en valeur absolue plutôt
  qu'en g/kg.
- **Tiller et al. 2019** — position stand ISSN sur l'ultra-marathon, *JISSN* 16:50.
  La seule qui traite spécifiquement de l'ultra-trail.
- **Sawka et al. 2007** — position stand ACSM sur le remplacement hydrique,
  *MSSE* 39(2):377-390.
- **3ᵉ conférence de consensus internationale sur l'hyponatrémie d'effort, 2015.**

Une page « sources » consultable dans l'application est prévue en phase 6.

À noter : ACSM et ISSN ne disent pas la même chose — jusqu'à 90 g/h pour l'un,
30 à 50 g/h pour l'autre en ultra. Les deux sont défendables et ne parlent pas du
même effort. L'outil doit trancher explicitement en fonction de la durée, et non
faire comme si la tension n'existait pas.

## Tests

```bash
npm test          # une passe
npm run test:watch
```

Vitest tourne en environnement `node` : le noyau n'a pas besoin de DOM. **Les
composants React ne sont pas testés unitairement** — coût élevé, valeur faible sur
un produit à quatre écrans. Le parcours sera couvert par un test de bout en bout à
partir de la phase 3.

La suite visée, par ordre de valeur :

| Niveau | Objet |
| --- | --- |
| Caractérisation | 10 GPX de courses françaises confrontés à leur D+ officiel publié |
| Propriété | L'invariant de somme : `Σ durées des tronçons === temps total`, quels que soient le profil, le temps visé et les durées imposées |
| Unitaire | Les huit fonctions du noyau |
| Intégration | Écriture puis relecture d'un plan, expiration |
| Bout en bout | Un seul parcours nominal, plus le cas « zéro ravito » |

Les fixtures GPX sont le test qui porte le plus de valeur du projet : c'est ce qui
rend le calcul de D+ défendable, et le seul garde-fou de non-régression sur la
partie réellement difficile.

### Ajouter une fixture

Les fichiers vivent dans `src/core/fixtures/` et se chargent par le helper
`fixture("nom.gpx")` du fichier de test. La règle de placement :

- **Un fichier sur disque** quand le XML est réaliste et qu'on le relira — une
  structure légitime du format, un export d'un outil du marché, une course réelle.
- **Une chaîne écrite dans le test** quand l'entrée est une anomalie fabriquée.
  Un `null-island.gpx` de quinze lignes dont une seule compte n'aide personne, et
  oblige à ouvrir un second fichier pour comprendre ce qui est testé.

Deux principes valables pour toute valeur attendue :

- **Elle doit venir d'une source indépendante de l'implémentation** — un calcul à
  la main, une formule connue, un D+ publié par l'organisateur. Une valeur obtenue
  en lançant le code puis recopiée ne vérifie rien : elle constate.
- **Choisir des données qui rendent l'échec lisible.** Le test qui vérifie qu'un
  `<trk>` l'emporte sur un `<rte>` place ses points à Lyon et à Genève : une
  concaténation accidentelle ne produit pas « un point de trop » mais un saut de
  150 km, dont la cause est évidente à la lecture.

## Décisions

Les décisions structurantes sont consignées dans [`docs/adr/`](docs/adr/) — une
page par décision, avec les alternatives écartées et ce qu'elles coûtent.

## Feuille de route

| Phase | Contenu | État |
| --- | --- | --- |
| 0 | Socle : TypeScript strict, Biome, Vitest, CI, ADR | Terminé |
| 1 | Le noyau de calcul, en ligne de commande, sans interface | En cours |
| 2 | Persistance : Drizzle, migrations versionnées, Postgres | À venir |
| 3 | Écrans upload et paramètres, profil SVG | À venir |
| 4 | Placement des ravitos : champ, profil, carte | À venir |
| 5 | Plan généré et catalogue produits | À venir |
| 6 | Mise en ligne, page sources, observabilité | À venir |
