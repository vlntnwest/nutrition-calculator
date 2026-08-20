import { primaryKey, snakeCase, timestamp, uuid } from "drizzle-orm/pg-core";

export const plans = snakeCase.table(
  "plans",
  {
    accessId: uuid().defaultRandom(),
    createdAt: timestamp({
      precision: 6,
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    lastSavedAt: timestamp({
      precision: 6,
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    generatedAt: timestamp({
      precision: 6,
      withTimezone: true,
    }),
  },
  (table) => [
    primaryKey({
      name: "plans_pk",
      columns: [table.accessId],
    }),
  ],
);
