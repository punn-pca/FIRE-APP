import { Router } from "express";
import OpenAI from "openai";
import { logger } from "../lib/logger";
import { loadMemoryWithBackend, type MemoryBackend } from "./memory";

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
  source: "user_input" | "conversation_history" | "memory" | "knowledge_base";
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
  metrics?: ModuleRuntimeMetric;
}

export interface ModuleRuntimeMetric {
  module: string;
  duration_ms: number;
  input_count: number;
  output_count: number;
  evidence_count: number;
  hypothesis_count: number;
  memory_hits: number;
  missing_info_count: number;
  conflict_count: number;
}

export interface ReasoningQualityMetrics {
  evidence_count: number;
  evidence_coverage: number;
  evidence_quality: number;
  memory_hits: number;
  hypothesis_count: number;
  conflict_count: number;
  missing_information_count: number;
  unsupported_claim_count: number;
  verification_pass_rate: number;
  decision_margin: number;
}

export interface LLMRuntime {
  provider: string;
  model: string;
  request_ms: number;
  retry_count: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface CognitiveRuntime {
  total_ms: number;
  pre_llm_ms: number;
  post_llm_ms: number;
  measured_stage_count: number;
  phase_count: number;
}

export interface RuntimeSummary {
  cognitive: CognitiveRuntime;
  llm: LLMRuntime;
}

export interface DataflowEdge {
  id: string;
  from: string;
  to: string;
  outputs: string[];
  inputs: string[];
  transformation: string;
  item_count: number;
}

export interface MemoryHit {
  rank: number;
  content: string;
  source: string;
  retrieval_score: number;
  matched_tokens: string[];
}

export interface MemoryRetrievalReport {
  query: string;
  query_tokens: string[];
  algorithm: string;
  threshold: number;
  candidate_count: number;
  matched_count: number;
  hits: MemoryHit[];
  storage_backend?: MemoryBackend;
  miss_reason?: string;
}

export type IntentType = "explanatory" | "decision" | "summary" | "comparison" | "general";

export interface IntentRoute {
  type: IntentType;
  confidence: number;
  rationale: string;
  signals: string[];
  pipeline: "explanation" | "decision" | "summary" | "comparison" | "general";
}

export interface DecisionOption {
  id: string;
  label: string;
  rationale: string;
  criteria: Record<string, number>;
  weighted_score: number;
  evidence_ids: string[];
}

export interface DecisionMatrix {
  methodology: string;
  criteria_weights: Record<string, number>;
  options: DecisionOption[];
  selected_option: string;
  selected_score: number;
  selection_reason: string;
}

export interface LogicalVerification {
  status: "ผ่าน" | "ต้องตรวจสอบ";
  checks: VerificationCheck[];
  score: number;
}

export type ClaimType = "fact" | "assumption" | "conclusion" | "unknown";
export type ClaimStatus = "supported" | "partial" | "unsupported";

export interface ClaimNode {
  id: string;
  text: string;
  type: ClaimType;
  status: ClaimStatus;
  source_module: string;
  evidence_ids: string[];
  assumption_ids: string[];
  conflict_ids: string[];
  decision_option_id?: string;
  support_score: number;
}

export interface ReasoningGraphEdge {
  id: string;
  from: string;
  to: string;
  relation: "supports" | "assumes" | "contradicts" | "influences";
  weight: number;
  rationale: string;
}

export interface ReasoningGraph {
  claims: ClaimNode[];
  edges: ReasoningGraphEdge[];
  selected_option: string;
  unsupported_claim_count: number;
  methodology: string;
}

export interface StateTransition {
  id: string;
  module: string;
  state_field: string;
  before: unknown;
  after: unknown;
  trigger: string;
  impact: string;
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
  intent: IntentRoute;
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
  runtime_metrics: ModuleRuntimeMetric[];
  dataflow: DataflowEdge[];
  memory_retrieval: MemoryRetrievalReport;
  decision_matrix: DecisionMatrix;
  logical_verification: LogicalVerification;
  reasoning_quality: ReasoningQualityMetrics;
  runtime_summary: RuntimeSummary;
  reasoning_graph: ReasoningGraph;
  state_transitions: StateTransition[];
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

export interface UserReport {
  answer: string;
  executive_summary: string;
  route: IntentRoute;
  confidence: PCAState["confidence"];
  limitations: string[];
  next_step?: string;
}

export interface AnalystReport {
  evidence_report: EvidenceReport;
  knowledge_map: KnowledgeMap;
  missing_info: string[];
  conflicts: ConflictFinding[];
  confidence_report: ConfidenceReport;
  verification: VerificationReport;
  logical_verification: LogicalVerification;
  reasoning_quality: ReasoningQualityMetrics;
  decision_matrix?: DecisionMatrix;
}

export interface SystemTrace {
  notes: string[];
  runtime_summary: RuntimeSummary;
  runtime_lifecycle: RuntimeEvent[];
  trace: TraceEntry[];
  dataflow: DataflowEdge[];
  runtime_metrics: ModuleRuntimeMetric[];
  module_audit: ModuleAudit[];
  state_transitions: StateTransition[];
  reasoning_graph: ReasoningGraph;
}

export interface ConfidenceSummary {
  score: number;
  band: PCAState["confidence"];
}

export interface ReportLayers {
  user_report: UserReport;
  analyst_report: AnalystReport;
  system_trace: SystemTrace;
  confidence_summary: ConfidenceSummary;
}

function buildExecutiveSummary(answer: string): string {
  const lines = answer
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?。！？])\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);
  const summary = (lines.length > 0 ? lines : [answer.trim()]).join(" ");
  if (summary.length <= 240) return summary;
  return `${summary.slice(0, 237).trimEnd()}...`;
}

