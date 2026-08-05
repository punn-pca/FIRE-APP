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
  started_at: string;
  ended_at: string;
  duration_ms: number;
  measured: boolean;
  output: Record<string, unknown>;
}

type RuntimePhase =
  | "BOOT"
  | "READY"
  | "UNDERSTAND"
  | "PLAN"
  | "REASON"
  | "VERIFY"
  | "RESPOND"
  | "REFLECT";

interface RuntimeEvent {
  phase: RuntimePhase;
  action: string;
  timestamp: string;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  measured: boolean;
}

interface GovernanceReport {
  status: "ผ่าน" | "ต้องตรวจสอบ" | "หยุด";
  policy: string[];
  safety_checks: string[];
  human_agency_preserved: boolean;
}

export interface EvidenceItem {
  id: string;
  source: "user_input" | "conversation_history" | "memory";
  text: string;
  relevance_score: number;
  quality_score: number;
  consistency_score: number;
  composite_score: number;
  basis: string[];
}

export interface EvidenceReport {
  methodology: string;
  items: EvidenceItem[];
  aggregate_score: number;
  coverage_score: number;
}

export interface ConflictFinding {
  id: string;
  type: "reversal" | "inconsistency";
  severity: "ต่ำ" | "ปานกลาง" | "สูง";
  current_signal: string;
  prior_signal: string;
  evidence: string;
  score: number;
}

export interface VerificationCheck {
  criterion: string;
  rule: string;
  passed: boolean;
  evidence: string;
  score: number;
}

export interface ConfidenceReport {
  score: number;
  band: PCAState["confidence"];
  method: string;
  components: Record<string, number>;
  verification_score: number;
}

export interface ModuleAudit {
  module: string;
  algorithm: string;
  input_count: number;
  score?: number;
  findings: string[];
  calculations: Record<string, number | string | boolean>;
}

interface VerificationReport {
  status: "ผ่าน" | "ต้องตรวจสอบ";
  consistency: "สอดคล้อง" | "ต้องทบทวน";
  expected: string[];
  observed: string[];
  checks: string[];
  detailed_checks: VerificationCheck[];
  score: number;
}

