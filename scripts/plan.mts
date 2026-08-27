/**
 * Le plan complet sur un GPX, secteur par secteur.
 *
 *   npm run plan -- saverne.gpx 3:45 70 --aidStations 9.8,20.8
 *   npm run plan -- uthk.gpx 15:30 70 --aidStations "Château du Frankenbourg@22.6,Lièpvre@39.8,Refuge des Vosges Trotters@46.8,1er passage Hasenclever@63,2ème passage Hasenclever@73.1, Château du Reichenberg@82.2, Château Haut-Koenigsbourg@92.9"
 *                                     --products naak-waffle-citron,naak-puree-apple,decathlon-iso-plus
 *
 * Positionnels : le fichier, l'objectif en `h:mm`, la masse en kg.
 *
 *   --products      identifiants séparés par des virgules
 *   --aidStations   « nom@km » ou « km », séparés par des virgules. Quatre
 *                   suffixes cumulables : « :8 » l'arrêt sur place en minutes,
 *                   « =95 » la durée imposée au secteur qui s'y termine,
 *                   « -eau » et « -solide » ce que la borne ne fournit pas
 *                   — « Lièpvre@39.8:8=95 », « Col@63-eau-solide ».
 *                   L'arrêt est retranché du temps visé avant que l'allure ne
 *                   soit placée, pas dilué sur la trace ; la durée imposée est
 *                   servie d'abord, et les secteurs libres s'accélèrent
 *                   d'autant. Une borne qui ne fournit pas ne rouvre pas la
 *                   portée : ce qu'on porte doit tenir jusqu'à la suivante
 *   --finish        durée imposée au dernier secteur, en minutes. Il n'est
 *                   clos par aucun ravito, sa consigne ne peut donc pas
 *                   s'écrire « =95 » — c'est le seul secteur dans ce cas
 *   --flasks        volumes en mL, suffixe `w` pour une flasque réservée à
 *                   l'eau claire — « 500,500w ». Omis, la contenance n'est pas
 *                   déclarée et le noyau ne borne rien
 *   --start         heure de départ en `h:mm`. Les passages sont alors donnés
 *                   à l'heure de la montre plutôt qu'en temps écoulé
 *   --carbs         glucides en g/h — 45, 60, 90… Aucune valeur n'est imposée
 *   --fluid         hydratation en mL/h
 *   --sodium        sodium en mg par litre de boisson
 *   --segments      ajoute les temps de passage, tronçon de pente par tronçon
 *
 * `--carbs`, `--fluid` et `--sodium` remplacent chacun la suggestion calculée
 * pour la durée et le gabarit. Rien n'est écrêté : une valeur hors norme passe
 * et déclenche une remarque.
 *
 * `--segments` est là où l'on confronte le modèle d'allure à ce qu'on fait
 * vraiment.
 *
 * Exemple :
 * npm run plan -- uthk.gpx 12:45 77 --aidStations "Château du Frankenbourg@22.6,Lièpvre@39.8,Refuge des Vosges Trotters@46.8,1er passage Hasenclever@63,2ème passage Hasenclever@73.1, Château du Reichenberg@82.2, Château Haut-Koenigsbourg@92.9" --products naak-waffle-citron,naak-puree-apple,decathlon-iso-plus --flasks "500,500w" --start "22:00" --carbs 45
 */

import { readFileSync } from "node:fs";
import {
  distributeTime,
  pacingIssue,
  timeSegments,
} from "../src/core/distribute.ts";
import {
  fixedSpans,
  movingTimeS,
  nutritionPlan,
  suggestedTargets,
} from "../src/core/nutrition.ts";
import { parseGpx } from "../src/core/parseGpx.ts";
import { prepareTrack, SETTINGS } from "../src/core/pipeline.ts";
import { CATALOG, productById } from "../src/core/products.ts";
import { splitBySlope } from "../src/core/split.ts";
import type {
  AidStation,
  Flask,
  Leg,
  PacingIssue,
  SegmentType,
  Targets,
  Warning,
} from "../src/core/type.ts";

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);

  return i >= 0 ? args[i + 1] : undefined;
};

// Les options à valeur consomment le jeton suivant : sans ça, « --products
// naak-gel-ultra » verrait son argument pris pour un positionnel.
const VALUED = [
  "products",
  "aidStations",
  "finish",
  "flasks",
  "start",
  "carbs",
  "fluid",
  "sodium",
];
const FLAGS = ["segments"];

