/**
 * Development PostgreSQL integration test for personal-memory isolation.
 *
 * Run with:
 *   pnpm --filter @workspace/api-server run test:memory-isolation
 *
 * The test uses synthetic Clerk user IDs and always removes its rows.
 * It must never be pointed at a production DATABASE_URL.
 */
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { db, firekeeperMemories, pool } from "@workspace/db";
import { loadMemoryForUser } from "../routes/memory";

const suffix = `${Date.now()}-${process.pid}`;
const userA = `integration-user-a-${suffix}`;
const userB = `integration-user-b-${suffix}`;
const contentA = `integration-memory-a-${suffix}`;
const contentB = `integration-memory-b-${suffix}`;

async function run(): Promise<void> {
  try {
    await db.insert(firekeeperMemories).values([
      { userId: userA, content: contentA, layer: "semantic", source: "integration_test", confidence: 1 },
      { userId: userB, content: contentB, layer: "semantic", source: "integration_test", confidence: 1 },
    ]);

    const firstA = await loadMemoryForUser(userA);
    const firstB = await loadMemoryForUser(userB);
    assert.equal(firstA.backend, "postgres");
    assert.equal(firstB.backend, "postgres");
    assert.deepEqual(firstA.items.map((item) => item.content), [contentA]);
    assert.deepEqual(firstB.items.map((item) => item.content), [contentB]);

    await db.delete(firekeeperMemories).where(and(
      eq(firekeeperMemories.userId, userA),
      eq(firekeeperMemories.content, contentA),
    ));
    const afterDeleteA = await loadMemoryForUser(userA);
    const afterDeleteB = await loadMemoryForUser(userB);
    assert.equal(afterDeleteA.items.some((item) => item.content === contentA), false);
    assert.equal(afterDeleteB.items.some((item) => item.content === contentB), true);

    await db.delete(firekeeperMemories).where(eq(firekeeperMemories.userId, userA));
    const afterClearA = await loadMemoryForUser(userA);
    const afterClearB = await loadMemoryForUser(userB);
    assert.equal(afterClearA.items.length, 0);
    assert.equal(afterClearB.items.some((item) => item.content === contentB), true);

    console.log("✅ Personal memory isolation passed for two synthetic users");
  } finally {
    await db.delete(firekeeperMemories).where(
      eq(firekeeperMemories.userId, userA),
    );
    await db.delete(firekeeperMemories).where(
      eq(firekeeperMemories.userId, userB),
    );
    await pool.end();
  }
}

run().catch((error) => {
  console.error("❌ Personal memory isolation failed", error);
  process.exitCode = 1;
});