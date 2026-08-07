/**
 * Passe un GPX dans le noyau de calcul et affiche ce qu'il en sort, comparé
 * aux lectures de Strava et Garmin sur le même fichier.
 *
 *   npm run analyze                    tous les fichiers du manifeste
 *   npm run analyze -- uthk            un fichier du manifeste
 *   npm run analyze -- ./course.gpx    n'importe quel GPX
 *
 * L'objectif n'est pas de coller à un chiffre — Strava et Garmin ne sont pas
 * d'accord entre eux sur le même fichier — mais de tomber dans leur fourchette.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { withCumulativeDistance } from "../src/core/distance.ts";
import { elevationGain, fillMissingElevation } from "../src/core/elevation.ts";
import { parseGpx } from "../src/core/parseGpx.ts";
import { resample } from "../src/core/resample.ts";
import { smooth } from "../src/core/smooth.ts";

const SEUILS = [0, 1, 2, 3, 5];
const REFERENCES = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/core/fixtures/references",
);

type Lecture = { distanceKm?: number; denivelePositifM: number | null } | null;

type Entree = {
  fichier: string;
  course: string;
  type: string;
  officiel: Lecture;
  strava: Lecture;
  garmin: Lecture;
};

const manifeste: Entree[] = JSON.parse(
  readFileSync(join(REFERENCES, "manifest.json"), "utf8"),
);

/** Fourchette des D+ connus pour ce fichier, tous outils confondus. */
function fourchette(entree: Entree | undefined): [number, number] | null {
  if (!entree) return null;
  const valeurs = [entree.strava, entree.garmin, entree.officiel]
    .map((l) => l?.denivelePositifM)
    .filter((v): v is number => typeof v === "number");
  if (valeurs.length === 0) return null;
  return [Math.min(...valeurs), Math.max(...valeurs)];
}

function ecart(valeur: number, reference: number): string {
  const p = ((valeur - reference) / reference) * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(1)} %`;
}

function analyser(chemin: string, entree?: Entree): void {
  const xml = readFileSync(chemin, "utf8");

  const trace = parseGpx(xml);
  const ancres = withCumulativeDistance(trace.points);
  const complets = fillMissingElevation(ancres);
  const totalM = complets[complets.length - 1].d;
  const echantillonnes = resample(complets, 10);
  const lisses = smooth(echantillonnes);

  console.log(`\n\x1b[1m${entree?.course ?? chemin}\x1b[0m`);
  console.log(`  fichier        ${chemin.split("/").pop()}`);
  if (entree) console.log(`  type           ${entree.type}`);
  console.log(`  points bruts   ${trace.points.length}`);
  if (trace.skipped > 0) console.log(`  ecartes        ${trace.skipped}`);
  console.log(
    `  espacement     ${(totalM / (complets.length - 1)).toFixed(1)} m`,
  );
  console.log(`  points a 10 m  ${echantillonnes.length}`);

  // Distance
  const km = totalM / 1000;
  const refsKm = [
    ["Strava", entree?.strava?.distanceKm],
    ["Garmin", entree?.garmin?.distanceKm],
  ].filter((r): r is [string, number] => typeof r[1] === "number");

  console.log(`\n  \x1b[1mDistance\x1b[0m  ${km.toFixed(2)} km`);
  for (const [nom, valeur] of refsKm) {
    console.log(
      `    ${nom.padEnd(8)} ${valeur.toFixed(2)} km   ${ecart(km, valeur)}`,
    );
  }

  // Dénivelé
  const bornes = fourchette(entree);
  console.log(`\n  \x1b[1mD+\x1b[0m`);
  if (entree?.strava?.denivelePositifM)
    console.log(`    Strava   ${entree.strava.denivelePositifM} m`);
  if (entree?.garmin?.denivelePositifM)
    console.log(`    Garmin   ${entree.garmin.denivelePositifM} m`);
  if (entree?.officiel?.denivelePositifM)
    console.log(`    officiel ${entree.officiel.denivelePositifM} m`);

  console.log(
    `\n    seuil   brut   pipeline   ${bornes ? "dans la fourchette" : ""}`,
  );
  for (const seuil of SEUILS) {
    const brut = Math.round(elevationGain(complets, seuil));
    const pipe = Math.round(elevationGain(lisses, seuil));
    const dedans = bornes && pipe >= bornes[0] && pipe <= bornes[1];
    const marque = bornes ? (dedans ? "  \x1b[32m✓\x1b[0m" : "") : "";
    console.log(
      `    ${String(seuil).padStart(3)}   ${String(brut).padStart(5)}   ${String(pipe).padStart(6)}${marque}`,
    );
  }
}

const argument = process.argv[2];

if (!argument) {
  for (const entree of manifeste) {
    analyser(join(REFERENCES, entree.fichier), entree);
  }
} else {
  const entree = manifeste.find(
    (e) => e.fichier === argument || e.fichier === `${argument}.gpx`,
  );
  analyser(
    entree ? join(REFERENCES, entree.fichier) : resolve(argument),
    entree,
  );
}

console.log("");
