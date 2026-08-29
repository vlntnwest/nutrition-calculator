import type { LegOverride, NewAidStation, NewPlan } from "./planInput";

/**
 * Égalité structurelle, sans dépendre de l'ordre des clés.
 *
 * Sur l'union des deux jeux de clés, et non sur l'un des deux : une clé
 * absente s'y lit `undefined`, comme une clé présente qui ne porte rien. Le
 * `providesSolid: undefined` que rend `getPlan` et l'omission qu'envoie un
 * formulaire décrivent le même ravito.
 */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((x, i) => same(x, b[i]))
    );
  }

  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;

  return [...new Set([...Object.keys(a), ...Object.keys(b)])].every((cle) =>
    same(
      (a as Record<string, unknown>)[cle],
      (b as Record<string, unknown>)[cle],
    ),
  );
}

/**
 * Les réglages séparés en trois : ce que le calcul ne lit pas, le poids, et
 * tout le reste.
 *
 * Le rest fait la liste blanche : un réglage ajouté demain tombe dans `read`
 * sans qu'on y pense, et condamnera le calcul faute d'avoir été déclaré
 * inoffensif ici. L'oubli fait recalculer pour rien — l'inverse afficherait
 * un roadbook périmé en le disant à jour.
 */
function splitSettings(settings: NewPlan["settings"]) {
  const { raceDate: _date, startTime: _heure, massKg, ...read } = settings;

  return { massKg, read };
}

/** Un ravito tel que le calcul le voit : le nom n'en fait pas partie. */
function withoutName({ name: _nom, ...reste }: NewAidStation) {
  return reste;
}

/** Les ravitos rangés sur l'abscisse : la saisie peut les donner mêlés. */
function byPosition(list: NewAidStation[]) {
  return [...list].sort((a, b) => a.distanceM - b.distanceM);
}

/** Les mêmes, réduits à ce que le calcul en lit. */
function asComputed(list: NewAidStation[]) {
  return byPosition(list).map(withoutName);
}

/** Les consignes rangées sur leur borne, pour la même raison. */
function byBoundary(list: LegOverride[]) {
  return [...list].sort((a, b) => a.endPositionM - b.endPositionM);
}

/**
 * Le calcul déjà écrit reste-t-il vrai après cette mise à jour ?
 *
 * Faux, et `updatePlan` le jette : garder un roadbook calculé sur des entrées
 * qui n'existent plus serait le mensonge le plus coûteux du modèle. La trace
 * n'entre pas dans la comparaison — un autre GPX est un autre plan, et
 * `PlanPatch` ne permet pas d'y toucher.
 */
export function survives(before: NewPlan, after: NewPlan): boolean {
  const avant = splitSettings(before.settings);
  const apres = splitSettings(after.settings);

  return (
    // Cibles saisies, `massKg` ne sert plus qu'à la dépense en calories, que
    // le plan ne stocke pas. Vides, il fixe `suggestedTargets` : il compte.
    (apres.read.targets !== undefined || avant.massKg === apres.massKg) &&
    same(avant.read, apres.read) &&
    same(asComputed(before.aidStations), asComputed(after.aidStations)) &&
    same(before.flasks, after.flasks) &&
    same(byBoundary(before.legOverrides), byBoundary(after.legOverrides)) &&
    // Une sélection est un ensemble : `getPlan` la rend triée, pas la saisie.
    same([...before.productCodes].sort(), [...after.productCodes].sort())
  );
}

/** Les sections qui ont vraiment bougé. Les autres ne se réécrivent pas. */
export type Changed = {
  settings: boolean;
  flasks: boolean;
  aidStations: boolean;
  legOverrides: boolean;
  products: boolean;
};

/**
 * Ce que la mise à jour doit réellement réécrire.
 *
 * Réécrire une section intacte n'est pas anodin : `fill` cascade depuis
 * `flasks`, et une fiole supprimée puis réinsérée à l'identique emporterait
 * les remplissages de secteurs que le calcul, lui, a survécu. Une section
 * absente du patch se retrouve ici inchangée d'elle-même — `updatePlan` la
 * recopie de l'existant avant de comparer.
 *
 * Rien à voir avec `survives` : le nom d'un ravito et l'heure de départ
 * bougent sans condamner le calcul, mais il faut bien les écrire.
 */
export function changed(before: NewPlan, after: NewPlan): Changed {
  return {
    settings: !same(before.settings, after.settings),
    flasks: !same(before.flasks, after.flasks),
    aidStations: !same(
      byPosition(before.aidStations),
      byPosition(after.aidStations),
    ),
    legOverrides: !same(
      byBoundary(before.legOverrides),
      byBoundary(after.legOverrides),
    ),
    products: !same(
      [...before.productCodes].sort(),
      [...after.productCodes].sort(),
    ),
  };
}
