/**
 * Ce qui traduit la saisie de la modale d'import en valeurs, et l'inverse.
 *
 * Même logique que `plan/[accessId]/fields.ts`, mais le chrono s'y saisit
 * en trois cases (h, min, s) plutôt qu'un seul champ « hh:mm » : le format
 * diffère, la fonction ne se partage pas.
 */

/** Ne garde que des chiffres, sur deux caractères au plus. */
export function digitsOnly(texte: string): string {
  return texte.replace(/\D/g, "").slice(0, 2);
}

/**
 * Trois cases vides → aucun chrono visé, pas `0`. Une case vide parmi les
 * trois vaut zéro : `"1", "", "30"` est bien 1 h 0 min 30 s.
 */
export function toSecondsHMS(
  h: string,
  m: string,
  s: string,
): number | undefined {
  if (h.trim() === "" && m.trim() === "" && s.trim() === "") return undefined;

  const heures = h.trim() === "" ? 0 : Number(h);
  const minutes = m.trim() === "" ? 0 : Number(m);
  const secondes = s.trim() === "" ? 0 : Number(s);

  if (
    !Number.isFinite(heures) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(secondes)
  ) {
    return undefined;
  }

  return heures * 3600 + minutes * 60 + secondes;
}

/**
 * Un nom de course à partir du fichier, quand le GPX n'en portait pas :
 * `saintelyon-2026.gpx` → `saintelyon 2026`. Un simple retrait de
 * l'extension et des séparateurs, pas une tentative de deviner la casse.
 */
export function raceNameFromFileName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

/**
 * L'allure moyenne que suppose le chrono visé, en `mm:ss /km` — la seule
 * confirmation immédiate qu'un chrono tapé est plausible avant d'aller
 * jusqu'au roadbook. `undefined` tant qu'aucun chrono n'est renseigné.
 */
export function paceLabel(
  targetTimeS: number | undefined,
  distanceM: number,
): string | undefined {
  if (targetTimeS === undefined || distanceM <= 0) return undefined;

  const secPerKm = targetTimeS / (distanceM / 1000);
  const minutes = Math.floor(secPerKm / 60);
  const seconds = Math.round(secPerKm % 60);
  // `Math.round` peut porter les secondes à 60 tout rond.
  const report =
    seconds === 60
      ? { minutes: minutes + 1, seconds: 0 }
      : { minutes, seconds };

  return `${String(report.minutes).padStart(2, "0")}:${String(report.seconds).padStart(2, "0")}`;
}
