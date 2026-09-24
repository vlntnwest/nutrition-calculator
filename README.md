# Nutrition calculator

Générateur de plan nutritionnel de course à partir d'un fichier GPX. On dépose une
trace, on renseigne un temps visé et une tolérance digestive, on place ses ravitos,
et l'outil produit les temps de passage par tronçon et la quantité de glucides,
d'eau et de sodium à emporter entre chaque. Sans compte, sans installation, et
sans être enfermé dans le catalogue d'une marque.

Le créneau, les principes et les décisions produit encore ouvertes sont dans
[`PRODUCT.md`](PRODUCT.md), le système visuel dans [`DESIGN.md`](DESIGN.md).

> **État : phase 6 en cours.** Le noyau de calcul est complet, du fichier GPX au
> plan nutritionnel, et `npm run plan` en produit un en ligne de commande. La
> persistance est bouclée : un plan s'écrit, se relit et se régénère entièrement.
> L'interface existe : on dépose un GPX, on confirme la course, puis on ouvre un
> dossier à quatre destinations, Course, Cibles, Produits et Roadbook. Le roadbook
> se télécharge en feuille A4. Reste la saisie d'un produit qui n'est pas au
> catalogue.

## Démarrage

```bash
npm install
npm run env:pull     # variables partagées, depuis Vercel, voir « Environnements »
npm run db:up        # Postgres 18 dans Docker
npm run db:migrate   # applique les migrations de drizzle/
npm run db:seed      # onze produits d'essai, de quoi ne pas démarrer à vide
npm run dev
```

L'application tourne sur http://localhost:3000. La base locale vient de
[`.env`](.env), commité parce qu'il ne porte que `localhost`, et le reste de
`npm run env:pull`. **Aucune URL Neon n'a sa place sur un poste de travail** :
`src/db/env.ts` refuse de démarrer sur une base distante hors production, et il
faut un `ALLOW_REMOTE_DB=1` explicite pour inspecter une base déployée.

Si `db:migrate` échoue sur un rôle inexistant, c'est qu'un autre Postgres occupe le
port 5432, celui d'un `brew services` oublié, typiquement. Il écoute sur
`127.0.0.1`, ce qui l'emporte sur le `*` du conteneur, et la connexion part vers le
mauvais serveur. `lsof -nP -iTCP:5432 -sTCP:LISTEN` dit qui est là.

Les trois vérifications, celles que la CI rejoue sur chaque PR :

```bash
npm run typecheck   # next typegen && tsc --noEmit
npm run lint        # biome check
npm test            # vitest run
```

`npm test` veut le Postgres local démarré : le `globalSetup` de Vitest migre et
seed la base de test avant la première assertion. Sans `npm run db:up`, la suite
échoue sur une connexion refusée, pas sur une régression.

## Architecture

```
src/
  core/    ← fonctions pures. Aucun import de React, de Next ou de la base.
  db/      ← schéma Drizzle et connexion. Un fichier par table.
  app/     ← Next.js : routage, écrans, accès aux données.
  pdf/     ← la feuille A4, rendue côté serveur par @react-pdf/renderer.
  ui/      ← composants partagés, carte et profil compris.
  format/  ← la traduction entre saisie et valeur affichée.
```

Le fichier GPX est parsé dans le navigateur, à l'intérieur d'un Web Worker, puis
**jeté**. Seules les ~150 ko de données dérivées sont persistées, et elles expirent
au bout de six mois, voir
[ADR 001](docs/adr/001-ne-pas-stocker-le-fichier-gpx.md).

`src/core/` porte l'intégralité du calcul, du XML au plan, en fonctions pures sur
des tableaux : elles se testent en millisecondes, sans DOM, sans serveur et sans
base. La règle pratique : **si une fonction de `core/` a besoin d'importer quoi que
ce soit de `app/`, c'est qu'elle est au mauvais endroit.** Chaque étape, ses
hypothèses et ses seuils sont dans
[`docs/noyau-de-calcul.md`](docs/noyau-de-calcul.md), dont le D+ dérivé d'un filtre
médian sur 30 m **sans seuil d'accumulation**, là où la plupart des outils en
posent un. `npm run analyze` compare les deux approches sur une trace et affiche
l'écart au D+ publié.

