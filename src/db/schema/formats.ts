import { sql } from "drizzle-orm";
import { check, primaryKey, snakeCase, text, uuid } from "drizzle-orm/pg-core";

export const formats = snakeCase.table(
  "formats",
  {
    id: uuid().defaultRandom().notNull(),
    label: text().notNull().unique(),
  },
  (table) => [
    primaryKey({
      name: "formats_pk",
      columns: [table.id],
    }),
    check("formats_label_not_empty", sql`${table.label} != ''`),
  ],
);
