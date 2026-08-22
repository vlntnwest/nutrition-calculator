import { sql } from "drizzle-orm";
import { check, primaryKey, snakeCase, text, uuid } from "drizzle-orm/pg-core";

export const brands = snakeCase.table(
  "brands",
  {
    id: uuid().defaultRandom().notNull(),
    name: text().notNull(),
    affiliateUrl: text(),
    websiteUrl: text(),
  },
  (table) => [
    primaryKey({
      name: "brands_pk",
      columns: [table.id],
    }),
    check("brands_name_not_empty", sql`${table.name} != ''`),
  ],
);