`src/pdf/` rend la feuille qu'on emporte en course, servie par
`GET /plan/[accessId]/roadbook/pdf` : identité de la course, carte, profil et bande
d'allure, temps de passage avec les rations sous chaque borne, liste de courses.
Elle se fabrique côté serveur, pour lire le profil pleine résolution sans le faire
traverser le réseau, et ne rend que l'état enregistré. Le cadrage, le relief et le
rangement de la feuille en lignes sont des fonctions pures et se testent ; les
tuiles OpenStreetMap se chargent avec un `User-Agent` qui nomme l'application. La
conception est dans
[`docs/pdf-du-roadbook.md`](docs/pdf-du-roadbook.md).

## Base de données

Le schéma vit dans [`src/db/schema/`](src/db/schema/), un fichier par table, et les
migrations générées dans [`drizzle/`](drizzle/).

```bash
npm run db:up        # démarre Postgres, attend qu'il réponde
npm run db:generate  # écrit une migration à partir du schéma
npm run db:migrate   # l'applique
npm run db:seed      # écrit le jeu d'essai de src/fixtures/, relançable
npm run db:pull      # recopie une base déployée en local, écrase les données
npm run db:studio    # inspecte les données
npm run race:publish # inscrit un plan à l'accueil, voir plus bas
npm run db:down      # arrête le conteneur, ajouter -v pour effacer le volume
```

Le conteneur porte **deux** bases : `nutrition-calculator`, celle de `npm run dev`,
et `nutrition-calculator-test`, où `npm test` travaille. La seconde est créée au
premier démarrage du volume par
[`docker/init-test-database.sql`](docker/init-test-database.sql), et le
`globalSetup` de Vitest la migre lui-même : une passe de tests ne touche jamais les
données de développement.

Trois conventions structurent le schéma, et elles ne se devinent pas à la lecture
d'une table isolée :

- **Ce qui appartient à un plan est identifié par un couple**, `(plan_id, rank)`
  pour un secteur ou une flasque, `(plan_id, position_m)` pour un ravitaillement.
  Les clés étrangères qui les visent sont donc composites : référencer la seule
  moitié `rank` échoue à la migration, faute d'unicité côté Postgres.
- **Un secteur se désigne par l'abscisse où il se termine.** `legs` est réécrit à
  chaque calcul et n'a pas d'identité stable : ce qu'on lui impose vit à part, dans
  `leg_overrides`, clé `(plan_id, end_position_m)`. Le secteur d'arrivée y porte la
  distance totale, puisqu'aucun ravito ne le clôt, et c'est pourquoi
  `legs.end_position_m` vaut `null` sur ce dernier.
- **Les produits retenus pour un plan sont figés** dans `product_snapshots` au
  moment du choix, valeurs nutritionnelles comprises. Corriger le catalogue ne
  réécrit jamais un plan déjà enregistré.

Les valeurs nutritionnelles sont exprimées **par dose consommée**, l'unité pour un
gel, la mesurette pour une poudre, jamais pour 100 g ni pour le contenant vendu. La
conversion se fait à la saisie.

**Le catalogue produits est une donnée d'exploitation**, qui vit en base, se
saisit par [`/catalogue`](src/app/catalogue/) et dont la production est la source
de vérité, voir
[ADR 013](docs/adr/013-le-catalogue-est-une-donnee-de-production.md). Ce que sème
`npm run db:seed` est le **jeu d'essai** de
[`src/fixtures/sampleProducts.ts`](src/fixtures/sampleProducts.ts), onze produits
pour qu'un poste neuf ne démarre pas à vide. `npm run db:pull` ramène le vrai
catalogue en local.

**Une course officielle est une donnée d'exploitation aussi.** C'est un plan comme
un autre, importé et garni de ses ravitos par les écrans, qu'on inscrit ensuite à
l'accueil :

```bash
npm run race:publish -- <accessId> --slug traversee-des-cimes-2026 \
  --photo /card-modele.webp --rank 1
```

Publier fait cesser sa péremption et fige la vignette de son profil. Cliquer la
carte en tire une copie, la trace et les ravitos seulement, voir
[`duplicatePlan`](src/app/plans/duplicatePlan.ts).

## Environnements

