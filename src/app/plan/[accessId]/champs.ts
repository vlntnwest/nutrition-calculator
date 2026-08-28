/**
 * Ce qui traduit une saisie en valeur, et l'inverse.
 *
 * Un formulaire garde le **texte** tapé, jamais la valeur : repasser par un
 * nombre à chaque frappe efface ce qui n'est pas encore un nombre — le
 * séparateur décimal en premier, qu'on ne pourrait alors jamais saisir.
 */

/** `13500` → `03:45`. Absent rend la chaîne vide, pas `00:00`. */
export function toClock(seconds: number | undefined): string {
  if (seconds === undefined) return "";

  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** `03:45` → `13500`. Rend `undefined` sur une saisie inexploitable. */
export function toSeconds(clock: string): number | undefined {
  const parts = clock.split(":");
  if (parts.length !== 2) return undefined;

  const [h, m] = parts.map((p) => (p.trim() === "" ? NaN : Number(p)));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return undefined;

  return h * 3600 + m * 60;
}

/**
 * Lit un nombre, la virgule valant le point : un clavier français ne propose
 * pas autre chose, et `Number("9,8")` rend `NaN`.
 */
export function nombre(texte: string): number | undefined {
  const propre = texte.trim().replace(",", ".");
  if (propre === "") return undefined;

  const valeur = Number(propre);

  return Number.isFinite(valeur) ? valeur : undefined;
}
