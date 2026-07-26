import { Router } from "express";
import OpenAI from "openai";
import { logger } from "../lib/logger";

const router: Router = Router();

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TraceEntry {
  stage: string;
  timestamp: string;
  output: Record<string, unknown>;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface PCAState {
  user_input: string;
  language: "th" | "en";
  observations: string[];
  understanding: string;
  purpose: string;
  constraints: string[];
  memories: Array<{ content: string; layer: string; source: string; confidence: number }>;
  hypotheses: Array<{ claim: string; confidence: number }>;
  evidence: string[];
  critique: string[];
  uncertainty: string[];
  decision: string;
  response: string;
  reflection: string[];
  learning: string[];
  agency_checks: string[];
  notes: string[];
  confidence: "สูง" | "ปานกลาง" | "ต่ำ" | "ไม่สามารถประเมินได้";
  conflicts: string[];
  missing_info: string[];
  trace: TraceEntry[];
  llm_provider: string;
  llm_model: string;
  execution_time_ms: number;
  start_time: string;
  end_time: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const THAI_REGEX = /[\u0E00-\u0E7F]/;
export function detectLanguage(text: string): "th" | "en" {
  return THAI_REGEX.test(text) ? "th" : "en";
}

function record(state: PCAState, stage: string, output: Record<string, unknown>) {
  state.trace.push({ stage, timestamp: new Date().toISOString(), output });
}

// ─── 2. Working Memory: compact history summary ───────────────────────────────

export function buildWorkingMemory(history: ConversationTurn[], lang: "th" | "en"): string {
  if (history.length === 0) return "";
  // Take last 8 turns (4 exchanges), truncate each to 300 chars to stay concise
  return history
    .slice(-8)
    .map((t) => {
      const role = t.role === "user"
        ? (lang === "th" ? "ผู้ใช้" : "User")
        : "FIRE KEEPER";
      return `${role}: ${t.content.slice(0, 300)}${t.content.length > 300 ? "…" : ""}`;
    })
    .join("\n---\n");
}

// ─── 3. Context Validation ────────────────────────────────────────────────────

export interface ContextValidation {
  richness: "rich" | "moderate" | "thin";
  missingSignals: string[];
}

export function validateContext(
  question: string,
  history: ConversationTurn[]
): ContextValidation {
  const q = question.trim();
  // Thai doesn't separate words with spaces consistently — use character count
  const charCount = q.length;
  const wordCount = q.split(/\s+/).filter(Boolean).length;
  const hasHistory = history.length > 0;
  const hasSpecifics = /\d|ชื่อ|วันที่|จำนวน|ราคา|how|when|where|who|why|what|\?/i.test(q);

  const missingSignals: string[] = [];

  // "Short" = both char count AND word count are small (avoids false positives on Thai)
  if (charCount < 15 && wordCount < 4 && !hasHistory) {
    missingSignals.push("คำถามสั้นมาก — ต้องการบริบทเพิ่มเติม");
  }
  if (!hasSpecifics && charCount < 35 && !hasHistory) {
    missingSignals.push("ขาดรายละเอียดเฉพาะเจาะจง (เหตุการณ์, เงื่อนไข, ตัวเลข)");
  }

  // Use char count as the primary richness signal for Thai/mixed text
  const richness: ContextValidation["richness"] =
    charCount >= 55 || (hasHistory && charCount >= 12)
      ? "rich"
      : charCount >= 20 || hasHistory
      ? "moderate"
      : "thin";

  return { richness, missingSignals };
}

// ─── 6. Conflict Detection ────────────────────────────────────────────────────

export function detectConflicts(question: string, history: ConversationTurn[]): string[] {
  const prevAssistant = history.filter((h) => h.role === "assistant").slice(-3);
  if (prevAssistant.length === 0) return [];

  const conflicts: string[] = [];
  const reversalPatterns = [
    { a: /แนะนำ|ควร(?!จะ)|เหมาะสม/i, b: /ไม่แนะนำ|ไม่ควร|ไม่เหมาะสม/i },
    { a: /ปลอดภัย|เชื่อถือได้/i, b: /ไม่ปลอดภัย|เชื่อถือไม่ได้/i },
    { a: /ดีกว่า|เหนือกว่า/i, b: /แย่กว่า|ด้อยกว่า/i },
  ];

  for (const prev of prevAssistant) {
    for (const { a, b } of reversalPatterns) {
      const prevSaysA = a.test(prev.content) && !b.test(prev.content);
      const questionSaysB = b.test(question);
      const prevSaysB = b.test(prev.content) && !a.test(prev.content);
      const questionSaysA = a.test(question);
      if ((prevSaysA && questionSaysB) || (prevSaysB && questionSaysA)) {
        conflicts.push(
          "ตรวจพบแนวโน้มขัดแย้งกับการวิเคราะห์ก่อนหน้า — กำลังตรวจสอบความสอดคล้อง"
        );
        break;
      }
    }
  }
  return [...new Set(conflicts)];
}

// ─── 8. Evidence-based Confidence ────────────────────────────────────────────

export function calculateConfidence(
  question: string,
  history: ConversationTurn[],
  memories: PCAState["memories"],
  context: ContextValidation,
  conflicts: string[]
): PCAState["confidence"] {
  let score = 0;

  // Input richness — use char count (Thai doesn't split cleanly by whitespace)
  const charCount = question.trim().length;
  if (charCount >= 55) score += 2;
  else if (charCount >= 20) score += 1;

  // Conversation depth — more history = more context available
  if (history.length >= 6) score += 2;
  else if (history.length >= 2) score += 1;

  // Long-term memory items
  if (memories.length >= 3) score += 1;
  else if (memories.length >= 1) score += 0.5;

  // Context richness
  if (context.richness === "rich") score += 1;
  else if (context.richness === "thin") score -= 2;

  // Penalise for missing signals
  score -= context.missingSignals.length;

  // Penalise for detected conflicts (uncertain which answer is correct)
  score -= conflicts.length;

  if (score >= 4) return "สูง";
  if (score >= 2) return "ปานกลาง";
  if (score >= 0) return "ต่ำ";
  return "ไม่สามารถประเมินได้";
}

// ─── Cognitive Stages ─────────────────────────────────────────────────────────

function stageObservation(state: PCAState) {
  state.observations.push(state.user_input.trim());
  state.language = detectLanguage(state.user_input);
  record(state, "OBSERVATION", { observations: state.observations });
}

function stageUnderstanding(state: PCAState) {
  const input = state.user_input.toLowerCase();
  const isDecision = /ตัดสินใจ|เลือก|decision|choose/i.test(input);
  const isComparison = /เปรียบเทียบ|เทียบ|compare|vs|ดีกว่า/i.test(input);
  const isPhilosophy = /ปรัชญา|จริยธรรม|philosophy|ethics|moral/i.test(input);
  const isAI = /ai|ปัญญาประดิษฐ์|alignment|safety|agi/i.test(input);

  if (isDecision) {
    state.understanding =
      state.language === "th"
        ? "ผู้ใช้กำลังเปรียบเทียบทางเลือกต่าง ๆ และต้องการแนวทางช่วยในการตัดสินใจ"
        : "The user is weighing alternative paths and requires structured decision support.";
  } else if (isComparison) {
    state.understanding =
      state.language === "th"
        ? "ผู้ใช้ต้องการเปรียบเทียบความแตกต่างและข้อดีข้อเสียเพื่อมุมมองที่รอบด้าน"
        : "The user wants to compare options and trade-offs for a comprehensive perspective.";
  } else if (isPhilosophy) {
    state.understanding =
      state.language === "th"
        ? "ผู้ใช้ต้องการถกประเด็นปรัชญาหรือจริยธรรมอย่างลึกซึ้ง"
        : "The user seeks philosophical or ethical exploration.";
  } else if (isAI) {
    state.understanding =
      state.language === "th"
        ? "ผู้ใช้กำลังพิจารณาประเด็นด้าน AI และความปลอดภัยของระบบ"
        : "The user is examining AI alignment, ethics, or system safety.";
  } else {
    state.understanding =
      state.language === "th"
        ? "ผู้ใช้ต้องการวิเคราะห์และประเมินข้อมูล เพื่อทำความเข้าใจสถานการณ์และหาแนวทาง"
        : "The user wants to analyze information to clarify context and find the best way forward.";
  }
  record(state, "UNDERSTANDING", { understanding: state.understanding });
}

function stagePurpose(state: PCAState) {
  state.purpose =
    state.language === "th"
      ? `ช่วยวิเคราะห์ ตรวจสอบข้อมูล และเสนอทางเลือกให้คุณตัดสินใจได้อย่างรอบคอบเกี่ยวกับ: "${state.user_input.slice(0, 80)}"`
      : `Analyze evidence and present options for: "${state.user_input.slice(0, 80)}"`;
  state.constraints = [
    state.language === "th"
      ? "คงไว้ซึ่งเสรีภาพในการตัดสินใจของมนุษย์ (Human Agency)"
      : "Preserve human agency and final decision authority.",
    state.language === "th"
      ? "อ้างอิงหลักฐานเชิงประจักษ์และระบุระดับความมั่นใจอย่างโปร่งใส"
      : "Base conclusions on empirical evidence with explicit confidence levels.",
  ];
  record(state, "PURPOSE", { purpose: state.purpose, constraints: state.constraints });
}

function stageMemoryRetrieval(state: PCAState, memoryItems: PCAState["memories"]) {
  state.memories = memoryItems.slice(0, 5);
  record(state, "MEMORY", { retrieved: state.memories.length });
}

function stageMentalModel(state: PCAState) {
  record(state, "MENTAL_MODEL", {
    model: "PCA 12-Stage Cognitive Pipeline",
    framework: "PUNN FIRE (Fact · Inference · Risk · Evidence)",
  });
}

function stageHypotheses(state: PCAState) {
  state.hypotheses = [
    {
      claim:
        state.language === "th"
          ? "สมมติฐานหลัก: ข้อมูลเบื้องต้นที่ผู้ใช้ให้มามีความถูกต้องและสมบูรณ์เพียงพอ"
          : "Primary assumption: User-provided information is reasonably accurate and complete.",
      confidence: 0.75,
    },
    {
      claim:
        state.language === "th"
          ? "สมมติฐานรอง: มีตัวแปรบริบทภายนอกที่อาจส่งผลต่อผลลัพธ์ของการวิเคราะห์"
          : "Secondary assumption: External contextual variables may influence the analysis outcome.",
      confidence: 0.6,
    },
  ];
  record(state, "HYPOTHESIS", { hypotheses: state.hypotheses });
}

function stageEvidenceEvaluation(state: PCAState, history: ConversationTurn[]) {
  state.evidence = [
    state.language === "th"
      ? "หลักฐานเชิงประจักษ์จากข้อมูลที่ผู้ใช้ระบุมาในคำถาม"
      : "Empirical evidence from user-provided input",
    state.language === "th"
      ? "หลักฐานอ้างอิงจากฐานความรู้และมาตรฐานสากลที่เกี่ยวข้อง"
      : "Evidence from established knowledge base and international standards",
  ];
  if (history.length > 0) {
    state.evidence.push(
      state.language === "th"
        ? `บริบทจากประวัติการสนทนา (${history.length} รายการ)`
        : `Context from conversation history (${history.length} turns)`
    );
  }
  record(state, "EVIDENCE_EVALUATION", { evidence: state.evidence, history_turns: history.length });
}

function stageCritique(state: PCAState, context: ContextValidation) {
  state.critique = [
    state.language === "th"
      ? "ข้อจำกัด: การวิเคราะห์นี้ตั้งอยู่บนข้อมูลที่ผู้ใช้ให้มา หากข้อมูลไม่ครบถ้วนอาจส่งผลต่อความแม่นยำ"
      : "Limitation: This analysis is based on user-provided context; incomplete data may reduce accuracy.",
    state.language === "th"
      ? "ความเสี่ยง: อาจมี Confirmation Bias ในการตีความข้อมูลที่นำเสนอ"
      : "Risk: Potential Confirmation Bias in interpreting the presented information.",
  ];

  // 3. Context Validation — surface missing info as critique
  state.missing_info = context.missingSignals;
  if (context.missingSignals.length > 0) {
    state.critique.push(
      state.language === "th"
        ? `ข้อมูลที่ขาด: ${context.missingSignals.join("; ")}`
        : `Missing information: ${context.missingSignals.join("; ")}`
    );
  }

  const uncertaintyLevel = context.richness === "thin" ? "สูง" : "ปานกลาง";
  state.uncertainty = [
    state.language === "th"
      ? `ระดับความไม่แน่นอน: ${uncertaintyLevel} — ขึ้นอยู่กับตัวแปรบริบทที่ยังไม่ได้รับการยืนยัน`
      : `Uncertainty Level: ${uncertaintyLevel === "สูง" ? "High" : "Medium"} — depends on unconfirmed contextual variables.`,
  ];
  record(state, "CRITIQUE", {
    critique: state.critique,
    uncertainty: state.uncertainty,
    missing_info: state.missing_info,
  });
}

function stageDecision(
  state: PCAState,
  history: ConversationTurn[],
  memories: PCAState["memories"],
  context: ContextValidation,
  conflicts: string[]
) {
  state.decision =
    state.language === "th"
      ? "เสนอข้อสรุปเชิงยุทธศาสตร์ที่แยกแยะระหว่างข้อเท็จจริงและการตีความ พร้อมระบุขอบเขตและข้อจำกัด"
      : "Present strategic conclusions distinguishing facts from interpretations, with explicit scope and limitations.";

  // 8. Evidence-based confidence
  state.confidence = calculateConfidence(state.user_input, history, memories, context, conflicts);
  state.conflicts = conflicts;

  record(state, "DECISION", {
    decision: state.decision,
    confidence: state.confidence,
    conflicts,
    context_richness: context.richness,
  });
}

function stageReflection(state: PCAState) {
  state.reflection = [
    state.language === "th"
      ? "กระบวนการคิดครบถ้วนตามกรอบ PCA 12 ขั้นตอน"
      : "Cognitive process completed following the 12-stage PCA framework.",
    state.language === "th"
      ? "การตัดสินใจขั้นสุดท้ายอยู่กับผู้ใช้เสมอ (Human Agency Preserved)"
      : "Final decision authority remains with the human user (Human Agency Preserved).",
  ];
  if (state.conflicts.length > 0) {
    state.reflection.push(
      state.language === "th"
        ? "มีการตรวจสอบความสอดคล้องกับบทสนทนาก่อนหน้า"
        : "Self-consistency check performed against prior conversation."
    );
  }
  record(state, "REFLECTION", { reflection: state.reflection });
}

function stageLearning(state: PCAState) {
  state.learning = [
    state.language === "th"
      ? `บทเรียน: ประเด็น "${state.user_input.slice(0, 50)}..." ต้องการการวิเคราะห์หลักฐานหลายชั้น`
      : `Lesson: The topic "${state.user_input.slice(0, 50)}..." requires multi-layer evidence analysis.`,
  ];
  state.agency_checks = [
    state.language === "th"
      ? "ผู้ใช้ยังคงเป็นผู้ตัดสินใจขั้นสุดท้าย — ระบบทำหน้าที่สนับสนุนเท่านั้น"
      : "User remains the final decision-maker — this system provides support only.",
    state.language === "th"
      ? "ดำเนินการทดสอบหรือยืนยันข้อมูลเพิ่มเติมก่อนตัดสินใจครั้งสำคัญ"
      : "Seek additional verification before making critical decisions.",
  ];
  record(state, "LEARNING", { learning: state.learning });
}

// ─── Communication Prompt ─────────────────────────────────────────────────────

function buildSystemPrompt(
  state: PCAState,
  tone: string,
  deepReasoning: boolean,
  personalContext: string,
  workingMemory: string,
  context: ContextValidation,
  conflicts: string[]
): string {
  let toneInstruction = "";
  if (tone === "Formal Architect") {
    toneInstruction =
      "TONE: Formal Architect — ใช้ภาษาทางการ เป็นระบบ สุขุม เน้นโครงสร้างเชิงนามธรรม ระบุขอบเขตเหตุผลอย่างรัดกุม หลีกเลี่ยงคำบรรยายเวิ่นเว้อ";
  } else if (tone === "Empathetic Guide") {
    toneInstruction =
      "TONE: Empathetic Guide — ใช้ภาษาอบอุ่น เป็นมิตร เป็นกันเอง เข้าใจง่าย สื่อสารเหมือนเพื่อนที่ไว้วางใจได้";
  } else if (tone === "Direct Expert") {
    toneInstruction =
      "TONE: Direct Expert — ตอบตรงประเด็น กระชับ ชัดเจน ระบุข้อเสนอโดยไม่อ้อมค้อม";
  }

  // 1+2. Conversation history & working memory
  const historySection = workingMemory
    ? `\n── ประวัติการสนทนา (Working Memory) ──\n${workingMemory}\n──────────────────────────────────────`
    : "";

  // Long-term memory store
  const memorySection =
    state.memories.length > 0
      ? `\nMemory Context:\n${state.memories.map((m, i) => `${i + 1}. [${m.layer}] ${m.content}`).join("\n")}`
      : "";

  const personalCtx = personalContext ? `\nUser Personal Context: ${personalContext}` : "";

  // 3. Context validation warning
  const contextWarning =
    context.missingSignals.length > 0
      ? `\n⚠️ บริบทที่ได้รับ: ${context.richness === "thin" ? "น้อยมาก" : "ปานกลาง"}\nข้อมูลที่ขาด: ${context.missingSignals.join(", ")}`
      : "";

  // 6. Conflict flags
  const conflictWarning =
    conflicts.length > 0
      ? `\n⚠️ ตรวจพบความขัดแย้งที่อาจเกิดขึ้น: ${conflicts.join("; ")}\nกรุณาตรวจสอบความสอดคล้องก่อนตอบ`
      : "";

  // 5. Fact/Assumption/Missing separation — 7. Self-consistency — 9. Graceful fallback
  const coreRules = `
กฎสำคัญ (บังคับทุกข้อ):
- ตอบเป็นภาษาไทยเป็นหลัก ห้ามใช้ภาษาจีน
- ห้ามตัดสินใจแทนผู้ใช้
- แยกประเภทข้อมูลด้วย label ดังนี้:
  · [ข้อเท็จจริง] — ยืนยันได้จากหลักฐาน
  · [สมมติฐาน] — อนุมาน ยังไม่พิสูจน์
  · [ข้อมูลที่ขาด] — ต้องการแต่ไม่มี ให้ระบุและขอเพิ่มเติม
- 4. ห้ามให้ความมั่นใจสูง (สูง) เมื่อข้อมูลไม่เพียงพอ ให้ระบุ "ต่ำ" หรือ "ไม่สามารถประเมินได้" แทน
- 9. Graceful Fallback: หากข้อมูลไม่พอ ให้ระบุ [ข้อมูลที่ขาด] และเสนอสมมติฐานชัดเจน ห้ามเดาโดยไม่แจ้ง
- 7. Self-Consistency: หากมีประวัติการสนทนา ต้องตรวจสอบว่าคำตอบใหม่ไม่ขัดแย้งกับที่เคยให้ไว้ หากต้องเปลี่ยนจุดยืนให้อธิบายเหตุผลชัดเจน`;

  if (deepReasoning) {
    return `คุณคือ FIRE KEEPER ระบบวิเคราะห์ปัญญาประดิษฐ์ตามกรอบ PUNN Cognitive Architecture (PCA) — Full Deep Analysis Mode

${toneInstruction}${historySection}${memorySection}${personalCtx}${contextWarning}${conflictWarning}
${coreRules}

คุณต้องวิเคราะห์เชิงลึกเต็มรูปแบบ โดยใช้กรอบ FIRE:
- **F**act: ข้อเท็จจริงเชิงประจักษ์
- **I**nference: การอนุมานและตีความ
- **R**isk: ความเสี่ยงและข้อจำกัด
- **E**vidence: หลักฐานอ้างอิง

โครงสร้างรายงานที่ต้องมี:
### # ข้อมูลและหลักฐาน (Information & Evidence Matrix)
จำแนก [ข้อเท็จจริง] / [สมมติฐาน] / [ข้อมูลที่ขาด] ระบุระดับความมั่นใจ (สูง/ปานกลาง/ต่ำ)

### # ข้อโต้แย้งและความเสี่ยง (Counter Evidence & Critique)
ชี้จุดอ่อน ข้อแย้ง หรือความเสี่ยงสำคัญ

### # สมมติฐานและผลกระทบ (Key Assumptions & Failure Impact)
ระบุ [สมมติฐาน] หลักและผลกระทบหากพลาด

### # ข้อจำกัดและ [ข้อมูลที่ขาด] (Limitations & Knowledge Gaps)
ระบุสิ่งที่ยังพิสูจน์ไม่ได้และข้อมูลที่ต้องการเพิ่ม

### # ห่วงโซ่เหตุผล (Causal Chain & Uncertainty)
[ต้นเหตุ] → [กลไก] → [ผลลัพธ์] พร้อมระดับความไม่แน่นอน

### # ทางเลือกและข้อแลกเปลี่ยน (Strategic Options & Trade-offs)
เสนอ 2-3 ทางเลือก พร้อม Pros/Cons/Risks

### # ข้อสรุปเชิงยุทธศาสตร์ (Strategic Conclusion)
สรุปคำแนะนำพร้อมระดับความมั่นใจ (สูง/ปานกลาง/ต่ำ) ไม่ตัดสินใจแทน

[DECISION_SUMMARY]: สรุปข้อเสนอแนะสั้น ๆ (1-2 ประโยค)`;
  }

  return `คุณคือ FIRE KEEPER ระบบวิเคราะห์ปัญญาประดิษฐ์ตามกรอบ PUNN Cognitive Architecture (PCA)

${toneInstruction}${historySection}${memorySection}${personalCtx}${contextWarning}${conflictWarning}
${coreRules}

กรอบการวิเคราะห์ PUNN FIRE:
- Fact First: แยก [ข้อเท็จจริง] ออกจาก [สมมติฐาน]
- Inference-based Reasoning: ใช้เหตุผลจากหลักฐาน
- Risk & Reflection: ประเมินความเสี่ยงและข้อจำกัด
- Evidence Evaluation: ประเมินน้ำหนักหลักฐาน

โครงสร้างคำตอบ:
### 1. การสังเกตการณ์และทำความเข้าใจ (Observation & Understanding)
วิเคราะห์บริบทและเจตนาของผู้ใช้

### 2. ข้อสรุปเชิงยุทธศาสตร์ (Strategic Analysis)
วิเคราะห์หลักฐาน แยก [ข้อเท็จจริง] / [สมมติฐาน] / [ข้อมูลที่ขาด] ระบุระดับความมั่นใจ

### 3. ข้อจำกัดและทางเลือก (Boundaries & Options)
ระบุข้อจำกัด ความเสี่ยง และเสนอทางเลือก 2-3 แนว

[DECISION_SUMMARY]: สรุปข้อเสนอแนะสั้น ๆ พร้อมระดับความมั่นใจ`;
}

// ─── Route ────────────────────────────────────────────────────────────────────

interface AnalyzeRequest {
  question: string;
  tone?: string;
  deepReasoning?: boolean;
  personalContext?: string;
  memories?: PCAState["memories"];
  history?: ConversationTurn[]; // 1. Conversation Memory
}

router.post("/", async (req, res) => {
  const {
    question,
    tone = "Formal Architect",
    deepReasoning = false,
    personalContext = "",
    memories = [],
    history = [],
  } = req.body as AnalyzeRequest;

  if (!question?.trim()) {
    res.status(400).json({ error: "question is required" });
    return;
  }

  const startTime = new Date().toISOString();
  const startMs = Date.now();

  const state: PCAState = {
    user_input: question.trim(),
    language: "th",
    observations: [],
    understanding: "",
    purpose: "",
    constraints: [],
    memories: [],
    hypotheses: [],
    evidence: [],
    critique: [],
    uncertainty: [],
    decision: "",
    response: "",
    reflection: [],
    learning: [],
    agency_checks: [],
    notes: [],
    confidence: "ปานกลาง",
    conflicts: [],
    missing_info: [],
    trace: [],
    llm_provider: "openai",
    llm_model: "gpt-4o",
    execution_time_ms: 0,
    start_time: startTime,
    end_time: "",
  };

  try {
    // Pre-pipeline analysis
    const context = validateContext(question, history);          // 3
    const conflicts = detectConflicts(question, history);        // 6

    // Cognitive pipeline
    stageObservation(state);
    stageUnderstanding(state);
    stagePurpose(state);
    stageMemoryRetrieval(state, memories);
    stageMentalModel(state);
    stageHypotheses(state);
    stageEvidenceEvaluation(state, history);                     // 1 — history-aware
    stageCritique(state, context);                               // 3 — context validation
    stageDecision(state, history, memories, context, conflicts); // 6+8 — conflict + confidence

    // 2. Working memory summary for system prompt
    const workingMemory = buildWorkingMemory(history, state.language);

    // LLM Communication stage — 1+7: pass history as messages for context + self-consistency
    const systemPrompt = buildSystemPrompt(
      state, tone, deepReasoning, personalContext,
      workingMemory, context, conflicts
    );

    // Build message array: system + history turns (last 10) + current question
    const historyMessages: OpenAI.Chat.ChatCompletionMessageParam[] = history
      .slice(-10)
      .map((t) => ({ role: t.role, content: t.content }));

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        ...historyMessages,
        { role: "user", content: question },
      ],
      max_completion_tokens: deepReasoning ? 3000 : 1800,
      temperature: 0.7,
    });

    const responseText =
      completion.choices[0]?.message?.content ?? "ไม่สามารถประมวลผลได้ในขณะนี้";
    state.response = responseText;
    state.llm_model = completion.model ?? "gpt-4o";
    state.notes.push(`LLM: openai (${state.llm_model})`);

    record(state, "COMMUNICATION", { response_length: responseText.length });

    stageReflection(state);
    stageLearning(state);

    state.end_time = new Date().toISOString();
    state.execution_time_ms = Date.now() - startMs;

    res.json({
      response: state.response,
      pcaState: {
        notes: state.notes,
        observations: state.observations,
        understanding: state.understanding,
        purpose: state.purpose,
        decision: state.decision,
        confidence: state.confidence,
        conflicts: state.conflicts,
        missing_info: state.missing_info,
        critique: state.critique,
        reflection: state.reflection,
        learning: state.learning,
        agency_checks: state.agency_checks,
        trace: state.trace,
        llm_provider: state.llm_provider,
        llm_model: state.llm_model,
        execution_time_ms: state.execution_time_ms,
        start_time: state.start_time,
        end_time: state.end_time,
      },
    });
  } catch (err) {
    logger.error({ err }, "Analyze error");
    const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
    res.status(500).json({ error: errorMessage });
  }
});

export default router;
