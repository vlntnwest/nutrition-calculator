# 003. Pas d'authentification, un UUID dans l'URL

## Statut

Accepté — 2026-08-05

## Contexte

Le critère qui définit le périmètre du projet est explicite : **une seule action
utilisateur, un seul livrable, zéro compte obligatoire**. Il a été retenu en
réaction au projet précédent, abandonné pour cause de périmètre trop large.

L'usage type se déroule en une session : un coureur prépare une course, dépose son
GPX, place ses ravitos, obtient son plan, l'imprime ou le partage avec ses
accompagnateurs. Il ne revient pas gérer un historique.

Le plan est associé à un poids corporel, qui relève des données de santé au sens du
RGPD. Sans compte, sans nom et sans adresse e-mail, un poids isolé n'identifie
personne : l'exposition est quasi nulle. C'est une propriété à préserver
délibérément, pas un état de fait provisoire.

Reste la question de la durée de vie : les plans doivent disparaître, et le
mécanisme de purge doit fonctionner sur l'hébergement retenu.

## Décision

**Aucune authentification.** Un plan est identifié par un UUID non devinable,
présent dans son URL. Qui a l'URL a le plan.

**Expiration à six mois.** Le filtre `expires_at > now()` est appliqué à chaque
lecture, et la suppression est paresseuse — les lignes périmées sont retirées à
l'occasion, pas par une tâche planifiée.

**Le caractère non privé de l'URL est écrit dans l'interface.** Non devinable ne
veut pas dire privé, et l'utilisateur doit le savoir avant de partager le lien.

## Alternatives écartées

**Comptes utilisateurs.** Apportent l'historique des courses et la récupération
d'un lien perdu. En échange : inscription, mot de passe ou OAuth, réinitialisation,
suppression de compte, et surtout le basculement du poids corporel dans la
catégorie « donnée de santé rattachée à une personne identifiée » — avec les
obligations qui vont avec. Un tunnel d'inscription avant le premier résultat
contredit frontalement le critère de périmètre. Repoussé au backlog V2.

**Supabase, pour son authentification intégrée.** Écarté avec les comptes
eux-mêmes : le projet n'utilise que Postgres, ni auth, ni storage, ni realtime. Payer
la complexité d'une plateforme pour une brique dont on ne veut pas n'a pas de sens.
D'où Neon.

**`pg_cron` pour purger les plans expirés.** C'était le premier réflexe. Il ne
fonctionne pas sur Neon : les tâches planifiées ne se déclenchent pas pendant la
mise en veille du compute, qui est précisément l'état normal d'une base peu
sollicitée. Une purge qui ne s'exécute que lorsque quelqu'un utilise le site n'est
pas une purge planifiée — autant l'assumer et la rendre paresseuse.

**Une tâche planifiée externe** (cron GitHub Actions, Vercel Cron). Fonctionnerait,
mais ajoute une pièce mobile, un secret à gérer et un mode de panne silencieux,
pour supprimer des lignes qui sont déjà invisibles grâce au filtre de lecture.

## Conséquences

**Un lien perdu est un plan perdu.** Il n'y a aucun moyen de retrouver un plan sans
son URL — pas de « mes plans », pas de récupération par e-mail. L'interface doit
inciter à conserver le lien, et le récapitulatif imprimable sert de filet.

**Non devinable n'est pas privé.** Un UUID v4 est hors de portée d'une énumération,
mais il circule en clair dans un historique de navigateur, un message, un
`Referer`. C'est acceptable pour un plan de course ; ce ne le serait pas pour une
donnée sensible, et c'est une raison de plus de ne rien stocker d'autre.

**La suppression paresseuse laisse des lignes mortes en base.** Elles sont
invisibles à la lecture, mais occupent de l'espace jusqu'à leur passage. Sur le
volume attendu, c'est sans conséquence ; à surveiller si le trafic change d'ordre
de grandeur.

Corollaire à exploiter : les plans expirent vite et ne contiennent rien de
précieux. Une migration ratée ne coûte pratiquement rien — c'est un terrain
d'apprentissage inhabituellement clément, et il faut s'en servir.
