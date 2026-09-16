/**
 * Un plan est un secret partagé : l'identifiant *est* le droit d'accès, il
 * n'y a pas de compte. Le vérifier avant la base évite qu'une saisie de
 * travers ressorte en `invalid input syntax for type uuid`.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAccessId(value: string): boolean {
  return UUID.test(value);
}