const USAGE =
  "usage : npm run plan -- <fichier.gpx> <h:mm> <kg> [options]\n" +
  `options : ${[...VALUED.map((o) => `--${o} <valeur>`), ...FLAGS.map((o) => `--${o}`)].join(" · ")}`;

const positional: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--")) {
    const name = args[i].slice(2);

    // Une option inconnue était ignorée sans un mot : « --flask 500 » au lieu
    // de « --flasks » laissait le plan se calculer sans contenance déclarée,
    // et rien ne disait pourquoi le résultat ne bougeait pas.
    if (!VALUED.includes(name) && !FLAGS.includes(name)) {
      throw new Error(`Option inconnue : ${args[i]}\n${USAGE}`);
    }
    if (VALUED.includes(name)) i++;
    continue;
  }
  positional.push(args[i]);
}

// `Number` rend `NaN` sur n'importe quel jeton non numérique. Sans ce garde, un
// positionnel oublié imprimait un plan entier rempli de `NaN` au lieu de dire
// ce qui n'allait pas — le chemin du produit inconnu échoue déjà bruyamment.
const number = (raw: string, what: string): number => {
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`${what} illisible : « ${raw} »\n${USAGE}`);
  }

  return n;
};

const file = positional[0] ?? "uthk.gpx";
const [h, m = 0] = (positional[1] ?? "15:30")
  .split(":")
  .map((part) => number(part, "Objectif"));
const targetTimeS = h * 3600 + m * 60;
const massKg = number(positional[2] ?? "70", "Masse");

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

// « nom@km », « km », avec des suffixes facultatifs dans n'importe quel
// ordre : « :8 » l'arrêt sur place en minutes, « =95 » la durée imposée au
// secteur qui s'y termine, « -eau » et « -solide » ce que la borne ne fournit
// pas — « nom@km:8=95-eau ». Une borne qui ne fournit pas ne rouvre pas la
// portée : ce qu'on porte doit tenir jusqu'à la suivante.
const aidStations: AidStation[] = (option("aidStations") ?? "")
  .split(",")
  .filter(Boolean)
  .map((raw, i) => {
    const [a, b] = raw.split("@");
    const full = b ?? a;
    const spec = full.replace(/-eau|-solide/g, "");
    const [km] = spec.split(/[:=]/);
    const stop = spec.match(/:([^:=]+)/)?.[1];
    const leg = spec.match(/=([^:=]+)/)?.[1];

    return {
      name: b === undefined ? `Ravito ${i + 1}` : a,
      distanceM: Number(km) * 1000,
      stopS: stop === undefined ? 0 : number(stop, "Arrêt au ravito") * 60,
      ...(full.includes("-eau") ? { providesLiquid: false } : {}),
      ...(full.includes("-solide") ? { providesSolid: false } : {}),
      // Absente plutôt que nulle : une durée imposée de zéro seconde est une
      // consigne, pas une absence de consigne.
      ...(leg === undefined
        ? {}
        : { legDurationS: number(leg, "Durée imposée") * 60 }),
    };
  });

// « 500,500w » : deux flasques de 500 mL, la seconde réservée à l'eau claire.
// Vide = contenance non déclarée, le noyau ne borne rien.
const flasks: Flask[] = (option("flasks") ?? "")
  .split(",")
  .filter(Boolean)
  .map((raw) => {
    const onlyWater = raw.trim().endsWith("w");

    return {
      volumeMl: number(
        onlyWater ? raw.trim().slice(0, -1) : raw,
        "Contenance de flasque",
      ),
      onlyWater,
    };
  });

const path = file.includes("/")
  ? new URL(file, `file://${process.cwd()}/`)
  : new URL(`../src/core/fixtures/references/${file}`, import.meta.url);

const trace = parseGpx(readFileSync(path, "utf8"));
const smoothed = prepareTrack(trace.points);

const endM = smoothed[smoothed.length - 1].d;

// Le dernier secteur se règle comme les autres, par une option à lui : aucun
// ravito ne le clôt, donc aucun ne peut porter sa consigne.
const finishRaw = option("finish");

// Arrondi et non troncature : l'accumulation flottante rend 7199,999… pour
// une durée imposée à 2 h, que tronquer afficherait « 1h59 ».
const hoursMinutes = (s: number) => {
  const minutes = Math.round(s / 60);

  return `${Math.floor(minutes / 60)}h${(minutes % 60)
    .toString()
    .padStart(2, "0")}`;
};

