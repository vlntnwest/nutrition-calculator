# Nutrition calculator

Générateur de plan nutritionnel de course à partir d'un fichier GPX. On dépose une
trace, on renseigne un temps visé et une tolérance digestive, on place ses ravitos,
et l'outil produit les temps de passage par tronçon et la quantité de glucides,
d'eau et de sodium à emporter entre chaque. Sans compte, sans installation, et
sans être enfermé dans le catalogue d'une marque.

> **État : phase 5 terminée.** Le noyau de calcul est complet, du fichier GPX au
> plan nutritionnel, et `npm run plan` en produit un en ligne de commande. La
> persistance est bouclée : un plan s'écrit, se relit et se régénère
> entièrement, trace, réglages, flasques, ravitos et produits figés d'un côté,
> tronçons, rations, remplissages et avertissements de l'autre, contre un vrai
> Postgres, en local comme en CI.
>
> **L'interface existe** : on dépose un GPX, on confirme la course, puis on
> ouvre un dossier à quatre destinations, Course, Cibles, Produits et Roadbook.
> Deux choses annoncées dans les wireframes manquent encore et sont suivies
> plus bas : l'impression PDF du roadbook, et la saisie d'un produit qui n'est
> pas au catalogue.

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
npm run env:pull     # variables partagées, depuis Vercel — voir « Environnements »
npm run db:up        # Postgres 18 dans Docker
npm run db:migrate   # applique les migrations de drizzle/
npm run db:seed      # écrit le catalogue produits
npm run dev
```

L'application tourne sur http://localhost:3000.

Rien d'autre n'est à configurer : la base locale vient de [`.env`](.env), commité
parce qu'il ne porte que `localhost`, et le reste de `npm run env:pull`. **Aucune URL
Neon n'a sa place sur un poste de travail** — `src/db/env.ts` refuse de démarrer sur
une base distante hors production, et il faut un `ALLOW_REMOTE_DB=1` explicite pour
inspecter une base déployée.

Si `db:migrate` échoue sur un rôle inexistant, c'est qu'un autre Postgres occupe le
port 5432 — celui d'un `brew services` oublié, typiquement. Il écoute sur
`127.0.0.1`, ce qui l'emporte sur le `*` du conteneur, et la connexion part vers le
mauvais serveur. `lsof -nP -iTCP:5432 -sTCP:LISTEN` dit qui est là.

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
  db/     ← schéma Drizzle et connexion. Un fichier par table.
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
rééchantillonnage se fait à pas de distance et non à nombre de points, et pourquoi
le D+ se dérive d'un filtre médian sur 30 m **sans seuil d'accumulation**, là où
la plupart des outils en posent un. `npm run analyze` compare les deux approches
sur une trace et affiche l'écart au D+ publié.

## Base de données

Le schéma vit dans [`src/db/schema/`](src/db/schema/), un fichier par table, et les
migrations générées dans [`drizzle/`](drizzle/).

```bash
npm run db:up        # démarre Postgres, attend qu'il réponde
npm run db:generate  # écrit une migration à partir du schéma
npm run db:migrate   # l'applique
npm run db:seed      # écrit le catalogue de core/products.ts — relançable
npm run db:studio    # inspecte les données
npm run db:down      # arrête le conteneur — ajouter -v pour effacer le volume
```

Le conteneur porte **deux** bases : `nutrition-calculator`, celle de `npm run dev`, et
`nutrition-calculator-test`, où `npm test` travaille. La seconde est créée au premier
démarrage du volume par [`docker/init-test-database.sql`](docker/init-test-database.sql),
et le `globalSetup` de Vitest la migre lui-même : une passe de tests ne touche jamais
les données de développement.

Trois conventions structurent le schéma, et elles ne se devinent pas à la lecture
d'une table isolée :

- **Ce qui appartient à un plan est identifié par un couple** — `(plan_id, rank)`
  pour un secteur ou une flasque, `(plan_id, position_m)` pour un ravitaillement.
  Les clés étrangères qui les visent sont donc composites : référencer la seule
  moitié `rank` échoue à la migration, faute d'unicité côté Postgres.
- **Un secteur se désigne par l'abscisse où il se termine.** `legs` est réécrit
  à chaque calcul et n'a donc pas d'identité stable : ce qu'on lui impose vit à
  part, dans `leg_overrides`, clé `(plan_id, end_position_m)`. Un ravito y porte
  sa position ; le secteur d'arrivée, la distance totale, puisqu'aucun ravito ne
  le clôt. C'est aussi pourquoi `legs.end_position_m` vaut `null` sur ce
  dernier, et pourquoi un index partiel interdit qu'il y en ait deux.
- **Les produits retenus pour un plan sont figés** dans `product_snapshots` au
  moment du choix, valeurs nutritionnelles comprises. Corriger le catalogue ne
  réécrit jamais un plan déjà enregistré.

Les valeurs nutritionnelles sont exprimées **par dose consommée** — l'unité pour un
gel, la mesurette pour une poudre — jamais pour 100 g ni pour le contenant vendu.
La conversion se fait à la saisie.

## Environnements

Quatre étages, une base par étage, et une migration qui accompagne toujours le
déploiement — jamais un geste à retenir.

| Étage   | Git                | Hébergement          | Base                            |
| ------- | ------------------ | -------------------- | ------------------------------- |
| local   | branche de travail | `npm run dev`        | Postgres Docker, sur `localhost` |
| preview | PR vers `staging`  | preview Vercel       | branche Neon créée par l'intégration |
| staging | `staging`          | environnement `staging` | branche Neon `staging`       |
| prod    | `main`             | production Vercel    | branche Neon `production`       |

```
feature/x ──PR──▶ staging ──PR──▶ main
                     │              │
              Vercel staging    Vercel production
              Neon staging      Neon production
