/**
 * Le plan complet sur un GPX, secteur par secteur.
 *
 *   npm run plan -- saverne.gpx 3:45 70 --aidStations 9.8,20.8
 *   npm run plan -- uthk.gpx 15:30 70 --aidStations "Le Hohwald@23,Champ du Feu@48,Andlau@77"
 *                                     --products naak-gel-ultra,naak-drink-salted-soup
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
import type { AidStation, Leg, Warning } from "../src/core/type.ts";

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
        `Produit inconnu : ${id}\nConnus : ${CATALOG.map((x) => x.id).join(", ")}`,
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
      ? { name: `Ravito ${i + 1}`, distanceM: Number(a) * 1000 }
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

// Le noyau rend des données ; les mots sont ici, et nulle part ailleurs.
const legName = (s: Leg) => `${s.from ?? "Départ"} → ${s.to ?? "Arrivée"}`;
const percent = (share: number) => `${Math.round(share * 100)} %`;

function phrase(w: Warning): string {
  switch (w.code) {
    case "no-carb-product":
      return "Aucun produit sélectionné ne fournit de glucides.";
    case "carbs-above-guide":
      return (
        `${w.carbsGH} g/h dépasse le repère de tolérance de ${w.guideGH} g/h. ` +
        `La littérature ne montre pas d'avantage au-delà, et les troubles digestifs augmentent.`
      );
    case "carbs-single-source":
      return (
        `Au-delà de ${w.maxGH} g/h il faut du glucose-fructose : ` +
        `seuls ${percent(w.multiShare)} des glucides choisis en apportent. ` +
        `Le reste ne sera pas absorbé.`
      );
    case "fluid-above-guide":
      return (
        `${Math.round(w.fluidMlH)} mL/h dépasse ce que la plupart des coureurs ` +
        `transpirent. Boire au-delà de sa sudation expose à l'hyponatrémie.`
      );
    case "sodium-below-target":
      return (
        `Sodium à ${percent(w.share)} de la cible : ` +
        `prévoir des pastilles de sel ou une boisson plus salée.`
      );
    case "leg-fluid-above-target":
      return (
        `${legName(plan.legs[w.legIndex])} : la boisson seule dépasse la cible d'hydratation ` +
        `(${Math.round(w.supplyMl)} contre ${Math.round(w.needMl)} mL). ` +
        `Diluer moins, ou passer des glucides sur du solide.`
      );
  }
}

console.log(`\n${trace.name ?? file}`);
console.log(
  `${(smoothed[smoothed.length - 1].d / 1000).toFixed(1)} km · ` +
    `objectif ${hoursMinutes(targetTimeS)} · ${massKg} kg · ` +
    `${targets.carbsGH} g/h, ${Math.round(targets.fluidMlH)} mL/h, ${targets.sodiumMgL} mg/L`,
);

for (const s of plan.legs) {
  console.log(`\n── ${legName(s)}`);
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
  for (const a of plan.warnings) console.log(`  ⚠  ${phrase(a)}`);
}
console.log("");
