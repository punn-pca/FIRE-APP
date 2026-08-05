import { integer, real, serial, text, timestamp, pgTable } from "drizzle-orm/pg-core";

export const firekeeperMemories = pgTable("firekeeper_memories", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  layer: text("layer").notNull().default("project"),
  source: text("source").notNull().default("user_manual"),
  confidence: real("confidence").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FirekeeperMemory = typeof firekeeperMemories.$inferSelect;
export type NewFirekeeperMemory = typeof firekeeperMemories.$inferInsert;