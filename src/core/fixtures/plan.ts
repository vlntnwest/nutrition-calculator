import { sampleProductById } from "@/fixtures/sampleProducts";
import type {
  AidStation,
  Product,
  Runner,
  Targets,
  TimedPoint,
} from "../type.ts";

/** Contenance non déclarée : le noyau ne borne rien et n'alerte sur rien. */
export const RUNNER: Runner = { massKg: 70, flasks: [] };
export const TARGETS: Targets = { carbsGH: 60, fluidMlH: 500, sodiumMgL: 600 };

/** Une trace plate de `km` kilomètres, parcourue en `heures`. */
export function flatTrack(km: number, hours: number): TimedPoint[] {
  const points: TimedPoint[] = [];
  for (let i = 0; i <= km * 100; i++) {
    points.push({
      d: i * 10,
      ele: 0,
      t: (i / (km * 100)) * hours * 3600,
    });
  }

  return points;
}

export const gel = sampleProductById("naak-gel-ultra") as Product;
export const drink = sampleProductById("naak-drink-ultra") as Product;
export const baouwGel = sampleProductById("baouw-gel") as Product;
export const baouwBar = sampleProductById("baouw-bar-extra") as Product;

/**
 * Un ravito sans eau ne rouvre pas le portage : la **portée** court jusqu'au
 * point d'eau suivant, et c'est elle que la contenance doit couvrir.
 */
export const WATER_STOP: AidStation = {
  name: "Point d'eau",
  distanceM: 10_000,
};
export const DRY_STOP: AidStation = {
  name: "Passage sec",
  distanceM: 20_000,
  providesLiquid: false,
};

/** Deux flasques : 1 000 mL en tout, dont 500 pour la boisson. */
export const CARRIER: Runner = {
  massKg: 70,
  flasks: [
    { volumeMl: 500, onlyWater: false },
    { volumeMl: 500, onlyWater: true },
  ],
};
