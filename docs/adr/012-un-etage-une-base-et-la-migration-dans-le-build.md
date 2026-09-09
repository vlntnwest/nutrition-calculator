# 012. Un étage, une base, et la migration dans le build

## Statut

Accepté — 2026-09-09

## Contexte

Le dépôt avait les pièces d'un déploiement sérieux, jamais l'assemblage. Trois
choses, découvertes ensemble.

**Le poste de travail écrivait en production.** `.env.local` portait l'URL de la
branche Neon `production` — `NEON_BRANCH=production` en toutes lettres. Donc
`npm run dev`, `db:studio`, `db:migrate`, et surtout `npm test`, dont le
`globalSetup` sème le catalogue et dont une douzaine de fichiers de
`src/app/plans/` écrivent puis relisent des plans. Le Postgres Docker que le
dépôt prévoit ne servait pas. Rien dans le code ne s'y opposait : les deux
lecteurs d'environnement, `src/db/index.ts` et `drizzle.config.ts`, prenaient
`DATABASE_URL` telle quelle.

**Les migrations de preview visaient une branche que personne n'utilisait.**
L'intégration Neon–Vercel est installée : c'est elle qui crée la branche au
moment du **déploiement** et en injecte l'URL. `neon_workflow.yml`, lui, créait
`preview/pr-N` au moment de la **PR** et migrait celle-là. Deux branches par PR,
et le preview tournait sur la non-migrée.

**Il n'y avait pas d'étage intermédiaire**, ni rien pour tenir deux ordinateurs
d'accord : `.env.local` se recréait à la main de chaque côté, et c'est
exactement ainsi qu'une URL de production s'y installe.

## Décision

**Un étage, une base, et personne d'autre.** Local sur Docker, preview sur la
branche Neon que l'intégration lui donne, `staging` sur la branche Neon
`staging`, `main` sur `production`. La branche `staging` est la branche par
défaut du dépôt, pour qu'une PR la cible sans qu'on y pense.

**La migration est dans la commande de build de Vercel**, pas en CI.
`vercel.json` porte `npm run db:migrate && npm run build`. Trois propriétés en
découlent d'un coup, plutôt que d'avoir à être obtenues une par une :

- **Un preview migre forcément la base qu'il utilise**, puisque `drizzle-kit`
  lit la `DATABASE_URL` du déploiement. Le problème de la branche fantôme ne se
  pose plus, et il ne peut pas se reposer.
- **Les quatre étages migrent par le même mécanisme.** Il n'y a plus un chemin
  pour la production et un autre pour le reste.
- **La migration précède la bascule du trafic**, ce que le job CI ne garantissait
  pas : il partait du même push que Vercel, en parallèle.

**Hors production, la base doit être sur la machine.** `src/db/env.ts` lit
l'environnement une fois pour les deux consommateurs et refuse une URL dont
l'hôte n'est ni `localhost` ni `127.0.0.1` quand `NODE_ENV` ne vaut pas
`production`. `ALLOW_REMOTE_DB=1` la lève, explicitement, le temps d'une
inspection. C'est la règle qui manquait : le correctif seul n'aurait tenu que
jusqu'au prochain copier-coller depuis la console Neon.

**La configuration d'un poste tient dans des fichiers commités.** L'ordre de
résolution de Next sert d'empilement : `.env`, commité, porte le socle — la base
Docker — et `.env.test`, commité aussi, la recouvre pour les tests ;
`vercel env pull` écrit par-dessus dans `.env.local`, et `process.env` l'emporte
partout ailleurs. Le socle est dans `.env` et non dans un `.env.development`
parce que `.env` est le seul fichier que Next ouvre dans les trois modes : `next
build` impose `NODE_ENV=production` même en local, et un build de vérification
doit trouver une base. Le mot de passe du conteneur cesse alors d'être une
variable et se fige à `postgres` : un Postgres lié à la boucle locale n'a rien à
protéger, et les deux ordinateurs deviennent identiques sans configuration.
`npm test` gagne au passage sa propre base, `nutrition-calculator-test`, parce
que `.env.local` n'est pas lu en mode test et que `.env.test` est donc la seule
source possible.

