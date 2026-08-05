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
  analyzeConflictFindings,
  buildEvidenceReport,
  buildKnowledgeMap,
  buildConfidenceReport,
  buildVerificationReport,
  buildDecisionMatrix,
  buildLogicalVerification,
  buildReasoningGraph,
  buildStateTransitions,
  buildSystemPrompt,
  buildVerifiedFallback,
  normalizeUserFacingResponse,
  classifyIntent,
  buildReportLayers,
  type PCAState,
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
  const findings = analyzeConflictFindings("ทำไมถึงไม่แนะนำหุ้นเทคโนโลยี", history);
  assert("Structured conflict finding has evidence", findings[0]?.evidence.length > 0);
  assert("Structured conflict finding has severity", findings[0]?.severity === "ปานกลาง");
});

describe("detectConflicts — negative polarity reversal", () => {
  const history: ConversationTurn[] = [
    { role: "assistant", content: "จากข้อมูลก่อนหน้า ไม่แนะนำหุ้นเทคโนโลยีในตอนนี้" },
  ];
  const question = "ถ้าอย่างนั้น แนะนำหุ้นเทคโนโลยีหรือไม่";
  const result = detectConflicts(question, history);
  const findings = analyzeConflictFindings(question, history);
  assert("Negative prior and positive current signal are detected", result.length > 0);
  assert("Structured negative reversal has evidence", findings.length > 0 && findings[0].evidence.length > 0);
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

// ─── Computed module outputs ───────────────────────────────────────────────────

describe("buildEvidenceReport — weighted evidence scoring", () => {
  const history: ConversationTurn[] = [
    { role: "user", content: "งบประมาณโครงการมีจำกัดและต้องการลดความเสี่ยง" },
    { role: "assistant", content: "ควรตรวจสอบต้นทุนและความเสี่ยงก่อนเริ่มโครงการ" },
  ];
  const memories: PCAState["memories"] = [
    { content: "โครงการที่มีงบประมาณจำกัดควรแบ่งการลงทุนเป็นระยะ", layer: "long-term", source: "test", confidence: 0.9 },
    { content: "หัวข้อที่ไม่เกี่ยวข้องกับการทำอาหาร", layer: "long-term", source: "test", confidence: 0.9 },
  ];
  const report = buildEvidenceReport("ช่วยประเมินความเสี่ยงของโครงการที่มีงบประมาณจำกัด", history, memories);
  assert("Evidence report has methodology", report.methodology.includes("composite"));
  assert("Direct input evidence is included", report.items.some((item) => item.source === "user_input"));
  assert("Relevant memory is included", report.items.some((item) => item.source === "memory"));
  assert("Irrelevant memory is excluded", !report.items.some((item) => item.text.includes("ทำอาหาร")));
  assert("Aggregate score is bounded", report.aggregate_score >= 0 && report.aggregate_score <= 1);
  assert("Evidence items contain component scores", report.items.every((item) =>
    item.relevance_score >= 0 && item.quality_score >= 0 && item.composite_score >= 0
  ));
});

describe("buildEvidenceReport — irrelevant short history is excluded", () => {
  const report = buildEvidenceReport(
    "ช่วยวางแผนการเกษียณ",
    [
      { role: "user", content: "วันนี้ฝนตกหนักมาก" },
      { role: "assistant", content: "ควรพกร่มและตรวจสอบการจราจร" },
    ],
    []
  );
  assert(
    "Unrelated short history is not evidence",
    !report.items.some((item) => item.source === "conversation_history")
  );
});

describe("Intent Router — explanatory and decision routes", () => {
  const explanatory = classifyIntent("รักคืออะไร");
  assert("รักคืออะไร is explanatory", explanatory.type === "explanatory");
  assert("Explanatory route uses explanation pipeline", explanatory.pipeline === "explanation");

  const report = buildEvidenceReport("รักคืออะไร", [], []);
  assert(
    "Explanatory route adds curated knowledge",
    report.items.some((item) => item.source === "knowledge_base")
  );
  assert(
    "Explanatory knowledge does not echo the question",
    !report.items.some((item) => item.source === "knowledge_base" && item.text === "รักคืออะไร")
  );

  const explanatoryState = makeVerificationState();
  explanatoryState.intent = explanatory;
  explanatoryState.evidence_report = report;
  explanatoryState.decision_matrix = buildDecisionMatrix(explanatoryState, 0.8);
  const explanatoryFallback = buildVerifiedFallback(explanatoryState);
  assert("Explanatory route has no decision alternatives", explanatoryState.decision_matrix.options.length === 0);
  assert("Explanatory fallback does not recommend phased action", !explanatoryFallback.includes("ดำเนินการเป็นระยะ"));
  assert(
    "Explanatory fallback contains the supported meaning",
    explanatoryFallback.includes("ความรักเป็นความผูกพัน")
  );
  assert(
    "Explanatory fallback answers directly",
    explanatoryFallback.includes("คำตอบตรงประเด็น:") &&
      explanatoryFallback.includes("ความรักเป็นความผูกพัน")
  );
  assert(
    "Explanatory verification accepts a natural direct answer",
    buildVerificationReport(explanatoryState, explanatoryFallback).status === "ผ่าน"
  );
  assert(
    "Explanatory logical verification accepts a natural direct answer",
    buildLogicalVerification(explanatoryState, explanatoryFallback).status === "ผ่าน"
  );
  assert(
    "Explanatory fallback passes route-aware logical verification",
    buildLogicalVerification(explanatoryState, explanatoryFallback).status === "ผ่าน"
  );
  const modelStyleReport = `### 1. การสังเกตการณ์และทำความเข้าใจ
คำถามนี้ต้องการความหมาย

### 2. ข้อสรุปเชิงยุทธศาสตร์
[ข้อเท็จจริง]: ความรักเป็นความผูกพันทางอารมณ์

### 3. คำอธิบายและข้อสรุป
ความรักคือความผูกพันทางอารมณ์และสังคมที่แสดงผ่านความใกล้ชิด ความห่วงใย และการดูแลกัน [หลักฐาน: knowledge-love-definition]

[DECISION_SUMMARY]: ความรักคือความผูกพันทางอารมณ์และสังคม`;
  const normalized = normalizeUserFacingResponse(explanatoryState, modelStyleReport);
  assert("Model report is normalized to the direct answer", normalized.startsWith("ความรักคือความผูกพัน"));
  assert("Normalized answer removes PCA headings", !normalized.includes("### 1."));
  assert(
    "User-facing answer removes citation placeholders",
    !normalizeUserFacingResponse(
      explanatoryState,
      "คำตอบนี้อธิบายได้อย่างตรงประเด็นและชัดเจน [หลักฐาน: evidence-id]"
    ).includes("evidence-id")
  );

  const knowledgeMap = buildKnowledgeMap(explanatoryState, {
    richness: "thin",
    missingSignals: [],
  });
  assert(
    "Knowledge map does not echo the question as a fact",
    !knowledgeMap.facts.includes("ข้อมูลที่ผู้ใช้ระบุ: รักคืออะไร")
  );

  const decision = classifyIntent("ควรลงทุนในหุ้นไหม");
  assert("Investment question is decision", decision.type === "decision");
  assert("Decision route uses decision pipeline", decision.pipeline === "decision");
});

function makeVerificationState(): PCAState {
  return {
    user_input: "ช่วยวิเคราะห์ทางเลือก",
    language: "th",
    intent: {
      type: "decision",
      confidence: 0.88,
      rationale: "test decision route",
      signals: ["decision marker"],
      pipeline: "decision",
    },
    observations: [],
    understanding: "",
    purpose: "",
    constraints: [],
    memories: [],
    hypotheses: [{ claim: "สมมติฐาน: ข้อมูลอาจไม่ครบ", confidence: 0.5 }],
    evidence: [],
    critique: [],
    uncertainty: [],
    decision: "เสนอทางเลือก",
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
      methodology: "test",
      items: [{
        id: "evidence-input",
        source: "user_input",
        text: "ข้อมูลจากผู้ใช้",
        relevance_score: 1,
        quality_score: 0.5,
        consistency_score: 1,
        composite_score: 0.8,
        basis: [],
      }, {
        id: "evidence-knowledge",
        source: "knowledge_base",
        text: "ข้อมูลจาก knowledge base",
        relevance_score: 0.9,
        quality_score: 0.8,
        consistency_score: 1,
        composite_score: 0.86,
        basis: ["curated conceptual knowledge"],
      }],
      aggregate_score: 0.8,
      coverage_score: 1,
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
      query: "",
      query_tokens: [],
      algorithm: "",
      threshold: 0.25,
      candidate_count: 0,
      matched_count: 0,
      hits: [],
    },
    decision_matrix: {
      methodology: "",
      criteria_weights: {},
      options: [],
      selected_option: "",
      selected_score: 0,
      selection_reason: "",
    },
    logical_verification: { status: "ต้องตรวจสอบ", checks: [], score: 0 },
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
        provider: "test",
        model: "test",
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
    knowledge_map: { facts: [], assumptions: [], unknowns: [] },
    trace: [],
    llm_provider: "test",
    llm_model: "test",
    execution_time_ms: 0,
    start_time: "",
    end_time: "",
  };
}

describe("buildVerificationReport — substantive checks", () => {
  const state = makeVerificationState();
  const generic = buildVerificationReport(
    state,
    "[ข้อเท็จจริง]\nหลักฐาน\n[สมมติฐาน]\nสมมติฐาน\nผู้ใช้ตัดสินใจขั้นสุดท้าย"
  );
  const grounded = buildVerificationReport(
    state,
      "[ข้อเท็จจริง]\nโครงการมีข้อมูลสนับสนุนจาก knowledge base [หลักฐาน: evidence-knowledge]\n" +
      "[สมมติฐาน]\nอาจต้องแบ่งการลงทุนเป็นระยะ\nผู้ใช้เป็นผู้ตัดสินใจขั้นสุดท้าย"
  );
  assert("Keyword-only answer does not pass evidence alignment", generic.detailed_checks.find(
    (check) => check.criterion === "evidence_alignment"
  )?.passed === false);
  assert("Grounded answer passes evidence alignment", grounded.detailed_checks.find(
    (check) => check.criterion === "evidence_alignment"
  )?.passed === true);
});

describe("buildReportLayers — separated output contract", () => {
  const state = makeVerificationState();
  state.response = "คำตอบปกติสำหรับผู้ใช้";
  const reports = buildReportLayers(state);
  assert("User Report contains the fixed answer", reports.user_report.answer === state.response);
  assert("User Report contains an executive summary", reports.user_report.executive_summary.length > 0);
  assert("Executive Summary stays concise", reports.user_report.executive_summary.length <= 240);
  assert("Analyst Report contains evidence", reports.analyst_report.evidence_report === state.evidence_report);
  assert("System Trace contains runtime trace", reports.system_trace.trace === state.trace);
  assert("Confidence is shared across reports", reports.confidence_summary.score === state.confidence_report.score);
  assert("Decision Matrix is analyst-only", reports.analyst_report.decision_matrix !== undefined);
  assert("User Report does not expose decision matrix", !("decision_matrix" in reports.user_report));

  const explanatory = { ...state, intent: classifyIntent("รักคืออะไร") };
  const explanatoryReports = buildReportLayers(explanatory);
  assert(
    "Explanatory User Report does not inherit decision matrix",
    explanatoryReports.analyst_report.decision_matrix === undefined
  );
});

describe("buildConfidenceReport — history and memory are separate", () => {
  const state = makeVerificationState();
  state.memories = [{
    content: "memory",
    layer: "long-term",
    source: "test",
    confidence: 0.9,
    retrieval_score: 0.8,
  }];
  const report = buildConfidenceReport(state, 0);
  assert("Memory-only state has no history support", report.components.history_support === 0);
  assert("Memory-only state retains memory support", report.components.memory_support === 0.8);
});

describe("buildSystemPrompt — computed controls are injected", () => {
  const state = makeVerificationState();
  state.module_audit = [{
    module: "Decision",
    algorithm: "test",
    input_count: 1,
    score: 0.8,
    findings: [],
    calculations: {},
  }];
  const prompt = buildSystemPrompt(
    state,
    "Formal Architect",
    false,
    "",
    "",
    { richness: "moderate", missingSignals: [] },
    []
  );
  assert("Prompt includes supported evidence id", prompt.includes("[หลักฐาน: evidence-knowledge]"));
  assert("Prompt excludes user input as evidence", !prompt.includes("[หลักฐาน: evidence-input]"));
  assert("Prompt includes decision output", prompt.includes("เสนอทางเลือก"));
});

describe("buildDecisionMatrix — deterministic alternatives and winner", () => {
  const state = makeVerificationState();
  state.evidence_report.aggregate_score = 0.82;
  state.missing_info = [];
  state.conflict_findings = [];
  const matrix = buildDecisionMatrix(state, 0.9);
  assert("Decision matrix has three alternatives", matrix.options.length === 3);
  assert("Criteria weights sum to one", Math.abs(
    Object.values(matrix.criteria_weights).reduce((sum: number, value: number) => sum + value, 0) - 1
  ) < 0.001);
  assert("Winner is one of the computed alternatives", matrix.options.some(
    (option) => option.id === matrix.selected_option && option.weighted_score === matrix.selected_score
  ));
  assert("Selection reason exposes causal score", matrix.selection_reason.includes("weighted score"));
});

describe("buildLogicalVerification — grounding and decision alignment", () => {
  const state = makeVerificationState();
  state.decision_matrix = {
    methodology: "test",
    criteria_weights: { evidence_alignment: 1 },
    options: [{
      id: "option-phased",
      label: "ดำเนินการเป็นระยะ",
      rationale: "ลดความเสี่ยง",
      criteria: { evidence_alignment: 0.8 },
      weighted_score: 0.8,
        evidence_ids: ["evidence-knowledge"],
    }],
    selected_option: "option-phased",
    selected_score: 0.8,
    selection_reason: "test",
  };
  const result = buildLogicalVerification(
    state,
      "[ข้อเท็จจริง]\nข้อมูลจาก knowledge base [หลักฐาน: evidence-knowledge]\n" +
      "[สมมติฐาน]\nอาจมีข้อมูลที่ขาด\nข้อสรุป: ดำเนินการเป็นระยะ\nผู้ใช้เป็นผู้ตัดสินใจขั้นสุดท้าย"
  );
  assert("Grounded evidence passes logical verification", result.checks.find(
    (check) => check.criterion === "evidence_grounding"
  )?.passed === true);
  assert("Selected decision is aligned", result.checks.find(
    (check) => check.criterion === "decision_alignment"
  )?.passed === true);
  assert("Logical verification is not keyword-only", result.checks.some(
    (check) => check.criterion === "fact_conclusion_consistency"
  ));

  const noSupportedEvidenceState = makeVerificationState();
  noSupportedEvidenceState.evidence_report.items = noSupportedEvidenceState.evidence_report.items
    .filter((item) => item.source === "user_input");
  const noSupportedEvidenceResult = buildLogicalVerification(
    noSupportedEvidenceState,
    "[ข้อเท็จจริง]\nยังไม่มีหลักฐานภายนอก\n" +
      "[สมมติฐาน]\nข้อมูลอาจไม่ครบ\n" +
      "[ข้อสรุป]\nควรเก็บข้อมูลเพิ่มก่อนตัดสินใจ\n" +
      "ผู้ใช้เป็นผู้ตัดสินใจขั้นสุดท้าย"
  );
  assert(
    "No supported evidence is a valid zero-citation state",
    noSupportedEvidenceResult.checks.find((check) => check.criterion === "evidence_grounding")?.score === 1
  );
});

describe("buildReasoningGraph — claims connect evidence to decision", () => {
  const state = makeVerificationState();
  state.decision_matrix = {
    methodology: "test",
    criteria_weights: { evidence_alignment: 1 },
    options: [{
      id: "option-phased",
      label: "ดำเนินการเป็นระยะ",
      rationale: "ลดความเสี่ยง",
      criteria: { evidence_alignment: 0.8 },
      weighted_score: 0.8,
       evidence_ids: ["evidence-knowledge"],
    }],
    selected_option: "option-phased",
    selected_score: 0.8,
    selection_reason: "test",
  };
  state.logical_verification = { status: "ผ่าน", checks: [], score: 1 };
  const graph = buildReasoningGraph(state);
  assert("Graph contains fact and conclusion claims", graph.claims.some((claim) => claim.type === "fact") &&
    graph.claims.some((claim) => claim.type === "conclusion"));
  assert("Graph contains evidence support edge", graph.edges.some((edge) => edge.relation === "supports"));
  assert("Conclusion points to selected option", graph.selected_option === "option-phased");
  assert("Graph exposes unsupported claim count", graph.unsupported_claim_count >= 0);
});

describe("buildStateTransitions — causal mutations are explicit", () => {
  const state = makeVerificationState();
  state.missing_info = ["งบประมาณ"];
  state.decision_matrix.selected_option = "option-phased";
  state.verification.status = "ผ่าน";
  state.confidence = "ต่ำ";
  const transitions = buildStateTransitions(state);
  assert("Transitions include missing information mutation", transitions.some(
    (transition) => transition.state_field === "missing_info" && Array.isArray(transition.after)
  ));
  assert("Transitions include decision selection", transitions.some(
    (transition) => transition.state_field === "decision_matrix.selected_option"
  ));
  assert("Transitions explain impact", transitions.every((transition) => transition.impact.length > 0));
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
