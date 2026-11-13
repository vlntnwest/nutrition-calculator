# 015. Un produit saisi appartient à son plan

## Statut

Accepté — 2026-11-13

## Contexte

Le catalogue compte 45 produits, tenus à la main par `/catalogue` (ADR 013). Un
coureur qui part avec un gâteau de riz, une compote du commerce ou le gel d'une
marque absente n'avait aucun moyen de les faire entrer dans son plan : `PRODUCT.md`
rangeait la saisie d'un produit hors catalogue hors périmètre, et le calcul ne
répartissait donc que ce que le catalogue connaissait.

Il n'y a pas de compte (ADR 003). Le seul objet auquel une saisie peut se
rattacher est le plan, que son `accessId` ouvre à qui le tient.

## Décision

**Un produit saisi par un coureur est une ligne de `products` qui porte
`plan_id`.** Nul, le produit est au catalogue. Renseigné, il ne se propose que
dans ce plan, en tête de l'écran Produits, et la cascade l'emporte avec lui.

**Il entre au sac par le chemin de tout le monde.** Un code dans
`productCodes`, un instantané figé, le même calcul. Le noyau, le roadbook et le
PDF ne savent pas qu'il existe une seconde origine. `insertSnapshots` ne fige
que le catalogue et les produits du plan qu'on écrit : le code d'un produit
saisi ailleurs y est inconnu.

**Sa marque est un texte libre**, `own_brand`, et jamais une ligne de `brands`.
Cette table nourrit les filtres de tous les plans.

**Son code est tiré au hasard**, `perso-<uuid>`. `code_seed` est unique sur
toute la table : un identifiant choisi à la main heurterait celui d'un inconnu.

**La saisie se supprime, elle ne se corrige pas.** Supprimer sort le produit du
sac et jette le calcul qui s'en servait, dans une seule transaction.

## Alternatives écartées

**Une table `plan_products` à part.** Le partage est net, et `products` garde
ses colonnes obligatoires. Mais `product_snapshots.product_id`, la lecture du
sac par `code_seed`, le filtre des boissons sans flasque et la sélection de
l'écran passent tous par `products` : chacun aurait dû apprendre une seconde
source, pour des lignes qui ont les mêmes colonnes et les mêmes contraintes.

**Verser la saisie au catalogue commun.** Un produit ajouté par l'un servirait
aux autres, et le catalogue grossirait seul. Écarté : l'action est une route
ouverte, sans compte ni relecture. Une valeur fausse, un doublon ou un nom
déplacé paraîtrait dans le plan de tout le monde, et l'ADR 013 dit déjà ce que
coûte une fiche que personne n'a relue.

**Garder les produits saisis dans le navigateur**, comme la liste des plans
ouverts. Rien à écrire en base. Écarté : un plan se partage par son lien, et
l'accompagnateur qui l'ouvre doit y trouver le même sac.

## Conséquences

**Un produit saisi ne suit pas son auteur.** Il vit dans un plan : la course
suivante demande de le retaper. C'est le prix de l'absence de compte, et la
première chose qu'un coureur régulier remarquera.

**Une erreur de saisie coûte une suppression.** Corriger un chiffre, c'est
supprimer puis recréer, et recalculer le roadbook si le produit y servait.

**`products` ne dit plus « le catalogue » à elle seule.** Toute lecture doit
filtrer sur `plan_id`. `listProducts()` le fait, et `/catalogue` passe par
elle, mais une requête écrite à la main sur la table ramène désormais des
gâteaux de riz. `brand_id` devient facultative, tenue par la contrainte
`products_brand_or_plan`.

**La table grossit avec l'usage, sans relecture.** Trente produits par plan au
plus, et le plan expire à six mois. Mais la purge est paresseuse (ADR 003) : les
produits d'un plan que personne ne rouvre restent en base avec lui.

**Qui tient le lien peut écrire.** Un accompagnateur peut ajouter ou supprimer
un produit, comme il peut déjà déplacer un ravito.
