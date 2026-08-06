import { Router } from "express";
import fs from "fs";
import path from "path";
import { and, desc, eq } from "drizzle-orm";
import { db, firekeeperMemories } from "@workspace/db";
import { logger } from "../lib/logger";

const router: Router = Router();

export interface MemoryItem {
  id: string;
  content: string;
  layer: "project" | "reflective" | "episodic" | "semantic";
  source: string;
  confidence: number;
  created_at: string;
}

// File-based persistent memory
const MEMORY_FILE = path.join(process.cwd(), "memory_store.json");

function memoryFileForUser(userId: string): string {
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(process.cwd(), `memory_store_${safeUserId}.json`);
}

function loadFileMemory(userId = "legacy"): MemoryItem[] {
  try {
    const file = userId === "legacy" ? MEMORY_FILE : memoryFileForUser(userId);
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    logger.error({ err }, "Failed to load memory store");
  }
  return [];
}

export type MemoryBackend = "postgres" | "file_fallback";

export async function loadMemoryWithBackend(userId = "legacy"): Promise<{ items: MemoryItem[]; backend: MemoryBackend }> {
  return loadMemoryForUser(userId);
}

export async function loadMemoryForUser(userId: string): Promise<{ items: MemoryItem[]; backend: MemoryBackend }> {
  try {
    const rows = await db
      .select()
      .from(firekeeperMemories)
      .where(eq(firekeeperMemories.userId, userId))
      .orderBy(desc(firekeeperMemories.createdAt));
    return {
      backend: "postgres",
      items: rows.map((row) => ({
        id: `Memory #${row.id}`,
        content: row.content,
        layer: row.layer as MemoryItem["layer"],
        source: row.source,
        confidence: row.confidence,
        created_at: row.createdAt.toISOString(),
      })),
    };
  } catch (err) {
    logger.error({ err }, "Failed to load PostgreSQL memory store; using file fallback");
    return { items: loadFileMemory(userId), backend: "file_fallback" };
  }
}

function saveMemory(items: MemoryItem[], userId = "legacy"): void {
  try {
    const file = userId === "legacy" ? MEMORY_FILE : memoryFileForUser(userId);
    fs.writeFileSync(file, JSON.stringify(items, null, 2), "utf-8");
  } catch (err) {
    logger.error({ err }, "Failed to save memory store");
  }
}

router.get("/", (req, res) => {
  loadMemoryForUser(req.userId!)
    .then(({ items, backend }) => res.json({ items, backend }))
    .catch((err) => res.status(500).json({ error: "memory store unavailable", detail: String(err) }));
});

router.post("/", async (req, res) => {
  const { content, layer, source } = req.body as {
    content?: string;
    layer?: string;
    source?: string;
  };

  if (!content) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  try {
      await db.insert(firekeeperMemories).values({
      userId: req.userId!,
      content,
      layer: layer ?? "project",
      source: source ?? "user_manual",
      confidence: 1,
    });
    const result = await loadMemoryForUser(req.userId!);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error({ err }, "Failed to write PostgreSQL memory store; using file fallback");
    const items = loadFileMemory(req.userId!);
    const newItem: MemoryItem = {
      id: `Memory #${items.length + 1}`,
      content,
      layer: (layer as MemoryItem["layer"]) ?? "project",
      source: source ?? "user_manual",
      confidence: 1,
      created_at: new Date().toISOString(),
    };
    items.push(newItem);
    saveMemory(items, req.userId!);
    res.json({ success: true, items, backend: "file_fallback" satisfies MemoryBackend });
  }
});

router.delete("/", async (req, res) => {
  const { content } = req.body as { content?: string };
  if (!content) {
    res.status(400).json({ error: "content is required" });
    return;
  }
  try {
    await db.delete(firekeeperMemories).where(and(
      eq(firekeeperMemories.userId, req.userId!),
      eq(firekeeperMemories.content, content),
    ));
    const result = await loadMemoryForUser(req.userId!);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error({ err }, "Failed to delete PostgreSQL memory; using file fallback");
    const items = loadFileMemory(req.userId!);
    const filtered = items.filter((i) => i.content !== content);
    saveMemory(filtered, req.userId!);
    res.json({ success: true, items: filtered, backend: "file_fallback" satisfies MemoryBackend });
  }
});

router.post("/clear", async (req, res) => {
  try {
    await db.delete(firekeeperMemories).where(eq(firekeeperMemories.userId, req.userId!));
    res.json({ success: true, items: [], backend: "postgres" satisfies MemoryBackend });
  } catch (err) {
    logger.error({ err }, "Failed to clear PostgreSQL memory; using file fallback");
    saveMemory([], req.userId!);
    res.json({ success: true, items: [], backend: "file_fallback" satisfies MemoryBackend });
  }
});

export default router;
