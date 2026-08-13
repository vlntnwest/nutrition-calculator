# Nutrition calculator

Générateur de plan nutritionnel de course à partir d'un fichier GPX. On dépose une
trace, on renseigne un temps visé et une tolérance digestive, on place ses ravitos,
et l'outil produit les temps de passage par tronçon et la quantité de glucides,
d'eau et de sodium à emporter entre chaque. Sans compte, sans installation, et
sans être enfermé dans le catalogue d'une marque.

> **État : phase 1.** Le socle d'ingénierie est en place et le noyau de calcul
> est complet, du fichier GPX au plan nutritionnel — `npm run plan` produit déjà
> un roadbook en ligne de commande. Restent l'interface, la persistance et la
> mise en ligne. Voir [Feuille de route](#feuille-de-route). Une capture sera
> ajoutée dès qu'il y aura une interface à montrer.

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

Le calcul y est découpé en fonctions pures enchaînées, du XML au plan : lecture du
GPX, ancrage sur la distance cumulée, interpolation des altitudes manquantes,
rééchantillonnage, lissage, D+, simplification, découpage en tronçons de pente
homogène, modèle d'allure, répartition du temps, répartition nutritionnelle.
Chacune est documentée avec ses hypothèses et ses seuils dans
**[`docs/noyau-de-calcul.md`](docs/noyau-de-calcul.md)** — pourquoi le
rééchantillonnage se fait à pas de distance et non à nombre de points, pourquoi le
seuil d'accumulation du D+ est à trois mètres, et ce qui change si on le déplace.

## Sources scientifiques

Les seuils nutritionnels viennent de positions officielles et d'articles à comité
de lecture, jamais des documents commerciaux d'un fabricant. La liste, avec ce que
chaque référence établit et la tension non résolue entre l'ACSM et l'ISSN sur les
glucides en ultra, est dans **[`docs/sources.md`](docs/sources.md)**.

Une page « sources » consultable dans l'application est prévue en phase 6.

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
| Unitaire | Les fonctions du noyau |
| Intégration | Écriture puis relecture d'un plan, expiration |
| Bout en bout | Un seul parcours nominal, plus le cas « zéro ravito » |

Les fixtures GPX sont le test qui porte le plus de valeur du projet : c'est ce qui
rend le calcul de D+ défendable, et le seul garde-fou de non-régression sur la
partie réellement difficile.

### Ajouter une fixture

Les fichiers vivent dans `src/core/fixtures/` et se chargent par le helper
`fixture("nom.gpx")`. Un fichier sur disque quand le XML est réaliste et qu'on le
relira ; une chaîne écrite dans le test quand l'entrée est une anomalie fabriquée.

Deux principes pour toute valeur attendue :

- **Elle vient d'une source indépendante de l'implémentation** — un calcul à la
  main, une formule connue, un D+ publié par l'organisateur. Une valeur obtenue en
  lançant le code puis recopiée ne vérifie rien : elle constate.
- **Les données choisies rendent l'échec lisible.** Placer les points d'un cas
  limite à 150 km l'un de l'autre plutôt qu'à trois mètres transforme un « il y a
  un point de trop » en une cause évidente à la lecture.

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
