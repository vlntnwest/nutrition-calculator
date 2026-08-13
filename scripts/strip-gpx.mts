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
 * Les balises préfixées d'un namespace sont traitées : `parseGpx` lit avec
 * `removeNSPrefix`, donc un export en `<ns3:time>` ou `<gpx:extensions>` est
 * une entrée légitime du pipeline et arrivait ici intact.
 *
 * Ce que le nettoyage ne fait **pas** : un `<extensions>` imbriqué dans un
 * autre `<extensions>`. Le motif s'arrête à la première fermeture et laisserait
 * une balise orpheline. Le cas n'existe pas dans le corpus, et le GPX ne le
 * prévoit pas — les extensions imbriquent des éléments *constructeur*, pas
 * d'autres `<extensions>`.
 *
 * L'écriture se fait **en place**, sur des fixtures versionnées : git est le
 * filet, et le test de caractérisation la preuve. Aucune mesure ne doit bouger
 * — s'il reste vert après le passage, c'est que `lat`, `lon` et `ele` sont
 * intacts.
 */

import { readFileSync, statSync, writeFileSync } from "node:fs";

const files = process.argv.slice(2);

if (files.length === 0) {
  console.error("usage : npm run strip-gpx -- <file.gpx> [...]");
  process.exit(1);
}

const megabytes = (bytes: number) => `${(bytes / 1048576).toFixed(1)} Mo`;

let beforeTotal = 0;
let afterTotal = 0;

for (const path of files) {
  const before = statSync(path).size;

  const cleaned = readFileSync(path, "utf8")
    // <extensions> … </extensions>, multilignes, avec ou sans préfixe de
    // namespace. Non imbriquées : voir l'en-tête.
    .replace(
      /[ \t]*<(?:[\w.-]+:)?extensions\b[\s\S]*?<\/(?:[\w.-]+:)?extensions>\s*\n?/g,
      "",
    )
    // <time>…</time>, et la variante auto-fermante
    .replace(/[ \t]*<(?:[\w.-]+:)?time>[^<]*<\/(?:[\w.-]+:)?time>\s*\n?/g, "")
    .replace(/[ \t]*<(?:[\w.-]+:)?time\s*\/>\s*\n?/g, "");

  writeFileSync(path, cleaned);
  const after = statSync(path).size;

  beforeTotal += before;
  afterTotal += after;

  const gain = ((1 - after / before) * 100).toFixed(0);
  console.log(
    `${path.split("/").pop()?.padEnd(26)} ${megabytes(before).padStart(8)} -> ${megabytes(after).padStart(8)}   -${gain} %`,
  );
}

if (files.length > 1) {
  const gain = ((1 - afterTotal / beforeTotal) * 100).toFixed(0);
  console.log(
    `\n${"total".padEnd(26)} ${megabytes(beforeTotal).padStart(8)} -> ${megabytes(afterTotal).padStart(8)}   -${gain} %`,
  );
}
