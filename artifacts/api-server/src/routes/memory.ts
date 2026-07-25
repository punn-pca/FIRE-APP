import { Router } from "express";
import fs from "fs";
import path from "path";
import { logger } from "../lib/logger";

const router: Router = Router();

interface MemoryItem {
  id: string;
  content: string;
  layer: "project" | "reflective" | "episodic" | "semantic";
  source: string;
  confidence: number;
  created_at: string;
}

// File-based persistent memory
const MEMORY_FILE = path.join(process.cwd(), "memory_store.json");

function loadMemory(): MemoryItem[] {
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

function saveMemory(items: MemoryItem[]): void {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(items, null, 2), "utf-8");
  } catch (err) {
    logger.error({ err }, "Failed to save memory store");
  }
}

router.get("/", (_req, res) => {
  const items = loadMemory();
  res.json({ items });
});

router.post("/", (req, res) => {
  const { content, layer, source } = req.body as {
    content?: string;
    layer?: string;
    source?: string;
  };

  if (!content) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const items = loadMemory();
  const newItem: MemoryItem = {
    id: `Memory #${items.length + 1}`,
    content,
    layer: (layer as MemoryItem["layer"]) ?? "project",
    source: source ?? "user_manual",
    confidence: 1.0,
    created_at: new Date().toISOString(),
  };
  items.push(newItem);
  saveMemory(items);
  res.json({ success: true, items });
});

router.delete("/", (req, res) => {
  const { content } = req.body as { content?: string };
  if (!content) {
    res.status(400).json({ error: "content is required" });
    return;
  }
  const items = loadMemory();
  const filtered = items.filter((i) => i.content !== content);
  saveMemory(filtered);
  res.json({ success: true, items: filtered });
});

router.post("/clear", (_req, res) => {
  saveMemory([]);
  res.json({ success: true, items: [] });
});

export default router;