**Le poste de travail ne prend pas sa base sur Vercel, jamais.** L'intégration
Neon–Vercel renseigne `DATABASE_URL` dans tous les environnements du projet,
Development compris ; `npm run env:pull` la retire donc à l'arrivée plutôt que
de compter sur une suppression côté Vercel, que l'intégration réécrirait.

## Alternatives écartées

**Garder les migrations en CI, un job par étage.** C'était l'existant, étendu à
`staging` : deux secrets, deux jobs, une trace dans l'onglet Actions. Écarté sur
les previews, qui restaient insolubles — le nom de la branche créée par
l'intégration n'est connu qu'après le déploiement, et il aurait fallu
l'interroger par l'API Neon depuis un workflow déclenché, lui, par la PR. On
aurait reconstruit une seconde fois ce que Vercel sait déjà.

**Une branche Neon `dev` partagée par les deux ordinateurs.** Séduisant pour ce
problème précis : mêmes données des deux côtés, pas de Docker, et un GPX importé
le soir se retrouve le lendemain. Écarté parce que la panne devient commune —
une migration cassée depuis un poste casse l'autre — parce qu'il faut du réseau
pour lancer les tests, et parce que ça consomme des heures de compute pour un
usage qui n'en demande pas. Le seed reconstruit ce qui compte.

**Le trunk actuel, avec promotion manuelle dans Vercel.** Une seule branche
longue durée, l'auto-promotion coupée, et un clic pour envoyer en production.
Moins de mécanique, mais la promotion n'est alors qu'un geste dans une interface :
elle ne laisse ni commit, ni PR, ni rien à relire.

**Laisser `.env.local` faire foi, en le documentant mieux.** Écarté par
constat : c'est l'état dont on sort, et le README le documentait déjà.

## Conséquences

**Une migration qui casse casse le déploiement.** Le build échoue avant `next
build`, donc rien ne part. C'est voulu, mais ça déplace la panne : une erreur de
migration ne se voit plus dans l'onglet Actions, elle se voit dans les logs de
build de Vercel, et sur la production elle bloque aussi tout ce qui était dans le
même push.

**Une migration destructive n'a plus de place naturelle.** Elle se joue toujours
à la main, après le déploiement, et rien dans le dispositif ne le rappelle. Le
mécanisme automatique ne sait faire que le cas rétro-compatible ; le cas
dangereux, il l'applique aussi, sans rien demander.

**Deux PR par changement.** `staging` puis `main`. C'est le coût assumé du
troisième étage, et il tombe entièrement sur un développeur seul. Un hotfix qui
part sur `main` oblige en plus à re-merger `main` dans `staging`, sans quoi les
promotions suivantes accumulent des conflits — et personne ne le rappellera.

**Le mot de passe de la base locale est écrit dans le dépôt.** Il est sans
valeur, et le conteneur n'écoute que `127.0.0.1`. Mais c'est une chaîne qui
*ressemble* à un secret dans un fichier commité, et la prochaine personne qui
lira `.env` devra se convaincre que c'en est bien un faux.

**Le garde-fou gêne un jour où il ne devrait pas.** Inspecter la base de staging
avec `db:studio` demande un `ALLOW_REMOTE_DB=1` qu'on ne se rappellera pas, et
le message d'erreur est le seul endroit où il est écrit.

**`env:pull` jette des variables sans qu'on les ait demandées.** Il annonce
combien, jamais lesquelles, et sa liste est un motif à tenir à jour : le jour où
l'intégration Neon exposera la base sous un autre nom, la fuite reviendra en
silence — et seul un `next build` local la révélerait, puisque c'est le seul
endroit où le garde-fou se tait.

**Le volume Docker existant ne contient pas la base de test.** Le script d'init
ne joue qu'à la création du volume : sur une machine déjà équipée, il faut la
créer à la main, ou détruire le volume. Le README ne le dit pas, parce que c'est
une bascule et non un état.
