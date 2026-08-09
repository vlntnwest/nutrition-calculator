/**
 * Retire d'un GPX tout ce que le noyau ne lit pas : les horodatages et les
 * extensions constructeur — fréquence cardiaque, cadence, température,
 * puissance. Seuls `lat`, `lon` et `<ele>` servent au calcul.
 *
 *   npm run strip-gpx -- src/core/fixtures/references/uthk.gpx
 *   npm run strip-gpx -- src/core/fixtures/references/*.gpx
 *
 * Le nettoyage est **textuel** et non un reparse : la déclaration XML, les
 * namespaces, la structure trk/trkseg et l'ordre des points restent
 * exactement ceux de l'export d'origine. C'est ce qui permet aux fixtures de
 * continuer à éprouver `parseGpx` sur de vrais fichiers Strava ou Garmin —
 * les régénérer depuis notre propre parseur rendrait le test tautologique.
 *
 * Aucune mesure ne doit bouger. Le test de caractérisation en est la preuve :
 * s'il reste vert après le passage, c'est que `lat`, `lon` et `ele` sont
 * intacts.
 */

import { readFileSync, statSync, writeFileSync } from "node:fs";

const fichiers = process.argv.slice(2);

if (fichiers.length === 0) {
  console.error("usage : npm run strip-gpx -- <fichier.gpx> [...]");
  process.exit(1);
}

const mo = (octets: number) => `${(octets / 1048576).toFixed(1)} Mo`;

let avantTotal = 0;
let apresTotal = 0;

for (const chemin of fichiers) {
  const avant = statSync(chemin).size;

  const nettoye = readFileSync(chemin, "utf8")
    // <extensions> … </extensions>, y compris multilignes et imbriquées
    .replace(/[ \t]*<extensions>[\s\S]*?<\/extensions>\s*\n?/g, "")
    // <time>…</time>, et la variante auto-fermante
    .replace(/[ \t]*<time>[^<]*<\/time>\s*\n?/g, "")
    .replace(/[ \t]*<time\s*\/>\s*\n?/g, "");

  writeFileSync(chemin, nettoye);
  const apres = statSync(chemin).size;

  avantTotal += avant;
  apresTotal += apres;

  const gain = ((1 - apres / avant) * 100).toFixed(0);
  console.log(
    `${chemin.split("/").pop()?.padEnd(26)} ${mo(avant).padStart(8)} -> ${mo(apres).padStart(8)}   -${gain} %`,
  );
}

if (fichiers.length > 1) {
  const gain = ((1 - apresTotal / avantTotal) * 100).toFixed(0);
  console.log(
    `\n${"total".padEnd(26)} ${mo(avantTotal).padStart(8)} -> ${mo(apresTotal).padStart(8)}   -${gain} %`,
  );
}