Quatre étages, une base par étage, et une migration qui accompagne toujours le
déploiement.

| Étage   | Git                | Hébergement            | Base                                 |
| ------- | ------------------ | ---------------------- | ------------------------------------ |
| local   | branche de travail | `npm run dev`          | Postgres Docker, sur `localhost`     |
| preview | PR vers `staging`  | preview Vercel         | branche Neon créée par l'intégration |
| staging | `staging`          | déploiement de branche | branche Neon `staging`, persistante  |
| prod    | `main`             | production Vercel      | branche Neon `production`            |

L'étage staging est un déploiement de branche ordinaire, servi par l'alias stable
`nutrition-calculator-git-staging-….vercel.app` ; un environnement Vercel
demanderait un plan payant. Ce qui lui donne sa propre base, ce sont `DATABASE_URL`
et `DATABASE_URL_UNPOOLED` déclarées en variables **Preview restreintes à la
branche `staging`**, plus spécifiques que celles de l'environnement Preview entier.
Les autres branches gardent la branche Neon éphémère de leur preview.

### La boucle

1. **Développer en local**, sur le Postgres Docker. `npm run db:generate` puis
   `npm run db:migrate` pour une évolution de schéma.
2. **Éprouver sur staging**, `gh pr create --base staging`. Le preview de la PR
   migre la branche Neon qu'il utilise ; le merge déploie sur l'alias staging,
   contre la branche Neon `staging`.
3. **Promouvoir en production**, une PR `staging → main`. Le check
   `Promouvoir depuis staging` de [`ci.yml`](.github/workflows/ci.yml) refuse toute
   autre source que `staging` et `hotfix/*`. Après un hotfix, **`main` se re-merge
   dans `staging`**, sinon les promotions suivantes accumulent des conflits.
4. **Retirer les données**, `npm run db:pull` recopie une base déployée dans la
   base locale. On repart du terrain réel plutôt que d'un jeu d'essai qui vieillit,
   et le tour recommence.

**`main` reste la branche par défaut du dépôt**, parce que Vercel y adosse sa
branche de production. Une PR s'ouvre donc contre `main` si on ne dit rien, ce qui
n'est jamais voulu : le réflexe est `gh pr create --base staging`.

**`npm run db:pull` prend staging, jamais la production.** Après un passage du
workflow **Réinitialiser staging** (onglet Actions, déclenchement manuel), la
branche Neon `staging` est une copie de `production` : on obtient les mêmes données
sans que la production voie passer personne.

```bash
npm run db:pull                 # staging, lit STAGING_DATABASE_URL
npm run db:pull -- production   # la production, lit PROD_DATABASE_URL
```

Ces deux variables vivent dans `.env.local` et se posent une fois par machine. Ce
sont les connexions **directes** des branches Neon : une URL poolée est refusée,
car `pg_dump` a besoin d'un snapshot cohérent sur une session, que le pooler de
Neon, en mode transaction, ne donne pas. Elles ne s'appellent pas `DATABASE_URL`,
sous lequel le garde-fou refuserait de démarrer. Dans les deux cas l'opération
**écrase la base de développement** ; la base de test n'est pas touchée.

Les migrations sont dans la commande de build de Vercel
([`vercel.json`](vercel.json)), donc chaque étage migre sa propre base et un preview
migre forcément la branche Neon qu'il utilise. Un build qui échoue après la
migration laisse la base en avance sur le code, sens normal d'une migration
rétro-compatible ; une migration destructive se joue à la main, après.
`vercel.json` fixe aussi la région des fonctions à `fra1`, celle de la base Neon,
faute de quoi chaque requête SQL traverse l'Atlantique.

### Les variables

L'ordre de résolution de Next est `process.env`, puis `.env.$NODE_ENV.local`,
`.env.local`, `.env.$NODE_ENV`, `.env`. Le dépôt s'en sert comme d'un empilement, du
plus fort au plus faible :

| Source        | Commité    | Contenu                                               |
| ------------- | ---------- | ----------------------------------------------------- |
| `process.env` | sans objet | Vercel et la CI, qui l'emportent sur tout fichier     |
| `.env.local`  | non        | écrit par `npm run env:pull`, base de données retirée |
| `.env.test`   | oui        | la base Docker de `npm test`                          |
| `.env`        | oui        | le socle : la base Docker de `npm run dev`            |