/**
 * Ce qu'on répond à un plan infaisable. Le noyau a constaté et chiffré ; les
 * mots et la correction proposée sont ici, comme pour les remarques.
 *
 * Sur les deux premiers cas, `issue.targetTimeS` est le temps de **mouvement**
 * disponible : ce que l'objectif brut lui retire est exactement la somme des
 * arrêts, qu'il faut rajouter pour proposer un objectif tenable. Proposer la
 * seule somme des durées réglées relancerait le même refus, les arrêts venant
 * s'en retrancher au tour suivant.
 *
 * Le troisième ne propose rien : au-dessus des arrêts, tout objectif convient,
 * et en choisir un pour l'utilisateur serait inventer son temps de course.
 */
function issuePhrase(issue: PacingIssue): string {
  /** L'objectif qui rendrait les durées réglées tenables. */
  const adjusted = (fixedS: number, availableS: number) => {
    const stopS = targetTimeS - availableS;

    return (
      `Ajuster le temps total à ${hoursMinutes(fixedS + stopS)}` +
      (stopS > 0
        ? ` (${hoursMinutes(fixedS)} + ${Math.round(stopS / 60)} min de ravitos)`
        : "") +
      " ?"
    );
  };

  switch (issue.code) {
    case "fixed-miss-target":
      return (
        `Le temps distribué n'est pas égal au temps réglé : ` +
        `${hoursMinutes(issue.targetTimeS)} disponibles pour ` +
        `${hoursMinutes(issue.fixedS)} réglés.\n` +
        adjusted(issue.fixedS, issue.targetTimeS)
      );
    case "fixed-above-target":
      return (
        `Le temps réglé (${hoursMinutes(issue.fixedS)}) est supérieur au ` +
        `temps de mouvement disponible (${hoursMinutes(issue.targetTimeS)}).\n` +
        adjusted(issue.fixedS, issue.targetTimeS)
      );
    case "stops-above-target":
      return (
        `Le temps de pauses aux ravitos (${hoursMinutes(issue.stopS)}) ` +
        `dépasse le temps de course (${hoursMinutes(issue.targetTimeS)}). ` +
        `Il faut un temps total supérieur à ${hoursMinutes(issue.stopS)}.`
      );
  }
}

// L'allure se place sur le temps de mouvement : les arrêts sont retranchés
// d'abord, puis réintroduits par `splitByAidStation` aux horaires de passage.
const timed = (() => {
  try {
    return distributeTime(
      smoothed,
      movingTimeS(targetTimeS, aidStations, endM),
      { climbIntensity: 0.25, split: 0.05 },
      fixedSpans(
        aidStations,
        endM,
        finishRaw === undefined
          ? undefined
          : number(finishRaw, "Durée imposée à l'arrivée") * 60,
      ),
    );
  } catch (error) {
    const issue = pacingIssue(error);
    // Une exception qui n'est pas un plan infaisable n'a rien à faire ici :
    // la déguiser en conseil masquerait un vrai bug.
    if (issue === null) throw error;

    console.error(`\n⚠  ${issuePhrase(issue)}\n`);
    process.exit(1);
  }
})();

const runner = { massKg, flasks };

// Les cibles sont des suggestions, jamais des consignes : chacune se remplace
// sans que rien ne soit écrêté — c'est `warnings` qui dit ce qu'il en pense.
const suggested = suggestedTargets(runner, targetTimeS);
const override = (name: string, what: string, fallback: number) => {
  const raw = option(name);

  return raw === undefined ? fallback : number(raw, what);
};

const targets: Targets = {
  carbsGH: override("carbs", "Glucides", suggested.carbsGH),
  fluidMlH: override("fluid", "Hydratation", suggested.fluidMlH),
  sodiumMgL: override("sodium", "Sodium", suggested.sodiumMgL),
};

const plan = nutritionPlan(timed, aidStations, runner, targets, products);

const minutesSeconds = (s: number) =>
  `${Math.floor(s / 60)}'${Math.round(s % 60)
    .toString()
    .padStart(2, "0")}`;

// Heure de départ, en secondes depuis minuit. `null` = non déclarée, et les
// passages restent en temps écoulé.
const startOfDayS = (() => {
  const raw = option("start");
  if (raw === undefined) return null;

  const [h, m = 0] = raw
    .split(":")
    .map((part) => number(part, "Heure de départ"));

  return h * 3600 + m * 60;
})();

