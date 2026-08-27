import type { NewPlan } from "./planInput";

// On teste la persistance, pas le noyau — mais les ravitos tombent sur des
// points : une durée imposée ne se tient qu'à la résolution de la trace, et
// l'intervalle qui enjambe une borne dilue la consigne sur toute sa longueur.
export const newPlan = {
  track: {
    name: "Saverne Trail",
    distanceM: 28350,
    ascentM: 1314,
    points: [
      { d: 0, lat: 48.7411, lon: 7.3623, ele: 200 },
      { d: 9800, lat: 48.7466, lon: 7.3668, ele: 380 },
      { d: 14175, lat: 48.7502, lon: 7.3701, ele: 420 },
      { d: 20800, lat: 48.7455, lon: 7.3662, ele: 300 },
      { d: 28350, lat: 48.7411, lon: 7.3623, ele: 210 },
    ],
  },
  settings: {
    massKg: 70,
    targetTimeS: 13500,
    climbIntensity: 0.25,
    paceSplit: 0.05,
    raceDate: "2026-10-11",
    startTime: "08:00",
    targets: { carbsGH: 60, fluidMlH: 490, sodiumMgL: 600 },
  },
  flasks: [
    { volumeMl: 500, onlyWater: false },
    { volumeMl: 500, onlyWater: true },
  ],
  aidStations: [
    { name: "Ravito Haberacker", distanceM: 9800, stopS: 300 },
    { name: "Ravito Ochsenstein", distanceM: 20800, stopS: 240 },
  ],
  legOverrides: [],
  productCodes: ["naak-gel-ultra", "decathlon-iso-plus"],
} satisfies NewPlan;
