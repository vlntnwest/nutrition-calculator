# 001. Ne pas stocker le fichier GPX

## Statut

Accepté — 2026-08-05

## Contexte

L'utilisateur dépose un GPX pour obtenir un plan nutritionnel. Le fichier est le
point d'entrée du calcul, mais il n'est pas le livrable : le livrable est le plan.

Un GPX d'ultra-trail pèse lourd. Environ 30 000 points à ~200 octets, soit **5 Mo**,
dont la majeure partie ne sert à rien ici — timestamps, fréquence cardiaque,
cadence, extensions propriétaires, namespaces XML. Une fois rééchantillonné à pas
constant et simplifié à ~2 000 points, il ne reste que `d`, `lat`, `lon` et `ele` :
**~150 ko**, soit trente fois moins.

Trois options se présentaient : conserver le fichier original, parser côté serveur,
ou parser côté client et ne transmettre que le dérivé.

Le contexte réglementaire pèse aussi. Le plan est associé à un poids corporel, qui
est une donnée de santé. Moins on stocke, moins on a à protéger.

## Décision

Le GPX est **parsé à l'upload puis jeté**. Seules les données dérivées sont
persistées, et elles expirent au bout de six mois.

Le parsing a lieu **côté client, dans un Web Worker** — `fast-xml-parser` pour le
XML, mapping maison pour la structure. Le Worker évite de geler l'interface sur
30 000 points. Seuls les ~150 ko dérivés transitent sur le réseau.

Aucun stockage objet n'est mis en place. Le schéma ne comporte aucune colonne, ni
aucun bucket, destiné au fichier source.

## Alternatives écartées

**Conserver le fichier original en stockage objet.** Ajoute un service à
administrer, un coût au Go, et une surface d'exposition RGPD — une trace GPS est
une donnée de localisation. En échange d'un usage qui n'existe pas dans le
périmètre V1 : rien dans les quatre écrans ne relit le fichier source.

**Parser côté serveur.** Impose de téléverser 5 Mo par plan, sur une connexion
souvent mobile puisque l'usage type est la préparation d'une course. Consomme du
temps d'exécution serverless pour un travail que le navigateur fait très bien.
N'apporte qu'un seul avantage — le contrôle du parseur — qui ne compense pas.

**Garder le fichier le temps de la session, en mémoire serveur.** Complique le
déploiement serverless (aucune garantie d'affinité entre requêtes) pour un gain
marginal.

## Conséquences

**Un plan existant ne pourra jamais être recalculé avec un meilleur algorithme.**
C'est le vrai coût de cette décision, et il faut le regarder en face : le jour où
le lissage d'altitude s'améliore — et il s'améliorera, c'est la brique la plus
délicate du projet — les plans déjà générés resteront sur l'ancien calcul. La seule
issue sera de redemander le fichier à l'utilisateur.

Ce coût est acceptable parce que les plans expirent à six mois et qu'un plan de
course est consommé une fois, avant l'épreuve. Il le serait beaucoup moins sur un
produit à historique.

Corollaire positif : la base ne contient aucune donnée qui ait de la valeur pour un
attaquant, et une migration ratée ne détruit rien d'irremplaçable.

Le parsing côté client impose que le noyau de calcul soit isomorphe — pas d'API
Node dans `src/core/`. C'est de toute façon la contrainte que l'on veut, puisque
ces fonctions doivent rester testables sans framework.

## Précédent

OnRouteMap applique le même patron : fichier supprimé après traitement, seul le
résultat conservé.