Le socle est dans `.env` et non dans un `.env.development` parce que `.env` est le
seul fichier que Next ouvre dans les **trois** modes : `next build` impose
`NODE_ENV=production` même en local, et un build de vérification doit trouver une
base. Next ne lit pas `.env.local` en mode test, donc une variable tirée de Vercel
ne peut pas atteindre les tests.

`npm run env:pull` retire les variables de base de données à l'arrivée. Sans cela,
la `DATABASE_URL` que l'intégration Neon renseigne dans *tous* les environnements
du projet, Development compris, recouvrirait celle de `.env`. Les supprimer côté
Vercel ne tiendrait pas, l'intégration les réécrit.

Un ordinateur de plus se met en route avec la section « Démarrage », plus
`npx vercel login && npx vercel link` avant le premier `npm run env:pull`.

## Tests

```bash
npm test          # une passe
npm run test:watch
```

Vitest tourne en environnement `node`, sans DOM. Un composant se teste donc par
`renderToStaticMarkup`, sur son premier rendu, ce qui décrit ceux qui n'ont pas
d'effet et ne lisent rien du navigateur (`LegCard`, `PdfTrigger`). Le reste de la
valeur est dans le noyau, dans l'écriture puis la relecture d'un plan contre un vrai
Postgres, et dans la traduction entre saisie et valeur, isolée dans `src/format/` et
dans les modules `stations.ts`, `filtres.ts`, `synthese.ts` et `warnings.ts` de
chaque écran. L'invariant de somme, `Σ durées des tronçons === temps total`, est
tenu par un test de propriété. Le parcours sera couvert par un test de bout en bout
à la mise en ligne.

Les dix fixtures GPX de `src/core/fixtures/` portent le plus de valeur du projet :
elles rendent le calcul de D+ défendable, et sont le seul garde-fou de
non-régression sur la partie réellement difficile. Elles se chargent par
`fixture("nom.gpx")`. Un fichier sur disque quand le XML est réaliste et qu'on le
relira, une chaîne écrite dans le test quand l'entrée est une anomalie fabriquée.
Deux principes pour toute valeur attendue :

- **Elle vient d'une source indépendante de l'implémentation**, un calcul à la
  main, une formule connue, un D+ publié par l'organisateur. Une valeur obtenue en
  lançant le code puis recopiée ne vérifie rien : elle constate.
- **Les données choisies rendent l'échec lisible.** Placer les points d'un cas
  limite à 150 km l'un de l'autre plutôt qu'à trois mètres transforme un « il y a
  un point de trop » en une cause évidente à la lecture.

## Documentation

- [`docs/adr/`](docs/adr/), les décisions structurantes, une page par décision,
  avec les alternatives écartées et ce qu'elles coûtent.
- [`docs/noyau-de-calcul.md`](docs/noyau-de-calcul.md), le pipeline de calcul, ses
  hypothèses et ses seuils.
- [`docs/pdf-du-roadbook.md`](docs/pdf-du-roadbook.md), la feuille A4.
- [`docs/sources.md`](docs/sources.md), les références scientifiques et la tension
  non résolue entre l'ACSM et l'ISSN sur les glucides en ultra.
- [`docs/voix.md`](docs/voix.md), dix interdits vérifiables pour tout texte lu par
  un coureur.

## Feuille de route

| Phase | Contenu                                                           | État     |
| ----- | ----------------------------------------------------------------- | -------- |
| 0     | Socle : TypeScript strict, Biome, Vitest, CI, ADR                 | Terminé  |
| 1     | Le noyau de calcul, en ligne de commande, sans interface          | Terminé  |
| 2     | Persistance : schéma, migrations, écriture et relecture d'un plan | Terminé  |
| 3     | Écrans import et paramètres, profil et carte                      | Terminé  |
| 4     | Placement des ravitos : champ, profil, carte                      | Terminé  |
| 5     | Roadbook retouchable et catalogue produits                        | Terminé  |
| 6     | Impression PDF du roadbook, saisie d'un produit hors catalogue    | En cours |
| 7     | Mise en ligne, page sources, observabilité                        | À venir  |
