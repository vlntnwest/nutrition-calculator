import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";

dotenv.config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("Missing database url in environment variables");
}

export const db = drizzle(DATABASE_URL);
