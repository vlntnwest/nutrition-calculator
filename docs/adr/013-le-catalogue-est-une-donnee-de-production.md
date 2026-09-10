# 013. Le catalogue est une donnée de production, pas du code

## Statut

Accepté — 2026-09-10

## Contexte

`src/core/products.ts` exportait `CATALOG`, onze produits relevés à la main en
août 2026. Le seed les écrivait en base, le README annonçait « écrit le
catalogue produits », et le nom disait le reste : ceci **était** le catalogue.

Ce n'est plus vrai depuis que l'écran `/catalogue` existe. La production compte
**45 produits**, et **un seul** partage son `code_seed` avec `CATALOG`. Le vrai
catalogue a été re-saisi par le formulaire, avec ses propres identifiants ; les
onze références du dépôt n'en sont plus qu'un doublon fossile. Deux catalogues
donc, dont un seul sert, et le dépôt désignait le mauvais.

La divergence n'est pas un accident à rattraper, c'est la nature de la donnée.
Un produit apparaît, change de recette, sort du marché. Sa fiche se corrige le
soir où l'on découvre que le sodium annoncé était pour 100 g. Rien de tout cela
ne ressemble au reste du dépôt, où une modification se relit avant de partir.

S'ajoutait une faute de rangement : `src/core/` est réservé aux fonctions pures
du calcul — le README pose la règle en toutes lettres — et un jeu de données
d'essai n'y a pas plus sa place qu'un import de `app/`.

## Décision

**Le catalogue vit en base, et la production en est la source de vérité.** Il
s'édite par `/catalogue`, jamais par une PR. Aucun fichier du dépôt ne prétend
le contenir.

**Ce que le dépôt garde est un jeu d'essai, et il le dit.** `CATALOG` devient
`SAMPLE_PRODUCTS`, `productById` devient `sampleProductById`, et le fichier
quitte `src/core/` pour `src/fixtures/sampleProducts.ts`. Le mot « fixture » est
déjà celui du dépôt pour les GPX de référence ; l'emplacement est neutre, ce qui
évite qu'un test du noyau ait à importer depuis `src/db/`.

**Le seed ne sert qu'aux étages jetables.** `npm run db:seed` peuple un poste de
développement et la base de test, pour qu'aucun des deux ne démarre à vide. Le
`globalSetup` de Vitest continue de l'appeler : les tests du noyau ont besoin de
produits stables, connus à l'avance, que personne ne corrige entre deux passes.

**Le vrai catalogue se rapatrie, il ne se recopie pas.** `npm run db:pull` reste
le geste qui ramène les données déployées en local.

## Alternatives écartées

**Faire du seed la source de vérité, et promouvoir le catalogue comme le reste
du code.** C'est l'alternative sérieuse, et elle a tout pour elle sur le papier :
chaque produit passe par une PR, se relit, se date, se révoque d'un `git
revert`. Le catalogue gagnerait exactement les garanties dont il est privé
ci-dessous, sans mécanisme nouveau — le dispositif de l'ADR 012 le porterait
tel quel, de `staging` à `main`.

Écartée pour deux raisons. La première est le rythme : le catalogue suit le
marché des marques, pas celui du logiciel. Corriger un chiffre de glucides
demanderait une branche, une PR, un merge sur `staging`, une seconde PR vers
`main` et deux déploiements — pour une ligne de données. La saisie cesserait de
se faire, et le catalogue vieillirait, ce qui est la seule façon certaine de le
rendre faux. La seconde est le point de départ : les 45 produits en production
devraient être transcrits à la main dans le dépôt, avec leurs identifiants, et
`/catalogue` deviendrait un écran de consultation — on retirerait une
fonctionnalité qui marche pour obtenir une garantie de processus.

**Garder les deux, le seed comme socle et le formulaire pour le reste.** L'état
dont on sort, en somme. Écarté par constat : c'est précisément ce qui a produit
deux catalogues sans que rien ne signale lequel comptait. Un upsert de seed
lancé au mauvais moment réécrirait par-dessus une fiche corrigée par le
formulaire, en silence, puisque la clé de conflit est la même.

**Un import CSV relu avant application.** Un fichier déposé, un écart affiché,
une confirmation. C'est probablement la bonne réponse le jour où le catalogue se
maintient à plusieurs, ou se reprend d'une source externe. Écarté pour
maintenant : c'est un écran de plus, à écrire et à tester, pour un catalogue que
son unique auteur édite produit par produit.

## Conséquences

**Le catalogue n'a ni relecture ni historique.** C'est la seule donnée du projet
dans ce cas, et le contraste est total avec le reste, qui passe par deux PR. Une
valeur de glucides mal tapée est en ligne à l'instant où l'on valide le
formulaire, sans qu'aucun œil ne l'ait vue et sans que rien ne garde la valeur
d'avant. Le seul recours est la restauration ponctuelle de Neon, dont la fenêtre
dépend du plan souscrit — donc un recours qu'on ne peut pas promettre.

**`npm run db:seed` lancé contre la production y injecterait dix produits
fantômes.** Ils n'existent nulle part ailleurs, personne ne les a demandés, et
ils apparaîtraient dans les listes déroulantes des plans. Le garde-fou de
`src/db/env.ts` refuse aujourd'hui une base distante hors production — mais
c'est un garde-fou, pas une propriété de conception : il tient tant que
`NODE_ENV` et `ALLOW_REMOTE_DB` disent la vérité, et il ne protège rien si la
commande tourne un jour dans un contexte de production.

**Une base de développement ne ressemble plus à la production.** Onze produits
d'un côté, 45 de l'autre, et pratiquement aucun en commun : ce qui se voit à
l'écran en local ne dit rien de ce que voit un utilisateur. `npm run db:pull`
comble l'écart, mais c'est un geste à se rappeler, et les captures d'écran
faites en local montrent un catalogue qui n'existe pas.

**Le jeu d'essai va vieillir, et c'est assumé.** Ses onze fiches datent d'août
2026 et rien ne les rafraîchira. Elles restent justes pour ce qu'on leur
demande — des produits plausibles aux valeurs cohérentes — mais elles portent
des marques et des noms réels dont les chiffres finiront par être faux. Le test
de caractérisation du plan s'appuie sur deux d'entre elles : les corriger
déplacerait ses valeurs attendues, et demanderait donc de justifier le diff
avant de l'entériner.
