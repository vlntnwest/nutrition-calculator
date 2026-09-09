import { defineConfig } from "drizzle-kit";
import { migrationUrl } from "./src/db/env";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema",
  out: "./drizzle",
  dbCredentials: {
    url: migrationUrl,
  },
});
