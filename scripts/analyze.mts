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
import { REGLAGES } from "../src/core/pipeline.ts";
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
  // Mêmes réglages que le chemin canonique : le script explore des variantes
  // de seuil, il ne doit pas explorer une autre configuration de base.
  const echantillonnes = resample(complets, REGLAGES.pasM);
  const lisses = smooth(echantillonnes, REGLAGES.medianeM, REGLAGES.moyenneM);

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

  // Référence des écarts : Strava seule.
  //
  // Garmin est écarté : sur le même fichier, il annonce 2222 m depuis le
  // créateur de parcours et 3263 m après réimport. Un chiffre qui varie de
  // 47 % selon la surface où on le lit ne mesure pas le fichier, il mesure
  // l'outil. L'annonce de l'organisateur, elle, porte sur le parcours
  // officiel et non sur ce fichier.
  const moyenne = entree?.strava?.denivelePositifM ?? null;

  if (moyenne !== null) {
    console.log(
      `    \x1b[1m-> reference des ecarts : Strava (${moyenne} m)\x1b[0m`,
    );
  }

  const rangs = SEUILS.map((seuil) => ({
    seuil,
    brut: Math.round(elevationGain(complets, seuil)),
    echant: Math.round(elevationGain(echantillonnes, seuil)),
    pipe: Math.round(elevationGain(lisses, seuil)),
  }));

  // La valeur la plus proche de la référence, toutes colonnes confondues.
  let meilleur = Number.POSITIVE_INFINITY;
  if (moyenne !== null) {
    for (const r of rangs) {
      meilleur = Math.min(
        meilleur,
        Math.abs(r.brut - moyenne),
        Math.abs(r.echant - moyenne),
        Math.abs(r.pipe - moyenne),
      );
    }
  }

  const cellule = (valeur: number): string => {
    const nombre = String(valeur).padStart(5);
    if (moyenne === null) return `${nombre}         `;
    const p = ((valeur - moyenne) / moyenne) * 100;
    const texte = `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`.padStart(7);
    const proche = Math.abs(valeur - moyenne) === meilleur;
    const dedans = bornes && valeur >= bornes[0] && valeur <= bornes[1];
    const couleur = proche ? "\x1b[1;32m" : dedans ? "\x1b[32m" : "";
    return couleur
      ? `${couleur}${nombre} ${texte}\x1b[0m`
      : `${nombre} ${texte}`;
  };

  // brut       : points d'origine, aucun traitement
  // resample   : pas constant de 10 m, sans lissage
  // + mediane  : resample puis filtre median (le pipeline actuel)
  console.log("\n    seuil        brut         resample       + mediane");
  for (const r of rangs) {
    console.log(
      `    ${String(r.seuil).padStart(3)}   ${cellule(r.brut)}   ${cellule(r.echant)}   ${cellule(r.pipe)}`,
    );
  }
  if (moyenne !== null) {
    console.log(
      "\n    vert = dans la fourchette des outils, gras = le plus proche de la moyenne",
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
