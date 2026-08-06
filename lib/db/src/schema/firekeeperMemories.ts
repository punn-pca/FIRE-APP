import { index, real, serial, text, timestamp, pgTable } from "drizzle-orm/pg-core";

export const firekeeperMemories = pgTable(
  "firekeeper_memories",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().default("legacy"),
    content: text("content").notNull(),
    layer: text("layer").notNull().default("project"),
    source: text("source").notNull().default("user_manual"),
    confidence: real("confidence").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("firekeeper_memories_user_id_idx").on(table.userId),
  }),
);

export type FirekeeperMemory = typeof firekeeperMemories.$inferSelect;
export type NewFirekeeperMemory = typeof firekeeperMemories.$inferInsert;