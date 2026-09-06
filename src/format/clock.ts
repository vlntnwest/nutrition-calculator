/**
 * Ce qui traduit un chrono saisi en secondes, et l'inverse.
 *
 * Un formulaire garde le **texte** tapé, jamais la valeur : repasser par un
 * nombre à chaque frappe efface ce qui n'est pas encore un nombre.
 */

/** Les trois cases d'un chrono, telles qu'elles sont tapées. */
export type HMS = { h: string; m: string; s: string };

export const HMS_VIDE: HMS = { h: "", m: "", s: "" };

/** Ne garde que des chiffres, sur deux caractères au plus. */
export function digitsOnly(texte: string): string {
  return texte.replace(/\D/g, "").slice(0, 2);
}

/**
 * Trois cases vides rendent `undefined`, pas `0`. Une case vide parmi les
 * trois vaut zéro : `"1", "", "30"` est bien 1 h 0 min 30 s.
 */
export function toSecondsHMS({ h, m, s }: HMS): number | undefined {
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

/** `13500` → `{ h: "03", m: "45", s: "00" }`. Absent rend trois cases vides. */
export function toHMS(seconds: number | undefined): HMS {
  if (seconds === undefined) return HMS_VIDE;

  return {
    h: String(Math.floor(seconds / 3600)).padStart(2, "0"),
    m: String(Math.floor((seconds % 3600) / 60)).padStart(2, "0"),
    s: String(Math.round(seconds % 60)).padStart(2, "0"),
  };
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
 * L'allure qui remplit le chrono à l'ouverture de la fiche, en secondes par
 * kilomètre. Un point de départ à corriger, pas une prédiction : elle ignore
 * le dénivelé, que le noyau, lui, prend en compte.
 */
export const BASE_PACE_S_PER_KM = 360;

/**
 * Le chrono proposé à l'ouverture : la distance courue à
 * `BASE_PACE_S_PER_KM`. Une trace sans distance rend trois cases vides plutôt
 * qu'un `00:00:00` trompeur.
 */
export function baseChronoHMS(distanceM: number): HMS {
  if (distanceM <= 0) return HMS_VIDE;

  return toHMS(Math.round((distanceM / 1000) * BASE_PACE_S_PER_KM));
}

/**
 * L'allure moyenne que suppose le chrono visé, en `mm:ss`. C'est la seule
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