interface KnowledgeMap {
  facts: string[];
  assumptions: string[];
  unknowns: string[];
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
  memories: Array<{
    content: string;
    layer: string;
    source: string;
    confidence: number;
    retrieval_score?: number;
  }>;
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
  conflict_findings: ConflictFinding[];
  missing_info: string[];
  evidence_report: EvidenceReport;
  confidence_report: ConfidenceReport;
  module_audit: ModuleAudit[];
  runtime_lifecycle: RuntimeEvent[];
  governance: GovernanceReport;
  verification: VerificationReport;
  knowledge_map: KnowledgeMap;
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

function record(state: PCAState, stage: string, output: Record<string, unknown>, duration_ms = 0) {
  const timestamp = new Date().toISOString();
  state.trace.push({
    stage,
    timestamp,
    started_at: timestamp,
    ended_at: timestamp,
    duration_ms,
    measured: false,
    output,
  });
}

function recordMeasured(
  state: PCAState,
  stage: string,
  output: Record<string, unknown>,
  started_at: string,
  ended_at: string,
  duration_ms: number
) {
  state.trace.push({
    stage,
    timestamp: started_at,
    started_at,
    ended_at,
    duration_ms,
    measured: true,
    output,
  });
}

function monotonicMs(): number {
  return Number(process.hrtime.bigint()) / 1_000_000;
}

/** Wraps a synchronous stage fn and stamps its wall-clock duration onto any
 *  trace entries the fn appended. Date timestamps are for display; duration
 *  comes from a monotonic clock so fast stages are not rounded to fake 0ms. */
function timed(state: PCAState, fn: () => void): void {
  const before = state.trace.length;
  const startedAt = new Date().toISOString();
  const startedMono = monotonicMs();
  fn();
  const endedAt = new Date().toISOString();
  const ms = Number((monotonicMs() - startedMono).toFixed(3));
  for (let i = before; i < state.trace.length; i++) {
    state.trace[i].timestamp = startedAt;
    state.trace[i].started_at = startedAt;
    state.trace[i].ended_at = endedAt;
    state.trace[i].duration_ms = ms;
    state.trace[i].measured = true;
  }
}

function recordRuntime(
  state: PCAState,
  phase: RuntimePhase,
  action: string,
  duration_ms: number,
  started_at = new Date().toISOString(),
  ended_at = new Date().toISOString(),
  measured = true
) {
  state.runtime_lifecycle.push({
    phase,
    action,
    timestamp: started_at,
    started_at,
    ended_at,
    duration_ms,
    measured,
  });
}

function tokenize(text: string): string[] {
  const normalized = text.toLowerCase();
  const tokens: string[] = [];
  const thaiStopBigrams = new Set([
    "การ", "ของ", "ที่", "มี", "ไม่", "และ", "ใน", "กับ", "เป็น", "จาก",
    "ให้", "ได้", "ว่า", "นี้", "จะ", "ต้อง", "หรือ", "อีก", "โดย", "เพื่อ",
    "ความ", "แล้ว", "แต่", "ตาม", "เมื่อ", "อย่าง", "อาจ", "ควร",
  ]);
  for (const segment of normalized.match(/[\u0E00-\u0E7F]+|[a-z0-9]+/gi) ?? []) {
    if (/^[\u0E00-\u0E7F]+$/.test(segment)) {
      // Thai has no reliable whitespace token boundaries. Character bigrams
      // preserve shared terms across inflected/compound phrases.
      for (let i = 0; i < segment.length - 1; i++) {
        const bigram = segment.slice(i, i + 2);
        if (!thaiStopBigrams.has(bigram)) tokens.push(bigram);
      }
    } else {
      tokens.push(segment);
    }
  }
  return [...new Set(tokens)];
}

function overlapScore(query: string, candidate: string): number {
  const queryTokens = tokenize(query);
  const candidateTokens = new Set(tokenize(candidate));
  if (queryTokens.length === 0 || candidateTokens.size === 0) return 0;
  return Number(
    (queryTokens.filter((token) => candidateTokens.has(token)).length / queryTokens.length).toFixed(3)
  );
}

const MEMORY_RELEVANCE_THRESHOLD = 0.25;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function analyzeConflictFindings(
  question: string,
  history: ConversationTurn[]
): ConflictFinding[] {
  const prevAssistant = history.filter((h) => h.role === "assistant").slice(-3);
  const findings: ConflictFinding[] = [];
  const reversalPatterns = [
    { type: "reversal" as const, a: /แนะนำ|ควร(?!จะ)|เหมาะสม/i, b: /ไม่แนะนำ|ไม่ควร|ไม่เหมาะสม/i },
    { type: "reversal" as const, a: /ปลอดภัย|เชื่อถือได้/i, b: /ไม่ปลอดภัย|เชื่อถือไม่ได้/i },
    { type: "reversal" as const, a: /ดีกว่า|เหนือกว่า/i, b: /แย่กว่า|ด้อยกว่า/i },
  ];

  for (const [index, prev] of prevAssistant.entries()) {
    for (const pattern of reversalPatterns) {
      const prevSaysA = pattern.a.test(prev.content) && !pattern.b.test(prev.content);
      const questionSaysB = pattern.b.test(question);
      const prevSaysB = pattern.b.test(prev.content) && !pattern.a.test(prev.content);
      const questionSaysA = pattern.a.test(question);
      if ((prevSaysA && questionSaysB) || (prevSaysB && questionSaysA)) {
        findings.push({
          id: `conflict-${index + 1}`,
          type: pattern.type,
          severity: "ปานกลาง",
          current_signal: question.slice(0, 120),
          prior_signal: prev.content.slice(0, 160),
          evidence: "พบสัญญาณเชิงบวกและเชิงลบต่อประเด็นเดียวกันจากข้อความต่างช่วง",
          score: 0.65,
        });
        break;
      }
    }
  }
  return findings;
}

export function buildEvidenceReport(
  question: string,
  history: ConversationTurn[],
  memories: PCAState["memories"],
  conflictFindings: ConflictFinding[] = []
): EvidenceReport {
  const items: EvidenceItem[] = [];
  const addItem = (
    id: string,
    source: EvidenceItem["source"],
    text: string,
    relevance_score: number,
    quality_score: number,
    basis: string[]
  ) => {
    const consistency_score = clamp01(1 - conflictFindings.length * 0.15);
    const composite_score = Number(
      (relevance_score * 0.45 + quality_score * 0.35 + consistency_score * 0.2).toFixed(3)
    );
    items.push({
      id,
      source,
      text: text.slice(0, 240),
      relevance_score: Number(relevance_score.toFixed(3)),
      quality_score: Number(quality_score.toFixed(3)),
      consistency_score: Number(consistency_score.toFixed(3)),
      composite_score,
      basis,
    });
  };

  addItem(
    "evidence-input",
    "user_input",
    question,
    1,
    question.trim().length >= 55 ? 0.8 : question.trim().length >= 20 ? 0.6 : 0.35,
    ["แหล่งข้อมูลโดยตรงจากคำถาม", "ไม่มีการตรวจสอบจากแหล่งภายนอก"]
  );

  history.slice(-6).forEach((turn, index) => {
    const relevance = overlapScore(question, turn.content);
    if (relevance > 0 || history.length <= 2) {
      addItem(
        `evidence-history-${index + 1}`,
        "conversation_history",
        turn.content,
        relevance,
        0.55,
        ["ข้อความจาก conversation memory", `role=${turn.role}`, "ความเกี่ยวข้องคำนวณจาก token overlap"]
      );
    }
  });

  memories
    .map((memory, index) => ({
      memory,
      relevance: overlapScore(question, memory.content),
      index,
    }))
    .filter(({ relevance }) => relevance >= MEMORY_RELEVANCE_THRESHOLD)
    .forEach(({ memory, relevance, index }) => {
      addItem(
        `evidence-memory-${index + 1}`,
        "memory",
        memory.content,
        relevance,
        clamp01(memory.confidence),
        ["ข้อมูลจาก long-term memory", `confidence=${memory.confidence}`, "ความเกี่ยวข้องคำนวณจาก token overlap"]
      );
    });

  const aggregate_score = items.length
    ? Number((items.reduce((sum, item) => sum + item.composite_score, 0) / items.length).toFixed(3))
    : 0;
  const coverage_score = Number(
    clamp01(
      (items.filter((item) => item.source !== "user_input" && item.relevance_score > 0).length + 1) /
      (history.length > 0 || memories.length > 0 ? 3 : 1)
    ).toFixed(3)
  );
  return {
    methodology: "composite = relevance×0.45 + source_quality×0.35 + consistency×0.20; relevance ใช้ token overlap",
    items,
    aggregate_score,
    coverage_score,
  };
}

export function buildConfidenceReport(
  state: PCAState,
  verificationScore = 0
): ConfidenceReport {
  const contextScore = state.notes.some((note) => note.includes("context"))
    ? 0.5
    : state.knowledge_map.unknowns.length === 0
      ? 1
      : 0.45;
  const inputScore = clamp01(state.user_input.trim().length / 55);
  const historyScore = clamp01(state.memories.length > 0 ? 0.75 : state.evidence_report.items.some(
    (item) => item.source === "conversation_history"
  ) ? 0.6 : 0);
  const memoryScore = clamp01(
    state.memories.length === 0
      ? 0
      : state.memories.reduce((sum, memory) => sum + (memory.retrieval_score ?? 0), 0) / state.memories.length
  );
  const evidenceScore = state.evidence_report.aggregate_score;
  const conflictPenalty = clamp01(state.conflict_findings.length * 0.2);
  const missingPenalty = clamp01(state.missing_info.length * 0.15);
  const score = Number(
    (100 * clamp01(
      inputScore * 0.15 +
      contextScore * 0.15 +
      historyScore * 0.1 +
      memoryScore * 0.1 +
      evidenceScore * 0.25 +
      verificationScore * 0.25 -
      conflictPenalty * 0.1 -
      missingPenalty * 0.1
    )).toFixed(1)
  );
  const band: PCAState["confidence"] =
    score >= 75 ? "สูง" :
    score >= 50 ? "ปานกลาง" :
    score >= 25 ? "ต่ำ" :
    "ไม่สามารถประเมินได้";
  return {
    score,
    band,
    method: "input 15% + context 15% + history 10% + memory 10% + evidence 25% + verification 25% − conflict/missing penalties",
    components: {
      input_quality: Number(inputScore.toFixed(3)),
      context_quality: Number(contextScore.toFixed(3)),
      history_support: Number(historyScore.toFixed(3)),
      memory_support: Number(memoryScore.toFixed(3)),
      evidence_quality: evidenceScore,
      conflict_penalty: Number(conflictPenalty.toFixed(3)),
      missing_information_penalty: Number(missingPenalty.toFixed(3)),
    },
    verification_score: Number(verificationScore.toFixed(3)),
  };
}

function buildGovernanceReport(
  context: ContextValidation,
  conflicts: string[]
): GovernanceReport {
  const needsReview = context.missingSignals.length > 0 || conflicts.length > 0;
  return {
    status: needsReview ? "ต้องตรวจสอบ" : "ผ่าน",
    policy: [
      "Truth before certainty — ไม่สร้างความมั่นใจเกินหลักฐาน",
      "Evidence before opinion — แยกหลักฐานออกจากการตีความ",
      "Human agency before automation — ผู้ใช้ตัดสินใจขั้นสุดท้าย",
    ],
    safety_checks: [
      context.missingSignals.length > 0
        ? "บริบทไม่ครบ — ลดความมั่นใจและระบุข้อมูลที่ขาด"
        : "ตรวจสอบบริบทเบื้องต้นแล้ว",
      conflicts.length > 0
        ? "พบความขัดแย้ง — ต้องทบทวนความสอดคล้อง"
        : "ไม่พบความขัดแย้งจากประวัติการสนทนา",
      "ไม่มีการตัดสินใจแทนผู้ใช้",
    ],
    human_agency_preserved: true,
  };
}

function buildKnowledgeMap(
  state: PCAState,
  context: ContextValidation
): KnowledgeMap {
  return {
    facts: [
      state.language === "th"
        ? `ข้อมูลที่ผู้ใช้ระบุ: ${state.user_input}`
        : `User-provided input: ${state.user_input}`,
      ...state.evidence,
    ],
    assumptions: state.hypotheses.map((hypothesis) => hypothesis.claim),
    unknowns: [
      ...context.missingSignals,
      ...state.uncertainty,
    ],
  };
}

function buildVerificationReport(
  state: PCAState,
  responseText: string
): VerificationReport {
  const checks: string[] = [];
  const detailed_checks: VerificationCheck[] = [];
  const hasFactLabel = /\[ข้อเท็จจริง\]|\[Fact\]/i.test(responseText);
  const hasAssumptionLabel = /\[สมมติฐาน\]|\[Assumption\]/i.test(responseText);
  const preservesAgency = /ผู้ใช้|ตัดสินใจขั้นสุดท้าย|human agency|final decision/i.test(
    responseText
  );
  const surfacesMissingInfo =
    state.missing_info.length === 0 ||
    state.missing_info.some((missing) => responseText.includes(missing)) ||
    /\[ข้อมูลที่ขาด\]|\[missing information\]|ข้อมูลที่ต้องการเพิ่ม/i.test(responseText);
  const acknowledgesEvidence =
    state.evidence_report.items.length === 0 ||
    /\[ข้อเท็จจริง\]|\[fact\]|หลักฐาน|evidence/i.test(responseText);
  const acknowledgesConflicts =
    state.conflict_findings.length === 0 ||
    /ขัดแย้ง|ทบทวน|สอดคล้อง|conflict|consistency|review/i.test(responseText);

  checks.push(
    hasFactLabel
      ? "พบการแยกข้อเท็จจริง"
      : "ไม่พบ label ข้อเท็จจริงครบถ้วน — ควรตรวจสอบ"
  );
  checks.push(
    hasAssumptionLabel
      ? "พบการแยกสมมติฐาน"
      : "ไม่พบ label สมมติฐานครบถ้วน — ควรตรวจสอบ"
  );
  checks.push(
    preservesAgency
      ? "ยืนยัน Human Agency"
      : "ไม่พบข้อความยืนยัน Human Agency — ควรตรวจสอบ"
  );
  if (state.missing_info.length > 0) {
    checks.push("มีข้อมูลที่ขาดและถูกส่งต่อเพื่อให้ผู้ใช้ตรวจสอบ");
  }

  detailed_checks.push(
    {
      criterion: "fact_label",
      rule: "response ต้องมี [ข้อเท็จจริง] หรือ [Fact]",
      passed: hasFactLabel,
      evidence: hasFactLabel ? "พบ label ใน response" : "ไม่พบ label ที่กำหนด",
      score: hasFactLabel ? 1 : 0,
    },
    {
      criterion: "assumption_label",
      rule: "response ต้องมี [สมมติฐาน] หรือ [Assumption]",
      passed: hasAssumptionLabel,
      evidence: hasAssumptionLabel ? "พบ label ใน response" : "ไม่พบ label ที่กำหนด",
      score: hasAssumptionLabel ? 1 : 0,
    },
    {
      criterion: "human_agency",
      rule: "response ต้องยืนยันว่าผู้ใช้เป็นผู้ตัดสินใจขั้นสุดท้าย",
      passed: preservesAgency,
      evidence: preservesAgency ? "พบข้อความรักษา Human Agency" : "ไม่พบข้อความยืนยัน",
      score: preservesAgency ? 1 : 0,
    },
    {
      criterion: "missing_information",
      rule: "เมื่อมีข้อมูลขาด ต้องระบุข้อมูลนั้นหรือใช้ label [ข้อมูลที่ขาด]",
      passed: surfacesMissingInfo,
      evidence: surfacesMissingInfo ? "response สะท้อนข้อมูลที่ขาด" : "ไม่พบข้อมูลที่ขาดใน response",
      score: surfacesMissingInfo ? 1 : 0,
    },
    {
      criterion: "evidence_alignment",
      rule: "response ต้องอ้างถึงหลักฐานหรือข้อเท็จจริงที่ pipeline ประเมินไว้",
      passed: acknowledgesEvidence,
      evidence: acknowledgesEvidence
        ? `เชื่อมกับ evidence ${state.evidence_report.items.length} รายการ`
        : "ไม่พบการอ้างหลักฐาน",
      score: acknowledgesEvidence ? 1 : 0,
    },
    {
      criterion: "conflict_acknowledgement",
      rule: "เมื่อพบ conflict ต้องมีข้อความให้ทบทวนความสอดคล้อง",
      passed: acknowledgesConflicts,
      evidence: acknowledgesConflicts
        ? "response สะท้อนสถานะความสอดคล้อง"
        : "ไม่พบการกล่าวถึง conflict",
      score: acknowledgesConflicts ? 1 : 0,
    }
  );

  const score = detailed_checks.reduce((sum, check) => sum + check.score, 0) / detailed_checks.length;
  const allCoreChecksPass = detailed_checks.every((check) => check.passed);
  const consistent = state.conflicts.length === 0;
  return {
    status: allCoreChecksPass && consistent && score >= 0.8 ? "ผ่าน" : "ต้องตรวจสอบ",
    consistency: consistent ? "สอดคล้อง" : "ต้องทบทวน",
    expected: [
      "แยกข้อเท็จจริง สมมติฐาน และข้อมูลที่ขาด",
      "ไม่ตัดสินใจแทนผู้ใช้",
      "ตรวจสอบความสอดคล้องกับบริบทเดิม",
    ],
    observed: [
      hasFactLabel ? "มีข้อเท็จจริง" : "ไม่พบข้อเท็จจริงที่ติดป้ายชัดเจน",
      hasAssumptionLabel ? "มีสมมติฐาน" : "ไม่พบสมมติฐานที่ติดป้ายชัดเจน",
      preservesAgency ? "รักษา Human Agency" : "ต้องตรวจสอบ Human Agency",
    ],
    checks,
    detailed_checks,
    score: Number(score.toFixed(3)),
  };
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
  const tokens = tokenize(state.user_input);
  const charCount = state.user_input.trim().length;
  state.observations.push(state.user_input.trim());
  state.language = detectLanguage(state.user_input);
  state.module_audit.push({
    module: "Observation",
    algorithm: "language detection + Unicode tokenization + input completeness counters",
    input_count: 1,
    score: Number(clamp01(charCount / 55).toFixed(3)),
    findings: [
      `ตรวจพบภาษา: ${state.language}`,
      `ความยาว input: ${charCount} ตัวอักษร`,
      `จำนวน token ที่ไม่ซ้ำ: ${tokens.length}`,
    ],
    calculations: {
      character_count: charCount,
      unique_token_count: tokens.length,
      thai_detected: state.language === "th",
      completeness_score: Number(clamp01(charCount / 55).toFixed(3)),
    },
  });
  record(state, "OBSERVATION", {
    observations: state.observations,
    character_count: charCount,
    unique_token_count: tokens.length,
    detected_language: state.language,
  });
}

function stageUnderstanding(state: PCAState) {
  const input = state.user_input.toLowerCase();
  const intentScores = {
    decision: (input.match(/ตัดสินใจ|เลือก|decision|choose/gi) ?? []).length,
    comparison: (input.match(/เปรียบเทียบ|เทียบ|compare|vs|ดีกว่า/gi) ?? []).length,
    philosophy: (input.match(/ปรัชญา|จริยธรรม|philosophy|ethics|moral/gi) ?? []).length,
    ai_safety: (input.match(/ai|ปัญญาประดิษฐ์|alignment|safety|agi/gi) ?? []).length,
  };
  const [selectedIntent] = Object.entries(intentScores).sort(([, a], [, b]) => b - a);
  const isDecision = intentScores.decision > 0;
  const isComparison = intentScores.comparison > 0;
  const isPhilosophy = intentScores.philosophy > 0;
  const isAI = intentScores.ai_safety > 0;

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
  state.module_audit.push({
    module: "Understanding",
    algorithm: "keyword feature scoring with deterministic priority classification",
    input_count: tokenize(state.user_input).length,
    score: selectedIntent?.[1] ? Number(clamp01(selectedIntent[1] / 3).toFixed(3)) : 0,
    findings: [
      `intent ที่มีคะแนนสูงสุด: ${selectedIntent?.[0] ?? "general"}`,
      `คะแนน intent: ${selectedIntent?.[1] ?? 0}`,
    ],
    calculations: {
      selected_intent: selectedIntent?.[0] ?? "general",
      decision_score: intentScores.decision,
      comparison_score: intentScores.comparison,
      philosophy_score: intentScores.philosophy,
      ai_safety_score: intentScores.ai_safety,
    },
  });
  record(state, "UNDERSTANDING", {
    understanding: state.understanding,
    intent_scores: intentScores,
    selected_intent: selectedIntent?.[0] ?? "general",
  });
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
  const ranked = memoryItems
    .map((memory) => ({
      ...memory,
      retrieval_score: overlapScore(state.user_input, memory.content),
    }))
    .sort((a, b) => (b.retrieval_score ?? 0) - (a.retrieval_score ?? 0));
  state.memories = ranked
    .filter((memory) => (memory.retrieval_score ?? 0) >= MEMORY_RELEVANCE_THRESHOLD)
    .slice(0, 5);
  const averageScore = state.memories.length
    ? state.memories.reduce((sum, memory) => sum + (memory.retrieval_score ?? 0), 0) / state.memories.length
    : 0;
  state.module_audit.push({
    module: "Memory Retrieval",
    algorithm: "ranked lexical retrieval: unique token overlap(query, memory)",
    input_count: memoryItems.length,
    score: Number(averageScore.toFixed(3)),
    findings: state.memories.length > 0
      ? state.memories.map((memory, index) => `อันดับ ${index + 1}: score ${(memory.retrieval_score ?? 0).toFixed(3)}`)
      : ["ไม่พบ memory ที่มี token ร่วมกับคำถาม"],
    calculations: {
      candidate_count: memoryItems.length,
      retrieved_count: state.memories.length,
      average_retrieval_score: Number(averageScore.toFixed(3)),
      top_score: Number((state.memories[0]?.retrieval_score ?? 0).toFixed(3)),
    },
  });
  record(state, "MEMORY", {
    retrieved: state.memories.length,
    candidates: memoryItems.length,
    ranked_scores: state.memories.map((memory) => memory.retrieval_score),
    algorithm: "token_overlap",
  });
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

function stageEvidenceEvaluation(
  state: PCAState,
  history: ConversationTurn[]
) {
  state.evidence_report = buildEvidenceReport(
    state.user_input,
    history,
    state.memories,
    state.conflict_findings
  );
  state.evidence = state.evidence_report.items.map(
    (item) => `[${item.source}] ${item.text} (score=${item.composite_score})`
  );
  state.module_audit.push({
    module: "Evidence Evaluation",
    algorithm: state.evidence_report.methodology,
    input_count: state.evidence_report.items.length,
    score: state.evidence_report.aggregate_score,
    findings: [
      `หลักฐานทั้งหมด ${state.evidence_report.items.length} รายการ`,
      `คะแนนรวมเฉลี่ย ${state.evidence_report.aggregate_score}`,
      `coverage ${state.evidence_report.coverage_score}`,
    ],
    calculations: {
      aggregate_score: state.evidence_report.aggregate_score,
      coverage_score: state.evidence_report.coverage_score,
      user_input_items: state.evidence_report.items.filter((item) => item.source === "user_input").length,
      history_items: state.evidence_report.items.filter((item) => item.source === "conversation_history").length,
      memory_items: state.evidence_report.items.filter((item) => item.source === "memory").length,
    },
  });
  record(state, "EVIDENCE_EVALUATION", {
    evidence: state.evidence,
    evidence_report: state.evidence_report,
    history_turns: history.length,
  });
}

function stageCritique(
  state: PCAState,
  context: ContextValidation,
  conflictFindings: ConflictFinding[]
) {
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
  state.module_audit.push({
    module: "Critique",
    algorithm: "missing-signal detection + conflict severity aggregation + uncertainty penalty",
    input_count: state.evidence_report.items.length,
    score: Number(clamp01(
      1 - context.missingSignals.length * 0.2 - conflictFindings.length * 0.2
    ).toFixed(3)),
    findings: [
      `missing signals: ${context.missingSignals.length}`,
      `conflict findings: ${conflictFindings.length}`,
      `uncertainty: ${uncertaintyLevel}`,
    ],
    calculations: {
      missing_signal_count: context.missingSignals.length,
      conflict_count: conflictFindings.length,
      uncertainty_level: uncertaintyLevel,
      critique_quality_score: Number(clamp01(
        1 - context.missingSignals.length * 0.2 - conflictFindings.length * 0.2
      ).toFixed(3)),
    },
  });
  record(state, "CRITIQUE", {
    critique: state.critique,
    uncertainty: state.uncertainty,
    missing_info: state.missing_info,
    conflict_findings: conflictFindings,
  });
}

function stageDecision(
  state: PCAState,
  history: ConversationTurn[],
  memories: PCAState["memories"],
  context: ContextValidation,
  conflicts: string[],
  conflictFindings: ConflictFinding[]
) {
  state.decision =
    state.language === "th"
      ? "เสนอข้อสรุปเชิงยุทธศาสตร์ที่แยกแยะระหว่างข้อเท็จจริงและการตีความ พร้อมระบุขอบเขตและข้อจำกัด"
      : "Present strategic conclusions distinguishing facts from interpretations, with explicit scope and limitations.";

  state.conflicts = conflicts;
  state.conflict_findings = conflictFindings;
  const evidenceScore = state.evidence_report.aggregate_score;
  const critiqueScore = state.module_audit.find((audit) => audit.module === "Critique")?.score ?? 0;
  const aggregationScore = Number(
    (evidenceScore * 0.6 + critiqueScore * 0.4 - conflictFindings.length * 0.1).toFixed(3)
  );
  state.confidence_report = buildConfidenceReport(state, 0);
  state.confidence = state.confidence_report.band;
  state.module_audit.push({
    module: "Decision",
    algorithm: "weighted aggregation: evidence×0.60 + critique×0.40 − conflicts×0.10",
    input_count: state.evidence_report.items.length + conflictFindings.length,
    score: Math.max(0, aggregationScore),
    findings: [
      `evidence score ${evidenceScore}`,
      `critique score ${critiqueScore}`,
      `decision aggregation ${Math.max(0, aggregationScore).toFixed(3)}`,
    ],
    calculations: {
      evidence_weight: 0.6,
      critique_weight: 0.4,
      conflict_penalty_per_finding: 0.1,
      aggregation_score: Math.max(0, aggregationScore),
    },
  });

  record(state, "DECISION", {
    decision: state.decision,
    confidence: state.confidence,
    confidence_report: state.confidence_report,
    aggregation_score: Math.max(0, aggregationScore),
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
 - Firekeeper OS lifecycle: Understand → Plan → Reason → Verify → Respond → Reflect
 - Governance gate: Truth before certainty, Evidence before opinion, Human agency before automation
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
  const startMono = monotonicMs();

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
    conflict_findings: [],
    missing_info: [],
    evidence_report: {
      methodology: "",
      items: [],
      aggregate_score: 0,
      coverage_score: 0,
    },
    confidence_report: {
      score: 0,
      band: "ปานกลาง",
      method: "",
      components: {},
      verification_score: 0,
    },
    module_audit: [],
    runtime_lifecycle: [],
    governance: {
      status: "ผ่าน",
      policy: [],
      safety_checks: [],
      human_agency_preserved: true,
    },
    verification: {
      status: "ต้องตรวจสอบ",
      consistency: "สอดคล้อง",
      expected: [],
      observed: [],
      checks: [],
      detailed_checks: [],
      score: 0,
    },
    knowledge_map: {
      facts: [],
      assumptions: [],
      unknowns: [],
    },
    trace: [],
    llm_provider: "openai",
    llm_model: "gpt-4o",
    execution_time_ms: 0,
    start_time: startTime,
    end_time: "",
  };

  try {
    recordRuntime(state, "BOOT", "เริ่มต้น Firekeeper OS runtime", 0, undefined, undefined, false);
    recordRuntime(state, "READY", "ตรวจสอบคำขอและเตรียมบริบท", 0, undefined, undefined, false);

    // Pre-pipeline analysis
    const understandStartedAt = new Date().toISOString();
    const understandStart = monotonicMs();
    const contextStart = monotonicMs();
    const context = validateContext(question, history);          // 3
    const conflictFindings = analyzeConflictFindings(question, history);
    const conflicts = [...new Set(conflictFindings.map((finding) => (
      `พบ ${finding.type === "reversal" ? "แนวโน้มกลับจุดยืน" : "ความไม่สอดคล้อง"} (${finding.severity}) — ${finding.evidence}`
    )))];
    state.conflict_findings = conflictFindings;
    state.conflicts = conflicts;
    const contextDuration = monotonicMs() - contextStart;

    // Cognitive pipeline — each stage is timed independently (ms-level)
    timed(state, () => stageObservation(state));
    timed(state, () => stageUnderstanding(state));
    const understandEndedAt = new Date().toISOString();
    recordRuntime(
      state,
      "UNDERSTAND",
      "ตรวจสอบบริบท ความขัดแย้ง สังเกต และทำความเข้าใจคำถาม",
      Number(Math.max(monotonicMs() - understandStart, contextDuration).toFixed(3)),
      understandStartedAt,
      understandEndedAt
    );

    const planStartedAt = new Date().toISOString();
    const planStart = monotonicMs();
    timed(state, () => stagePurpose(state));
    timed(state, () => stageMemoryRetrieval(state, memories));
    timed(state, () => stageMentalModel(state));
    recordRuntime(
      state,
      "PLAN",
      "กำหนดจุดประสงค์ ความจำ และแบบจำลอง",
      Number((monotonicMs() - planStart).toFixed(3)),
      planStartedAt,
      new Date().toISOString()
    );

    const reasonStartedAt = new Date().toISOString();
    const reasonStart = monotonicMs();
    timed(state, () => stageHypotheses(state));
    timed(state, () => stageEvidenceEvaluation(state, history));
    timed(state, () => stageCritique(state, context, conflictFindings));
    timed(state, () => stageDecision(state, history, memories, context, conflicts, conflictFindings));
    recordRuntime(
      state,
      "REASON",
      "รวบรวมหลักฐาน สร้างแบบจำลอง และประเมินทางเลือก",
      Number((monotonicMs() - reasonStart).toFixed(3)),
      reasonStartedAt,
      new Date().toISOString()
    );

    state.governance = buildGovernanceReport(context, conflicts);
    state.knowledge_map = buildKnowledgeMap(state, context);

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

    // LLM Communication — timed separately (async, can be seconds)
    const llmStartedAt = new Date().toISOString();
    const llmStart = monotonicMs();
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
    const llmEndedAt = new Date().toISOString();
    const llmMs = Number((monotonicMs() - llmStart).toFixed(3));
    recordRuntime(state, "RESPOND", "สื่อสารผลวิเคราะห์ผ่าน LLM", llmMs, llmStartedAt, llmEndedAt);

    const responseText =
      completion.choices[0]?.message?.content ?? "ไม่สามารถประมวลผลได้ในขณะนี้";
    state.response = responseText;
    state.llm_model = completion.model ?? "gpt-4o";
    state.notes.push(`LLM: openai (${state.llm_model})`);
    recordMeasured(
      state,
      "COMMUNICATION",
      { response_length: responseText.length, model: state.llm_model },
      llmStartedAt,
      llmEndedAt,
      llmMs
    );

    const reflectStartedAt = new Date().toISOString();
    const reflectStart = monotonicMs();
    timed(state, () => stageReflection(state));
    timed(state, () => stageLearning(state));
    state.verification = buildVerificationReport(state, responseText);
    state.confidence_report = buildConfidenceReport(state, state.verification.score);
    state.confidence = state.confidence_report.band;
    state.module_audit.push({
      module: "Verification",
      algorithm: "six rule-based response checks with explicit evidence and equal weighting",
      input_count: state.verification.detailed_checks.length,
      score: state.verification.score,
      findings: state.verification.detailed_checks.map((check) =>
        `${check.criterion}: ${check.passed ? "ผ่าน" : "ไม่ผ่าน"} (${check.score})`
      ),
      calculations: {
        passed_checks: state.verification.detailed_checks.filter((check) => check.passed).length,
        total_checks: state.verification.detailed_checks.length,
        verification_score: state.verification.score,
      },
    });
    record(state, "VERIFICATION_RESULT", {
      score: state.verification.score,
      detailed_checks: state.verification.detailed_checks,
      confidence_after_verification: state.confidence_report,
    });
    recordRuntime(state, "VERIFY", "ตรวจสอบการแยกข้อมูล ความสอดคล้อง และ Human Agency", 0, undefined, undefined, false);
    recordRuntime(
      state,
      "REFLECT",
      "สะท้อนคิดและสกัดบทเรียน",
      Number((monotonicMs() - reflectStart).toFixed(3)),
      reflectStartedAt,
      new Date().toISOString()
    );

    state.end_time = new Date().toISOString();
    state.execution_time_ms = Number((monotonicMs() - startMono).toFixed(3));

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
        conflict_findings: state.conflict_findings,
        missing_info: state.missing_info,
        evidence_report: state.evidence_report,
        confidence_report: state.confidence_report,
        module_audit: state.module_audit,
        critique: state.critique,
        reflection: state.reflection,
        learning: state.learning,
        agency_checks: state.agency_checks,
        user_input: state.user_input,
        runtime_lifecycle: state.runtime_lifecycle,
        governance: state.governance,
        verification: state.verification,
        knowledge_map: state.knowledge_map,
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
