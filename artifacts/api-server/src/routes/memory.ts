import { Router } from "express";
import fs from "fs";
import path from "path";
import { desc, eq } from "drizzle-orm";
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

function loadFileMemory(): MemoryItem[] {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      const raw = fs.readFileSync(MEMORY_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    logger.error({ err }, "Failed to load memory store");
  }
  return [];
}

export type MemoryBackend = "postgres" | "file_fallback";

export async function loadMemoryWithBackend(): Promise<{ items: MemoryItem[]; backend: MemoryBackend }> {
  try {
    const rows = await db.select().from(firekeeperMemories).orderBy(desc(firekeeperMemories.createdAt));
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
    return { items: loadFileMemory(), backend: "file_fallback" };
  }
}

function saveMemory(items: MemoryItem[]): void {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(items, null, 2), "utf-8");
  } catch (err) {
    logger.error({ err }, "Failed to save memory store");
  }
}

router.get("/", (_req, res) => {
  loadMemoryWithBackend()
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
      content,
      layer: layer ?? "project",
      source: source ?? "user_manual",
      confidence: 1,
    });
    const result = await loadMemoryWithBackend();
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error({ err }, "Failed to write PostgreSQL memory store; using file fallback");
    const items = loadFileMemory();
    const newItem: MemoryItem = {
      id: `Memory #${items.length + 1}`,
      content,
      layer: (layer as MemoryItem["layer"]) ?? "project",
      source: source ?? "user_manual",
      confidence: 1,
      created_at: new Date().toISOString(),
    };
    items.push(newItem);
    saveMemory(items);
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
    await db.delete(firekeeperMemories).where(eq(firekeeperMemories.content, content));
    const result = await loadMemoryWithBackend();
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error({ err }, "Failed to delete PostgreSQL memory; using file fallback");
    const items = loadFileMemory();
    const filtered = items.filter((i) => i.content !== content);
    saveMemory(filtered);
    res.json({ success: true, items: filtered, backend: "file_fallback" satisfies MemoryBackend });
  }
});

router.post("/clear", async (_req, res) => {
  try {
    await db.delete(firekeeperMemories);
    res.json({ success: true, items: [], backend: "postgres" satisfies MemoryBackend });
  } catch (err) {
    logger.error({ err }, "Failed to clear PostgreSQL memory; using file fallback");
    saveMemory([]);
    res.json({ success: true, items: [], backend: "file_fallback" satisfies MemoryBackend });
  }
});

export default router;
