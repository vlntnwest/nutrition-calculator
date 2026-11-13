# 014. Chaque geste s'écrit, sans bouton Enregistrer

## Statut

Accepté — 2026-10-28

## Contexte

Les quatre écrans du plan tenaient chacun un brouillon dans le navigateur, et un
bouton « Enregistrer » l'écrivait. Le Roadbook y ajoutait « Enregistrer les
retouches », et la date de départ son propre bouton. Autour de ces boutons
s'était bâti un état à part entière : un drapeau « modifié » par écran, une
confirmation « Enregistré » qu'une frappe suivante effaçait, une conséquence
annoncée avant le clic (« le roadbook devra être recalculé »).

Le brouillon avait un coût que le bouton ne disait pas. Quitter un écran sans
enregistrer revenait en arrière en silence : la saisie disparaissait au retour.
Sur le Roadbook, une consigne posée sur un secteur relançait le calcul et
jetait au passage les retouches non enregistrées. Et parce que la feuille PDF
ne rend que la base, son déclencheur devait refuser de partir tant qu'il
restait des retouches. La barre du haut, sœur du Roadbook dans l'arbre, ne
pouvait l'apprendre que par un contexte React posé exprès (`RetouchesEnCours`).

ADR 011 l'assumait : « un gain qu'un bouton couvre déjà en grande partie ». À
l'usage, le bouton est un geste de plus sur chaque écran, et ce qu'il protège
(revenir sur une saisie avant de l'écrire) ne sert presque jamais.

## Décision

**Chaque geste s'écrit.** Plus de bouton Enregistrer, plus de drapeau
« modifié », plus de confirmation. L'écran montre ce qui est en base.

**Une saisie part une fois posée, une retouche dès le clic.** `useAutosave`
reçoit à chaque rendu ce que l'écran écrirait s'il fallait écrire maintenant,
et l'écrit 500 ms après le dernier changement, clic ou frappe. Course, Cibles,
Produits et le départ s'en servent. Les retouches du Roadbook passent par
`useEcriture` et partent dès le clic : rien ne s'y tape, et une retouche encore en attente
partirait après un « Recalculer » cliqué juste derrière, pour réimposer ce
qu'il vient de jeter.

**Ce qui n'est pas lisible ne part pas, et ne retient pas le reste.** Un ravito
sans nom n'empêche pas le chrono de s'écrire. Son reproche s'affiche tant que la
saisie ne se lit pas.

**Quitter un écran écrit ce qui restait en suspens**, comme masquer l'onglet.

**Le serveur reste le seul état partagé.** Next envoie les actions d'un même
client l'une après l'autre : deux écritures rapprochées arrivent dans l'ordre,
et la dernière l'emporte. `router.refresh()` ne suit que la dernière.

## Alternatives écartées

**Garder le bouton, et prévenir au départ de l'écran.** Un `beforeunload`, une
garde sur les liens du rail. Elle traite le symptôme et ajoute un dialogue à un
geste qui n'en demandait pas.

**Un magasin d'état côté client** (Redux, Zustand) qui tiendrait le plan entier
et l'écrirait par lots. Il réglerait le fil entre le Roadbook et la barre du
haut, mais c'est la seule chose que deux composants éloignés avaient à se
dire, et l'écriture au clic la supprime. Il ajouterait une seconde copie du
plan à tenir d'accord avec la base, ce contre quoi ADR 011 a été écrit.

**Un brouillon en base**, déjà écarté par ADR 011. L'écriture directe rend la
question sans objet : il n'y a plus de brouillon.

**Un historique pour revenir en arrière.** Défaire une saisie demanderait de
garder les états du plan, en base ou dans le navigateur. Rien ne le réclame à
ce jour.

## Conséquences

**Un clic de trop sur Produits, Cibles ou Course jette le roadbook calculé, et
ses retouches avec.** C'était déjà la règle (`survives`), mais le bouton laissait
le temps de renoncer. Il n'y a plus de retour possible : le roadbook se
recalcule, les retouches sont perdues.

**Une saisie à moitié tapée peut s'écrire.** Vider le champ des heures pour le
retaper, puis attendre une demi-seconde, écrit un chrono sans heures et
périme le roadbook. La frappe suivante écrit le bon.

**Rien ne confirme qu'une écriture a réussi.** Seul un refus se montre, dans
un pied qui ne paraît que pour lui. Le Roadbook estompe ses avertissements le
temps de l'aller-retour.

**Plus d'écritures, et un rafraîchissement par pause.** Chaque pause relit la
page côté serveur, trace comprise sur l'écran Course. C'était le prix d'un
clic sur Enregistrer, il se paie désormais à chaque pause.

**Le PDF part toujours**, et le contexte `RetouchesEnCours` disparaît. Un clic
sur le lien juste après une retouche peut encore rendre l'état d'avant, le
temps que l'écriture rentre.