/**
 * Un passage : à l'heure de la montre si le départ est connu, en temps écoulé
 * sinon. Sur un ultra qui franchit minuit, le jour est indiqué — « 2h14 +1j »
 * se lit sans compter sur ses doigts.
 */
const passage = (elapsedS: number) => {
  if (startOfDayS === null) return hoursMinutes(elapsedS);

  const total = Math.round((startOfDayS + elapsedS) / 60) * 60;
  const days = Math.floor(total / 86_400);
  const hh = Math.floor((total % 86_400) / 3600);
  const mm = Math.floor((total % 3600) / 60);

  return `${hh}h${mm.toString().padStart(2, "0")}${days > 0 ? ` +${days}j` : ""}`;
};

// Le noyau rend des données ; les mots sont ici, et nulle part ailleurs.
const legName = (s: Leg) => `${s.from ?? "Départ"} → ${s.to ?? "Arrivée"}`;
/** Une portée se nomme par ses deux bouts : elle peut couvrir plusieurs secteurs. */
const spanName = (from: number, through: number) =>
  `${plan.legs[from].from ?? "Départ"} → ${plan.legs[through].to ?? "Arrivée"}`;
const percent = (share: number) => `${Math.round(share * 100)} %`;
const typeName: Record<SegmentType, string> = {
  climb: "montée",
  descent: "descente",
  flat: "plat",
};
/** Les demies existent depuis `divisibleBy` : « 2,5 × barre ». */
const amount = (n: number) =>
  (n % 1 === 0 ? String(n) : n.toFixed(1).replace(".", ",")).padStart(4);

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
    case "carbs-above-target":
      return (
        `Le plan sert ${percent(w.share)} des glucides visés : une boisson ` +
        `concentrée traîne ses glucides avec le liquide. ` +
        `Viser plus haut, ou diluer moins — sinon le solide n'a plus sa place.`
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
    case "leg-fluid-above-carry":
      return (
        `${spanName(w.legIndex, w.throughLegIndex)} : ${Math.round(w.requiredMl)} mL à porter ` +
        `pour ${Math.round(w.carryMl)} mL de contenance. ` +
        `Il faudra boire au ravito ou puiser en route.`
      );
    case "leg-drink-above-flasks":
      return (
        `${spanName(w.legIndex, w.throughLegIndex)} : ${Math.round(w.drinkMl)} mL de boisson préparée ` +
        `pour ${Math.round(w.capacityMl)} mL de flasques qui l'acceptent. ` +
        `Le reste des contenants est réservé à l'eau claire.`
      );
    case "leg-drink-unused":
      return (
        `${legName(plan.legs[w.legIndex])} : aucune dose de boisson n'entre dans ce secteur, ` +
        `les ${Math.round(w.plainWaterMl)} mL partent en eau claire. ` +
        `Secteur trop court pour la dose, ou contenance trop faible.`
      );
  }
}

console.log(`\n${trace.name ?? file}`);

// Plusieurs traces dans le fichier : on les a combinées, on dit lesquelles et
// à quel point les raccords sont plausibles. ADR 009.
if (trace.sources.length > 1) {
  console.log(`   ${trace.sources.length} traces combinées :`);
  for (const [i, s] of trace.sources.entries()) {
    const join = trace.joins.find((j) => j.afterSource === i - 1);
    console.log(
      `     ${s.name ?? `Trace ${i + 1}`} · ${s.points.length} points` +
        (join ? ` · raccord de ${Math.round(join.gapM)} m` : ""),
    );
  }
}
console.log(
  `${(smoothed[smoothed.length - 1].d / 1000).toFixed(1)} km · ` +
    `objectif ${hoursMinutes(targetTimeS)}` +
    (plan.total.stopS > 0
      ? ` (${hoursMinutes(plan.total.durationS)} en mouvement + ${Math.round(
          plan.total.stopS / 60,
        )} min de ravitos)`
      : "") +
    ` · ${massKg} kg · ` +
    (startOfDayS === null
      ? ""
      : `départ ${passage(0)}, arrivée ${passage(targetTimeS)} · `) +
    `${targets.carbsGH} g/h, ${Math.round(targets.fluidMlH)} mL/h, ${targets.sodiumMgL} mg/L`,
);

// Les secteurs qui ouvrent une portée sont les seuls où l'on charge quoi que
// ce soit : ailleurs, on vit sur ce qu'on porte depuis l'amont.
const opensLiquid = new Set(plan.spans.liquid.map((span) => span[0]));
const opensSolid = new Set(plan.spans.solid.map((span) => span[0]));