export function buildReportLayers(state: PCAState): ReportLayers {
  const selected = state.decision_matrix.options.find(
    (option) => option.id === state.decision_matrix.selected_option
  );
  return {
    user_report: {
      answer: state.response,
      executive_summary: buildExecutiveSummary(state.response),
      route: state.intent,
      confidence: state.confidence,
      limitations: state.missing_info.slice(0, 3),
      ...(state.intent.type === "decision" && selected
        ? { next_step: `พิจารณาทางเลือก “${selected.label}” โดยตรวจสอบข้อมูลสำคัญเพิ่มเติมก่อนตัดสินใจ` }
        : {}),
    },
    analyst_report: {
      evidence_report: state.evidence_report,
      knowledge_map: state.knowledge_map,
      missing_info: state.missing_info,
      conflicts: state.conflict_findings,
      confidence_report: state.confidence_report,
      verification: state.verification,
      logical_verification: state.logical_verification,
      reasoning_quality: state.reasoning_quality,
      ...(state.intent.type === "decision" ? { decision_matrix: state.decision_matrix } : {}),
    },
    system_trace: {
      notes: state.notes,
      runtime_summary: state.runtime_summary,
      runtime_lifecycle: state.runtime_lifecycle,
      trace: state.trace,
      dataflow: state.dataflow,
      runtime_metrics: state.runtime_metrics,
      module_audit: state.module_audit,
      state_transitions: state.state_transitions,
      reasoning_graph: state.reasoning_graph,
    },
    confidence_summary: {
      score: state.confidence_report.score,
      band: state.confidence,
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const THAI_REGEX = /[\u0E00-\u0E7F]/;
export function detectLanguage(text: string): "th" | "en" {
  return THAI_REGEX.test(text) ? "th" : "en";
}

export function classifyIntent(question: string): IntentRoute {
  const input = question.trim().toLowerCase();
  const signals: string[] = [];
  const has = (pattern: RegExp, label: string) => {
    if (!pattern.test(input)) return false;
    signals.push(label);
    return true;
  };

  if (has(/สรุป|ย่อความ|สรุปบทความ|summari[sz]e|summary|ทำบทคัดย่อ/i, "summary marker")) {
    return {
      type: "summary",
      confidence: 0.96,
      rationale: "คำถามขอให้ย่อหรือสรุปเนื้อหา จึงใช้ Summary Pipeline แทนการตัดสินใจ",
      signals,
      pipeline: "summary",
    };
  }

  if (has(/คืออะไร|หมายถึงอะไร|แปลว่าอะไร|อธิบาย|นิยาม|ทำไม|what is|what does|explain|define|why is|why does/i, "explanation marker")) {
    return {
      type: "explanatory",
      confidence: 0.98,
      rationale: "คำถามต้องการความหมาย กลไก หรือคำอธิบาย จึงไม่สร้างทางเลือกเชิงการตัดสินใจ",
      signals,
      pipeline: "explanation",
    };
  }

  if (has(/เปรียบเทียบ|แตกต่างกันอย่างไร|ต่างกันอย่างไร|compare|comparison|versus|\bvs\b/i, "comparison marker")) {
    return {
      type: "comparison",
      confidence: 0.93,
      rationale: "คำถามต้องการเปรียบเทียบคุณลักษณะและข้อแลกเปลี่ยน ไม่ใช่การเลือกทางดำเนินการโดยอัตโนมัติ",
      signals,
      pipeline: "comparison",
    };
  }

  if (has(/ควร|ดีไหม|ไหม|หรือไม่|เลือก|แนะนำ|ตัดสินใจ|ลงทุน|ลาออก|ซื้อ|สร้างระบบ|should|recommend|whether|choose|invest|quit|buy|build/i, "decision marker")) {
    return {
      type: "decision",
      confidence: 0.88,
      rationale: "คำถามมีสัญญาณขอคำแนะนำหรือเลือกแนวทาง จึงใช้ Decision Pipeline",
      signals,
      pipeline: "decision",
    };
  }

  return {
    type: "general",
    confidence: 0.52,
    rationale: "ยังไม่พบสัญญาณเฉพาะ จึงใช้ General Response Pipeline โดยไม่สมมติว่าเป็นการตัดสินใจ",
    signals: ["no dominant intent marker"],
    pipeline: "general",
  };
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

function matchedTokens(query: string, candidate: string): string[] {
  const candidateTokens = new Set(tokenize(candidate));
  return tokenize(query).filter((token) => candidateTokens.has(token));
}

const MEMORY_RELEVANCE_THRESHOLD = 0.25;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

type ReversalPattern = {
  type?: "reversal";
  a: RegExp;
  b: RegExp;
};

function getPolarity(text: string, pattern: ReversalPattern): "positive" | "negative" | "mixed" | "none" {
  const withoutNegative = text.replace(pattern.b, "");
  const hasPositive = pattern.a.test(withoutNegative);
  const hasNegative = pattern.b.test(text);
  if (hasPositive && hasNegative) return "mixed";
  if (hasPositive) return "positive";
  if (hasNegative) return "negative";
  return "none";
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
      const previousPolarity = getPolarity(prev.content, pattern);
      const currentPolarity = getPolarity(question, pattern);
      if (
        (previousPolarity === "positive" && currentPolarity === "negative") ||
        (previousPolarity === "negative" && currentPolarity === "positive")
      ) {
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

  const intent = classifyIntent(question);
  const conceptualKnowledge: Array<{
    id: string;
    matches: RegExp;
    th: string;
    en: string;
    basis: string[];
  }> = [
    {
      id: "knowledge-love-definition",
      matches: /รัก|ความรัก|love/i,
      th: "ความรักเป็นความผูกพันทางอารมณ์และสังคมที่อาจแสดงออกผ่านความใกล้ชิด ความห่วงใย และการดูแลกัน",
      en: "Love is an emotional and social bond that can be expressed through intimacy, care, and concern for another person.",
      basis: ["curated conceptual knowledge", "ใช้เป็นกรอบอธิบายทั่วไป ไม่ใช่ผลการค้นหาแบบสด"],
    },
    {
      id: "knowledge-love-components",
      matches: /รัก|ความรัก|love/i,
      th: "กรอบจิตวิทยาบางแนวอธิบายความรักผ่านองค์ประกอบ เช่น ความใกล้ชิด ความผูกพัน และความมุ่งมั่น",
      en: "Some psychological frameworks describe love through components such as intimacy, attachment, and commitment.",
      basis: ["curated psychology concept", "เป็นกรอบอธิบายหนึ่ง ไม่ใช่ข้อสรุปเดียวของทุกบริบท"],
    },
    {
      id: "knowledge-ai-definition",
      matches: /ปัญญาประดิษฐ์|\bai\b|artificial intelligence/i,
      th: "ปัญญาประดิษฐ์คือระบบคอมพิวเตอร์ที่ทำงานซึ่งโดยทั่วไปต้องใช้ความสามารถด้านการรับรู้ การเรียนรู้ หรือการให้เหตุผล",
      en: "Artificial intelligence refers to computer systems performing tasks that commonly require perception, learning, or reasoning.",
      basis: ["curated conceptual knowledge"],
    },
    {
      id: "knowledge-time-definition",
      matches: /เวลา|time/i,
      th: "เวลาเป็นแนวคิดหรือปริมาณที่ใช้จัดลำดับเหตุการณ์และวัดช่วงห่างระหว่างเหตุการณ์",
      en: "Time is a concept or quantity used to order events and measure intervals between events.",
      basis: ["curated conceptual knowledge"],
    },
  ];

  if (intent.pipeline === "explanation" || intent.pipeline === "comparison" || intent.pipeline === "general") {
    conceptualKnowledge
      .filter((entry) => entry.matches.test(question))
      .forEach((entry) => {
        addItem(
          entry.id,
          "knowledge_base",
          detectLanguage(question) === "th" ? entry.th : entry.en,
          0.95,
          0.78,
          entry.basis
        );
      });
  }

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
    if (relevance >= MEMORY_RELEVANCE_THRESHOLD) {
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
      items.filter((item) => item.source !== "user_input" && item.relevance_score >= MEMORY_RELEVANCE_THRESHOLD).length /
      (history.length > 0 || memories.length > 0 ? 3 : 1)
    ).toFixed(3)
  );
  return {
    methodology: "composite = relevance×0.45 + source_quality×0.35 + consistency×0.20; user_input is context, while knowledge_base/history/memory can support claims",
    items,
    aggregate_score,
    coverage_score,
  };
}

export function buildConfidenceReport(
  state: PCAState,
  verificationScore = 0
): ConfidenceReport {
  const contextScore = state.missing_info.length === 0
    ? 1
    : clamp01(1 - state.missing_info.length * 0.2);
  const inputScore = clamp01(state.user_input.trim().length / 55);
  const historyItems = state.evidence_report.items.filter(
    (item) => item.source === "conversation_history"
  );
  const historyScore = historyItems.length
    ? clamp01(historyItems.reduce((sum, item) => sum + item.relevance_score, 0) / historyItems.length)
    : 0;
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

export function buildKnowledgeMap(
  state: PCAState,
  context: ContextValidation
): KnowledgeMap {
  const supportedEvidence = state.evidence_report.items
    .filter((item) => item.source !== "user_input")
    .map((item) => item.text);
  return {
    facts: supportedEvidence.length > 0
      ? supportedEvidence
      : [
          state.language === "th"
            ? "ยังไม่มีข้อเท็จจริงจาก knowledge base, memory หรือบริบทก่อนหน้า"
            : "No factual support was found in the knowledge base, memory, or prior context.",
        ],
    assumptions: state.hypotheses.map((hypothesis) => hypothesis.claim),
    unknowns: [
      ...context.missingSignals,
      ...state.uncertainty,
    ],
  };
}

export function buildVerificationReport(
  state: PCAState,
  responseText: string
): VerificationReport {
  const checks: string[] = [];
  const detailed_checks: VerificationCheck[] = [];
  const isDecisionRoute = state.intent.type === "decision";
  const hasDirectAnswer = responseText.trim().length >= 40 &&
    (/คำตอบตรงประเด็น|คำตอบเบื้องต้น|คำตอบคือ|โดยสรุป|direct answer|in summary/i.test(responseText) ||
      !/^\s*\[(?:ข้อเท็จจริง|สมมติฐาน|ข้อมูลที่ขาด)\]/i.test(responseText));
  const hasSubstantiveLabel = (labels: RegExp): boolean => {
    const match = labels.exec(responseText);
    if (!match) return false;
    const followingText = responseText.slice(match.index + match[0].length).split(/\n(?=#|\[)/, 1)[0];
    return followingText.replace(/[:：\s\-*]/g, "").trim().length >= 12;
  };
  const hasFactLabel = hasSubstantiveLabel(/\[ข้อเท็จจริง\]|\[Fact\]/i);
  const hasAssumptionLabel = hasSubstantiveLabel(/\[สมมติฐาน\]|\[Assumption\]/i);
  const requiresAgency = isDecisionRoute;
  const preservesAgency = !requiresAgency || /ผู้ใช้|ตัดสินใจขั้นสุดท้าย|human agency|final decision/i.test(
    responseText
  );
  const surfacesMissingInfo =
    !isDecisionRoute ||
    state.missing_info.length === 0 ||
    (
      /\[ข้อมูลที่ขาด\]|\[missing information\]|ข้อมูลที่ต้องการเพิ่ม/i.test(responseText) &&
      state.missing_info.some((missing) => responseText.includes(missing) || /ยังไม่มีข้อมูล|ยังไม่ทราบ|ต้องการข้อมูลเพิ่ม/i.test(responseText))
    );
  const evidenceIds = state.evidence_report.items
    .filter((item) => item.source !== "user_input")
    .map((item) => item.id);
  const citedEvidenceIds = evidenceIds.filter((id) => responseText.includes(`[หลักฐาน: ${id}]`));
  const acknowledgesEvidence =
    evidenceIds.length === 0 ||
    citedEvidenceIds.length > 0;
  const acknowledgesConflicts =
    state.conflict_findings.length === 0 ||
    state.conflict_findings.some((finding) =>
      responseText.includes(`[ความขัดแย้ง: ${finding.id}]`) ||
      responseText.includes(finding.id)
    );

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
      rule: isDecisionRoute
        ? "response ต้องมี [ข้อเท็จจริง] หรือ [Fact]"
        : "คำตอบที่ไม่ใช่ decision ต้องตอบตรงประเด็น",
      passed: isDecisionRoute ? hasFactLabel : hasDirectAnswer,
      evidence: isDecisionRoute
        ? hasFactLabel ? "พบ label ใน response" : "ไม่พบ label ที่กำหนด"
        : hasDirectAnswer ? "พบคำตอบตรงประเด็น" : "ไม่พบคำตอบที่ชัดเจน",
      score: isDecisionRoute ? hasFactLabel ? 1 : 0 : hasDirectAnswer ? 1 : 0,
    },
    {
      criterion: "assumption_label",
      rule: isDecisionRoute
        ? "response ต้องมี [สมมติฐาน] หรือ [Assumption]"
        : "คำตอบที่ไม่ใช่ decision ไม่ต้องแสดงโครงสร้างภายในของ pipeline",
      passed: isDecisionRoute ? hasAssumptionLabel : hasDirectAnswer,
      evidence: isDecisionRoute
        ? hasAssumptionLabel ? "พบ label ใน response" : "ไม่พบ label ที่กำหนด"
        : hasDirectAnswer ? "ไม่บังคับแสดง assumption ในคำตอบหลัก" : "ไม่พบคำตอบที่ชัดเจน",
      score: isDecisionRoute ? hasAssumptionLabel ? 1 : 0 : hasDirectAnswer ? 1 : 0,
    },
    {
      criterion: "human_agency",
      rule: requiresAgency
        ? "response ต้องยืนยันว่าผู้ใช้เป็นผู้ตัดสินใจขั้นสุดท้าย"
        : "ไม่บังคับ Human Agency สำหรับคำถามที่ไม่ใช่ decision",
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
      rule: "response ต้องอ้างอิง evidence id ด้วยรูปแบบ [หลักฐาน: evidence-id]",
      passed: acknowledgesEvidence,
      evidence: acknowledgesEvidence
        ? `อ้างอิง evidence ${citedEvidenceIds.join(", ")}`
        : "ไม่พบ evidence id ที่ pipeline อนุญาต",
      score: acknowledgesEvidence ? 1 : 0,
    },
    {
      criterion: "conflict_acknowledgement",
      rule: "เมื่อพบ conflict ต้องอ้างอิง conflict id ด้วยรูปแบบ [ความขัดแย้ง: conflict-id]",
      passed: acknowledgesConflicts,
      evidence: acknowledgesConflicts
        ? "response สะท้อนสถานะความสอดคล้อง"
        : "ไม่พบการกล่าวถึง conflict",
      score: acknowledgesConflicts ? 1 : 0,
    }
  );

  const score = detailed_checks.reduce((sum, check) => sum + check.score, 0) / detailed_checks.length;
  const allCoreChecksPass = detailed_checks.every((check) => check.passed);
  // A detected conflict is not itself a verification failure. It passes when
  // the response explicitly acknowledges every conflict for the user.
  const consistent = state.conflicts.length === 0 || acknowledgesConflicts;
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

export function buildVerifiedFallback(state: PCAState): string {
  const supportedEvidence = state.evidence_report.items.filter((item) => item.source !== "user_input");
  const cite = (item: EvidenceItem): string => `${item.text} [หลักฐาน: ${item.id}]`;
  const directAnswer = (() => {
    if (state.intent.type === "explanatory") {
      if (supportedEvidence.length === 0) {
        return state.language === "th"
          ? "คำตอบตรงประเด็น: ตอนนี้ยังไม่มีข้อมูลความรู้ที่เพียงพอสำหรับอธิบายเรื่องนี้อย่างน่าเชื่อถือ"
          : "Direct answer: There is not enough supported knowledge to explain this reliably yet.";
      }
      const primary = cite(supportedEvidence[0]);
      const supporting = supportedEvidence[1] ? ` ${cite(supportedEvidence[1])}` : "";
      return state.language === "th"
        ? `คำตอบตรงประเด็น: ${primary}${supporting}`
        : `Direct answer: ${primary}${supporting}`;
    }
    if (state.intent.type === "summary") {
      return state.language === "th"
        ? `คำตอบตรงประเด็น: ${supportedEvidence.length > 0
          ? supportedEvidence.slice(0, 3).map(cite).join(" ")
          : "ยังไม่มีข้อมูลที่รองรับเพียงพอสำหรับสรุป"}`
        : `Direct answer: ${supportedEvidence.length > 0
          ? supportedEvidence.slice(0, 3).map(cite).join(" ")
          : "There is not enough supported information to summarize."}`;
    }
    if (state.intent.type === "comparison") {
      return state.language === "th"
        ? `คำตอบตรงประเด็น: การเปรียบเทียบควรพิจารณาจากข้อมูลที่รองรับต่อไปนี้ — ${
          supportedEvidence.length > 0 ? supportedEvidence.slice(0, 3).map(cite).join(" ") : "ยังไม่มีข้อมูลเปรียบเทียบที่เพียงพอ"
        }`
        : `Direct answer: The comparison should be based on the following supported information — ${
          supportedEvidence.length > 0 ? supportedEvidence.slice(0, 3).map(cite).join(" ") : "there is not enough supported comparison data yet."
        }`;
    }
    if (state.intent.type === "decision") {
      const selected = state.decision_matrix.options.find(
        (option) => option.id === state.decision_matrix.selected_option
      );
      return state.language === "th"
        ? `คำตอบเบื้องต้น: จากข้อมูลและข้อจำกัดปัจจุบัน ระบบให้น้ำหนักกับทางเลือก “${selected?.label ?? "เก็บข้อมูลเพิ่ม"}” แต่ยังไม่ใช่การตัดสินใจแทนผู้ใช้`
        : `Preliminary answer: Given the current information and constraints, the system favors “${selected?.label ?? "gather more information"}” without making the decision for the user.`;
    }
    return state.language === "th"
      ? `คำตอบตรงประเด็น: ${supportedEvidence.length > 0 ? supportedEvidence.slice(0, 2).map(cite).join(" ") : "ยังไม่มีข้อมูลที่รองรับเพียงพอสำหรับตอบอย่างมั่นใจ"}`
      : `Direct answer: ${supportedEvidence.length > 0 ? supportedEvidence.slice(0, 2).map(cite).join(" ") : "There is not enough supported information to answer confidently."}`;
  })();
  const evidenceText = supportedEvidence.length > 0
    ? supportedEvidence
      .slice(0, 3)
      .map((item) => `- ${item.text} [หลักฐาน: ${item.id}]`)
      .join("\n")
    : "- ยังไม่มีหลักฐานสนับสนุนจาก memory, history หรือ knowledge base";
  const selected = state.decision_matrix.options.find(
    (option) => option.id === state.decision_matrix.selected_option
  );
  const conflictText = state.conflict_findings.length > 0
    ? state.conflict_findings
      .map((finding) => `- ${finding.evidence} [ความขัดแย้ง: ${finding.id}]`)
      .join("\n")
    : "- ไม่พบความขัดแย้งจากข้อมูลที่ตรวจสอบ";
  const missingText = state.missing_info.length > 0
    ? state.missing_info.map((missing) => `- ${missing}`).join("\n")
    : "- ไม่พบข้อมูลสำคัญที่ขาดจากบริบทปัจจุบัน";
  const assumptionText = state.hypotheses
    .slice(0, 2)
    .map((hypothesis) => `- ${hypothesis.claim}`)
    .join("\n");
  const optionText = state.decision_matrix.options
    .map((option) => `- ${option.label}: คะแนน ${option.weighted_score.toFixed(3)} — ${option.rationale}`)
    .join("\n");

  if (state.intent.type !== "decision") return directAnswer;

  return `${directAnswer}

[ข้อเท็จจริง]
${evidenceText}

[สมมติฐาน]
${assumptionText || "- ยังไม่มีสมมติฐานเพิ่มเติม"}

[ข้อมูลที่ขาด]
${missingText}

[ข้อจำกัดและความขัดแย้ง]
${conflictText}

[ทางเลือกและข้อแลกเปลี่ยน]
${optionText}

[ข้อสรุป]
ทางเลือกที่ pipeline เลือกคือ ${selected?.label ?? state.decision_matrix.selected_option} เพราะมี weighted score ${state.decision_matrix.selected_score.toFixed(3)} ภายใต้หลักฐานและข้อจำกัดปัจจุบัน

ผู้ใช้เป็นผู้ตัดสินใจขั้นสุดท้าย ควรตรวจสอบข้อมูลเพิ่มเติมก่อนดำเนินการในเรื่องที่มีผลกระทบสูง`;
}

export function normalizeUserFacingResponse(state: PCAState, responseText: string): string {
  const trimmed = responseText.trim();
  const cleanPlaceholders = (text: string): string => text
    .replace(/\s*\[หลักฐาน:\s*evidence-id\s*\]/gi, "")
    .replace(/\s*\[ความขัดแย้ง:\s*conflict-id\s*\]/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  if (!trimmed) return buildVerifiedFallback(state);

  const sectionMatch = responseText.match(
    /(?:^|\n)###\s*(?:#\s*)?3\.\s*[^\n]*(?:คำอธิบาย|สรุป|เปรียบเทียบ|คำตอบ|ทางเลือก|comparison|answer|explanation|conclusion)[^\n]*\n([\s\S]*?)(?=\n###|\n\[DECISION_SUMMARY\]|\s*$)/i
  );
  const summaryMatch = responseText.match(/\[DECISION_SUMMARY\]:\s*([\s\S]*)/i);
  const extracted = (sectionMatch?.[1] ?? summaryMatch?.[1] ?? "").trim();
  const hasInternalReport = /^###\s/m.test(responseText) ||
    /^\s*\[(?:ข้อเท็จจริง|สมมติฐาน|ข้อมูลที่ขาด|DECISION_SUMMARY)\]/im.test(responseText);
  if (extracted.length >= 40) {
    return cleanPlaceholders(extracted.replace(/^#+\s*/gm, "").trim());
  }
  if (!hasInternalReport) return cleanPlaceholders(trimmed);

  const withoutReportHeadings = responseText
    .replace(/^###.*$/gm, "")
    .replace(/^\[(?:ข้อเท็จจริง|สมมติฐาน|ข้อมูลที่ขาด|DECISION_SUMMARY)\]:?\s*/gim, "")
    .trim();
  return withoutReportHeadings.length >= 40
    ? cleanPlaceholders(withoutReportHeadings)
    : buildVerifiedFallback(state);
}

export function buildReasoningQuality(state: PCAState): ReasoningQualityMetrics {
  const checks = state.verification.detailed_checks;
  const sortedScores = state.decision_matrix.options
    .map((option) => option.weighted_score)
    .sort((a, b) => b - a);
  const decisionMargin = sortedScores.length > 1
    ? Math.max(0, sortedScores[0] - sortedScores[1])
    : sortedScores[0] ?? 0;
  return {
    evidence_count: state.evidence_report.items.length,
    evidence_coverage: Number(state.evidence_report.coverage_score.toFixed(3)),
    evidence_quality: Number(state.evidence_report.aggregate_score.toFixed(3)),
    memory_hits: state.memory_retrieval.matched_count,
    hypothesis_count: state.hypotheses.length,
    conflict_count: state.conflict_findings.length,
    missing_information_count: state.missing_info.length,
    unsupported_claim_count: state.reasoning_graph.unsupported_claim_count,
    verification_pass_rate: checks.length
      ? Number((checks.filter((check) => check.passed).length / checks.length).toFixed(3))
      : 0,
    decision_margin: Number(decisionMargin.toFixed(3)),
  };
}

export function buildRuntimeSummary(
  state: PCAState,
  preLlmMs: number,
  llmRuntime: LLMRuntime
): RuntimeSummary {
  const cognitiveTotal = Math.max(0, state.execution_time_ms - llmRuntime.request_ms);
  return {
    cognitive: {
      total_ms: Number(cognitiveTotal.toFixed(3)),
      pre_llm_ms: Number(Math.max(0, preLlmMs).toFixed(3)),
      post_llm_ms: Number(Math.max(0, cognitiveTotal - preLlmMs).toFixed(3)),
      measured_stage_count: state.trace.filter((entry) => entry.measured).length,
      phase_count: state.runtime_lifecycle.filter((event) => event.phase !== "RESPOND").length,
    },
    llm: llmRuntime,
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
      const pattern = { a, b };
      const previousPolarity = getPolarity(prev.content, pattern);
      const currentPolarity = getPolarity(question, pattern);
      if (
        (previousPolarity === "positive" && currentPolarity === "negative") ||
        (previousPolarity === "negative" && currentPolarity === "positive")
      ) {
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
  state.intent = classifyIntent(state.user_input);
  const isDecision = state.intent.type === "decision";
  const isComparison = state.intent.type === "comparison";
  const isExplanatory = state.intent.type === "explanatory";

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
  } else if (isExplanatory) {
    state.understanding =
      state.language === "th"
        ? "ผู้ใช้ต้องการคำอธิบาย ความหมาย หรือกลไกของหัวข้อ ไม่ใช่ข้อเสนอให้เลือกดำเนินการ"
        : "The user wants an explanation, definition, or mechanism rather than an action recommendation.";
  } else {
    state.understanding =
      state.language === "th"
        ? "ผู้ใช้ต้องการคำตอบที่ตรงกับคำถาม โดยยังไม่ควรสมมติว่าเป็นปัญหาการตัดสินใจ"
        : "The user wants a direct answer without assuming this is a decision problem.";
  }
  state.module_audit.push({
    module: "Intent Router",
    algorithm: "deterministic intent classification with route-specific pipeline selection",
    input_count: tokenize(state.user_input).length,
    score: state.intent.confidence,
    findings: [
      `route: ${state.intent.type}`,
      `pipeline: ${state.intent.pipeline}`,
      state.intent.rationale,
    ],
    calculations: {
      intent_type: state.intent.type,
      pipeline: state.intent.pipeline,
      classifier_confidence: state.intent.confidence,
      signals: state.intent.signals.join(", "),
    },
  });
  state.module_audit.push({
    module: "Understanding",
    algorithm: "intent-aware context interpretation",
    input_count: tokenize(state.user_input).length,
    score: state.intent.confidence,
    findings: [state.understanding],
    calculations: { routed_intent: state.intent.type },
  });
  record(state, "UNDERSTANDING", {
    understanding: state.understanding,
    intent: state.intent,
  });
}

function stagePurpose(state: PCAState) {
  const purposeByRoute: Record<IntentRoute["pipeline"], [string, string]> = {
    explanation: [
      `อธิบายความหมาย กลไก และมุมมองที่เกี่ยวข้องกับ: "${state.user_input.slice(0, 80)}"`,
      `Explain the meaning, mechanism, and relevant perspectives of: "${state.user_input.slice(0, 80)}"`,
    ],
    decision: [
      `ช่วยประเมินหลักฐานและทางเลือกเพื่อสนับสนุนการตัดสินใจเกี่ยวกับ: "${state.user_input.slice(0, 80)}"`,
      `Evaluate evidence and options to support a decision about: "${state.user_input.slice(0, 80)}"`,
    ],
    summary: [
      `สรุปสาระสำคัญของ: "${state.user_input.slice(0, 80)}"`,
      `Summarize the key points of: "${state.user_input.slice(0, 80)}"`,
    ],
    comparison: [
      `เปรียบเทียบคุณลักษณะ ความแตกต่าง และข้อแลกเปลี่ยนของ: "${state.user_input.slice(0, 80)}"`,
      `Compare the characteristics, differences, and trade-offs of: "${state.user_input.slice(0, 80)}"`,
    ],
    general: [
      `ตอบคำถามโดยตรงและแยกข้อเท็จจริงออกจากการตีความเกี่ยวกับ: "${state.user_input.slice(0, 80)}"`,
      `Answer directly while separating facts from interpretation about: "${state.user_input.slice(0, 80)}"`,
    ],
  };
  const [thaiPurpose, englishPurpose] = purposeByRoute[state.intent.pipeline];
  state.purpose = state.language === "th" ? thaiPurpose : englishPurpose;
  state.constraints = [
    ...(state.intent.type === "decision"
      ? [
          state.language === "th"
            ? "คงไว้ซึ่งเสรีภาพในการตัดสินใจของมนุษย์ (Human Agency)"
            : "Preserve human agency and final decision authority.",
        ]
      : []),
    state.language === "th"
      ? "อ้างอิงหลักฐานเชิงประจักษ์และระบุระดับความมั่นใจอย่างโปร่งใส"
      : "Base conclusions on empirical evidence with explicit confidence levels.",
    state.language === "th"
      ? `ใช้ ${state.intent.pipeline} pipeline ที่ตรงกับเจตนาของคำถาม`
      : `Use the ${state.intent.pipeline} pipeline that matches the question intent.`,
  ];
  record(state, "PURPOSE", { purpose: state.purpose, constraints: state.constraints, intent: state.intent });
}

function stageMemoryRetrieval(state: PCAState, memoryItems: PCAState["memories"]) {
  const queryTokens = tokenize(state.user_input);
  const ranked = memoryItems
    .map((memory) => ({
      ...memory,
      retrieval_score: overlapScore(state.user_input, memory.content),
      matched_tokens: matchedTokens(state.user_input, memory.content),
    }))
    .sort((a, b) => (b.retrieval_score ?? 0) - (a.retrieval_score ?? 0));
  state.memories = ranked
    .filter((memory) => (memory.retrieval_score ?? 0) >= MEMORY_RELEVANCE_THRESHOLD)
    .slice(0, 5);
  state.memory_retrieval = {
    query: state.user_input,
    query_tokens: queryTokens,
    algorithm: "ranked lexical retrieval: Thai character bigram/token overlap with matched-token diagnostics",
    threshold: MEMORY_RELEVANCE_THRESHOLD,
    candidate_count: memoryItems.length,
    matched_count: state.memories.length,
    hits: state.memories.map((memory, index) => ({
      rank: index + 1,
      content: memory.content,
      source: memory.source,
      retrieval_score: Number((memory.retrieval_score ?? 0).toFixed(3)),
      matched_tokens: matchedTokens(state.user_input, memory.content),
    })),
    ...(state.memory_retrieval.storage_backend
      ? { storage_backend: state.memory_retrieval.storage_backend }
      : {}),
    ...(state.memories.length === 0
      ? {
          miss_reason: memoryItems.length === 0
            ? "ไม่มี memory candidates ถูกส่งเข้ามาใน request"
            : `มี ${memoryItems.length} candidates แต่ไม่มีรายการผ่าน threshold ${MEMORY_RELEVANCE_THRESHOLD}`,
        }
      : {}),
  };
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
      query_token_count: queryTokens.length,
      threshold: MEMORY_RELEVANCE_THRESHOLD,
    },
  });
  record(state, "MEMORY", {
    retrieved: state.memories.length,
    candidates: memoryItems.length,
    ranked_scores: state.memories.map((memory) => memory.retrieval_score),
    query_tokens: queryTokens,
    matched_tokens: state.memory_retrieval.hits.map((hit) => hit.matched_tokens),
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

export function buildDecisionMatrix(state: PCAState, critiqueScore: number): DecisionMatrix {
  if (state.intent.type !== "decision") {
    return {
      methodology: `decision matrix not applicable for ${state.intent.type} intent; route uses ${state.intent.pipeline} pipeline`,
      criteria_weights: {},
      options: [],
      selected_option: "",
      selected_score: 0,
      selection_reason: "ไม่สร้างทางเลือกเชิงการตัดสินใจ เพราะคำถามนี้ไม่ใช่ decision problem",
    };
  }
  const evidenceScore = state.evidence_report.aggregate_score;
  const contextScore = state.missing_info.length === 0
    ? 1
    : clamp01(1 - state.missing_info.length * 0.2);
  const conflictRisk = clamp01(state.conflict_findings.length * 0.2);
  const criteria_weights = {
    evidence_alignment: 0.4,
    risk_control: 0.35,
    feasibility: 0.25,
  };
  const options: DecisionOption[] = [
    {
      id: "option-immediate",
      label: state.language === "th" ? "ดำเนินการทันที" : "Act immediately",
      rationale: state.language === "th"
        ? "เหมาะเมื่อหลักฐานเพียงพอ ความเสี่ยงต่ำ และบริบทครบ"
        : "Best when evidence is sufficient, risk is low, and context is complete.",
      criteria: {
        evidence_alignment: Number((evidenceScore * 0.9).toFixed(3)),
        risk_control: Number(clamp01(0.55 - conflictRisk).toFixed(3)),
        feasibility: Number(clamp01(0.85 * contextScore).toFixed(3)),
      },
      weighted_score: 0,
      evidence_ids: state.evidence_report.items.slice(0, 3).map((item) => item.id),
    },
    {
      id: "option-phased",
      label: state.language === "th" ? "ดำเนินการเป็นระยะ" : "Proceed in phases",
      rationale: state.language === "th"
        ? "ลดความเสี่ยงด้วยการทดลอง ตรวจสอบผล และปรับแผนเป็นช่วง ๆ"
        : "Controls risk through staged execution, validation, and adjustment.",
      criteria: {
        evidence_alignment: Number(evidenceScore.toFixed(3)),
        risk_control: Number(clamp01(0.85 - conflictRisk * 0.5).toFixed(3)),
        feasibility: Number(clamp01(0.7 * contextScore + 0.15).toFixed(3)),
      },
      weighted_score: 0,
      evidence_ids: state.evidence_report.items.filter((item) => item.composite_score >= 0.55).slice(0, 4).map((item) => item.id),
    },
    {
      id: "option-defer",
      label: state.language === "th" ? "ชะลอเพื่อเก็บข้อมูลเพิ่ม" : "Defer for more evidence",
      rationale: state.language === "th"
        ? "เหมาะเมื่อข้อมูลขาด ความเสี่ยงสูง หรือหลักฐานยังไม่สอดคล้อง"
        : "Best when information is missing, risk is high, or evidence is inconsistent.",
      criteria: {
        evidence_alignment: Number(clamp01(1 - evidenceScore * 0.5).toFixed(3)),
        risk_control: Number(clamp01(0.95 - conflictRisk * 0.2).toFixed(3)),
        feasibility: Number(clamp01(0.45 + (1 - contextScore) * 0.25).toFixed(3)),
      },
      weighted_score: 0,
      evidence_ids: state.evidence_report.items.filter((item) => item.relevance_score >= MEMORY_RELEVANCE_THRESHOLD).slice(0, 3).map((item) => item.id),
    },
  ];
  for (const option of options) {
    option.weighted_score = Number((
      option.criteria.evidence_alignment * criteria_weights.evidence_alignment +
      option.criteria.risk_control * criteria_weights.risk_control +
      option.criteria.feasibility * criteria_weights.feasibility
    ).toFixed(3));
  }
  const selected = [...options].sort((a, b) => b.weighted_score - a.weighted_score)[0];
  const strongestCriterion = Object.entries(selected.criteria).sort(([, a], [, b]) => b - a)[0];
  return {
    methodology: "weighted multi-criteria matrix: evidence alignment×0.40 + risk control×0.35 + feasibility×0.25",
    criteria_weights,
    options,
    selected_option: selected.id,
    selected_score: selected.weighted_score,
    selection_reason: `เลือก ${selected.label} เพราะ weighted score ${selected.weighted_score.toFixed(3)} สูงสุด โดย ${strongestCriterion[0]}=${strongestCriterion[1].toFixed(3)}; critique=${critiqueScore.toFixed(3)}, evidence=${evidenceScore.toFixed(3)}`,
  };
}

export function buildLogicalVerification(state: PCAState, responseText: string): LogicalVerification {
  const checks: VerificationCheck[] = [];
  const citedIds = state.evidence_report.items
    .filter((item) => item.source !== "user_input")
    .map((item) => item.id)
    .filter((id) => responseText.includes(`[หลักฐาน: ${id}]`));
  const groundedCitations = citedIds.filter((id) => {
    const item = state.evidence_report.items.find((candidate) => candidate.id === id);
    return item ? overlapScore(item.text, responseText) >= 0.15 : false;
  });
  const allowedEvidenceIds = state.evidence_report.items
    .filter((item) => item.source !== "user_input")
    .map((item) => item.id);
  const groundingScore = citedIds.length === 0
    ? allowedEvidenceIds.length === 0 ? 1 : 0
    : groundedCitations.length / citedIds.length;
  checks.push({
    criterion: "evidence_grounding",
    rule: "ทุก evidence citation ต้องมี token ที่สอดคล้องกับเนื้อหาหลักฐาน",
    passed: citedIds.length === 0 || groundingScore >= 0.6,
    evidence: `${groundedCitations.length}/${citedIds.length} citations มี token overlap กับ evidence`,
    score: Number(clamp01(groundingScore).toFixed(3)),
  });

  const selected = state.decision_matrix.options.find(
    (option) => option.id === state.decision_matrix.selected_option
  );
  const decisionAligned = state.intent.type !== "decision" || Boolean(
    selected &&
    (responseText.includes(selected.id) || responseText.includes(selected.label))
  );
  checks.push({
    criterion: "decision_alignment",
    rule: state.intent.type === "decision"
      ? "ข้อสรุปต้องอ้างถึงทางเลือกที่ Decision Matrix เลือก"
      : "ไม่บังคับ Decision Matrix สำหรับคำถามที่ไม่ใช่ decision",
    passed: decisionAligned,
    evidence: decisionAligned
      ? state.intent.type === "decision"
        ? `พบ selected option: ${selected?.label}`
        : "ข้าม decision alignment ตาม intent route"
      : `ไม่พบ selected option: ${selected?.label ?? state.decision_matrix.selected_option}`,
    score: decisionAligned ? 1 : 0,
  });

  const factIndex = responseText.search(/\[ข้อเท็จจริง\]|\[Fact\]/i);
  const assumptionIndex = responseText.search(/\[สมมติฐาน\]|\[Assumption\]/i);
  const conclusionIndex = responseText.search(/ข้อสรุป|สรุป|decision summary|strategic conclusion/i);
  const routeAnswerIndex = responseText.search(/คำตอบตรงประเด็น|คำตอบเบื้องต้น|direct answer|in summary/i);
  const hasConclusion = state.intent.type !== "decision"
    ? responseText.trim().length >= 40
    : conclusionIndex >= 0 || routeAnswerIndex >= 0;
  const hasFactAndAssumption = /\[ข้อเท็จจริง\]|\[Fact\]/i.test(responseText) &&
    /\[สมมติฐาน\]|\[Assumption\]/i.test(responseText);
  const conclusionConsistent = state.intent.type !== "decision"
    ? hasConclusion && responseText.trim().length >= 40
    : hasConclusion && hasFactAndAssumption &&
      conclusionIndex > factIndex &&
      conclusionIndex > assumptionIndex &&
      !(/\[ข้อเท็จจริง\][\s\S]{0,180}(?:อาจ|น่าจะ|คาดว่า)/i.test(responseText));
  checks.push({
    criterion: "fact_conclusion_consistency",
    rule: state.intent.type === "decision"
      ? "ข้อเท็จจริงต้องไม่ถูกเขียนเป็นสมมติฐาน และต้องมีข้อสรุปที่แยกจาก facts"
      : "คำตอบ non-decision ต้องมีคำตอบตรงประเด็นที่สอดคล้องกับ intent route",
    passed: conclusionConsistent,
    evidence: conclusionConsistent
      ? state.intent.type === "decision"
        ? "พบ facts/assumptions แยกกันและมีข้อสรุป"
        : "พบคำตอบตรงประเด็นตาม intent route"
      : "ไม่พบโครงสร้างคำตอบที่สอดคล้องกับ intent route",
    score: conclusionConsistent ? 1 : 0,
  });

  const score = checks.reduce((sum, check) => sum + check.score, 0) / checks.length;
  return {
    status: checks.every((check) => check.passed) ? "ผ่าน" : "ต้องตรวจสอบ",
    checks,
    score: Number(score.toFixed(3)),
  };
}

export function buildReasoningGraph(state: PCAState): ReasoningGraph {
  const claims: ClaimNode[] = [];
  const edges: ReasoningGraphEdge[] = [];
  const evidenceClaims = state.evidence_report.items
    .filter((item) => item.source !== "user_input")
    .map((item) => {
    const id = `claim-${item.id}`;
    claims.push({
      id,
      text: item.text,
      type: "fact",
      status: item.composite_score >= 0.6 ? "supported" : "partial",
      source_module: "Evidence Evaluation",
      evidence_ids: [item.id],
      assumption_ids: [],
      conflict_ids: [],
      support_score: Number(item.composite_score.toFixed(3)),
    });
    return { id, evidenceId: item.id };
    });

  const assumptionClaims = state.hypotheses.map((hypothesis, index) => {
    const id = `claim-assumption-${index + 1}`;
    claims.push({
      id,
      text: hypothesis.claim,
      type: "assumption",
      status: hypothesis.confidence >= 0.7 ? "partial" : "unsupported",
      source_module: "Hypothesis",
      evidence_ids: [],
      assumption_ids: [id],
      conflict_ids: [],
      support_score: Number(hypothesis.confidence.toFixed(3)),
    });
    return id;
  });

  const unknownClaims = state.missing_info.map((missing, index) => {
    const id = `claim-unknown-${index + 1}`;
    claims.push({
      id,
      text: missing,
      type: "unknown",
      status: "unsupported",
      source_module: "Critique",
      evidence_ids: [],
      assumption_ids: [],
      conflict_ids: [],
      support_score: 0,
    });
    return id;
  });

  const selected = state.decision_matrix.options.find(
    (option) => option.id === state.decision_matrix.selected_option
  );
  const conclusionId = state.intent.type === "decision"
    ? "claim-conclusion-selected-option"
    : "claim-conclusion-routed-answer";
  const conclusionEvidenceIds = state.intent.type === "decision"
    ? selected?.evidence_ids ?? []
    : state.evidence_report.items
      .filter((item) => item.source !== "user_input")
      .slice(0, 4)
      .map((item) => item.id);
  const conclusionSupport = clamp01(
    (state.evidence_report.aggregate_score * 0.5) +
    (state.intent.type === "decision" ? state.decision_matrix.selected_score * 0.3 : 0.15) +
    (state.logical_verification.score * 0.2)
  );
  const conclusionStatus: ClaimStatus = conclusionSupport >= 0.75
    ? "supported"
    : conclusionSupport >= 0.45 ? "partial" : "unsupported";
  claims.push({
    id: conclusionId,
    text: state.intent.type === "decision"
      ? selected?.label ?? state.decision ?? "ยังไม่มีข้อสรุป"
      : state.decision || "คำตอบถูกสร้างตาม intent route",
    type: "conclusion",
    status: conclusionStatus,
    source_module: state.intent.type === "decision" ? "Decision" : "Intent Router",
    evidence_ids: conclusionEvidenceIds,
    assumption_ids: assumptionClaims,
    conflict_ids: state.conflict_findings.map((finding) => finding.id),
    decision_option_id: selected?.id,
    support_score: Number(conclusionSupport.toFixed(3)),
  });

  for (const evidence of evidenceClaims) {
    edges.push({
      id: `edge-${evidence.id}-supports-conclusion`,
      from: evidence.id,
      to: conclusionId,
      relation: "supports",
      weight: Number((state.evidence_report.items.find((item) => item.id === evidence.evidenceId)?.composite_score ?? 0).toFixed(3)),
      rationale: state.intent.type === "decision"
        ? "หลักฐานนี้ถูกใช้ประเมินและสนับสนุนทางเลือกที่เลือก"
        : "หลักฐานนี้สนับสนุนคำตอบตาม intent route",
    });
  }
  for (const assumptionId of assumptionClaims) {
    edges.push({
      id: `edge-${assumptionId}-assumes-conclusion`,
      from: assumptionId,
      to: conclusionId,
      relation: "assumes",
      weight: 0.5,
      rationale: "ข้อสรุปขึ้นกับสมมติฐานนี้",
    });
  }
  state.conflict_findings.forEach((finding) => {
    const conflictId = `claim-conflict-${finding.id}`;
    claims.push({
      id: conflictId,
      text: finding.evidence,
      type: "unknown",
      status: "partial",
      source_module: "Critique",
      evidence_ids: [],
      assumption_ids: [],
      conflict_ids: [finding.id],
      support_score: Number(finding.score.toFixed(3)),
    });
    edges.push({
      id: `edge-${conflictId}-contradicts-conclusion`,
      from: conflictId,
      to: conclusionId,
      relation: "contradicts",
      weight: Number(finding.score.toFixed(3)),
      rationale: "conflict นี้ลดความมั่นใจในข้อสรุป",
    });
  });
  unknownClaims.forEach((unknownId) => {
    edges.push({
      id: `edge-${unknownId}-influences-conclusion`,
      from: unknownId,
      to: conclusionId,
      relation: "influences",
      weight: 0.2,
      rationale: "ข้อมูลที่ขาดทำให้ข้อสรุปต้องมีขอบเขต",
    });
  });

  return {
    claims,
    edges,
    selected_option: state.intent.type === "decision" ? state.decision_matrix.selected_option : "",
    unsupported_claim_count: claims.filter((claim) => claim.status === "unsupported").length,
    methodology: "claim-level graph: evidence supports, assumptions condition, conflicts contradict, unknowns constrain conclusions",
  };
}

export function buildStateTransitions(state: PCAState): StateTransition[] {
  const transition = (
    id: string,
    module: string,
    state_field: string,
    before: unknown,
    after: unknown,
    trigger: string,
    impact: string
  ): StateTransition => ({ id, module, state_field, before, after, trigger, impact });
  return [
    transition(
      "transition-observation-input",
      "Observation",
      "observations",
      0,
      state.observations.length,
      "รับ user_input และ tokenize",
      "สร้างข้อมูลตั้งต้นสำหรับ Understanding"
    ),
    transition(
      "transition-context-missing-info",
      "Critique",
      "missing_info",
      0,
      state.missing_info,
      "ตรวจสอบความครบถ้วนของ context",
      state.missing_info.length > 0 ? "ลด confidence และบังคับให้ระบุข้อมูลที่ขาด" : "ไม่เพิ่มข้อจำกัดด้านข้อมูล"
    ),
    transition(
      "transition-memory-retrieval",
      "Memory Retrieval",
      "memory_retrieval",
      { candidate_count: 0, matched_count: 0 },
      {
        candidate_count: state.memory_retrieval.candidate_count,
        matched_count: state.memory_retrieval.matched_count,
      },
      "ค้น persistent memory ด้วย query tokens และ threshold",
      "เปลี่ยน memory hits ให้เป็น context/evidence ที่ตรวจสอบได้"
    ),
    transition(
      "transition-evidence-score",
      "Evidence Evaluation",
      "evidence_report.aggregate_score",
      0,
      state.evidence_report.aggregate_score,
      "รวม relevance, quality และ consistency ของ evidence",
      state.intent.type === "decision"
        ? "กำหนดน้ำหนักหลักฐานที่ใช้ใน Decision Matrix"
        : "กำหนดขอบเขตหลักฐานสำหรับคำตอบตาม intent route"
    ),
    ...(state.intent.type === "decision"
      ? [
          transition(
            "transition-decision-selection",
            "Decision",
            "decision_matrix.selected_option",
            "",
            state.decision_matrix.selected_option,
            "คำนวณ weighted multi-criteria score",
            `เลือกทางเลือกด้วย score ${state.decision_matrix.selected_score.toFixed(3)}`
          ),
        ]
      : [
          transition(
            "transition-intent-route",
            "Intent Router",
            "intent",
            "",
            state.intent,
            "จำแนก intent ก่อนเลือก pipeline",
            `ใช้ ${state.intent.pipeline} pipeline และไม่สร้าง Decision Matrix`
          ),
        ]),
    transition(
      "transition-verification",
      "Verification",
      "verification.status",
      "ต้องตรวจสอบ",
      state.verification.status,
      `ตรวจ evidence grounding, ${state.intent.type === "decision" ? "decision alignment" : "route alignment"} และ consistency`,
      `verification score ${state.verification.score.toFixed(3)} ส่งผลต่อ confidence`
    ),
    transition(
      "transition-confidence",
      "Verification",
      "confidence",
      "ปานกลาง",
      state.confidence,
      "รวม context, evidence, conflict, memory และ verification",
      "กำหนดระดับความมั่นใจสุดท้ายที่แสดงต่อผู้ใช้"
    ),
  ];
}

function buildDataflow(state: PCAState): DataflowEdge[] {
  const edge = (
    id: string,
    from: string,
    to: string,
    outputs: string[],
    inputs: string[],
    transformation: string,
    item_count: number
  ): DataflowEdge => ({ id, from, to, outputs, inputs, transformation, item_count });
  return [
    edge("flow-observation-understanding", "Observation", "Understanding",
      ["user_input", "language", "unique_token_count"], ["language", "intent_features", "context_features"],
      "tokenize + language detection + feature extraction", state.observations.length),
    edge("flow-understanding-purpose", "Understanding", "Purpose",
      ["understanding", "selected_intent"], ["purpose", "constraints"],
      "intent classification becomes analysis goal and constraints", 1),
    edge("flow-purpose-memory", "Purpose", "Memory Retrieval",
      ["purpose", "user_input"], ["query_tokens", "retrieval_threshold"],
      "purpose constrains retrieval query; lexical matcher ranks candidates", state.memory_retrieval.candidate_count),
    edge("flow-memory-evidence", "Memory Retrieval", "Evidence Evaluation",
      ["memory_hits", "retrieval_scores"], ["memory_evidence", "source_quality"],
      "retrieved hits become scored evidence items", state.memory_retrieval.matched_count),
    edge("flow-hypothesis-evidence", "Hypothesis", "Evidence Evaluation",
      ["hypotheses"], ["assumption_context"], "hypotheses define interpretation boundaries", state.hypotheses.length),
    edge("flow-evidence-critique", "Evidence Evaluation", "Critique",
      ["evidence_report", "aggregate_score"], ["missing_signals", "uncertainty"],
      "evidence coverage and consistency produce critique signals", state.evidence_report.items.length),
    ...(state.intent.type === "decision"
      ? [
          edge("flow-critique-decision", "Critique", "Decision",
            ["critique_score", "missing_info", "conflicts"], ["risk_penalties", "matrix_constraints"],
            "critique adjusts risk-control and feasibility criteria", state.conflict_findings.length + state.missing_info.length),
          edge("flow-evidence-decision", "Evidence Evaluation", "Decision",
            ["evidence_items", "evidence_score"], ["criterion_scores", "evidence_ids"],
            "evidence items support option scoring and citation", state.evidence_report.items.length),
          edge("flow-decision-communication", "Decision", "Communication",
            ["decision_matrix", "selected_option"], ["prompt_constraints", "allowed_citations"],
            "matrix and selected option become generation constraints", state.decision_matrix.options.length),
        ]
      : [
          edge("flow-critique-intent-route", "Critique", "Intent Router",
            ["critique_score", "missing_info", "conflicts"], ["route_constraints", "uncertainty"],
            "critique constrains the routed answer", state.conflict_findings.length + state.missing_info.length),
          edge("flow-evidence-intent-route", "Evidence Evaluation", "Intent Router",
            ["evidence_items", "evidence_score"], ["allowed_citations", "route_grounding"],
            "evidence supports the routed answer without creating action alternatives", state.evidence_report.items.length),
          edge("flow-intent-communication", "Intent Router", "Communication",
            ["intent", "pipeline"], ["prompt_constraints", "allowed_citations"],
            "intent route becomes the generation constraint", 1),
        ]),
    edge("flow-communication-verification", "Communication", "Verification",
      ["response", "evidence_citations"], ["logical_checks", "grounding_checks"],
      "response citations and conclusion are tested against source evidence", 1),
    edge("flow-verification-reflection", "Verification", "Reflection",
      ["verification_score", "logical_verification"], ["confidence_update", "reflection_state"],
      "verification result recalculates confidence and reflection", state.verification.detailed_checks.length),
  ];
}

function finalizeRuntimeMetrics(state: PCAState): void {
  const traceStageByModule: Record<string, string> = {
    Observation: "OBSERVATION",
    Understanding: "UNDERSTANDING",
    "Memory Retrieval": "MEMORY",
    "Evidence Evaluation": "EVIDENCE_EVALUATION",
    Critique: "CRITIQUE",
    Decision: "DECISION",
    Verification: "VERIFICATION_RESULT",
  };
  const outputCountByModule: Record<string, number> = {
    Observation: state.observations.length,
    Understanding: state.understanding ? 1 : 0,
    "Memory Retrieval": state.memory_retrieval.matched_count,
    "Evidence Evaluation": state.evidence_report.items.length,
    Critique: state.critique.length,
    Decision: state.decision_matrix.options.length,
    Verification: state.verification.detailed_checks.length + state.logical_verification.checks.length,
  };
  state.runtime_metrics = state.module_audit.map((audit) => {
    const trace = state.trace.find((entry) => entry.stage === traceStageByModule[audit.module]);
    const metrics: ModuleRuntimeMetric = {
      module: audit.module,
      duration_ms: Number((trace?.duration_ms ?? 0).toFixed(3)),
      input_count: audit.input_count,
      output_count: outputCountByModule[audit.module] ?? audit.findings.length,
      evidence_count: state.evidence_report.items.length,
      hypothesis_count: state.hypotheses.length,
      memory_hits: state.memory_retrieval.matched_count,
      missing_info_count: state.missing_info.length,
      conflict_count: state.conflict_findings.length,
    };
    audit.metrics = metrics;
    return metrics;
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
    state.intent.type === "decision"
      ? state.language === "th"
        ? "เสนอข้อสรุปเชิงยุทธศาสตร์ที่แยกแยะระหว่างข้อเท็จจริงและการตีความ พร้อมระบุขอบเขตและข้อจำกัด"
        : "Present strategic conclusions distinguishing facts from interpretations, with explicit scope and limitations."
      : state.language === "th"
        ? `ใช้ ${state.intent.pipeline} pipeline เพื่อสร้างคำตอบตามเจตนาของคำถาม โดยไม่สร้างทางเลือกเชิงการตัดสินใจ`
        : `Use the ${state.intent.pipeline} pipeline to answer the question without generating action alternatives.`;

  state.conflicts = conflicts;
  state.conflict_findings = conflictFindings;
  const evidenceScore = state.evidence_report.aggregate_score;
  const critiqueScore = state.module_audit.find((audit) => audit.module === "Critique")?.score ?? 0;
  state.decision_matrix = buildDecisionMatrix(state, critiqueScore);
  const aggregationScore = state.intent.type === "decision"
    ? Number(
      (state.decision_matrix.selected_score * 0.6 + critiqueScore * 0.4 - conflictFindings.length * 0.1).toFixed(3)
    )
    : Number(
      (state.evidence_report.aggregate_score * 0.6 + critiqueScore * 0.4 - conflictFindings.length * 0.1).toFixed(3)
    );
  state.confidence_report = buildConfidenceReport(state, 0);
  state.confidence = state.confidence_report.band;
  state.module_audit.push({
    module: "Decision",
    algorithm: state.intent.type === "decision"
      ? state.decision_matrix.methodology
      : `route-aware aggregation for ${state.intent.pipeline} pipeline`,
    input_count: state.evidence_report.items.length + conflictFindings.length + state.decision_matrix.options.length,
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
      selected_option: state.decision_matrix.selected_option,
      selected_score: state.decision_matrix.selected_score,
    },
    metrics: {
      module: "Decision",
      duration_ms: 0,
      input_count: state.evidence_report.items.length + conflictFindings.length,
      output_count: state.decision_matrix.options.length,
      evidence_count: state.evidence_report.items.length,
      hypothesis_count: state.hypotheses.length,
      memory_hits: state.memories.length,
      missing_info_count: state.missing_info.length,
      conflict_count: conflictFindings.length,
    },
  });

  record(state, "DECISION", {
    decision: state.decision,
    confidence: state.confidence,
    confidence_report: state.confidence_report,
    aggregation_score: Math.max(0, aggregationScore),
    decision_matrix: state.decision_matrix,
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

export function buildSystemPrompt(
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

  const allowedEvidence = state.evidence_report.items.filter((item) => item.source !== "user_input");
  const evidenceSection = `
 หลักฐานที่ pipeline อนุญาตให้อ้างอิง:
${allowedEvidence.map((item) =>
  `- [หลักฐาน: ${item.id}] source=${item.source}, relevance=${item.relevance_score.toFixed(3)}, composite=${item.composite_score.toFixed(3)}: ${item.text}`
).join("\n")}
 หากใช้หลักฐาน ให้ใส่ ID จริงจากรายการด้านบน เช่น [หลักฐาน: ${allowedEvidence[0]?.id ?? "id-จากรายการ"}] ห้ามเขียนคำว่า evidence-id เป็น placeholder และห้ามอ้างหลักฐานที่ไม่มีในรายการนี้
 user_input เป็นเพียงคำถามและบริบท ไม่ใช่หลักฐาน`;

  const decisionSection = state.intent.type === "decision" ? `
ข้อกำหนดจาก Decision module:
- decision: ${state.decision}
- aggregation score: ${state.module_audit.find((audit) => audit.module === "Decision")?.score?.toFixed(3) ?? "0.000"}
- evidence aggregate: ${state.evidence_report.aggregate_score.toFixed(3)}
- missing information: ${state.missing_info.length > 0 ? state.missing_info.join("; ") : "ไม่พบ"}
- selected option: ${state.decision_matrix.selected_option} — ${state.decision_matrix.options.find((option) => option.id === state.decision_matrix.selected_option)?.label ?? "ไม่ระบุ"}
- decision matrix reason: ${state.decision_matrix.selection_reason}
- alternatives: ${state.decision_matrix.options.map((option) => `${option.id}=${option.label} (${option.weighted_score.toFixed(3)})`).join("; ")}
- ต้องกล่าวถึง selected option หรือ label ของทางเลือกที่เลือกในข้อสรุป และอธิบาย trade-off กับทางเลือกอื่น
- confidence ต้องไม่เกินระดับที่หลักฐานรองรับ และผู้ใช้เป็นผู้ตัดสินใจขั้นสุดท้าย`
    : `
ข้อกำหนดจาก Intent Router:
- route: ${state.intent.type}
- pipeline: ${state.intent.pipeline}
- rationale: ${state.intent.rationale}
- ห้ามสร้าง Decision Matrix หรือเสนอทางเลือกเชิงการดำเนินการ เพราะคำถามนี้ไม่ใช่ decision
- ตอบตามเจตนาของคำถามโดยตรง และอย่าเขียนคำถามของผู้ใช้ซ้ำเป็นข้อเท็จจริง`;

  const conflictSection = state.conflict_findings.length > 0
    ? `
ความขัดแย้งที่ต้องตรวจสอบ:
${state.conflict_findings.map((finding) =>
  `- [ความขัดแย้ง: ${finding.id}] severity=${finding.severity}: ${finding.prior_signal} → ${finding.current_signal}`
).join("\n")}
หากกล่าวถึง conflict ต้องอ้างอิง conflict id ด้วยรูปแบบ [ความขัดแย้ง: conflict-id]`
    : "\nไม่พบ conflict ที่ต้องอ้างอิงจาก pipeline";

  // Internal PCA controls are audited after the user-facing answer is selected.
  const coreRules = `
กฎสำคัญ (บังคับทุกข้อ):
  - Firekeeper OS lifecycle: Understand → Plan → Reason → Respond → Reflect → Audit
 - Governance gate: Truth before certainty, Evidence before opinion, Human agency before automation
- ตอบเป็นภาษาไทยเป็นหลัก ห้ามใช้ภาษาจีน
 - ห้ามตัดสินใจแทนผู้ใช้
 - ตอบคำถามตามปกติแบบผู้ช่วยที่เข้าใจง่าย เริ่มด้วยคำตอบตรงประเด็น
 - อย่าแสดงรายงาน PCA, pipeline, หัวข้อภายใน, labels [ข้อเท็จจริง]/[สมมติฐาน]/[ข้อมูลที่ขาด] หรือ [DECISION_SUMMARY] เป็นคำตอบหลัก
 - สำหรับ decision ให้บอกคำแนะนำเบื้องต้นและ trade-off อย่างเป็นธรรมชาติ โดยย้ำว่าผู้ใช้เป็นผู้ตัดสินใจขั้นสุดท้าย
 - หากข้อมูลไม่พอ ให้บอกข้อจำกัดสั้น ๆ ในภาษาธรรมชาติ ไม่ต้องสร้างรายงาน
 - ห้ามอ้าง user_input เป็นหลักฐาน; หากใช้หลักฐาน ให้ใช้ ID จริงจากรายการหลักฐานเท่านั้น
 - หากมี conflict ให้กล่าวถึงอย่างเป็นธรรมชาติและอ้างอิง ID จริงของ conflict`;

  const routeStructure = state.intent.type === "decision"
    ? `
### 3. ข้อจำกัดและทางเลือก (Boundaries & Options)
ระบุข้อจำกัด ความเสี่ยง และเสนอทางเลือก 2-3 แนว`
    : state.intent.type === "explanatory"
      ? `
### 3. คำอธิบายและข้อสรุป (Explanation & Conclusion)
อธิบายความหมาย กลไก หรือมุมมองที่เกี่ยวข้อง โดยไม่สร้างตัวเลือกการดำเนินการ`
      : state.intent.type === "summary"
        ? `
### 3. สรุปสาระสำคัญ (Summary)
สรุปเฉพาะสาระที่มีอยู่ และแยกข้อมูลที่ยังไม่ทราบ`
        : state.intent.type === "comparison"
          ? `
### 3. ตารางเปรียบเทียบ (Comparison)
เปรียบเทียบความแตกต่าง ข้อดี ข้อจำกัด และ trade-off โดยไม่บังคับให้เลือก`
          : `
### 3. คำตอบโดยตรง (Direct Answer)
ตอบตามข้อมูลที่รองรับ โดยไม่สมมติว่าเป็นการตัดสินใจ`;

  if (deepReasoning) {
    return `คุณคือ FIRE KEEPER ระบบวิเคราะห์ปัญญาประดิษฐ์ตามกรอบ PUNN Cognitive Architecture (PCA) — Full Deep Analysis Mode

${toneInstruction}${historySection}${memorySection}${personalCtx}${contextWarning}${conflictWarning}${evidenceSection}${decisionSection}${conflictSection}
${coreRules}

คุณต้องวิเคราะห์เชิงลึกเต็มรูปแบบ โดยใช้กรอบ FIRE:
- **F**act: ข้อเท็จจริงเชิงประจักษ์
- **I**nference: การอนุมานและตีความ
- **R**isk: ความเสี่ยงและข้อจำกัด
- **E**vidence: หลักฐานอ้างอิง

  ตอบคำถามโดยตรง 2-5 ย่อหน้า ใช้ข้อมูลจากการวิเคราะห์เป็นพื้นหลัง แต่ห้ามเปิดเผยรายงาน PCA ภายใน`;
  }

  return `คุณคือ FIRE KEEPER ระบบวิเคราะห์ปัญญาประดิษฐ์ตามกรอบ PUNN Cognitive Architecture (PCA)

${toneInstruction}${historySection}${memorySection}${personalCtx}${contextWarning}${conflictWarning}${evidenceSection}${decisionSection}${conflictSection}
${coreRules}

กรอบการวิเคราะห์ PUNN FIRE:
- Fact First: แยก [ข้อเท็จจริง] ออกจาก [สมมติฐาน]
- Inference-based Reasoning: ใช้เหตุผลจากหลักฐาน
- Risk & Reflection: ประเมินความเสี่ยงและข้อจำกัด
- Evidence Evaluation: ประเมินน้ำหนักหลักฐาน

  ตอบคำถามโดยตรง 1-4 ย่อหน้า ใช้ภาษาธรรมชาติและไม่แสดงโครงสร้าง pipeline หรือรายงาน PCA`;
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
    memories: requestedMemories,
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
    intent: classifyIntent(question.trim()),
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
    runtime_metrics: [],
    dataflow: [],
    memory_retrieval: {
      query: question.trim(),
      query_tokens: [],
      algorithm: "",
      threshold: MEMORY_RELEVANCE_THRESHOLD,
      candidate_count: 0,
      matched_count: 0,
      hits: [],
      miss_reason: "ยังไม่เริ่ม memory retrieval",
    },
    decision_matrix: {
      methodology: "",
      criteria_weights: {},
      options: [],
      selected_option: "",
      selected_score: 0,
      selection_reason: "",
    },
    logical_verification: {
      status: "ต้องตรวจสอบ",
      checks: [],
      score: 0,
    },
    reasoning_quality: {
      evidence_count: 0,
      evidence_coverage: 0,
      evidence_quality: 0,
      memory_hits: 0,
      hypothesis_count: 0,
      conflict_count: 0,
      missing_information_count: 0,
      unsupported_claim_count: 0,
      verification_pass_rate: 0,
      decision_margin: 0,
    },
    runtime_summary: {
      cognitive: {
        total_ms: 0,
        pre_llm_ms: 0,
        post_llm_ms: 0,
        measured_stage_count: 0,
        phase_count: 0,
      },
      llm: {
        provider: "openai",
        model: "gpt-4o",
        request_ms: 0,
        retry_count: 0,
      },
    },
    reasoning_graph: {
      claims: [],
      edges: [],
      selected_option: "",
      unsupported_claim_count: 0,
      methodology: "",
    },
    state_transitions: [],
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
    const memoryStore = await loadMemoryWithBackend();
    const persistentMemories = memoryStore.items.map((memory) => ({
      content: memory.content,
      layer: memory.layer,
      source: memory.source,
      confidence: memory.confidence,
    }));
    const suppliedMemories = requestedMemories ?? [];
    const memoryCandidates = [...persistentMemories, ...suppliedMemories].filter((memory, index, all) =>
      all.findIndex((candidate) => candidate.content === memory.content) === index
    );
    state.memory_retrieval.storage_backend = memoryStore.backend;
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
    timed(state, () => stageMemoryRetrieval(state, memoryCandidates));
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
    timed(state, () => stageDecision(state, history, memoryCandidates, context, conflicts, conflictFindings));
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
    const requestCompletion = (correction = "") => getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        ...historyMessages,
        { role: "user", content: question },
        ...(correction ? [{
          role: "system" as const,
          content: `ผลตรวจสอบรอบแรกไม่ผ่าน: ${correction}\nกรุณาสร้างคำตอบใหม่ให้ครบถ้วนตามหลักฐานและรูปแบบอ้างอิงที่กำหนด ห้ามเพียงเพิ่ม keyword โดยไม่มีเนื้อหาสนับสนุน`,
        }] : []),
      ],
      max_completion_tokens: deepReasoning ? 3000 : 1800,
      temperature: 0.7,
    });

    // Communication comes first. The user-facing answer is fixed before audit
    // begins; audit must never rewrite, retry, or block this answer.
    const completion = await requestCompletion();
    let responseText = normalizeUserFacingResponse(
      state,
      completion.choices[0]?.message?.content ?? "ไม่สามารถประมวลผลได้ในขณะนี้"
    );
    const llmEndedAt = new Date().toISOString();
    const llmMs = Number((monotonicMs() - llmStart).toFixed(3));
    const llmRuntime: LLMRuntime = {
      provider: "openai",
      model: completion.model ?? "gpt-4o",
      request_ms: llmMs,
      retry_count: 0,
      prompt_tokens: completion.usage?.prompt_tokens,
      completion_tokens: completion.usage?.completion_tokens,
      total_tokens: completion.usage?.total_tokens,
    };
    recordRuntime(
      state,
      "RESPOND",
      "ส่งคำตอบปกติจาก LLM ก่อนทำ audit",
      llmMs,
      llmStartedAt,
      llmEndedAt
    );

    state.response = responseText;
    state.llm_model = completion.model ?? "gpt-4o";
    state.notes.push(`LLM: openai (${state.llm_model})`);
    recordMeasured(
      state,
      "COMMUNICATION",
      { response_length: responseText.length, model: state.llm_model, retry_count: 0 },
      llmStartedAt,
      llmEndedAt,
      llmMs
    );

    const reflectStartedAt = new Date().toISOString();
    const reflectStart = monotonicMs();
    timed(state, () => stageReflection(state));
    timed(state, () => stageLearning(state));
    // Audit starts only after the normal answer has been fixed.
    state.notes.push("Audit completed after user-facing response");
    state.verification = buildVerificationReport(state, responseText);
    state.logical_verification = buildLogicalVerification(state, responseText);
    state.verification.detailed_checks = [
      ...state.verification.detailed_checks,
      ...state.logical_verification.checks,
    ];
    state.verification.checks = [
      ...state.verification.checks,
      ...state.logical_verification.checks.map((check) =>
        `${check.criterion}: ${check.passed ? "ผ่าน" : "ไม่ผ่าน"} — ${check.evidence}`
      ),
    ];
    state.verification.score = Number((
      state.verification.detailed_checks.reduce((sum, check) => sum + check.score, 0) /
      state.verification.detailed_checks.length
    ).toFixed(3));
    state.verification.status =
      state.verification.status === "ผ่าน" && state.logical_verification.status === "ผ่าน"
        ? "ผ่าน"
        : "ต้องตรวจสอบ";
    state.verification.consistency =
      state.verification.consistency === "สอดคล้อง" && state.logical_verification.status === "ผ่าน"
        ? "สอดคล้อง"
        : "ต้องทบทวน";
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
        logical_verification_score: state.logical_verification.score,
      },
    });
    record(state, "VERIFICATION_RESULT", {
      score: state.verification.score,
      detailed_checks: state.verification.detailed_checks,
      logical_verification: state.logical_verification,
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
    finalizeRuntimeMetrics(state);
    state.dataflow = buildDataflow(state);
    state.reasoning_graph = buildReasoningGraph(state);
    state.state_transitions = buildStateTransitions(state);
    state.reasoning_quality = buildReasoningQuality(state);
    state.runtime_summary = buildRuntimeSummary(
      state,
      Number((llmStart - startMono).toFixed(3)),
      llmRuntime
    );

    res.json({
      response: state.response,
      reports: buildReportLayers(state),
      pcaState: {
        notes: state.notes,
        observations: state.observations,
        language: state.language,
        intent: state.intent,
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
        runtime_metrics: state.runtime_metrics,
        dataflow: state.dataflow,
        memory_retrieval: state.memory_retrieval,
        decision_matrix: state.decision_matrix,
        logical_verification: state.logical_verification,
         reasoning_quality: state.reasoning_quality,
         runtime_summary: state.runtime_summary,
         reasoning_graph: state.reasoning_graph,
         state_transitions: state.state_transitions,
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
