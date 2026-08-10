/**
 * Passe un GPX dans le noyau de calcul et affiche ce qu'il en sort, comparé
 * aux lectures de Strava et Garmin sur le même fichier.
 *
 *   npm run analyze                    tous les fichiers du manifeste
 *   npm run analyze -- uthk            un fichier du manifeste
 *   npm run analyze -- ./course.gpx    n'importe quel GPX
 *
 * L'objectif n'est pas de coller à un chiffre — Strava et Garmin ne sont pas
 * d'accord entre eux sur le même fichier — mais de tomber dans leur range.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { withCumulativeDistance } from "../src/core/distance.ts";
import { elevationGain, fillMissingElevation } from "../src/core/elevation.ts";
import { parseGpx } from "../src/core/parseGpx.ts";
import { SETTINGS } from "../src/core/pipeline.ts";
import { resample } from "../src/core/resample.ts";
import { smooth } from "../src/core/smooth.ts";

const THRESHOLDS = [0, 1, 2, 3, 5];
const REFERENCES = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/core/fixtures/references",
);

type Reading = { distanceKm?: number; ascentM: number | null } | null;

type Entry = {
  file: string;
  course: string;
  type: string;
  official: Reading;
  strava: Reading;
  garmin: Reading;
};

const manifest: Entry[] = JSON.parse(
  readFileSync(join(REFERENCES, "manifest.json"), "utf8"),
);

/** Fourchette des D+ connus pour ce fichier, tous outils confondus. */
function range(entry: Entry | undefined): [number, number] | null {
  if (!entry) return null;
  const values = [entry.strava, entry.garmin, entry.official]
    .map((l) => l?.ascentM)
    .filter((v): v is number => typeof v === "number");
  if (values.length === 0) return null;
  return [Math.min(...values), Math.max(...values)];
}

function deviation(value: number, reference: number): string {
  const p = ((value - reference) / reference) * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(1)} %`;
}

function analyzeFile(path: string, entry?: Entry): void {
  const xml = readFileSync(path, "utf8");

  const trace = parseGpx(xml);
  const anchored = withCumulativeDistance(trace.points);
  const filled = fillMissingElevation(anchored);
  const totalM = filled[filled.length - 1].d;
  // Mêmes réglages que le chemin canonique : le script explore des variantes
  // de seuil, il ne doit pas explorer une autre configuration de base.
  const resampled = resample(filled, SETTINGS.stepM);
  const smoothed = smooth(resampled, SETTINGS.medianM, SETTINGS.meanM);

  console.log(`\n\x1b[1m${entry?.course ?? path}\x1b[0m`);
  console.log(`  file        ${path.split("/").pop()}`);
  if (entry) console.log(`  type           ${entry.type}`);
  console.log(`  points bruts   ${trace.points.length}`);
  if (trace.skipped > 0) console.log(`  skipped        ${trace.skipped}`);
  console.log(
    `  espacement     ${(totalM / (filled.length - 1)).toFixed(1)} m`,
  );
  console.log(`  points a 10 m  ${resampled.length}`);

  // Distance
  const km = totalM / 1000;
  const refsKm = [
    ["Strava", entry?.strava?.distanceKm],
    ["Garmin", entry?.garmin?.distanceKm],
  ].filter((r): r is [string, number] => typeof r[1] === "number");

  console.log(`\n  \x1b[1mDistance\x1b[0m  ${km.toFixed(2)} km`);
  for (const [name, value] of refsKm) {
    console.log(
      `    ${name.padEnd(8)} ${value.toFixed(2)} km   ${deviation(km, value)}`,
    );
  }

  // Dénivelé
  const bounds = range(entry);
  console.log(`\n  \x1b[1mD+\x1b[0m`);
  if (entry?.strava?.ascentM)
    console.log(`    Strava   ${entry.strava.ascentM} m`);
  if (entry?.garmin?.ascentM)
    console.log(`    Garmin   ${entry.garmin.ascentM} m`);
  if (entry?.official?.ascentM)
    console.log(`    official ${entry.official.ascentM} m`);

  // Référence des écarts : Strava seule.
  //
  // Garmin est écarté : sur le même fichier, il annonce 2222 m depuis le
  // créateur de parcours et 3263 m après réimport. Un chiffre qui varie de
  // 47 % selon la surface où on le lit ne mesure pas le fichier, il mesure
  // l'outil. L'annonce de l'organisateur, elle, porte sur le parcours
  // official et non sur ce fichier.
  const reference = entry?.strava?.ascentM ?? null;

  if (reference !== null) {
    console.log(
      `    \x1b[1m-> reference des ecarts : Strava (${reference} m)\x1b[0m`,
    );
  }

  const rows = THRESHOLDS.map((threshold) => ({
    threshold,
    raw: Math.round(elevationGain(filled, threshold)),
    resampled: Math.round(elevationGain(resampled, threshold)),
    pipe: Math.round(elevationGain(smoothed, threshold)),
  }));

  // La valeur la plus proche de la référence, toutes colonnes confondues.
  let best = Number.POSITIVE_INFINITY;
  if (reference !== null) {
    for (const r of rows) {
      best = Math.min(
        best,
        Math.abs(r.raw - reference),
        Math.abs(r.resampled - reference),
        Math.abs(r.pipe - reference),
      );
    }
  }

  const cell = (value: number): string => {
    const count = String(value).padStart(5);
    if (reference === null) return `${count}         `;
    const p = ((value - reference) / reference) * 100;
    const text = `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`.padStart(7);
    const closest = Math.abs(value - reference) === best;
    const inside = bounds && value >= bounds[0] && value <= bounds[1];
    const color = closest ? "\x1b[1;32m" : inside ? "\x1b[32m" : "";
    return color ? `${color}${count} ${text}\x1b[0m` : `${count} ${text}`;
  };

  // brut       : points d'origine, aucun traitement
  // resample   : pas constant de 10 m, sans lissage
  // + mediane  : resample puis filtre median (le pipeline actuel)
  console.log("\n    seuil        brut         resample       + mediane");
  for (const r of rows) {
    console.log(
      `    ${String(r.threshold).padStart(3)}   ${cell(r.raw)}   ${cell(r.resampled)}   ${cell(r.pipe)}`,
    );
  }
  if (reference !== null) {
    console.log(
      "\n    vert = dans la fourchette des outils, gras = le plus proche de la moyenne",
    );
  }
}

const arg = process.argv[2];

if (!arg) {
  for (const entry of manifest) {
    analyzeFile(join(REFERENCES, entry.file), entry);
  }
} else {
  const entry = manifest.find((e) => e.file === arg || e.file === `${arg}.gpx`);
  analyzeFile(entry ? join(REFERENCES, entry.file) : resolve(arg), entry);
}

console.log("");
