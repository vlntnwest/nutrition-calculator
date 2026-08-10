/**
 * Le plan complet sur un GPX, secteur par secteur.
 *
 *   npm run plan -- saverne.gpx 3:45 70 --ravitos 9.8,20.8
 *   npm run plan -- uthk.gpx 15:30 70 --ravitos "Le Hohwald@23,Champ du Feu@48,Andlau@77"
 *                                     --produits naak-gel-ultra,naak-boisson-salted-soup
 */

import { readFileSync } from "node:fs";
import { withCumulativeDistance } from "../src/core/distance.ts";
import { distributeTime } from "../src/core/distribute.ts";
import { fillMissingElevation } from "../src/core/elevation.ts";
import { nutritionPlan, suggestedTargets } from "../src/core/nutrition.ts";
import { parseGpx } from "../src/core/parseGpx.ts";
import { SETTINGS } from "../src/core/pipeline.ts";
import { CATALOG, productById } from "../src/core/products.ts";
import { resample } from "../src/core/resample.ts";
import { smooth } from "../src/core/smooth.ts";
import type { AidStation } from "../src/core/type.ts";

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);

  return i >= 0 ? args[i + 1] : undefined;
};

const file = args[0] ?? "uthk.gpx";
const [h, m] = (args[1] ?? "15:30").split(":").map(Number);
const targetTimeS = h * 3600 + (m ?? 0) * 60;
const massKg = Number(args[2] ?? 70);

const products = (option("products") ?? "naak-gel-ultra,naak-drink-ultra")
  .split(",")
  .map((id) => {
    const p = productById(id);
    if (!p) {
      throw new Error(
        `Product inconnu : ${id}\nConnus : ${CATALOG.map((x) => x.id).join(", ")}`,
      );
    }

    return p;
  });

// « nom@km » ou simplement « km ».
const aidStations: AidStation[] = (option("aidStations") ?? "")
  .split(",")
  .filter(Boolean)
  .map((raw, i) => {
    const [a, b] = raw.split("@");

    return b === undefined
      ? { name: `AidStation ${i + 1}`, distanceM: Number(a) * 1000 }
      : { name: a, distanceM: Number(b) * 1000 };
  });

const path = file.includes("/")
  ? new URL(file, `file://${process.cwd()}/`)
  : new URL(`../src/core/fixtures/references/${file}`, import.meta.url);

const trace = parseGpx(readFileSync(path, "utf8"));
const smoothed = smooth(
  resample(
    fillMissingElevation(withCumulativeDistance(trace.points)),
    SETTINGS.stepM,
  ),
  SETTINGS.medianM,
  SETTINGS.meanM,
);
const timed = distributeTime(smoothed, targetTimeS, {
  climbIntensity: 0.25,
  split: 0.05,
});

const runner = { massKg };
const targets = suggestedTargets(runner, targetTimeS);
const plan = nutritionPlan(timed, aidStations, runner, targets, products);

const hoursMinutes = (s: number) =>
  `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)
    .toString()
    .padStart(2, "0")}`;

console.log(`\n${trace.name ?? file}`);
console.log(
  `${(smoothed[smoothed.length - 1].d / 1000).toFixed(1)} km · ` +
    `objectif ${hoursMinutes(targetTimeS)} · ${massKg} kg · ` +
    `${targets.carbsGH} g/h, ${Math.round(targets.fluidMlH)} mL/h, ${targets.sodiumMgL} mg/L`,
);

for (const s of plan.legs) {
  console.log(`\n── ${s.name}`);
  console.log(
    `   ${(s.startM / 1000).toFixed(1)} → ${(s.endM / 1000).toFixed(1)} km · ` +
      `${(s.lengthM / 1000).toFixed(1)} km · ` +
      `+${Math.round(s.ascentM)} / −${Math.round(s.descentM)} m · ` +
      `${hoursMinutes(s.durationS)} (arrivée ${hoursMinutes(s.arrivalS)})`,
  );
  console.log(
    `   à emporter : ${Math.round(s.need.carbsG)} g de glucides, ` +
      `${Math.round(s.need.fluidMl)} mL, ${Math.round(s.need.sodiumMg)} mg de sodium ` +
      `· ${Math.round(s.expenditureKcal)} kcal dépensées`,
  );

  for (const r of s.servings) {
    console.log(
      `     ${r.units.toString().padStart(3)} × ${`${r.product.brand} ${r.product.name}`.padEnd(36)}` +
        ` un toutes les ${Math.round(r.intervalS / 60)} min`,
    );
  }
  if (s.plainWaterMl > 0) {
    console.log(
      `         + ${Math.round(s.plainWaterMl)} mL d'eau claire`.padEnd(44),
    );
  }
}

console.log(`\n── Le sac complet`);
for (const [id, units] of plan.total.units) {
  const p = productById(id);
  console.log(`   ${units.toString().padStart(3)} × ${p?.brand} ${p?.name}`);
}
console.log(
  `   ${Math.round(plan.total.carbsG)} g de glucides · ` +
    `${Math.round(plan.total.sodiumMg)} mg de sodium · ` +
    `${Math.round(plan.total.fluidMl)} mL de boisson · ` +
    `${Math.round(plan.total.expenditureKcal).toLocaleString("fr")} kcal dépensées`,
);

if (plan.warnings.length > 0) {
  console.log("");
  for (const a of plan.warnings) console.log(`  ⚠  ${a}`);
}
console.log("");
