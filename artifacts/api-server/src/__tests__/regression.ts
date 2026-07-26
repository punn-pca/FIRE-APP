/**
 * FIRE KEEPER — Regression Test Suite (item 10)
 *
 * Tests pure pipeline functions to guard against context-loss regressions.
 * Run with: pnpm --filter @workspace/api-server exec tsx src/__tests__/regression.ts
 */

import {
  detectLanguage,
  validateContext,
  detectConflicts,
  calculateConfidence,
  buildWorkingMemory,
  type ConversationTurn,
  type ContextValidation,
} from "../routes/analyze";

// ─── Minimal test runner ──────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function describe(suite: string, fn: () => void) {
  console.log(`\n${suite}`);
  fn();
}

// ─── 1. detectLanguage ────────────────────────────────────────────────────────

describe("detectLanguage", () => {
  assert("Thai text detected", detectLanguage("กาแฟดีต่อสุขภาพไหม") === "th");
  assert("English text detected", detectLanguage("Is coffee healthy?") === "en");
  assert("Mixed text → Thai wins", detectLanguage("coffee กาแฟ") === "th");
});

// ─── 3. validateContext ───────────────────────────────────────────────────────

describe("validateContext — thin input, no history", () => {
  const result = validateContext("โอเค", []);
  assert("Richness is thin", result.richness === "thin");
  assert("Missing signals populated", result.missingSignals.length > 0);
});

describe("validateContext — rich input (Thai, long)", () => {
  // 76 chars — should be rich
  const question =
    "ควรลงทุนในหุ้นเทคโนโลยีหรือพันธบัตรรัฐบาล เมื่อพิจารณาจากอัตราดอกเบี้ยที่สูงขึ้นและความผันผวนของตลาด";
  const result = validateContext(question, []);
  assert(
    "Richness is rich for long Thai question",
    result.richness === "rich",
    `got: ${result.richness} (charCount: ${question.trim().length})`
  );
  assert("No missing signals for rich input", result.missingSignals.length === 0);
});

describe("validateContext — short question with history", () => {
  const history: ConversationTurn[] = [
    { role: "user", content: "ฉันกำลังพิจารณาลงทุนระยะยาว" },
    { role: "assistant", content: "ดีครับ ลงทุนระยะยาวมีหลายรูปแบบ..." },
  ];
  const result = validateContext("แนะนำอะไรดี", history);
  assert(
    "Short question + history → at least moderate",
    result.richness !== "thin",
    `got: ${result.richness}`
  );
});

// ─── 6. detectConflicts ───────────────────────────────────────────────────────

describe("detectConflicts — no history", () => {
  const result = detectConflicts("ควรลงทุนหุ้น", []);
  assert("No conflicts with empty history", result.length === 0);
});

describe("detectConflicts — clear reversal", () => {
  const history: ConversationTurn[] = [
    { role: "user", content: "ควรซื้อหุ้นเทคโนโลยีไหม" },
    {
      role: "assistant",
      content:
        "จากข้อมูล [ข้อเท็จจริง] แนะนำว่าหุ้นเทคโนโลยีมีโอกาสเติบโตสูง",
    },
  ];
  const result = detectConflicts("ทำไมถึงไม่แนะนำหุ้นเทคโนโลยี", history);
  assert("Reversal pattern detected", result.length > 0);
});

describe("detectConflicts — consistent follow-up", () => {
  const history: ConversationTurn[] = [
    { role: "user", content: "กาแฟดีต่อสุขภาพไหม" },
    { role: "assistant", content: "ขึ้นอยู่กับปริมาณ [สมมติฐาน]..." },
  ];
  const result = detectConflicts("กาแฟมีผลต่อหัวใจอย่างไร", history);
  assert("No false positive on consistent follow-up", result.length === 0);
});

// ─── 8. calculateConfidence ───────────────────────────────────────────────────

describe("calculateConfidence — thin context, no history", () => {
  const ctx: ContextValidation = { richness: "thin", missingSignals: ["ขาดบริบท"] };
  const conf = calculateConfidence("โอเค", [], [], ctx, []);
  assert(
    "Thin context → ต่ำ or ไม่สามารถประเมินได้",
    conf === "ต่ำ" || conf === "ไม่สามารถประเมินได้",
    `got: ${conf}`
  );
});

describe("calculateConfidence — rich question + history", () => {
  const history: ConversationTurn[] = Array.from({ length: 6 }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: "ข้อความทดสอบบริบทที่ยาวพอสมควร สำหรับการทดสอบ",
  }));
  const ctx: ContextValidation = { richness: "rich", missingSignals: [] };
  const longQ =
    "ช่วยวิเคราะห์ว่าควรเลือกลงทุนในกองทุนรวมหุ้นระยะยาว หรือ ETF ตลาดหลักทรัพย์ไทย โดยพิจารณาจากความเสี่ยง สภาพคล่อง และผลตอบแทนย้อนหลัง 5 ปี";
  const conf = calculateConfidence(longQ, history, [], ctx, []);
  assert(
    "Rich context + history → ปานกลาง or สูง",
    conf === "ปานกลาง" || conf === "สูง",
    `got: ${conf}`
  );
});

