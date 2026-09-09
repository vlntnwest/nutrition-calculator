import { drizzle } from "drizzle-orm/node-postgres";
import { databaseUrl } from "./env";

export const db = drizzle(databaseUrl);

/** La poignée d'une transaction, telle que `db.transaction` la passe. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
