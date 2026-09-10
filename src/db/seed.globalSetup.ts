import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "@/db";
import { seed } from "@/db/seed";

// Une seule fois avant toute la suite. Trois fichiers de test ont besoin du
// jeu d'essai ; les laisser le semer chacun de leur côté fait s'entre-bloquer
// des upserts concurrents sur les mêmes lignes.
//
// La migration est ici et non dans une étape à retenir : la base de test est
// distincte de celle de développement, et rien d'autre ne la tient à jour.
export default async function setup() {
  await migrate(db, { migrationsFolder: "drizzle" });
  await seed();
}