describe("calculateConfidence — conflict penalises score", () => {
  const ctx: ContextValidation = { richness: "moderate", missingSignals: [] };
  const confNoConflict = calculateConfidence("คำถามยาวพอสมควรสำหรับบริบท", [], [], ctx, []);
  const confWithConflict = calculateConfidence("คำถามยาวพอสมควรสำหรับบริบท", [], [], ctx, [
    "ตรวจพบความขัดแย้ง",
  ]);
  const levels = ["ไม่สามารถประเมินได้", "ต่ำ", "ปานกลาง", "สูง"];
  const idxA = levels.indexOf(confNoConflict);
  const idxB = levels.indexOf(confWithConflict);
  assert(
    "Conflict reduces confidence or keeps it equal",
    idxA >= idxB,
    `no conflict: ${confNoConflict}, with conflict: ${confWithConflict}`
  );
});

// ─── 2. buildWorkingMemory ────────────────────────────────────────────────────

describe("buildWorkingMemory — empty history", () => {
  assert("Empty history → empty string", buildWorkingMemory([], "th") === "");
});

describe("buildWorkingMemory — respects last-8 limit", () => {
  const history: ConversationTurn[] = Array.from({ length: 12 }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `MSG_TURN_${String(i + 1).padStart(2, "0")}`,
  }));
  const result = buildWorkingMemory(history, "th");
  // Last 8 = turns 5-12 (indices 4-11), turns 1-4 must be absent
  assert("Contains last turn (12)", result.includes("MSG_TURN_12"));
  assert("Contains turn 5 (first of last 8)", result.includes("MSG_TURN_05"));
  assert("Does not contain turn 4 (outside window)", !result.includes("MSG_TURN_04"));
  assert("Does not contain turn 1", !result.includes("MSG_TURN_01"));
});

describe("buildWorkingMemory — truncates long content", () => {
  const longContent = "ก".repeat(500);
  const history: ConversationTurn[] = [{ role: "user", content: longContent }];
  const result = buildWorkingMemory(history, "th");
  assert("Long content truncated with ellipsis", result.includes("…"));
});

// ─── Multi-turn scenario (regression guard) ───────────────────────────────────

describe("Multi-turn scenario: context continuity", () => {
  // Simulate a 2-exchange conversation (4 turns)
  const history: ConversationTurn[] = [
    { role: "user", content: "ฉันกำลังวางแผนเกษียณอายุอีก 20 ปีข้างหน้า มีเงินออม 1 ล้านบาท" },
    {
      role: "assistant",
      content:
        "[ข้อเท็จจริง] ระยะเวลา 20 ปีเป็นขอบฟ้าการลงทุนระยะยาว [สมมติฐาน] สมมติว่าอัตราเงินเฟ้อเฉลี่ย 3%",
    },
    { role: "user", content: "ควรใส่เงินในหุ้นหรือพันธบัตรมากกว่ากัน" },
    {
      role: "assistant",
      content:
        "[ข้อเท็จจริง] ระยะ 20 ปีรองรับความเสี่ยงสูงได้ [สมมติฐาน] หากรับความเสี่ยงได้ หุ้นมีโอกาสผลตอบแทนสูงกว่า",
    },
  ];

  // Follow-up question: 37 chars — moderate on its own, but rich with history
  const followUp = "ควรปรับพอร์ตยังไงถ้าเศรษฐกิจถดถอย";

  const ctx = validateContext(followUp, history);
  assert("History makes context at least moderate", ctx.richness !== "thin", `got: ${ctx.richness}`);

  // With history (score +1) + char >= 20 (score +1) = score 2 → ปานกลาง
  const conf = calculateConfidence(followUp, history, [], ctx, []);
  assert(
    "Multi-turn conversation → ปานกลาง or สูง",
    conf === "ปานกลาง" || conf === "สูง",
    `got: ${conf}`
  );

  // Working memory should include all 4 prior turns (< 8 limit)
  const wm = buildWorkingMemory(history, "th");
  assert("Working memory includes first user turn", wm.includes("20 ปีข้างหน้า"));
  assert("Working memory includes last assistant turn", wm.includes("ความเสี่ยงได้"));
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error("❌ Regression tests FAILED");
  process.exit(1);
} else {
  console.log("✅ All regression tests passed");
  process.exit(0);
}
