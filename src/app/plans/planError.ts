/**
 * Un refus que l'écran doit montrer, par opposition à un bug.
 *
 * Les actions rendent le message d'un `PlanError` tel quel et taisent le
 * reste : une contrainte Postgres nomme des colonnes, ce qui ne dit rien à
 * un coureur et raconte le schéma à qui poste au hasard.
 */
export class PlanError extends Error {}