for (const [l, s] of plan.legs.entries()) {
  console.log(`\n── ${legName(s)}`);
  console.log(
    `   ${(s.startM / 1000).toFixed(1)} → ${(s.endM / 1000).toFixed(1)} km · ` +
      `${(s.lengthM / 1000).toFixed(1)} km · ` +
      `+${Math.round(s.ascentM)} / −${Math.round(s.descentM)} m · ` +
      `${hoursMinutes(s.durationS)} (arrivée ${passage(s.arrivalS)})`,
  );
  console.log(
    `   besoin : ${Math.round(s.need.carbsG)} g de glucides, ` +
      `${Math.round(s.need.fluidMl)} mL, ${Math.round(s.need.sodiumMg)} mg de sodium`,
  );

  for (const r of s.servings) {
    console.log(
      `     ${amount(r.units)} × ${`${r.product.brand} ${r.product.name}`}`,
    );
  }
  if (!opensSolid.has(l)) {
    console.log(`          (solide pris plus tôt : rien à manger à ${s.from})`);
  }
  if (!opensLiquid.has(l)) {
    console.log(`          (rien à verser : pas d'eau à ${s.from})`);
  } else if (s.fills.length > 0) {
    for (const f of s.fills) {
      console.log(
        `          flasque ${f.flaskIndex + 1} : ${Math.round(f.volumeMl)} mL ` +
          `${f.product ? f.product.name : "d'eau claire"}`,
      );
    }
    if (s.refillMl > 0) {
      console.log(
        `          + ${Math.round(s.refillMl)} mL à boire au ravito ou à refaire en route`,
      );
    }
  } else if (s.plainWaterMl > 0) {
    console.log(`          + ${Math.round(s.plainWaterMl)} mL d'eau claire`);
  }
  console.log(
    `   apport : ${Math.round(s.supply.carbsG)} g` +
      // Signé : depuis l'ADR 007 un secteur peut être sous son besoin propre.
      (Math.abs(s.marginG) >= 1
        ? ` (${s.marginG > 0 ? "+" : "−"}${Math.round(Math.abs(s.marginG))} g)`
        : "") +
      `, ${Math.round(s.supply.energyKcal)} kcal, ` +
      `${Math.round(s.supply.sodiumMg)} mg de sodium, ` +
      `${Math.round(s.supply.fluidMl)} mL de boisson`,
  );
}

if (args.includes("--segments")) {
  const segments = timeSegments(
    timed,
    splitBySlope(
      smoothed,
      SETTINGS.splitToleranceM,
      SETTINGS.splitMinLengthM,
      SETTINGS.splitFlatMax,
    ),
  );

  console.log(`\n── Les temps de passage · ${segments.length} tronçons`);
  console.log(
    `        km        longueur    pente   terrain     durée   vitesse       VAM   passage`,
  );
  for (const s of segments) {
    console.log(
      `   ${(s.startM / 1000).toFixed(1).padStart(5)} → ${(s.endM / 1000).toFixed(1).padEnd(5)} ` +
        `${(s.lengthM / 1000).toFixed(2).padStart(6)} km ${(s.meanSlope * 100).toFixed(1).padStart(7)} %  ` +
        `${typeName[s.type].padEnd(8)} ${minutesSeconds(s.durationS).padStart(7)} ` +
        `${s.speedKmh.toFixed(1).padStart(6)} km/h ` +
        `${s.type === "climb" ? `${Math.round(s.vamMH).toString().padStart(5)} m/h` : "         "}   ` +
        `${passage(s.arrivalS)}`,
    );
  }
}

console.log(`\n── Le sac complet`);
for (const [id, units] of plan.total.units) {
  const p = productById(id);
  console.log(`   ${amount(units)} × ${p?.brand} ${p?.name}`);
}
console.log(
  `   ${Math.round(plan.total.carbsG)} g de glucides ` +
    `(+${Math.round(plan.total.marginG)} g de marge) · ` +
    `${Math.round(plan.total.energyKcal).toLocaleString("fr")} kcal · ` +
    `${Math.round(plan.total.sodiumMg)} mg de sodium · ` +
    `${Math.round(plan.total.fluidMl)} mL de boisson`,
);

if (plan.warnings.length > 0) {
  console.log("");
  for (const a of plan.warnings) console.log(`  ⚠  ${phrase(a)}`);
}
console.log("");
