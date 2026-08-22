import { seed } from "@/db/seed";

// Une seule fois avant toute la suite. Trois fichiers de test ont besoin du
// catalogue ; les laisser le semer chacun de leur côté fait s'entre-bloquer
// des upserts concurrents sur les mêmes lignes.
export default async function setup() {
  await seed();
}