```

`staging` est la branche par défaut du dépôt : une PR la cible sans qu'on y pense, et
`main` ne reçoit que les PR de promotion. Un hotfix part directement sur `main`, et
**`main` se re-merge alors dans `staging`** — sinon les promotions suivantes accumulent
des conflits.

Les migrations sont dans la commande de build de Vercel
([`vercel.json`](vercel.json)) : `drizzle-kit migrate` tourne avec la `DATABASE_URL` de
l'environnement déployé, donc chaque étage migre sa propre base et un preview migre
forcément la branche Neon qu'il utilise. Un build qui échoue après la migration laisse
la base en avance sur le code — c'est le sens normal d'une migration rétro-compatible ;
une migration destructive se joue toujours à la main, après.

La branche Neon `staging` dérive à mesure qu'on l'écrit. Le workflow
**Réinitialiser staging** (onglet Actions, déclenchement manuel) la remet au niveau de
`production`, pour valider une promotion contre des données réalistes.

### Les variables

L'ordre de résolution de Next est `process.env`, puis `.env.$NODE_ENV.local`,
`.env.local`, `.env.$NODE_ENV`, `.env`. Le dépôt s'en sert comme d'un empilement, du
plus fort au plus faible :

| Source        | Commité | Contenu                                              |
| ------------- | ------- | ---------------------------------------------------- |
| `process.env` | —       | Vercel et la CI, qui l'emportent sur tout fichier     |
| `.env.local`  | non     | écrit par `npm run env:pull`, base de données retirée |
| `.env.test`   | oui     | la base Docker de `npm test`                          |
| `.env`        | oui     | le socle : la base Docker de `npm run dev`            |

Le socle est dans `.env` et non dans un `.env.development` parce que `.env` est le seul
fichier que Next ouvre dans les **trois** modes : `next build` impose
`NODE_ENV=production` même en local, et un build de vérification doit trouver une base.

Deux propriétés en découlent : les déploiements ne dépendent d'aucun fichier, puisque
`process.env` prime ; et `.env.local` n'étant pas lu en mode test, une variable tirée de
Vercel ne peut pas atteindre les tests.

Restait une fuite : l'intégration Neon–Vercel renseigne `DATABASE_URL` dans *tous* les
environnements du projet, Development compris, et `.env.local` prime sur `.env`.
`npm run env:pull` retire donc les variables de base de données à l'arrivée — les
supprimer côté Vercel ne tiendrait pas, l'intégration les réécrit.

Un ordinateur de plus se met en route avec la section « Démarrage », plus
`npx vercel login && npx vercel link` avant le premier `npm run env:pull`.

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
un produit à quatre écrans. Ce qui se teste vraiment est la traduction entre
saisie et valeur, isolée dans `src/format/` et dans les modules `stations.ts`,
`filtres.ts`, `synthese.ts` et `warnings.ts` de chaque écran. Le parcours sera
couvert par un test de bout en bout à la mise en ligne.

La suite visée, par ordre de valeur :

| Niveau          | Objet                                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Caractérisation | 10 GPX de courses françaises confrontés à leur D+ officiel publié                                                                |
| Propriété       | L'invariant de somme : `Σ durées des tronçons === temps total`, quels que soient le profil, le temps visé et les durées imposées |
| Unitaire        | Les fonctions du noyau                                                                                                           |
| Intégration     | Écriture puis relecture d'un plan, expiration                                                                                    |
| Bout en bout    | Un seul parcours nominal, plus le cas « zéro ravito »                                                                            |

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

| Phase | Contenu                                                           | État     |
| ----- | ----------------------------------------------------------------- | -------- |
| 0     | Socle : TypeScript strict, Biome, Vitest, CI, ADR                 | Terminé  |
| 1     | Le noyau de calcul, en ligne de commande, sans interface          | Terminé  |
| 2     | Persistance : schéma, migrations, écriture et relecture d'un plan | Terminé  |
| 3     | Écrans import et paramètres, profil et carte                      | Terminé  |
| 4     | Placement des ravitos : champ, profil, carte                      | Terminé  |
| 5     | Roadbook retouchable et catalogue produits                        | Terminé  |
| 6     | Impression PDF du roadbook, saisie d'un produit hors catalogue    | À venir  |
| 7     | Mise en ligne, page sources, observabilité                        | À venir  |
