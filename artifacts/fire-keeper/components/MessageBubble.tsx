import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  ToastAndroid,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

const THAI_TIME_ZONE = 'Asia/Bangkok';

function thaiDate(value?: string | number): Date {
  return value == null ? new Date() : new Date(value);
}

export function formatThaiDateTime(value?: string | number): string {
  return thaiDate(value).toLocaleString('th-TH', {
    timeZone: THAI_TIME_ZONE,
    dateStyle: 'full',
    timeStyle: 'medium',
  });
}

export function formatThaiClock(value?: string | number): string {
  const date = thaiDate(value);
  const parts = new Intl.DateTimeFormat('th-TH', {
    timeZone: THAI_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return `${get('hour')}:${get('minute')}:${get('second')}.${String(date.getUTCMilliseconds()).padStart(3, '0')}`;
}

export function formatThaiFileStamp(value?: string | number): string {
  const date = thaiDate(value);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: THAI_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return `${get('year')}${get('month')}${get('day')}_${get('hour')}${get('minute')}${get('second')}`;
}

export interface TraceEntry {
  stage: string;
  timestamp: string;
  started_at?: string;
  ended_at?: string;
  duration_ms: number;
  measured?: boolean;
  output: Record<string, unknown>;
}

export interface RuntimeEvent {
  phase: string;
  action: string;
  timestamp: string;
  started_at?: string;
  ended_at?: string;
  duration_ms: number;
  measured?: boolean;
}

export interface GovernanceReport {
  status: 'ผ่าน' | 'ต้องตรวจสอบ' | 'หยุด';
  policy: string[];
  safety_checks: string[];
  human_agency_preserved: boolean;
}

export interface VerificationReport {
  status: 'ผ่าน' | 'ต้องตรวจสอบ';
  consistency: 'สอดคล้อง' | 'ต้องทบทวน';
  expected: string[];
  observed: string[];
  checks: string[];
  detailed_checks?: VerificationCheck[];
  score?: number;
}

export interface EvidenceItem {
  id: string;
  source: 'user_input' | 'conversation_history' | 'memory' | 'knowledge_base';
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
  source_coverage?: Record<EvidenceItem['source'], number>;
  source_diversity_score?: number;
  supported_source_count?: number;
}

export interface ConflictFinding {
  id: string;
  type: 'reversal' | 'inconsistency';
  severity: 'ต่ำ' | 'ปานกลาง' | 'สูง';
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
  band: PCAState['confidence'];
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

export interface RuntimeSummary {
  cognitive: {
    total_ms: number;
    pre_llm_ms: number;
    post_llm_ms: number;
    measured_stage_count: number;
    phase_count: number;
  };
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
  storage_backend?: 'postgres' | 'file_fallback';
  miss_reason?: string;
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
  counterfactual_analysis?: CounterfactualAnalysis;
  causal_reasoning?: CausalReasoning;
}

export interface CounterfactualComparison {
  option_id: string;
  condition: string;
  baseline_score: number;
  counterfactual_score: number;
  delta: number;
  outcome: string;
  evidence_ids: string[];
}

export interface CounterfactualAnalysis {
  methodology: string;
  baseline_condition: string;
  counterfactual_condition: string;
  comparisons: CounterfactualComparison[];
  most_robust_option: string;
  sensitivity_score: number;
}

export interface CausalLink {
  id: string;
  cause: string;
  effect: string;
  mechanism: string;
  relation: 'contributes_to' | 'constrains' | 'moderates';
  evidence_ids: string[];
  confidence: number;
}

export interface CausalReasoning {
  methodology: string;
  links: CausalLink[];
  confounders: string[];
  score: number;
}

export interface LogicalVerification {
  status: 'ผ่าน' | 'ต้องตรวจสอบ';
  checks: VerificationCheck[];
  score: number;
}

export interface ClaimNode {
  id: string;
  text: string;
  type: 'fact' | 'assumption' | 'conclusion' | 'unknown';
  status: 'supported' | 'partial' | 'unsupported';
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
  relation: 'supports' | 'assumes' | 'contradicts' | 'influences';
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

export interface KnowledgeMap {
  facts: string[];
  assumptions: string[];
  unknowns: string[];
}

export interface IntentRoute {
  type: 'explanatory' | 'decision' | 'summary' | 'comparison' | 'general';
  confidence: number;
  rationale: string;
  signals: string[];
  pipeline: 'explanation' | 'decision' | 'summary' | 'comparison' | 'general';
}

export interface PCAState {
  user_input?: string;
  intent?: IntentRoute;
  notes: string[];
  observations: string[];
  understanding: string;
  purpose: string;
  decision: string;
  confidence: "สูง" | "ปานกลาง" | "ต่ำ" | "ไม่สามารถประเมินได้";
  conflicts?: string[];
  conflict_findings?: ConflictFinding[];
  missing_info?: string[];
  evidence_report?: EvidenceReport;
  confidence_report?: ConfidenceReport;
  module_audit?: ModuleAudit[];
  runtime_metrics?: ModuleRuntimeMetric[];
  dataflow?: DataflowEdge[];
  memory_retrieval?: MemoryRetrievalReport;
  decision_matrix?: DecisionMatrix;
  counterfactual_analysis?: CounterfactualAnalysis;
  causal_reasoning?: CausalReasoning;
  logical_verification?: LogicalVerification;
  reasoning_quality?: ReasoningQualityMetrics;
  runtime_summary?: RuntimeSummary;
  reasoning_graph?: ReasoningGraph;
  state_transitions?: StateTransition[];
  runtime_lifecycle?: RuntimeEvent[];
  governance?: GovernanceReport;
  verification?: VerificationReport;
  knowledge_map?: KnowledgeMap;
  critique: string[];
  reflection: string[];
  learning: string[];
  agency_checks: string[];
  trace: TraceEntry[];
  llm_provider?: string;
  llm_model?: string;
  execution_time_ms?: number;
  start_time?: string;
  end_time?: string;
}

export interface UserReport {
  answer: string;
  executive_summary: string;
  route?: IntentRoute;
  confidence: PCAState['confidence'];
  limitations: string[];
  next_step?: string;
}

export interface AuditAssumption {
  id: string;
  statement: string;
  confidence: number;
  basis: string;
}

export interface AuditLimitation {
  id: string;
  description: string;
  impact: string;
  mitigation: string;
}

export interface ReasoningTraceStep {
  id: string;
  stage: string;
  purpose: string;
  inputs: string[];
  outputs: string[];
  evidence_ids: string[];
  assumption_ids: string[];
  limitation_ids: string[];
  verification_ids: string[];
}

export interface VerificationCriterion extends VerificationCheck {
  id: string;
  source: 'verification' | 'logical_verification';
}

export interface AnalystReport {
  evidence_report?: EvidenceReport;
  knowledge_map?: KnowledgeMap;
  assumptions: AuditAssumption[];
  reasoning_trace: ReasoningTraceStep[];
  limitations: AuditLimitation[];
  verification_criteria: VerificationCriterion[];
  missing_info: string[];
  conflicts: ConflictFinding[];
  confidence_report?: ConfidenceReport;
  verification?: VerificationReport;
  logical_verification?: LogicalVerification;
  reasoning_quality?: ReasoningQualityMetrics;
  decision_matrix?: DecisionMatrix;
  counterfactual_analysis?: CounterfactualAnalysis;
  causal_reasoning?: CausalReasoning;
}

export interface SystemTrace {
  notes: string[];
  runtime_summary?: RuntimeSummary;
  runtime_lifecycle: RuntimeEvent[];
  trace: TraceEntry[];
  dataflow: DataflowEdge[];
  runtime_metrics: ModuleRuntimeMetric[];
  module_audit: ModuleAudit[];
  state_transitions: StateTransition[];
  reasoning_graph?: ReasoningGraph;
}

export interface ConfidenceSummary {
  score: number;
  band: PCAState['confidence'];
}

export interface ResearchReasoningStep {
  step: string;
  claim: string;
  support: 'truth' | 'counterfactual' | 'rejected_plausibility' | 'unknown';
}

export interface ResearchEvaluation {
  id: string;
  generated_at: string;
  modules: {
    truth_source: { id: string; provenance: string; claims: string[] };
    world_generator: {
      id: string;
      generator: string;
      parameters: Record<string, number>;
      rules: string[];
    };
    truth_engine: { formula: string; derived_values: Record<string, number> };
    plausibility_generator: { claim: string; expected_label: 'false' };
    counterfactual_generator: { condition: string; expected_value: number };
    explanation_consistency: {
      trace_supports_answer: boolean;
      truth_assessment_matches_answer: boolean;
      score: number;
    };
    self_calibration: {
      declared_confidence: number;
      empirical_accuracy: number;
      calibration_error: number;
    };
  };
  test_instance: {
    id: string;
    prompt: string;
    expected_claims: string[];
    plausibility_claim: string;
    counterfactual_prompt: string;
  };
  ai_under_test: {
    model: string;
    answer: string;
    truth_assessment: 'true' | 'false' | 'mixed' | 'unknown';
    rejected_plausibility: boolean;
    counterfactual_answer: string;
    confidence: number;
    reasoning_trace: ResearchReasoningStep[];
  };
  evaluation_layer: {
    metrics: {
      truth_accuracy: number;
      reasoning_quality: number;
      calibration_error: number;
      robustness: number;
      consistency: number;
      generalization: number;
      overall_score: number;
    };
    criteria: string[];
    findings: string[];
  };
}

export interface ResearchSuiteEvaluation {
  id: string;
  generated_at: string;
  methodology: {
    version: string;
    dataset: string;
    dataset_status: 'synthetic_reproducible' | 'external_adapter_required';
    source: string;
    seed: string;
    cases: number;
    repetitions: number;
    generator_model: string;
    verifier_model: string;
    protocol: string[];
    limitations: string[];
  };
  before_after: {
    baseline: ResearchMethodMetrics;
    fire: ResearchMethodMetrics;
    delta: ResearchMetricDelta;
  };
  method_comparison: Array<{
    method: string;
    status: 'not_run' | 'run';
    metrics?: ResearchMethodMetrics;
    notes: string;
  }>;
  results: ResearchBenchmarkResult[];
  stress_tests: Array<{
    case_id: string;
    scenario: string;
    tags: string[];
    method_results: Array<{ method: string; passed: boolean; failure_modes: string[] }>;
  }>;
  external_benchmarks: Array<{
    name: 'TruthfulQA' | 'HaluEval' | 'MMLU-Pro' | 'GPQA';
    status: 'not_loaded';
    reason: string;
    adapter_contract: string;
  }>;
}

export interface ResearchConfusionMetrics {
  true_positive: number;
  false_positive: number;
  true_negative: number;
  false_negative: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface ResearchMethodMetrics {
  method: string;
  case_count: number;
  truth_accuracy: number;
  verification: ResearchConfusionMetrics;
  unsupported_claim_rate: number;
  calibration_error: number;
  decision_stability: number;
  prompt_injection_resistance: number;
  adversarial_robustness: number;
  average_latency_ms: number;
  verifier_agreement: number;
}

export interface ResearchMetricDelta extends Omit<ResearchMethodMetrics, 'method'> {
  method?: string;
}

export interface ResearchBenchmarkResult {
  case_id: string;
  category: string;
  method: string;
  answer: string;
  claims: string[];
  unsupported_claims: string[];
  confidence: number;
  selected_decision?: string;
  verification_predicted: boolean;
  verification_expected: boolean;
  truth_correct: boolean;
  verifier: {
    model: string;
    decision: 'supported' | 'unsupported' | 'uncertain';
    unsupported_claims: string[];
    evidence_ids: string[];
    rationale: string;
  };
  perturbation: {
    selected_decision?: string;
    truth_correct: boolean;
    stable: boolean;
  };
  latency_ms: number;
}

export interface ReportLayers {
  user_report: UserReport;
  analyst_report: AnalystReport;
  system_trace: SystemTrace;
  confidence_summary: ConfidenceSummary;
}

// ─── Stage metadata ───────────────────────────────────────────────────────────

const STAGE_INFO: Record<string, { icon: string; th: string; en: string; desc: string }> = {
  OBSERVATION:         { icon: '👁',  th: 'สังเกตการณ์',         en: 'Observation',          desc: 'รับข้อมูลจากผู้ใช้ ตรวจจับภาษา บันทึก input ดิบ' },
  UNDERSTANDING:       { icon: '🧠', th: 'ทำความเข้าใจ',         en: 'Understanding',        desc: 'วิเคราะห์เจตนาและบริบทของคำถาม จำแนกประเภทปัญหา' },
  PURPOSE:             { icon: '🎯', th: 'กำหนดจุดประสงค์',     en: 'Purpose',              desc: 'ระบุเป้าหมาย ข้อจำกัด และขอบเขตของการวิเคราะห์' },
  MEMORY:              { icon: '💾', th: 'ดึงความจำ',            en: 'Memory Retrieval',     desc: 'ค้นหาข้อมูลจากหน่วยความจำระยะยาวและบริบทที่เกี่ยวข้อง' },
  MENTAL_MODEL:        { icon: '🗺', th: 'แบบจำลองความคิด',     en: 'Mental Model',         desc: 'เลือกกรอบการวิเคราะห์ที่เหมาะสม (FIRE Framework)' },
  HYPOTHESIS:          { icon: '💡', th: 'ตั้งสมมติฐาน',         en: 'Hypothesis',           desc: 'สร้างสมมติฐานเบื้องต้นจากข้อมูลที่มี ระบุความน่าจะเป็น' },
  EVIDENCE_EVALUATION: { icon: '⚖️', th: 'ประเมินหลักฐาน',       en: 'Evidence Evaluation',  desc: 'รวบรวมและประเมินน้ำหนักหลักฐานจากหลายแหล่ง' },
  CRITIQUE:            { icon: '🔍', th: 'วิจารณ์และตรวจสอบ',   en: 'Critique',             desc: 'ระบุข้อจำกัด ความเสี่ยง ข้อมูลที่ขาด ตรวจสอบ bias' },
  DECISION:            { icon: '⚡', th: 'ตัดสินใจเชิงกลยุทธ์', en: 'Decision',             desc: 'คำนวณระดับความมั่นใจ สรุปทิศทางการตอบ รักษา Human Agency' },
  COMMUNICATION:       { icon: '🤖', th: 'สื่อสาร (LLM)',        en: 'Communication (LLM)',  desc: 'ส่ง prompt ไปยัง OpenAI GPT รอและประมวลผล response' },
  REFLECTION:          { icon: '🔄', th: 'สะท้อนคิด',            en: 'Reflection',           desc: 'ทบทวนกระบวนการทั้งหมด ตรวจสอบความสอดคล้องของผลลัพธ์' },
  LEARNING:            { icon: '📚', th: 'บทเรียนและ Agency',    en: 'Learning',             desc: 'สกัดบทเรียน ยืนยันสิทธิ์ตัดสินใจของผู้ใช้ อัปเดต state' },
};

// ─── HTML Report Generator ────────────────────────────────────────────────────

type ReportKind = 'all' | 'user' | 'analyst' | 'system';

const REPORT_KIND_LABELS: Record<Exclude<ReportKind, 'all'>, string> = {
  user: 'User Report',
  analyst: 'Analyst Report',
  system: 'System Trace',
};

function generateHtmlReport(
  question: string,
  answer: string,
  pca: PCAState,
  kind: ReportKind = 'all',
  reports?: ReportLayers,
): string {
  if (kind !== 'all') {
    return generateSeparatedReportHtml(question, answer, pca, kind, reports);
  }
  const totalMs = pca.execution_time_ms ?? 0;
  const maxMs = Math.max(...pca.trace.map((t) => t.duration_ms ?? 0), 1);
  const dateStr = formatThaiDateTime(pca.start_time);

  const confClass =
    pca.confidence === 'สูง' ? 'conf-high'
    : pca.confidence === 'ปานกลาง' ? 'conf-mid'
    : pca.confidence === 'ต่ำ' ? 'conf-low'
    : 'conf-unknown';

  // Stage rows
  const stageRows = pca.trace.map((entry, i) => {
    const info = STAGE_INFO[entry.stage] ?? { icon: '▸', th: entry.stage, en: entry.stage, desc: '' };
    const ms = entry.duration_ms ?? 0;
    const pct = Math.round((ms / maxMs) * 100);
    const barColor = ms >= 2000 ? '#dc2626' : ms >= 500 ? '#f59e0b' : ms >= 100 ? '#22d3ee' : '#22c55e';
    const msLabel = ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(3)} ms`;
    const ts = entry.started_at
      ? `${formatThaiClock(entry.started_at)}–${formatThaiClock(entry.ended_at ?? entry.started_at)}`
      : '';
    const measurement = entry.measured === false ? 'phase marker' : 'runtime measured';
    return `
      <tr>
        <td class="c-num">${i + 1}</td>
        <td class="c-icon">${info.icon}</td>
        <td class="c-name"><span class="name-th">${info.th}</span><br><span class="name-en">${info.en}</span></td>
        <td class="c-desc">${escHtml(info.desc)}</td>
        <td class="c-bar"><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${barColor}"></div></div></td>
        <td class="c-ms" style="color:${barColor}">${msLabel}<br><span class="measurement">${measurement}</span></td>
        <td class="c-ts">${ts}</td>
      </tr>`;
  }).join('');

  const critiqueItems = pca.critique.map((c) => `<li>${escHtml(c)}</li>`).join('');
  const reflectionItems = pca.reflection.map((r) => `<li>${escHtml(r)}</li>`).join('');
  const conflictItems = (pca.conflicts ?? []).map((c) => `<li>${escHtml(c)}</li>`).join('');
  const lifecycleRows = (pca.runtime_lifecycle ?? []).map((event, i) => `
    <tr>
      <td class="c-num">${i + 1}</td>
      <td class="c-name"><span class="name-th">${escHtml(event.phase)}</span></td>
      <td class="c-desc">${escHtml(event.action)}</td>
      <td class="c-ms">${event.measured === false ? '—' : `${(event.duration_ms ?? 0).toFixed(3)} ms`}<br><span class="measurement">${event.measured === false ? 'phase marker' : 'runtime measured'}</span></td>
      <td class="c-ts">${event.started_at ? `${formatThaiClock(event.started_at)}–${formatThaiClock(event.ended_at ?? event.started_at)}` : ''}</td>
    </tr>`).join('');
  const governanceItems = (pca.governance?.safety_checks ?? []).map((c) => `<li>${escHtml(c)}</li>`).join('');
  const verificationItems = (pca.verification?.checks ?? []).map((c) => `<li>${escHtml(c)}</li>`).join('');
  const verificationDetailItems = (pca.verification?.detailed_checks ?? []).map((check) =>
    `<li><strong>${escHtml(check.criterion)}</strong> — ${check.passed ? 'ผ่าน' : 'ไม่ผ่าน'} (${check.score.toFixed(2)})<br><span class="detail">${escHtml(check.rule)}<br>${escHtml(check.evidence)}</span></li>`
  ).join('');
  const evidenceRows = (pca.evidence_report?.items ?? []).map((item) => `
    <tr>
      <td>${escHtml(item.source)}</td>
      <td>${escHtml(item.text)}</td>
      <td>${item.relevance_score.toFixed(3)}</td>
      <td>${item.quality_score.toFixed(3)}</td>
      <td>${item.consistency_score.toFixed(3)}</td>
      <td><strong>${item.composite_score.toFixed(3)}</strong></td>
    </tr>`).join('');
  const conflictFindingItems = (pca.conflict_findings ?? []).map((finding) =>
    `<li><strong>${escHtml(finding.severity)} · ${escHtml(finding.type)}</strong> — ${escHtml(finding.evidence)}<br><span class="detail">ก่อนหน้า: ${escHtml(finding.prior_signal)}<br>ปัจจุบัน: ${escHtml(finding.current_signal)}</span></li>`
  ).join('');
  const auditRows = (pca.module_audit ?? []).map((audit) => `
    <tr>
      <td><strong>${escHtml(audit.module)}</strong></td>
      <td>${escHtml(audit.algorithm)}</td>
      <td>${audit.input_count}</td>
      <td>${audit.score != null ? audit.score.toFixed(3) : '—'}</td>
      <td>${audit.findings.map((finding) => escHtml(finding)).join('<br>')}</td>
    </tr>`).join('');
  const dataflowRows = (pca.dataflow ?? []).map((flow) => `
    <tr>
      <td><strong>${escHtml(flow.from)}</strong></td>
      <td>→</td>
      <td><strong>${escHtml(flow.to)}</strong></td>
      <td>${escHtml(flow.outputs.join(', '))}</td>
      <td>${escHtml(flow.inputs.join(', '))}</td>
      <td>${escHtml(flow.transformation)}</td>
      <td>${flow.item_count}</td>
    </tr>`).join('');
  const decisionRows = (pca.decision_matrix?.options ?? []).map((option) => `
    <tr>
      <td><strong>${escHtml(option.label)}</strong><br><span class="detail">${escHtml(option.id)}</span></td>
      <td>${Object.entries(option.criteria).map(([key, value]) => `${escHtml(key)} ${(value as number).toFixed(3)}`).join('<br>')}</td>
      <td><strong>${option.weighted_score.toFixed(3)}</strong></td>
      <td>${escHtml(option.rationale)}</td>
      <td>${option.evidence_ids.map((id) => escHtml(id)).join(', ') || '—'}</td>
    </tr>`).join('');
  const memoryRows = (pca.memory_retrieval?.hits ?? []).map((hit) => `
    <tr>
      <td>${hit.rank}</td>
      <td>${escHtml(hit.source)}</td>
      <td>${escHtml(hit.content)}</td>
      <td>${hit.retrieval_score.toFixed(3)}</td>
      <td>${hit.matched_tokens.map((token) => escHtml(token)).join(', ') || '—'}</td>
    </tr>`).join('');
  const metricRows = (pca.runtime_metrics ?? []).map((metric) => `
    <tr>
      <td><strong>${escHtml(metric.module)}</strong></td>
      <td>${metric.duration_ms.toFixed(3)} ms</td>
      <td>${metric.input_count}</td>
      <td>${metric.output_count}</td>
      <td>${metric.evidence_count}</td>
      <td>${metric.hypothesis_count}</td>
      <td>${metric.memory_hits}</td>
      <td>${metric.missing_info_count}</td>
      <td>${metric.conflict_count}</td>
    </tr>`).join('');
  const quality = pca.reasoning_quality;
  const logicalVerificationItems = (pca.logical_verification?.checks ?? []).map((check) =>
    `<li><strong>${escHtml(check.criterion)}</strong> — ${check.passed ? 'ผ่าน' : 'ไม่ผ่าน'} (${check.score.toFixed(2)})<br><span class="detail">${escHtml(check.rule)}<br>${escHtml(check.evidence)}</span></li>`
  ).join('');
  const graphClaimRows = (pca.reasoning_graph?.claims ?? []).map((claim) => `
    <tr>
      <td><strong>${escHtml(claim.id)}</strong></td>
      <td>${escHtml(claim.type)}</td>
      <td>${escHtml(claim.status)}</td>
      <td>${escHtml(claim.text)}</td>
      <td>${escHtml(claim.source_module)}</td>
      <td>${claim.support_score.toFixed(3)}</td>
    </tr>`).join('');
  const graphEdgeRows = (pca.reasoning_graph?.edges ?? []).map((edge) => `
    <tr>
      <td>${escHtml(edge.from)}</td>
      <td>${escHtml(edge.relation)}</td>
      <td>${escHtml(edge.to)}</td>
      <td>${edge.weight.toFixed(3)}</td>
      <td>${escHtml(edge.rationale)}</td>
    </tr>`).join('');
  const transitionRows = (pca.state_transitions ?? []).map((transition) => `
    <tr>
      <td><strong>${escHtml(transition.module)}</strong><br><span class="detail">${escHtml(transition.state_field)}</span></td>
      <td>${escHtml(JSON.stringify(transition.before) ?? '—')}</td>
      <td>${escHtml(JSON.stringify(transition.after) ?? '—')}</td>
      <td>${escHtml(transition.trigger)}</td>
      <td>${escHtml(transition.impact)}</td>
    </tr>`).join('');
  const factItems = (pca.knowledge_map?.facts ?? []).map((c) => `<li>${escHtml(c)}</li>`).join('');
  const assumptionItems = (pca.knowledge_map?.assumptions ?? []).map((c) => `<li>${escHtml(c)}</li>`).join('');
  const unknownItems = (pca.knowledge_map?.unknowns ?? []).map((c) => `<li>${escHtml(c)}</li>`).join('');
  const executiveSummary = reports?.user_report.executive_summary ?? answer;

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FIRE — Framework for Inference, Reasoning & Evaluation Report</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Sarabun','Noto Sans Thai','Helvetica Neue',sans-serif;font-size:11pt;color:#111;background:#f3f4f6;line-height:1.6}
@page{size:A4;margin:18mm 15mm}
@media print{
  .no-print{display:none!important}
  .page-break{page-break-before:always}
  body{background:#fff;font-size:10pt}
  .page{box-shadow:none;padding:0}
  .bar-fill{print-color-adjust:exact;-webkit-print-color-adjust:exact}
}
@media screen{
  body{padding:20px}
  .page{max-width:210mm;margin:0 auto;background:#fff;padding:22mm 18mm;box-shadow:0 4px 24px rgba(0,0,0,.1);border-radius:4px}
}
/* Print bar */
.print-bar{max-width:210mm;margin:0 auto 16px;display:flex;gap:10px}
.btn{padding:9px 20px;border:none;border-radius:8px;cursor:pointer;font-size:10pt;font-weight:700;font-family:inherit}
.btn-print{background:#f97316;color:#fff}
.btn-print:hover{background:#ea6c00}
/* Header */
.rpt-header{display:flex;align-items:flex-start;gap:14px;padding-bottom:14px;border-bottom:3px solid #f97316;margin-bottom:14px}
.logo-flame{font-size:30pt;line-height:1}
.logo-text{}
.logo-title{font-size:17pt;font-weight:900;color:#f97316;letter-spacing:.5px}
.logo-sub{font-size:9pt;color:#666;margin-top:1px}
/* Meta strip */
.meta-strip{display:flex;flex-wrap:wrap;gap:16px;background:#fef3c7;border:1px solid #fde68a;border-radius:6px;padding:9px 14px;margin-bottom:16px;font-size:9pt}
.meta-item{display:flex;align-items:center;gap:5px}
.meta-lbl{font-weight:700;color:#92400e}
.meta-val{color:#111}
/* Confidence badge */
.cbadge{padding:2px 9px;border-radius:10px;font-size:8.5pt;font-weight:700;display:inline-block}
.conf-high{background:#dcfce7;color:#166534}
.conf-mid{background:#fef9c3;color:#854d0e}
.conf-low{background:#fee2e2;color:#991b1b}
.conf-unknown{background:#f1f5f9;color:#475569}
/* Section */
.section{margin-bottom:18px}
.sec-title{font-size:11.5pt;font-weight:800;color:#f97316;border-bottom:1.5px solid #fed7aa;padding-bottom:4px;margin-bottom:10px}
/* Question */
.question-box{background:#eff6ff;border-left:4px solid #3b82f6;border-radius:0 6px 6px 0;padding:10px 14px;font-size:11pt;line-height:1.7;white-space:pre-wrap;word-break:break-word}
/* Answer */
.answer-box{background:#f9f9f9;border:1px solid #e5e7eb;border-radius:6px;padding:13px 16px;font-size:10.5pt;line-height:1.75;white-space:pre-wrap;word-break:break-word}
/* Timeline table */
.tl-table{width:100%;border-collapse:collapse;font-size:9pt}
.tl-table thead th{background:#111;color:#fff;padding:7px 8px;text-align:left;font-size:8.5pt;font-weight:700}
.tl-table tbody tr:nth-child(even){background:#f9f9f9}
.tl-table td{padding:6px 8px;vertical-align:middle;border-bottom:1px solid #eee}
.tl-table tfoot td{background:#1f2937;color:#fff;padding:7px 8px;font-weight:700}
.c-num{text-align:center;width:22px;font-weight:700;color:#888;font-size:8pt}
.c-icon{text-align:center;width:24px;font-size:12pt}
.c-name{min-width:110px;font-weight:600}
.name-th{font-size:9.5pt}
.name-en{font-size:7.5pt;color:#888;font-weight:400}
.c-desc{color:#555;font-size:8pt;max-width:200px;line-height:1.4}
.c-bar{width:110px}
.bar-track{height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden}
.bar-fill{height:100%;border-radius:4px;transition:width .3s}
.c-ms{text-align:right;font-family:'Courier New',monospace;font-size:9pt;font-weight:700;white-space:nowrap;min-width:72px}
.measurement{font-family:inherit;font-size:6.5pt;font-weight:400;color:#888;white-space:nowrap}
.c-ts{text-align:right;font-family:'Courier New',monospace;font-size:7.5pt;color:#999;white-space:nowrap;min-width:90px}
.total-lbl{font-size:9pt}
.total-ms{text-align:right;font-family:monospace;font-size:11pt;color:#fb923c}
/* Lists */
.ul-items{list-style:none;display:flex;flex-direction:column;gap:4px}
.ul-items li{padding-left:14px;position:relative;font-size:10pt;line-height:1.55}
.ul-items li::before{content:'•';position:absolute;left:0;color:#f97316;font-weight:700}
/* 2-col grid */
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media print{.grid2{display:grid}}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.map-title{font-weight:800;font-size:9pt;margin-bottom:5px}
.fact-title{color:#166534}.assumption-title{color:#92400e}.unknown-title{color:#475569}
.status-line{font-size:9pt;margin-bottom:6px}
.detail{font-size:8pt;color:#666}
.audit-table,.evidence-table{width:100%;border-collapse:collapse;font-size:8.5pt}
.audit-table th,.audit-table td,.evidence-table th,.evidence-table td{border:1px solid #e5e7eb;padding:5px;vertical-align:top}
.audit-table th,.evidence-table th{background:#fff7ed;color:#92400e;text-align:left}
.score-box{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
.score-chip{border:1px solid #fed7aa;border-radius:5px;padding:4px 8px;background:#fff7ed;font-size:8.5pt}
/* Footer */
.rpt-footer{margin-top:22px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:8pt;color:#aaa;text-align:center}
@media print{.grid3{display:grid}}
</style>
</head>
<body>
<div class="no-print print-bar">
  <button class="btn btn-print" onclick="window.print()">🖨&nbsp; พิมพ์ / บันทึก PDF</button>
</div>
<div class="page">

<!-- HEADER -->
<div class="rpt-header">
  <div class="logo-flame">🔥</div>
  <div class="logo-text">
    <div class="logo-title">FIRE</div>
   <div class="logo-sub">Framework for Inference, Reasoning & Evaluation — User Report · Analyst Report · System Trace</div>
  </div>
</div>

<!-- META STRIP -->
<div class="meta-strip">
  <div class="meta-item"><span class="meta-lbl">วันที่:</span><span class="meta-val">${escHtml(dateStr)}</span></div>
  <div class="meta-item"><span class="meta-lbl">โมเดล:</span><span class="meta-val">${escHtml(pca.llm_provider ?? 'openai')} / ${escHtml(pca.llm_model ?? 'gpt-4o')}</span></div>
  <div class="meta-item"><span class="meta-lbl">เวลารวม:</span><span class="meta-val">${totalMs >= 1000 ? (totalMs / 1000).toFixed(2) + ' s' : totalMs + ' ms'}</span></div>
  <div class="meta-item"><span class="meta-lbl">ขั้นตอน:</span><span class="meta-val">${pca.trace.length} stages</span></div>
  <div class="meta-item"><span class="meta-lbl">Intent:</span><span class="meta-val">${escHtml(pca.intent?.type ?? 'general')} / ${escHtml(pca.intent?.pipeline ?? 'general')}</span></div>
  <div class="meta-item"><span class="meta-lbl">ความมั่นใจ:</span><span class="cbadge ${confClass}">${pca.confidence} · ${(pca.confidence_report?.score ?? 0).toFixed(1)}/100</span></div>
</div>

<!-- USER REPORT -->
<div class="section">
  <div class="sec-title">👤 User Report — รายงานสำหรับผู้ใช้</div>
  <div class="question-box"><strong>Executive Summary</strong><br>${escHtml(executiveSummary).replace(/\n/g, '<br>')}</div>
  <div class="answer-box">${escHtml(answer)}</div>
  <div class="score-box">
    <span class="score-chip">intent: ${escHtml(pca.intent?.type ?? 'general')}</span>
    <span class="score-chip">confidence: ${escHtml(pca.confidence)}</span>
  </div>
  ${((pca.missing_info ?? []).length > 0)
    ? `<div class="detail">ข้อจำกัด / ข้อมูลที่ยังขาด: ${escHtml((pca.missing_info ?? []).slice(0, 3).join(' · '))}</div>`
    : '<div class="detail">ไม่พบข้อจำกัดเพิ่มเติมจากข้อมูลที่มี</div>'}
</div>

<!-- ANALYST REPORT -->
<div class="section">
  <div class="sec-title">🔎 Analyst Report — หลักฐาน เหตุผล และผลตรวจสอบ</div>
</div>

<!-- QUESTION -->
  <div class="section">
    <div class="sec-title">🧪 Reasoning Quality — คุณภาพเหตุผล</div>
    <div class="score-box">
      <span class="score-chip">evidence: ${quality?.evidence_count ?? 0}</span>
      <span class="score-chip">coverage: ${(quality?.evidence_coverage ?? 0).toFixed(3)}</span>
      <span class="score-chip">quality: ${(quality?.evidence_quality ?? 0).toFixed(3)}</span>
      <span class="score-chip">conflicts: ${quality?.conflict_count ?? 0}</span>
      <span class="score-chip">unsupported: ${quality?.unsupported_claim_count ?? 0}</span>
    </div>
    <div class="detail">memory hits ${quality?.memory_hits ?? 0} · hypotheses ${quality?.hypothesis_count ?? 0} · missing ${quality?.missing_information_count ?? 0} · verification pass rate ${((quality?.verification_pass_rate ?? 0) * 100).toFixed(1)}% · decision margin ${(quality?.decision_margin ?? 0).toFixed(3)}</div>
  </div>

  <div class="section">
  <div class="sec-title">❓ คำถาม / สิ่งที่วิเคราะห์</div>
  <div class="question-box">${escHtml(question)}</div>
</div>

<!-- SYSTEM TRACE -->
<div class="section">
  <div class="sec-title">🛠 System Trace — lifecycle, runtime และ dataflow</div>
</div>

<!-- PCA TIMELINE -->
<div class="section">
  <div class="sec-title">⏱ Runtime Boundary</div>
  <div class="score-box">
    <span class="score-chip">Cognitive: ${(pca.runtime_summary?.cognitive.total_ms ?? 0).toFixed(1)} ms</span>
    <span class="score-chip">LLM: ${(pca.runtime_summary?.llm.request_ms ?? 0).toFixed(1)} ms</span>
    <span class="score-chip">LLM retry: ${pca.runtime_summary?.llm.retry_count ?? 0}</span>
  </div>
  <div class="detail">Cognitive pre-LLM ${(pca.runtime_summary?.cognitive.pre_llm_ms ?? 0).toFixed(1)} ms · post-LLM ${(pca.runtime_summary?.cognitive.post_llm_ms ?? 0).toFixed(1)} ms · phase markers ${pca.runtime_summary?.cognitive.phase_count ?? 0}</div>
</div>

<div class="section">
  <div class="sec-title">⏱ กระบวนการ PCA — เวลาแต่ละขั้นตอน (มิลลิวินาที)</div>
  <table class="tl-table">
    <thead>
      <tr>
        <th>#</th><th></th><th>ขั้นตอน</th><th>รายละเอียด</th><th>ระยะเวลา</th><th>ms</th><th>เวลา (HH:MM:SS.mmm)</th>
      </tr>
    </thead>
    <tbody>${stageRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="5" class="total-lbl">รวมเวลาทั้งหมด</td>
        <td class="total-ms">${totalMs >= 1000 ? (totalMs / 1000).toFixed(2) + ' s' : totalMs + ' ms'}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>
</div>

<!-- FIRE RUNTIME -->
<div class="section">
  <div class="sec-title">⚙️ FIRE Runtime Lifecycle</div>
  <table class="tl-table">
    <thead><tr><th>#</th><th>Phase</th><th>การทำงาน</th><th>เวลา</th><th>Timestamp</th></tr></thead>
    <tbody>${lifecycleRows || '<tr><td colspan="5">ไม่มีข้อมูล lifecycle</td></tr>'}</tbody>
  </table>
</div>

<!-- GOVERNANCE + VERIFICATION -->
<div class="section">
  <div class="grid2">
    <div>
      <div class="sec-title">🛡 Governance & Safety</div>
      <div class="status-line">สถานะ: <span class="cbadge ${pca.governance?.status === 'ผ่าน' ? 'conf-high' : pca.governance?.status === 'หยุด' ? 'conf-low' : 'conf-mid'}">${escHtml(pca.governance?.status ?? 'ต้องตรวจสอบ')}</span></div>
      <ul class="ul-items">${governanceItems || '<li>—</li>'}</ul>
    </div>
    <div>
      <div class="sec-title">✅ Verification</div>
      <div class="status-line">สถานะ: <span class="cbadge ${pca.verification?.status === 'ผ่าน' ? 'conf-high' : 'conf-mid'}">${escHtml(pca.verification?.status ?? 'ต้องตรวจสอบ')}</span></div>
      <ul class="ul-items">${verificationItems || '<li>—</li>'}</ul>
      <div class="status-line">คะแนน verification: <strong>${((pca.verification?.score ?? 0) * 100).toFixed(1)}%</strong></div>
      <ul class="ul-items">${verificationDetailItems || '<li>ไม่มีรายละเอียด</li>'}</ul>
    </div>
  </div>
</div>

<!-- COMPUTED MODULE AUDIT -->
<div class="section">
  <div class="sec-title">🧪 Module Audit — ผลคำนวณและวิธีการ</div>
  <table class="audit-table">
    <thead><tr><th>โมดูล</th><th>อัลกอริทึม</th><th>จำนวน input</th><th>คะแนน</th><th>ผลคำนวณ</th></tr></thead>
    <tbody>${auditRows || '<tr><td colspan="5">ไม่มีข้อมูล module audit</td></tr>'}</tbody>
  </table>
</div>

<!-- EVIDENCE MATRIX -->
<div class="section">
  <div class="sec-title">⚖️ Evidence Matrix — หลักฐานที่ใช้จริง</div>
  <div class="score-box">
    <span class="score-chip">aggregate: ${(pca.evidence_report?.aggregate_score ?? 0).toFixed(3)}</span>
    <span class="score-chip">coverage: ${(pca.evidence_report?.coverage_score ?? 0).toFixed(3)}</span>
    <span class="score-chip">${escHtml(pca.evidence_report?.methodology ?? 'ไม่มี methodology')}</span>
  </div>
  <table class="evidence-table">
    <thead><tr><th>แหล่ง</th><th>ข้อความ</th><th>relevance</th><th>quality</th><th>consistency</th><th>composite</th></tr></thead>
    <tbody>${evidenceRows || '<tr><td colspan="6">ไม่มี evidence item</td></tr>'}</tbody>
  </table>
</div>

<!-- COGNITIVE DATAFLOW -->
<div class="section page-break">
  <div class="sec-title">🔗 Cognitive Dataflow — output → input lineage</div>
  <table class="audit-table">
    <thead><tr><th>จาก</th><th></th><th>ถึง</th><th>outputs</th><th>inputs</th><th>transformation</th><th>items</th></tr></thead>
    <tbody>${dataflowRows || '<tr><td colspan="7">ไม่มี dataflow</td></tr>'}</tbody>
  </table>
</div>

${(pca.intent?.type ?? 'general') === 'decision' && (pca.decision_matrix?.options?.length ?? 0) > 0 ? `
<!-- DECISION MATRIX -->
<div class="section">
  <div class="sec-title">⚡ Decision Matrix — alternatives, criteria & trade-offs</div>
  <div class="score-box">
    <span class="score-chip">selected: ${escHtml(pca.decision_matrix?.selected_option ?? '—')}</span>
    <span class="score-chip">score: ${(pca.decision_matrix?.selected_score ?? 0).toFixed(3)}</span>
  </div>
  <div class="detail">${escHtml(pca.decision_matrix?.selection_reason ?? 'ไม่มี decision matrix')}</div>
  <table class="audit-table">
    <thead><tr><th>ทางเลือก</th><th>criteria scores</th><th>weighted</th><th>rationale / trade-off</th><th>evidence IDs</th></tr></thead>
    <tbody>${decisionRows}</tbody>
  </table>
</div>` : `
<div class="section">
  <div class="sec-title">🧭 Intent Router — route-aware analysis</div>
  <div class="score-box">
    <span class="score-chip">intent: ${escHtml(pca.intent?.type ?? 'general')}</span>
    <span class="score-chip">pipeline: ${escHtml(pca.intent?.pipeline ?? 'general')}</span>
    <span class="score-chip">confidence: ${(pca.intent?.confidence ?? 0).toFixed(3)}</span>
  </div>
  <div class="detail">${escHtml(pca.intent?.rationale ?? 'ใช้คำตอบทั่วไปโดยไม่สมมติว่าเป็น decision')}</div>
</div>`}

<!-- MEMORY RETRIEVAL -->
<div class="section">
  <div class="sec-title">💾 Memory Retrieval — query, candidates, hits & misses</div>
  <div class="score-box">
    <span class="score-chip">candidates: ${pca.memory_retrieval?.candidate_count ?? 0}</span>
    <span class="score-chip">hits: ${pca.memory_retrieval?.matched_count ?? 0}</span>
    <span class="score-chip">threshold: ${(pca.memory_retrieval?.threshold ?? 0).toFixed(3)}</span>
  </div>
  <div class="question-box">${escHtml(pca.memory_retrieval?.query ?? 'ไม่มี query')}</div>
  ${pca.memory_retrieval?.miss_reason ? `<div class="detail">miss reason: ${escHtml(pca.memory_retrieval.miss_reason)}</div>` : ''}
  <table class="evidence-table">
    <thead><tr><th>#</th><th>source</th><th>content</th><th>score</th><th>matched tokens</th></tr></thead>
    <tbody>${memoryRows || '<tr><td colspan="5">ไม่พบ memory hit</td></tr>'}</tbody>
  </table>
</div>

<!-- MEANINGFUL RUNTIME METRICS -->
<div class="section">
  <div class="sec-title">📊 Cognitive Operation Metrics — runtime แยกจาก phase timing</div>
  <table class="audit-table">
    <thead><tr><th>โมดูล</th><th>runtime</th><th>input</th><th>output</th><th>evidence</th><th>hypotheses</th><th>memory hits</th><th>missing</th><th>conflicts</th></tr></thead>
    <tbody>${metricRows || '<tr><td colspan="9">ไม่มี metrics</td></tr>'}</tbody>
  </table>
</div>

<!-- LOGICAL VERIFICATION -->
<div class="section">
  <div class="sec-title">🧠 Logical Verification</div>
  <div class="status-line">สถานะ: <span class="cbadge ${pca.logical_verification?.status === 'ผ่าน' ? 'conf-high' : 'conf-mid'}">${escHtml(pca.logical_verification?.status ?? 'ต้องตรวจสอบ')}</span> · score ${((pca.logical_verification?.score ?? 0) * 100).toFixed(1)}%</div>
  <ul class="ul-items">${logicalVerificationItems || '<li>ไม่มี logical checks</li>'}</ul>
</div>

<!-- REASONING GRAPH -->
<div class="section page-break">
  <div class="sec-title">🕸 Claim–Evidence–Decision Graph</div>
  <div class="score-box">
    <span class="score-chip">selected: ${escHtml(pca.reasoning_graph?.selected_option ?? '—')}</span>
    <span class="score-chip">unsupported: ${pca.reasoning_graph?.unsupported_claim_count ?? 0}</span>
  </div>
  <div class="detail">${escHtml(pca.reasoning_graph?.methodology ?? 'ไม่มี reasoning graph')}</div>
  <table class="evidence-table">
    <thead><tr><th>claim ID</th><th>type</th><th>status</th><th>claim</th><th>module</th><th>support</th></tr></thead>
    <tbody>${graphClaimRows || '<tr><td colspan="6">ไม่มี claim</td></tr>'}</tbody>
  </table>
  <table class="audit-table">
    <thead><tr><th>จาก</th><th>relation</th><th>ถึง</th><th>weight</th><th>เหตุผล</th></tr></thead>
    <tbody>${graphEdgeRows || '<tr><td colspan="5">ไม่มี graph edge</td></tr>'}</tbody>
  </table>
</div>

<!-- STATE TRANSITIONS -->
<div class="section">
  <div class="sec-title">🔁 State Transition Trace — field mutation & impact</div>
  <table class="audit-table">
    <thead><tr><th>module / field</th><th>ก่อน</th><th>หลัง</th><th>trigger</th><th>impact</th></tr></thead>
    <tbody>${transitionRows || '<tr><td colspan="5">ไม่มี state transition</td></tr>'}</tbody>
  </table>
</div>

<div class="section">
  <div class="sec-title">⚠️ Conflict Findings</div>
  <ul class="ul-items">${conflictFindingItems || '<li>ไม่พบ conflict finding</li>'}</ul>
</div>

<!-- KNOWLEDGE MAP -->
<div class="section">
  <div class="sec-title">🧭 Knowledge Map</div>
  <div class="grid3">
    <div><div class="map-title fact-title">[ข้อเท็จจริง]</div><ul class="ul-items">${factItems || '<li>—</li>'}</ul></div>
    <div><div class="map-title assumption-title">[สมมติฐาน]</div><ul class="ul-items">${assumptionItems || '<li>—</li>'}</ul></div>
    <div><div class="map-title unknown-title">[ข้อมูลที่ขาด / Unknowns]</div><ul class="ul-items">${unknownItems || '<li>—</li>'}</ul></div>
  </div>
</div>

<!-- CRITIQUE + REFLECTION -->
<div class="section">
  <div class="grid2">
    <div>
      <div class="sec-title">🔍 ข้อวิจารณ์และข้อจำกัด</div>
      <ul class="ul-items">${critiqueItems || '<li>—</li>'}</ul>
    </div>
    <div>
      <div class="sec-title">🔄 การสะท้อนคิด</div>
      <ul class="ul-items">${reflectionItems || '<li>—</li>'}</ul>
    </div>
  </div>
</div>

${conflictItems ? `
<div class="section">
  <div class="sec-title">⚠️ ความขัดแย้งที่ตรวจพบ</div>
  <ul class="ul-items">${conflictItems}</ul>
</div>` : ''}

<!-- FOOTER -->
<div class="rpt-footer">
  Generated by FIRE · Framework for Inference, Reasoning & Evaluation · ${new Date().getFullYear()}
  &nbsp;|&nbsp; Human Agency Preserved — ผู้ใช้เป็นผู้ตัดสินใจขั้นสุดท้ายเสมอ
</div>

</div><!-- /page -->
</body>
</html>`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function reportList(items: string[], empty = 'ไม่มีข้อมูล'): string {
  return items.length > 0
    ? `<ul>${items.map((item) => `<li>${escHtml(item)}</li>`).join('')}</ul>`
    : `<p class="muted">${escHtml(empty)}</p>`;
}

function reportTable(headers: string[], rows: string[][], empty = 'ไม่มีข้อมูล'): string {
  if (rows.length === 0) return `<p class="muted">${escHtml(empty)}</p>`;
  return `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th>${escHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) =>
    `<tr>${headers.map((_, index) => `<td>${escHtml(row[index] ?? '—')}</td>`).join('')}</tr>`
  ).join('')}</tbody></table></div>`;
}

function generateSeparatedReportHtml(
  question: string,
  answer: string,
  pca: PCAState,
  kind: Exclude<ReportKind, 'all'>,
  reports?: ReportLayers,
): string {
  const userReport = reports?.user_report;
  const analystReport = reports?.analyst_report;
  const systemTrace = reports?.system_trace;
  const title = REPORT_KIND_LABELS[kind];
  const dateStr = formatThaiDateTime(pca.start_time);
  const confidence = reports?.confidence_summary ?? {
    score: pca.confidence_report?.score ?? 0,
    band: pca.confidence,
  };

  const section = (heading: string, content: string) =>
    `<section><h2>${escHtml(heading)}</h2>${content}</section>`;

  let body = '';
  if (kind === 'user') {
    const summary = userReport?.executive_summary ?? answer;
    body = [
      section('Executive Summary — ใจความสำคัญครบถ้วน', `<div class="summary">${escHtml(summary).replace(/\n/g, '<br>')}</div>`),
      section('คำถาม', `<div class="question">${escHtml(question)}</div>`),
      section('คำตอบสำหรับผู้ใช้', `<div class="answer">${escHtml(userReport?.answer ?? answer)}</div>`),
      section('ข้อมูลประกอบ', reportTable(
        ['รายการ', 'รายละเอียด'],
        [
          ['ประเภทคำถาม', userReport?.route?.type ?? pca.intent?.type ?? 'general'],
          ['ความมั่นใจ', `${confidence.band} · ${confidence.score.toFixed(1)}/100`],
          ['ข้อจำกัด', userReport?.limitations.join(' · ') || 'ไม่พบข้อจำกัดเพิ่มเติม'],
          ['ขั้นถัดไป', userReport?.next_step ?? 'ไม่มีขั้นถัดไปที่กำหนด'],
        ],
      )),
    ].join('');
  } else if (kind === 'analyst') {
    const evidence = analystReport?.evidence_report ?? pca.evidence_report;
    const knowledge = analystReport?.knowledge_map ?? pca.knowledge_map;
    const verification = analystReport?.verification ?? pca.verification;
    const logical = analystReport?.logical_verification ?? pca.logical_verification;
    const reasoning = analystReport?.reasoning_quality ?? pca.reasoning_quality;
    body = [
      section('Evidence — หลักฐาน', reportTable(
        ['แหล่ง', 'เนื้อหา', 'คะแนนรวม'],
        (evidence?.items ?? []).map((item) => [item.source, item.text, item.composite_score.toFixed(3)]),
      )),
      section('Assumptions — สมมติฐานที่ใช้', reportTable(
        ['ID', 'สมมติฐาน', 'ความมั่นใจ', 'ฐานที่ใช้'],
        (analystReport?.assumptions ?? []).map((assumption) => [
          assumption.id,
          assumption.statement,
          assumption.confidence.toFixed(3),
          assumption.basis,
        ]),
      )),
      section('Knowledge Map — ข้อเท็จจริง สมมติฐาน และข้อมูลที่ขาด', [
        `<h3>ข้อเท็จจริง</h3>${reportList(knowledge?.facts ?? [])}`,
        `<h3>สมมติฐาน</h3>${reportList(knowledge?.assumptions ?? [])}`,
        `<h3>ข้อมูลที่ขาด</h3>${reportList(knowledge?.unknowns ?? [])}`,
      ].join('')),
      section('Reasoning Trace — ร่องรอยการให้เหตุผลแบบสรุป', reportTable(
        ['ขั้นตอน', 'วัตถุประสงค์', 'ข้อมูลเข้า', 'ผลลัพธ์', 'อ้างอิง'],
        (analystReport?.reasoning_trace ?? []).map((step) => [
          step.stage,
          step.purpose,
          step.inputs.join(', '),
          step.outputs.join(', '),
          [
            ...step.evidence_ids,
            ...step.assumption_ids,
            ...step.limitation_ids,
            ...step.verification_ids,
          ].join(', ') || '—',
        ]),
      )),
      section('Reasoning — คุณภาพเหตุผล', reportTable(
        ['รายการ', 'ค่า'],
        [
          ['Evidence count', String(reasoning?.evidence_count ?? 0)],
          ['Evidence coverage', (reasoning?.evidence_coverage ?? 0).toFixed(3)],
          ['Evidence quality', (reasoning?.evidence_quality ?? 0).toFixed(3)],
          ['Unsupported claims', String(reasoning?.unsupported_claim_count ?? 0)],
          ['Decision margin', (reasoning?.decision_margin ?? 0).toFixed(3)],
        ],
      )),
      section('Limitations — ข้อจำกัดและผลกระทบ', reportTable(
        ['ID', 'ข้อจำกัด', 'ผลกระทบ', 'วิธีลดความเสี่ยง'],
        (analystReport?.limitations ?? []).map((limitation) => [
          limitation.id,
          limitation.description,
          limitation.impact,
          limitation.mitigation,
        ]),
      )),
      section('Decision — ทางเลือกและข้อแลกเปลี่ยน', pca.intent?.type === 'decision' && pca.decision_matrix
        ? reportTable(
          ['ทางเลือก', 'คะแนน', 'เหตุผล / ข้อแลกเปลี่ยน'],
          pca.decision_matrix.options.map((option) => [
            option.label,
            option.weighted_score.toFixed(3),
            option.rationale,
          ]),
        )
        : '<p class="muted">คำถามนี้ไม่ใช่เส้นทางการตัดสินใจ</p>'),
      section('Verification Criteria — เกณฑ์ตรวจสอบ', reportTable(
        ['ID', 'แหล่ง', 'เกณฑ์', 'ผ่านหรือไม่', 'หลักฐานผลตรวจ'],
        (analystReport?.verification_criteria ?? []).map((criterion) => [
          criterion.id,
          criterion.source,
          criterion.criterion,
          criterion.passed ? `ผ่าน (${criterion.score.toFixed(3)})` : `ไม่ผ่าน (${criterion.score.toFixed(3)})`,
          criterion.evidence,
        ]),
      )),
      section('Verification Summary — สรุปผลตรวจสอบ', reportTable(
        ['รายการ', 'ผล'],
        [
          ['Verification', `${verification?.status ?? 'ต้องตรวจสอบ'} · ${((verification?.score ?? 0) * 100).toFixed(1)}%`],
          ['Logical verification', `${logical?.status ?? 'ต้องตรวจสอบ'} · ${((logical?.score ?? 0) * 100).toFixed(1)}%`],
          ['Consistency', verification?.consistency ?? '—'],
          ['Missing information', (analystReport?.missing_info ?? pca.missing_info ?? []).join(' · ') || 'ไม่มี'],
          ['Conflicts', String((analystReport?.conflicts ?? pca.conflict_findings ?? []).length)],
        ],
      )),
    ].join('');
  } else {
    const trace = systemTrace ?? {
      notes: pca.notes ?? [],
      runtime_summary: pca.runtime_summary,
      runtime_lifecycle: pca.runtime_lifecycle ?? [],
      trace: pca.trace ?? [],
      dataflow: pca.dataflow ?? [],
      runtime_metrics: pca.runtime_metrics ?? [],
      module_audit: pca.module_audit ?? [],
      state_transitions: pca.state_transitions ?? [],
      reasoning_graph: pca.reasoning_graph,
    };
    body = [
      section('Runtime Summary', reportTable(
        ['รายการ', 'ค่า'],
        [
          ['Cognitive total', `${trace.runtime_summary?.cognitive.total_ms.toFixed(1) ?? '0.0'} ms`],
          ['LLM request', `${trace.runtime_summary?.llm.request_ms.toFixed(1) ?? '0.0'} ms`],
          ['Trace stages', String(trace.trace.length)],
          ['Dataflow edges', String(trace.dataflow.length)],
          ['Lifecycle events', String(trace.runtime_lifecycle.length)],
        ],
      )),
      section('Runtime Lifecycle', reportTable(
        ['Phase', 'Action', 'Duration'],
        trace.runtime_lifecycle.map((event) => [
          event.phase,
          event.action,
          event.measured === false ? 'phase marker' : `${event.duration_ms.toFixed(3)} ms`,
        ]),
      )),
      section('Trace', reportTable(
        ['Stage', 'Duration', 'Measured'],
        trace.trace.map((entry) => [
          entry.stage,
          `${(entry.duration_ms ?? 0).toFixed(3)} ms`,
          entry.measured === false ? 'phase marker' : 'runtime measured',
        ]),
      )),
      section('Dataflow', reportTable(
        ['จาก', 'ถึง', 'Transformation', 'Items'],
        trace.dataflow.map((flow) => [flow.from, flow.to, flow.transformation, String(flow.item_count)]),
      )),
      section('Module Audit / Metrics', reportTable(
        ['Module', 'Algorithm / Runtime', 'Score / Items'],
        trace.module_audit.map((audit) => [
          audit.module,
          audit.algorithm,
          `${audit.score != null ? audit.score.toFixed(3) : '—'} · ${audit.input_count} inputs`,
        ]),
      )),
      section('State Transitions', reportTable(
        ['Module / Field', 'Trigger', 'Impact'],
        trace.state_transitions.map((transition) => [
          `${transition.module} / ${transition.state_field}`,
          transition.trigger,
          transition.impact,
        ]),
      )),
      section('System Notes', reportList(trace.notes)),
    ].join('');
  }

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FIRE — ${escHtml(title)}</title>
<style>
*{box-sizing:border-box}body{font-family:'Sarabun','Noto Sans Thai','Helvetica Neue',sans-serif;color:#172033;background:#f3f4f6;line-height:1.65;margin:0;padding:20px}
.page{max-width:210mm;margin:auto;background:#fff;padding:22mm 18mm;box-shadow:0 4px 24px rgba(0,0,0,.1)}
.no-print{display:flex;gap:10px;margin:0 auto 16px;max-width:210mm}.btn{border:0;border-radius:8px;padding:9px 18px;background:#f97316;color:white;font:inherit;font-weight:700;cursor:pointer}
header{border-bottom:3px solid #f97316;padding-bottom:14px;margin-bottom:16px}h1{color:#f97316;font-size:22px;margin:0}h2{color:#c2410c;font-size:16px;border-bottom:1px solid #fed7aa;padding-bottom:5px;margin:22px 0 10px}h3{font-size:14px;color:#475569;margin:12px 0 4px}
.meta,.question,.answer,.summary{border-radius:8px;padding:12px 14px;margin:8px 0}.meta{background:#fff7ed;border:1px solid #fed7aa;font-size:13px}.question{background:#eff6ff;border-left:4px solid #3b82f6}.answer{background:#f8fafc;border:1px solid #e2e8f0;white-space:pre-wrap}.summary{background:#fff7ed;border-left:4px solid #f97316;white-space:pre-wrap}
table{border-collapse:collapse;width:100%;font-size:13px}.table-wrap{overflow-x:auto}th,td{border:1px solid #e2e8f0;padding:7px;vertical-align:top;text-align:left}th{background:#fff7ed;color:#9a3412}ul{margin:6px 0;padding-left:22px}.muted{color:#64748b}.footer{border-top:1px solid #e5e7eb;color:#94a3b8;font-size:11px;margin-top:28px;padding-top:10px;text-align:center}
@media print{body{background:#fff;padding:0}.page{box-shadow:none;padding:0}.no-print{display:none!important}h2{break-after:avoid}.table-wrap{overflow:visible}}
</style>
</head>
<body>
<div class="no-print"><button class="btn" onclick="window.print()">พิมพ์ / บันทึก PDF</button></div>
<main class="page">
<header><h1>🔥 FIRE</h1><div>Framework for Inference, Reasoning & Evaluation · ${escHtml(title)}</div></header>
<div class="meta"><strong>วันที่:</strong> ${escHtml(dateStr)} &nbsp; <strong>Intent:</strong> ${escHtml(pca.intent?.type ?? 'general')} &nbsp; <strong>Confidence:</strong> ${escHtml(confidence.band)} · ${confidence.score.toFixed(1)}/100</div>
${body}
<div class="footer">FIRE · Human Agency Preserved — ผู้ใช้เป็นผู้ตัดสินใจขั้นสุดท้ายเสมอ</div>
</main>
</body>
</html>`;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  elapsedMs?: number;
  pcaState?: PCAState;
  timestamp?: string;
  reports?: ReportLayers;
  researchEvaluation?: ResearchEvaluation;
  researchSuite?: ResearchSuiteEvaluation;
}

function ResearchMetricRow({
  label,
  baseline,
  fire,
  delta,
  inverse = false,
  percent = true,
  styles,
}: {
  label: string;
  baseline: number;
  fire: number;
  delta: number;
  inverse?: boolean;
  percent?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const format = (value: number) => percent ? `${(value * 100).toFixed(1)}%` : `${Math.round(value)} ms`;
  const deltaText = `${delta >= 0 ? '+' : ''}${format(delta)}`;
  return (
    <View style={styles.researchComparisonRow}>
      <Text style={styles.researchComparisonLabel}>{label}{inverse ? ' (ต่ำดีกว่า)' : ''}</Text>
      <Text style={styles.researchComparisonValue}>
        {format(baseline)} → {format(fire)} · {deltaText}
      </Text>
    </View>
  );
}

function ResearchEvaluationCard({
  evaluation,
  styles,
}: {
  evaluation: ResearchEvaluation;
  styles: ReturnType<typeof createStyles>;
}) {
  const metrics = evaluation.evaluation_layer.metrics;
  const metricRows: Array<[string, number, boolean]> = [
    ['Truth Accuracy', metrics.truth_accuracy, false],
    ['Reasoning Quality', metrics.reasoning_quality, false],
    ['Calibration Error', metrics.calibration_error, true],
    ['Robustness', metrics.robustness, false],
    ['Consistency', metrics.consistency, false],
    ['Generalization', metrics.generalization, false],
  ];
  return (
    <View style={styles.researchCard}>
      <View style={styles.researchHeader}>
        <View style={styles.researchHeaderText}>
          <Text style={styles.researchTitle}>🧪 Research Evaluation</Text>
          <Text style={styles.researchSubtitle}>โลกจำลอง · Ground Truth · Adversarial Test</Text>
        </View>
        <Text style={styles.researchOverall}>{(metrics.overall_score * 100).toFixed(1)}/100</Text>
      </View>
      <Text style={styles.researchLabel}>Evaluation Layer</Text>
      <View style={styles.researchMetricGrid}>
        {metricRows.map(([label, value, inverse]) => (
          <View key={label} style={styles.researchMetricTile}>
            <Text style={styles.researchMetricValue}>{(value * 100).toFixed(1)}%</Text>
            <Text style={styles.researchMetricLabel}>
              {label}{inverse ? ' (ยิ่งต่ำยิ่งดี)' : ''}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.researchSection}>
        <Text style={styles.researchLabel}>Truth Source / World Generator</Text>
        <Text style={styles.researchBody}>{evaluation.modules.truth_source.provenance}</Text>
        <Text style={styles.researchBody}>Rule: {evaluation.modules.truth_engine.formula}</Text>
        {evaluation.modules.truth_source.claims.map((claim) => (
          <Text key={claim} style={styles.researchBody}>• {claim}</Text>
        ))}
      </View>
      <View style={styles.researchSection}>
        <Text style={styles.researchLabel}>Plausibility Generator</Text>
        <Text style={styles.researchBody}>{evaluation.modules.plausibility_generator.claim}</Text>
        <Text style={styles.researchBody}>
          ผลตรวจ: {evaluation.ai_under_test.rejected_plausibility ? '✓ ปฏิเสธข้อความลวง' : '✗ ยังไม่ปฏิเสธข้อความลวง'}
        </Text>
      </View>
      <View style={styles.researchSection}>
        <Text style={styles.researchLabel}>Counterfactual Engine</Text>
        <Text style={styles.researchBody}>{evaluation.modules.counterfactual_generator.condition}</Text>
        <Text style={styles.researchBody}>
          Expected: {evaluation.modules.counterfactual_generator.expected_value} N
          {' · '}Answer: {evaluation.ai_under_test.counterfactual_answer || 'ไม่พบคำตอบ'}
        </Text>
      </View>
      <View style={styles.researchSection}>
        <Text style={styles.researchLabel}>Explanation Consistency</Text>
        {evaluation.ai_under_test.reasoning_trace.slice(0, 5).map((step) => (
          <Text key={`${step.step}-${step.claim}`} style={styles.researchBody}>
            • {step.step}: {step.claim} [{step.support}]
          </Text>
        ))}
        <Text style={styles.researchBody}>
          Trace alignment: {evaluation.modules.explanation_consistency.trace_supports_answer ? '✓' : '✗'}
          {' · '}Self-label alignment: {evaluation.modules.explanation_consistency.truth_assessment_matches_answer ? '✓' : '✗'}
          {' · '}Score: {(evaluation.modules.explanation_consistency.score * 100).toFixed(1)}%
        </Text>
        <Text style={styles.researchBody}>
          Declared confidence: {evaluation.ai_under_test.confidence}/100
          {' · '}Empirical accuracy: {(evaluation.modules.self_calibration.empirical_accuracy * 100).toFixed(1)}%
          {' · '}Calibration error: {evaluation.modules.self_calibration.calibration_error.toFixed(3)}
        </Text>
      </View>
      <View style={styles.researchFindings}>
        {evaluation.evaluation_layer.findings.map((finding) => (
          <Text key={finding} style={styles.researchBody}>• {finding}</Text>
        ))}
      </View>
    </View>
  );
}

function ResearchSuiteCard({
  evaluation,
  styles,
}: {
  evaluation: ResearchSuiteEvaluation;
  styles: ReturnType<typeof createStyles>;
}) {
  const { baseline, fire, delta } = evaluation.before_after;
  const stressFailures = evaluation.stress_tests.reduce(
    (total, test) => total + test.method_results.reduce((count, result) => count + (result.passed ? 0 : 1), 0),
    0,
  );
  const rows: Array<[string, number, number, number, boolean, boolean]> = [
    ['Truth Accuracy', baseline.truth_accuracy, fire.truth_accuracy, delta.truth_accuracy, false, true],
    ['Verification Precision', baseline.verification.precision, fire.verification.precision, delta.verification.precision, false, true],
    ['Verification Recall', baseline.verification.recall, fire.verification.recall, delta.verification.recall, false, true],
    ['Verification F1', baseline.verification.f1, fire.verification.f1, delta.verification.f1, false, true],
    ['Unsupported Claim Rate', baseline.unsupported_claim_rate, fire.unsupported_claim_rate, delta.unsupported_claim_rate, true, true],
    ['Calibration Error', baseline.calibration_error, fire.calibration_error, delta.calibration_error, true, true],
    ['Decision Stability', baseline.decision_stability, fire.decision_stability, delta.decision_stability, false, true],
    ['Prompt Injection Resistance', baseline.prompt_injection_resistance, fire.prompt_injection_resistance, delta.prompt_injection_resistance, false, true],
    ['Adversarial Robustness', baseline.adversarial_robustness, fire.adversarial_robustness, delta.adversarial_robustness, false, true],
    ['Average Latency', baseline.average_latency_ms, fire.average_latency_ms, delta.average_latency_ms, false, false],
  ];
  return (
    <View style={styles.researchCard}>
      <View style={styles.researchHeader}>
        <View style={styles.researchHeaderText}>
          <Text style={styles.researchTitle}>🧪 FIRE Research Suite</Text>
          <Text style={styles.researchSubtitle}>
            {evaluation.methodology.dataset} · {evaluation.methodology.cases} cases · seed {evaluation.methodology.seed}
          </Text>
        </View>
        <Text style={styles.researchOverall}>ก่อน–หลัง</Text>
      </View>
      <Text style={styles.researchBody}>
        Generator: {evaluation.methodology.generator_model}{'\n'}
        Independent verifier: {evaluation.methodology.verifier_model}
      </Text>
      <Text style={styles.researchLabel}>Metrics: Baseline → FIRE · Δ</Text>
      <View style={styles.researchComparisonCard}>
        {rows.map(([label, baselineValue, fireValue, deltaValue, inverse, percent]) => (
          <ResearchMetricRow
            key={label}
            label={label}
            baseline={baselineValue}
            fire={fireValue}
            delta={deltaValue}
            inverse={inverse}
            percent={percent}
            styles={styles}
          />
        ))}
      </View>
      <View style={styles.researchSection}>
        <Text style={styles.researchLabel}>Verification Confusion Matrix</Text>
        <Text style={styles.researchBody}>
          Baseline TP/FP/TN/FN: {baseline.verification.true_positive}/{baseline.verification.false_positive}/{baseline.verification.true_negative}/{baseline.verification.false_negative}
        </Text>
        <Text style={styles.researchBody}>
          FIRE TP/FP/TN/FN: {fire.verification.true_positive}/{fire.verification.false_positive}/{fire.verification.true_negative}/{fire.verification.false_negative}
        </Text>
        <Text style={styles.researchBody}>
          Verifier agreement: {(fire.verifier_agreement * 100).toFixed(1)}%
        </Text>
      </View>
      <View style={styles.researchSection}>
        <Text style={styles.researchLabel}>Stress Testing</Text>
        <Text style={styles.researchBody}>
          {evaluation.stress_tests.length} scenarios · {stressFailures} failed method checks
        </Text>
        {evaluation.stress_tests.map((test) => {
          const failed = test.method_results.filter((result) => !result.passed);
          return (
            <Text key={test.case_id} style={styles.researchBody}>
              • {test.case_id}: {failed.length === 0 ? '✓ ผ่าน' : `✗ ${failed.map((result) => `${result.method}: ${result.failure_modes.join(', ')}`).join(' · ')}`}
            </Text>
          );
        })}
      </View>
      <View style={styles.researchSection}>
        <Text style={styles.researchLabel}>Scientific Methodology</Text>
        {evaluation.methodology.protocol.slice(0, 5).map((step) => (
          <Text key={step} style={styles.researchBody}>• {step}</Text>
        ))}
        {evaluation.method_comparison.filter((method) => method.status === 'not_run').map((method) => (
          <Text key={method.method} style={styles.researchBody}>• {method.method}: ยังไม่ได้รัน — {method.notes}</Text>
        ))}
      </View>
      <View style={styles.researchSection}>
        <Text style={styles.researchLabel}>External Benchmarks</Text>
        {evaluation.external_benchmarks.map((benchmark) => (
          <Text key={benchmark.name} style={styles.researchBody}>
            • {benchmark.name}: ยังไม่ได้โหลด ({benchmark.reason})
          </Text>
        ))}
      </View>
    </View>
  );
}

interface ParsedSection {
  type: 'header' | 'text' | 'summary' | 'table' | 'hr';
  stageNum?: number;
  title?: string;
  content: string;
  table?: { headers: string[]; rows: string[][] };
}

function parsePCAContent(text: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const lines = text.split('\n');
  let current: string[] = [];

  const flushText = () => {
    const t = current.join('\n').trim();
    if (t) sections.push({ type: 'text', content: t });
    current = [];
  };

  const parseTableRow = (line: string) =>
    line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
  const isTableSeparator = (line: string) =>
    /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const nextLine = lines[index + 1];
    const h3Match = line.match(/^###\s+(\d+)\.\s+(.*)/);
    const h3HashMatch = line.match(/^###\s+#\s+(.*)/);
    const h3Plain = line.match(/^###\s+(.*)/);
    const markdownHeading = line.match(/^##?\s+(.*)/);
    const summaryMatch = line.match(/^\[DECISION_SUMMARY\]:\s*(.*)/);
    const hrMatch = line.match(/^[=─]{4,}/);

    if (line.includes('|') && nextLine && isTableSeparator(nextLine)) {
      flushText();
      const headers = parseTableRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        rows.push(parseTableRow(lines[index]));
        index += 1;
      }
      index -= 1;
      sections.push({ type: 'table', content: '', table: { headers, rows } });
    } else if (h3Match) {
      flushText();
      sections.push({ type: 'header', stageNum: parseInt(h3Match[1], 10), title: h3Match[2].trim(), content: '' });
    } else if (h3HashMatch) {
      flushText();
      sections.push({ type: 'header', title: h3HashMatch[1].trim(), content: '' });
    } else if (h3Plain && !h3Match) {
      flushText();
      sections.push({ type: 'header', title: h3Plain[1].trim(), content: '' });
    } else if (markdownHeading) {
      flushText();
      sections.push({ type: 'header', title: markdownHeading[1].trim(), content: '' });
    } else if (summaryMatch) {
      flushText();
      sections.push({ type: 'summary', content: summaryMatch[1] || '' });
    } else if (hrMatch) {
      flushText();
      sections.push({ type: 'hr', content: '' });
    } else {
      current.push(line);
    }
  }
  flushText();
  return sections;
}

function renderInlineMarkdown(text: string, baseStyle: object, boldStyle: object) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <Text key={i} style={boldStyle}>{part.slice(2, -2)}</Text>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <Text key={i} style={boldStyle}>{part.slice(1, -1)}</Text>;
    }
    return <Text key={i} style={baseStyle}>{part}</Text>;
  });
}

function confidenceStatus(band: PCAState['confidence']): { icon: string; color: string } {
  if (band === 'สูง') return { icon: '🟢', color: '#22c55e' };
  if (band === 'ต่ำ') return { icon: '🔴', color: '#ef4444' };
  return { icon: '🟡', color: '#eab308' };
}

function auditStatus(status?: VerificationReport['status']): { icon: string; color: string } {
  return status === 'ผ่าน'
    ? { icon: '🟢', color: '#22c55e' }
    : { icon: '🟡', color: '#eab308' };
}

interface MessageBubbleProps {
  message: Message;
}

async function shareAsFile(content: string, filename: string) {
  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: mimeTypeForFilename(filename) });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return;
  }
  const baseDirectory = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!baseDirectory) throw new Error('ไม่พบพื้นที่บันทึกไฟล์ในอุปกรณ์');
  const uri = `${baseDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('อุปกรณ์นี้ไม่รองรับการแชร์ไฟล์');
  }
  await Sharing.shareAsync(uri, {
    dialogTitle: filename,
    mimeType: mimeTypeForFilename(filename),
  });
}

function mimeTypeForFilename(filename: string): string {
  if (filename.endsWith('.html')) return 'text/html';
  if (filename.endsWith('.pdf')) return 'application/pdf';
  return 'text/plain';
}

function downloadTextFile(content: string, filename: string, mimeType: string) {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('ไม่พบระบบดาวน์โหลดไฟล์ของเว็บ');
  }
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openHtmlForPrint(html: string, title: string) {
  if (typeof window === 'undefined') {
    throw new Error('ไม่พบระบบพิมพ์ของเว็บ');
  }
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต pop-up แล้วลองใหม่');
  }
  printWindow.document.open();
  printWindow.document.write(
    html.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`),
  );
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => printWindow.print();
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const colors = useColors();
  const styles = createStyles(colors);
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [showPCA, setShowPCA] = useState(false);
  const [reportTab, setReportTab] = useState<'user' | 'analyst' | 'system'>('user');
  const [exportReportKind, setExportReportKind] = useState<Exclude<ReportKind, 'all'>>('user');
  const reports = message.reports;
  const analystAssumptions = reports?.analyst_report.assumptions ?? [];
  const analystReasoningTrace = reports?.analyst_report.reasoning_trace ?? [];
  const analystLimitations = reports?.analyst_report.limitations ?? [];
  const analystVerificationCriteria = reports?.analyst_report.verification_criteria ?? [];
  const reportConfidence = reports?.confidence_summary ?? (
    message.pcaState?.confidence_report
      ? {
          score: message.pcaState.confidence_report.score,
          band: message.pcaState.confidence,
        }
      : undefined
  );
  const confidenceIndicator = confidenceStatus(reportConfidence?.band ?? 'ไม่สามารถประเมินได้');
  const confidenceScore = Math.max(0, Math.min(100, reportConfidence?.score ?? 0));

  const sections = useMemo(() => {
    if (isUser) return null;
    return parsePCAContent(message.content);
  }, [message.content, isUser]);

  const elapsedLabel =
    message.elapsedMs != null
      ? message.elapsedMs >= 1000
        ? `${(message.elapsedMs / 1000).toFixed(1)}s`
        : `${message.elapsedMs}ms`
      : null;

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(message.content);
    setCopied(true);
    if (Platform.OS === 'android') {
      ToastAndroid.show('คัดลอกแล้ว', ToastAndroid.SHORT);
    }
    setTimeout(() => setCopied(false), 2000);
  }, [message.content]);

  const handleExportHtml = useCallback(async () => {
    if (!message.pcaState) return;
    try {
      const question = message.pcaState.user_input ?? message.pcaState.observations[0] ?? '';
      const html = generateHtmlReport(
        question,
        message.content,
        message.pcaState,
        exportReportKind,
        message.reports,
      );
      const filename = `FIRE_${exportReportKind.toUpperCase()}_${formatThaiFileStamp(message.pcaState.start_time)}.html`;

      if (Platform.OS === 'web') {
        downloadTextFile(html, filename, 'text/html;charset=utf-8');
      } else {
        await shareAsFile(html, filename);
      }
    } catch (error) {
      if (Platform.OS !== 'web' && message.pcaState) {
        const question = message.pcaState.user_input ?? message.pcaState.observations[0] ?? '';
        const html = generateHtmlReport(
          question,
          message.content,
          message.pcaState,
          exportReportKind,
          message.reports,
        );
        await Clipboard.setStringAsync(html);
        Alert.alert('บันทึกไม่สำเร็จ', 'คัดลอก HTML ไปยังคลิปบอร์ดแล้ว สามารถวางในไฟล์ .html ได้ครับ');
        return;
      }
      const detail = error instanceof Error ? error.message : 'ไม่ทราบสาเหตุ';
      Alert.alert('ดาวน์โหลด HTML ไม่สำเร็จ', detail);
    }
  }, [exportReportKind, message]);

  const handleExportPdf = useCallback(async () => {
    if (!message.pcaState) return;
    try {
      const question = message.pcaState.user_input ?? message.pcaState.observations[0] ?? '';
      const html = generateHtmlReport(
        question,
        message.content,
        message.pcaState,
        exportReportKind,
        message.reports,
      );
      const filename = `FIRE_${exportReportKind.toUpperCase()}_${formatThaiFileStamp(message.pcaState.start_time)}.pdf`;

      if (Platform.OS === 'web') {
        openHtmlForPrint(html, `FIRE — ${REPORT_KIND_LABELS[exportReportKind]}`);
        return;
      }

      const pdf = await Print.printToFileAsync({
        html,
        width: 794,
        height: 1123,
        margins: { top: 24, right: 24, bottom: 24, left: 24 },
      });
      const baseDirectory = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
      if (!baseDirectory) throw new Error('ไม่พบพื้นที่บันทึกไฟล์ในอุปกรณ์');
      const destination = `${baseDirectory}${filename}`;
      await FileSystem.copyAsync({ from: pdf.uri, to: destination });
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('อุปกรณ์นี้ไม่รองรับการแชร์ไฟล์');
      }
      await Sharing.shareAsync(destination, {
        dialogTitle: filename,
        mimeType: 'application/pdf',
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : '';
      if (Platform.OS === 'web' && detail.includes('บล็อกหน้าต่าง')) {
        Alert.alert(
          'เปิดหน้าต่าง PDF ไม่สำเร็จ',
          'เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต pop-up สำหรับแอปนี้ แล้วกด “บันทึก PDF” อีกครั้ง',
        );
        return;
      }
      Alert.alert(
        'สร้าง PDF ไม่สำเร็จ',
        Platform.OS === 'web'
          ? 'กรุณาลองใหม่อีกครั้ง หากไม่เห็นหน้าต่างพิมพ์ ให้ตรวจสอบการอนุญาต pop-up ของเบราว์เซอร์'
          : 'กรุณาลองใหม่อีกครั้ง หรือใช้ปุ่ม HTML แล้วเลือกพิมพ์เป็น PDF',
      );
    }
  }, [exportReportKind, message]);

  const renderExportControls = (legacy = false) => (
    <View style={styles.reportExportPanel}>
      <Text style={styles.exportHeading}>แชร์ / บันทึกรายงาน</Text>
      <Text style={styles.exportHint}>
        เลือกประเภทรายงาน แล้วดาวน์โหลด HTML หรือเลือก Save as PDF
      </Text>
      <View style={styles.exportTypeRow}>
        {([
          ['user', '👤 User Report'],
          ['analyst', '🔎 Analyst Report'],
          ['system', '🛠 System Trace'],
        ] as const).map(([kind, label]) => (
          <Pressable
            key={`${legacy ? 'legacy' : 'answer'}-export-${kind}`}
            onPress={() => setExportReportKind(kind)}
            style={[
              styles.exportTypeBtn,
              exportReportKind === kind && styles.exportTypeBtnActive,
            ]}
          >
            <Text style={[
              styles.exportTypeLabel,
              exportReportKind === kind && styles.exportTypeLabelActive,
            ]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.exportSelected}>
        รายงานที่เลือก: {REPORT_KIND_LABELS[exportReportKind]}
      </Text>
      <View style={styles.exportRow}>
        <Pressable
          onPress={handleExportHtml}
          style={({ pressed }) => [styles.exportHtmlBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel={`ดาวน์โหลด HTML — ${REPORT_KIND_LABELS[exportReportKind]}`}
        >
          <Ionicons name="logo-html5" size={13} color="#f97316" />
          <Text style={styles.exportHtmlLabel}>ดาวน์โหลด HTML</Text>
        </Pressable>
        <Pressable
          onPress={handleExportPdf}
          style={({ pressed }) => [styles.exportPdfBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel={`เปิดตัวเลือกบันทึก PDF — ${REPORT_KIND_LABELS[exportReportKind]}`}
        >
          <Ionicons name="document-text-outline" size={13} color="#dc2626" />
          <Text style={styles.exportPdfLabel}>บันทึก PDF</Text>
        </Pressable>
      </View>
    </View>
  );

  const handleShare = useCallback(async () => {
    const timestamp = formatThaiDateTime();
    const filename = `FIRE_${formatThaiFileStamp()}.txt`;
    let content = `=== FIRE — Framework for Inference, Reasoning & Evaluation ===\nวันที่: ${timestamp}\n\n`;

    if (message.pcaState) {
      content += `ระดับความมั่นใจ (ประมาณการเชิงคุณภาพ): ${message.pcaState.confidence}\n`;
      content += `โมเดล: ${message.pcaState.llm_provider ?? 'openai'} (${message.pcaState.llm_model ?? 'gpt-4o'})\n`;
      if (message.pcaState.execution_time_ms) {
        content += `เวลาประมวลผล: ${(message.pcaState.execution_time_ms / 1000).toFixed(2)}s\n`;
      }
      content += '\n';
    }

    if (message.reports) {
      const { user_report, analyst_report, system_trace, confidence_summary } = message.reports;
      content += `=== USER REPORT — รายงานสำหรับผู้ใช้ ===\n`;
      content += `${user_report.answer}\n`;
      content += `Executive Summary: ${user_report.executive_summary}\n`;
      content += `ประเภทคำถาม: ${user_report.route?.type ?? 'general'}\n`;
      content += `ความมั่นใจ: ${user_report.confidence}\n`;
      if (user_report.limitations.length > 0) {
        content += `ข้อจำกัด: ${user_report.limitations.join(' · ')}\n`;
      }
      if (user_report.next_step) content += `ขั้นถัดไป: ${user_report.next_step}\n`;

      content += `\n=== ANALYST REPORT — หลักฐานและผลตรวจสอบ ===\n`;
      content += `หลักฐาน: ${analyst_report.evidence_report?.items.length ?? 0} รายการ\n`;
      content += `ข้อเท็จจริง: ${analyst_report.knowledge_map?.facts.length ?? 0} · สมมติฐาน: ${analyst_report.knowledge_map?.assumptions.length ?? 0} · ข้อมูลขาด: ${analyst_report.missing_info.length}\n`;
      content += `ความขัดแย้ง: ${analyst_report.conflicts.length}\n`;
      if (analyst_report.verification) {
        content += `Verification: ${analyst_report.verification.status} (${((analyst_report.verification.score ?? 0) * 100).toFixed(1)}%)\n`;
      }
      if (analyst_report.decision_matrix) {
        content += `Decision Matrix: ${analyst_report.decision_matrix.selected_option}\n`;
      }
      if (analyst_report.counterfactual_analysis) {
        content += `Counterfactual: ${analyst_report.counterfactual_analysis.most_robust_option} · sensitivity ${analyst_report.counterfactual_analysis.sensitivity_score.toFixed(3)}\n`;
      }
      if (analyst_report.causal_reasoning) {
        content += `Causal links: ${analyst_report.causal_reasoning.links.length} · score ${analyst_report.causal_reasoning.score.toFixed(3)}\n`;
      }

      content += `Confidence: ${confidence_summary.score.toFixed(1)}/100 (${confidence_summary.band})\n`;
      content += `\n=== SYSTEM TRACE — รายละเอียดระบบ ===\n`;
      content += `Trace stages: ${system_trace.trace.length}\n`;
      content += `Dataflow edges: ${system_trace.dataflow.length}\n`;
      content += `Lifecycle events: ${system_trace.runtime_lifecycle.length}\n`;
      content += `Module audits: ${system_trace.module_audit.length}\n`;
      content += `State transitions: ${system_trace.state_transitions.length}\n`;
    } else {
      content += `=== คำตอบ ===\n${message.content}\n`;
      if (message.pcaState) {
        content += `\n=== กระบวนการคิด PCA ===\n`;
        content += `เข้าใจบริบท: ${message.pcaState.understanding}\n`;
        content += `เป้าหมาย: ${message.pcaState.purpose}\n`;
        content += `\nข้อวิจารณ์:\n${message.pcaState.critique.map((c) => `- ${c}`).join('\n')}\n`;
        content += `\nการสะท้อนคิด:\n${message.pcaState.reflection.map((r) => `- ${r}`).join('\n')}\n`;
      }
    }

    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
          await navigator.share({ title: 'FIRE Analysis', text: content });
        } else {
          downloadTextFile(content, filename, 'text/plain;charset=utf-8');
        }
      } else {
        await shareAsFile(content, filename);
      }
    } catch (err) {
      try {
        await Clipboard.setStringAsync(content);
        Alert.alert('แชร์ไม่สำเร็จ', 'คัดลอกผลวิเคราะห์ไปยังคลิปบอร์ดแล้วครับ');
      } catch {
        Alert.alert('แชร์ไม่สำเร็จ', err instanceof Error ? err.message : 'กรุณาลองใหม่อีกครั้ง');
      }
    }
  }, [message]);

  const renderSections = () => {
    if (!sections) return null;
    return sections.map((sec, idx) => {
      if (sec.type === 'header') {
        const stageColors = [
          '#FF6B2C', '#FF8C42', '#FFB347', '#E8844A', '#D97D3A',
          '#C4712F', '#B06525', '#9C591B', '#884E12', '#744208',
        ];
        const c = sec.stageNum
          ? stageColors[(sec.stageNum - 1) % stageColors.length]
          : colors.primary;
        return (
          <View key={idx} style={styles.sectionHeader}>
            {sec.stageNum != null && (
              <View style={[styles.sectionTag, { backgroundColor: c + '22' }]}>
                <Text style={[styles.sectionTagText, { color: c }]}>{sec.stageNum}</Text>
              </View>
            )}
            <Text style={[styles.sectionTitle, { color: c }]}>{sec.title}</Text>
          </View>
        );
      }
      if (sec.type === 'summary') {
        return (
          <View key={idx} style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>🔥 DECISION SUMMARY</Text>
            <Text style={styles.summaryText}>{sec.content}</Text>
          </View>
        );
      }
      if (sec.type === 'hr') {
        return <View key={idx} style={styles.hr} />;
      }
      if (sec.type === 'table' && sec.table) {
        return (
          <ScrollView
            key={idx}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tableScroll}
            contentContainerStyle={styles.tableContent}
          >
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeaderRow]}>
                {sec.table.headers.map((cell, cellIndex) => (
                  <Text key={`header-${cellIndex}`} style={[styles.tableCell, styles.tableHeaderCell]}>
                    {renderInlineMarkdown(cell, styles.tableHeaderCell, styles.tableHeaderCell)}
                  </Text>
                ))}
              </View>
              {sec.table.rows.map((row, rowIndex) => (
                <View key={`row-${rowIndex}`} style={styles.tableRow}>
                  {sec.table!.headers.map((_, cellIndex) => (
                    <Text key={`cell-${rowIndex}-${cellIndex}`} style={styles.tableCell}>
                      {renderInlineMarkdown(row[cellIndex] ?? '—', styles.tableCell, styles.bold)}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        );
      }
      if (sec.type === 'text' && sec.content) {
        const lines = sec.content.split('\n').filter(Boolean);
        return (
          <View key={idx} style={styles.textBlock}>
            {lines.map((line, li) => {
              const bulletMatch = line.match(/^[-•*]\s+(.*)/);
              const numberedMatch = line.match(/^(\d+)\.\s+(.*)/);
              if (bulletMatch) {
                return (
                  <View key={li} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>
                      {renderInlineMarkdown(bulletMatch[1], styles.bulletText, styles.bold)}
                    </Text>
                  </View>
                );
              }
              if (numberedMatch) {
                return (
                  <View key={li} style={styles.bulletRow}>
                    <Text style={[styles.bulletDot, { width: 18 }]}>{numberedMatch[1]}.</Text>
                    <Text style={styles.bulletText}>
                      {renderInlineMarkdown(numberedMatch[2], styles.bulletText, styles.bold)}
                    </Text>
                  </View>
                );
              }
              if (line.startsWith('#')) return null;
              return (
                <Text key={li} style={styles.aiText}>
                  {renderInlineMarkdown(line, styles.aiText, styles.bold)}
                </Text>
              );
            })}
          </View>
        );
      }
      return null;
    });
  };

  return (
    <View style={[styles.wrapper, isUser ? styles.wrapperUser : styles.wrapperAI]}>
      {isUser ? (
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.content}</Text>
        </View>
      ) : (
        <View style={styles.aiBubble}>
          {/* Content */}
          {sections ? (
            <View>{renderSections()}</View>
          ) : (
            <Text style={styles.aiText}>{message.content}</Text>
          )}

          {message.researchEvaluation && (
            <ResearchEvaluationCard evaluation={message.researchEvaluation} styles={styles} />
          )}
          {message.researchSuite && (
            <ResearchSuiteCard evaluation={message.researchSuite} styles={styles} />
          )}

          {message.pcaState && reports && renderExportControls()}

          {/* PCA Meta (collapsible) */}
          {message.pcaState && (
            <Pressable onPress={() => setShowPCA(!showPCA)} style={styles.pcaToggle}>
              <Text style={styles.pcaToggleText}>
                {showPCA ? '▲ ซ่อนรายงานและ System Trace' : '▼ เปิดรายงานและ System Trace'}
              </Text>
              <Text style={[
                styles.pcaConfidence,
                { color: confidenceIndicator.color },
              ]}>
                {confidenceIndicator.icon} {confidenceScore.toFixed(1)}/100 · {reportConfidence?.band ?? message.pcaState.confidence}
              </Text>
            </Pressable>
          )}
          {showPCA && reports && (
            <View style={styles.reportPanel}>
              <View style={styles.confidencePanel}>
                <View style={styles.confidenceHeader}>
                  <Text style={styles.confidenceTitle}>Confidence</Text>
                  <Text style={[styles.confidenceScore, { color: confidenceIndicator.color }]}>
                    {confidenceIndicator.icon} {confidenceScore.toFixed(1)}/100
                  </Text>
                </View>
                <View style={styles.confidenceTrack}>
                  <View
                    style={[
                      styles.confidenceFill,
                      { width: `${confidenceScore}%`, backgroundColor: confidenceIndicator.color },
                    ]}
                  />
                </View>
                <Text style={[styles.confidenceBand, { color: confidenceIndicator.color }]}>
                  {reportConfidence?.band ?? 'ไม่สามารถประเมินได้'}
                </Text>
              </View>
              <View style={styles.reportTabs}>
                {([
                  ['user', '👤 ผู้ใช้'],
                  ['analyst', '🔎 นักวิเคราะห์'],
                  ['system', '🛠 System Trace'],
                ] as const).map(([tab, label]) => (
                  <Pressable
                    key={tab}
                    onPress={() => setReportTab(tab)}
                    style={[
                      styles.reportTab,
                      reportTab === tab && styles.reportTabActive,
                    ]}
                  >
                    <Text style={[
                      styles.reportTabText,
                      reportTab === tab && styles.reportTabTextActive,
                    ]}>
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {reportTab === 'user' && (
                <View style={styles.reportSection}>
                  <Text style={styles.reportSectionTitle}>User Report</Text>
                  <Text style={styles.reportSectionHint}>สรุปสำหรับการอ่านและตัดสินใจของคุณ</Text>
                  <View style={styles.executiveSummary}>
                    <Text style={styles.executiveSummaryLabel}>Executive Summary</Text>
                    <Text style={styles.executiveSummaryText}>{reports.user_report.executive_summary}</Text>
                  </View>
                  <View style={styles.reportMetricRow}>
                    <Text style={styles.reportMetricLabel}>ประเภทคำถาม</Text>
                    <Text style={styles.reportMetricValue}>{reports.user_report.route?.type ?? 'general'}</Text>
                  </View>
                  {reports.user_report.limitations.length > 0 && (
                    <View style={styles.reportCallout}>
                      <Text style={styles.reportCalloutTitle}>ข้อจำกัดที่ควรรู้</Text>
                      {reports.user_report.limitations.map((item, index) => (
                        <Text key={`user-limit-${index}`} style={styles.reportBodyText}>• {item}</Text>
                      ))}
                    </View>
                  )}
                  {reports.user_report.next_step && (
                    <View style={styles.reportCallout}>
                      <Text style={styles.reportCalloutTitle}>ขั้นถัดไป</Text>
                      <Text style={styles.reportBodyText}>{reports.user_report.next_step}</Text>
                    </View>
                  )}
                </View>
              )}

              {reportTab === 'analyst' && (
                <View style={styles.reportSection}>
                  <Text style={styles.reportSectionTitle}>Analyst Report</Text>
                  <Text style={styles.reportSectionHint}>หลักฐาน เหตุผล และผล audit หลังคำตอบ</Text>
                  <Text style={styles.reportGroupTitle}>1. Evidence</Text>
                  <View style={styles.reportMetricGrid}>
                    <View style={styles.reportMetricTile}>
                      <Text style={styles.reportMetricNumber}>{reports.analyst_report.evidence_report?.items.length ?? 0}</Text>
                      <Text style={styles.reportMetricLabel}>หลักฐาน</Text>
                    </View>
                    <View style={styles.reportMetricTile}>
                      <Text style={styles.reportMetricNumber}>{reports.analyst_report.knowledge_map?.facts.length ?? 0}</Text>
                      <Text style={styles.reportMetricLabel}>ข้อเท็จจริง</Text>
                    </View>
                    <View style={styles.reportMetricTile}>
                        <Text style={styles.reportMetricNumber}>{analystAssumptions.length || reports.analyst_report.knowledge_map?.assumptions.length || 0}</Text>
                      <Text style={styles.reportMetricLabel}>สมมติฐาน</Text>
                    </View>
                    <View style={styles.reportMetricTile}>
                      <Text style={styles.reportMetricNumber}>{reports.analyst_report.missing_info.length}</Text>
                      <Text style={styles.reportMetricLabel}>ข้อมูลขาด</Text>
                    </View>
                  </View>
                  {reports.analyst_report.evidence_report && (
                    <View style={styles.reportCallout}>
                      <Text style={styles.reportCalloutTitle}>Evidence Matrix</Text>
                      <Text style={styles.reportBodyText}>
                        aggregate {reports.analyst_report.evidence_report.aggregate_score.toFixed(3)}
                        {' · '}coverage {reports.analyst_report.evidence_report.coverage_score.toFixed(3)}
                        {' · '}diversity {(reports.analyst_report.evidence_report.source_diversity_score ?? 0).toFixed(3)}
                      </Text>
                      <Text style={styles.reportSectionHint}>
                        source families: {Object.entries(reports.analyst_report.evidence_report.source_coverage ?? {})
                          .filter(([source]) => source !== 'user_input')
                          .map(([source, score]) => `${source} ${(score ?? 0).toFixed(3)}`)
                          .join(' · ') || 'ไม่มีแหล่ง non-user ที่ใช้ได้'}
                      </Text>
                      {reports.analyst_report.evidence_report.items.slice(0, 5).map((item) => (
                        <View key={item.id} style={styles.evidenceItemRow}>
                          <Text style={styles.reportCalloutTitle}>
                            {item.id} · {item.source} · {item.composite_score.toFixed(3)}
                          </Text>
                          <Text style={styles.reportBodyText} numberOfLines={3}>{item.text}</Text>
                          <Text style={styles.reportSectionHint}>
                            relevance {item.relevance_score.toFixed(3)} · quality {item.quality_score.toFixed(3)} · consistency {item.consistency_score.toFixed(3)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <Text style={styles.reportGroupTitle}>2. Assumptions</Text>
                  {analystAssumptions.length > 0 ? (
                    analystAssumptions.map((assumption) => (
                      <View key={assumption.id} style={styles.reportCallout}>
                        <Text style={styles.reportCalloutTitle}>
                          {assumption.id} · confidence {assumption.confidence.toFixed(3)}
                        </Text>
                        <Text style={styles.reportBodyText}>{assumption.statement}</Text>
                        <Text style={styles.reportSectionHint}>{assumption.basis}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.reportBodyText}>ไม่พบสมมติฐานที่ถูกบันทึก</Text>
                  )}
                  <Text style={styles.reportGroupTitle}>3. Reasoning Trace</Text>
                  {analystReasoningTrace.map((step) => (
                    <View key={step.id} style={styles.reasoningTraceRow}>
                      <View style={styles.reasoningTraceHeader}>
                        <Text style={styles.reportCalloutTitle}>{step.stage}</Text>
                        <Text style={styles.reasoningTraceId}>{step.id}</Text>
                      </View>
                      <Text style={styles.reportBodyText}>{step.purpose}</Text>
                      <Text style={styles.reportSectionHint}>
                        Input: {step.inputs.join(', ') || '—'} · Output: {step.outputs.join(', ') || '—'}
                      </Text>
                      <Text style={styles.reportSectionHint}>
                        อ้างอิง: {[
                          ...step.evidence_ids,
                          ...step.assumption_ids,
                          ...step.limitation_ids,
                          ...step.verification_ids,
                        ].join(', ') || 'ไม่มี'}
                      </Text>
                    </View>
                  ))}
                  <Text style={styles.reportGroupTitle}>4. Limitations</Text>
                  {analystLimitations.length > 0 ? (
                    analystLimitations.map((limitation) => (
                      <View key={limitation.id} style={styles.reportCallout}>
                        <Text style={styles.reportCalloutTitle}>{limitation.id}</Text>
                        <Text style={styles.reportBodyText}>{limitation.description}</Text>
                        <Text style={styles.reportSectionHint}>ผลกระทบ: {limitation.impact}</Text>
                        <Text style={styles.reportSectionHint}>ลดความเสี่ยง: {limitation.mitigation}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.reportBodyText}>ไม่พบข้อจำกัดเพิ่มเติม</Text>
                  )}
                  <Text style={styles.reportGroupTitle}>5. Verification Criteria</Text>
                  {analystVerificationCriteria.map((criterion) => (
                    <View key={criterion.id} style={styles.verificationCriterionRow}>
                      <Text style={styles.reportCalloutTitle}>
                        {criterion.passed ? '✓' : '✗'} {criterion.id} · {criterion.source}
                      </Text>
                      <Text style={styles.reportBodyText}>{criterion.criterion}</Text>
                      <Text style={styles.reportSectionHint}>
                        {criterion.evidence} · score {criterion.score.toFixed(3)}
                      </Text>
                    </View>
                  ))}
                  <Text style={styles.reportGroupTitle}>6. Reasoning Quality</Text>
                  {reports.analyst_report.reasoning_quality && (
                    <View style={styles.reportCallout}>
                      <Text style={styles.reportCalloutTitle}>Reasoning Quality</Text>
                      <Text style={styles.reportBodyText}>
                        evidence {reports.analyst_report.reasoning_quality.evidence_count}
                        {' · '}quality {reports.analyst_report.reasoning_quality.evidence_quality.toFixed(3)}
                        {' · '}unsupported {reports.analyst_report.reasoning_quality.unsupported_claim_count}
                      </Text>
                    </View>
                  )}
                  {reports.analyst_report.conflicts.length > 0 && (
                    <View style={styles.reportCallout}>
                      <Text style={styles.reportCalloutTitle}>ความขัดแย้ง {reports.analyst_report.conflicts.length} รายการ</Text>
                      {reports.analyst_report.conflicts.slice(0, 3).map((conflict) => (
                        <Text key={conflict.id} style={styles.reportBodyText}>• {conflict.severity} · {conflict.evidence}</Text>
                      ))}
                    </View>
                  )}
                  <Text style={styles.reportGroupTitle}>3. Decision</Text>
                  {reports.analyst_report.decision_matrix && reports.analyst_report.decision_matrix.options.length > 0 ? (
                    <View style={styles.reportCallout}>
                      <Text style={styles.reportCalloutTitle}>Decision Matrix</Text>
                      <Text style={styles.reportSectionHint}>
                        {Object.entries(reports.analyst_report.decision_matrix.criteria_weights)
                          .map(([criterion, weight]) => `${criterion} ${(weight ?? 0).toFixed(2)}`)
                          .join(' · ')}
                      </Text>
                      <Text style={styles.reportBodyText}>
                        เลือก: {reports.analyst_report.decision_matrix.selected_option}
                        {' · '}score {reports.analyst_report.decision_matrix.selected_score.toFixed(3)}
                      </Text>
                      <Text style={styles.reportBodyText}>{reports.analyst_report.decision_matrix.selection_reason}</Text>
                      {reports.analyst_report.decision_matrix.options.map((option) => (
                        <Text key={option.id} style={styles.reportSectionHint} numberOfLines={2}>
                          {option.label}: {Object.entries(option.criteria)
                            .map(([criterion, value]) => `${criterion} ${(value ?? 0).toFixed(2)}`)
                            .join(' · ')}
                        </Text>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.reportBodyText}>คำถามนี้ไม่ใช่เส้นทางการตัดสินใจ</Text>
                  )}
                  {reports.analyst_report.counterfactual_analysis && (
                    <View style={styles.reportCallout}>
                      <Text style={styles.reportCalloutTitle}>Counterfactual Stress Test</Text>
                      <Text style={styles.reportSectionHint}>
                        {reports.analyst_report.counterfactual_analysis.counterfactual_condition}
                      </Text>
                      <Text style={styles.reportBodyText}>
                        robust: {reports.analyst_report.counterfactual_analysis.most_robust_option}
                        {' · '}sensitivity {reports.analyst_report.counterfactual_analysis.sensitivity_score.toFixed(3)}
                      </Text>
                      {reports.analyst_report.counterfactual_analysis.comparisons.map((comparison) => (
                        <Text key={comparison.option_id} style={styles.reportSectionHint} numberOfLines={2}>
                          {comparison.option_id}: {comparison.baseline_score.toFixed(3)} → {comparison.counterfactual_score.toFixed(3)}
                          {' · '}Δ {comparison.delta.toFixed(3)} · {comparison.outcome}
                        </Text>
                      ))}
                    </View>
                  )}
                  {reports.analyst_report.causal_reasoning && (
                    <View style={styles.reportCallout}>
                      <Text style={styles.reportCalloutTitle}>Causal Reasoning</Text>
                      <Text style={styles.reportBodyText}>
                        score {reports.analyst_report.causal_reasoning.score.toFixed(3)}
                        {' · '}links {reports.analyst_report.causal_reasoning.links.length}
                      </Text>
                      {reports.analyst_report.causal_reasoning.links.map((link) => (
                        <Text key={link.id} style={styles.reportSectionHint} numberOfLines={3}>
                          • {link.cause} → {link.effect} · {link.relation} · confidence {link.confidence.toFixed(3)}
                          {'\n'}  {link.mechanism}
                        </Text>
                      ))}
                      {reports.analyst_report.causal_reasoning.confounders.length > 0 && (
                        <Text style={styles.reportSectionHint} numberOfLines={2}>
                          confounders: {reports.analyst_report.causal_reasoning.confounders.join(' · ')}
                        </Text>
                      )}
                    </View>
                  )}
                  <Text style={styles.reportGroupTitle}>4. Verification</Text>
                  {reports.analyst_report.verification && (
                    <View style={styles.reportCallout}>
                      <Text style={styles.reportCalloutTitle}>
                        {auditStatus(reports.analyst_report.verification.status).icon}{' '}
                        Audit: {reports.analyst_report.verification.status}
                      </Text>
                      <Text style={styles.reportBodyText}>
                        {reports.analyst_report.verification.consistency} · score {((reports.analyst_report.verification.score ?? 0) * 100).toFixed(1)}%
                      </Text>
                    </View>
                  )}
                  {reports.analyst_report.logical_verification && (
                    <Text style={styles.reportBodyText}>
                      {auditStatus(reports.analyst_report.logical_verification.status).icon} Logical verification: {reports.analyst_report.logical_verification.status}
                    </Text>
                  )}
                </View>
              )}

              {reportTab === 'system' && (
                <View style={styles.reportSection}>
                  <Text style={styles.reportSectionTitle}>System Trace</Text>
                  <Text style={styles.reportSectionHint}>รายละเอียดการทำงานสำหรับ debug และพัฒนาระบบ</Text>
                  {reports.system_trace.runtime_summary && (
                    <View style={styles.reportCallout}>
                      <Text style={styles.reportCalloutTitle}>Runtime</Text>
                      <Text style={styles.reportBodyText}>
                        Total {reports.system_trace.runtime_summary.cognitive.total_ms.toFixed(1)}ms
                        {' · '}LLM {reports.system_trace.runtime_summary.llm.request_ms.toFixed(1)}ms
                      </Text>
                      <Text style={styles.reportBodyText}>
                        {reports.system_trace.trace.length} trace stages · {reports.system_trace.dataflow.length} dataflow edges
                      </Text>
                    </View>
                  )}
                  <View style={styles.reportMetricGrid}>
                    <View style={styles.reportMetricTile}>
                      <Text style={styles.reportMetricNumber}>{reports.system_trace.module_audit.length}</Text>
                      <Text style={styles.reportMetricLabel}>โมดูล audit</Text>
                    </View>
                    <View style={styles.reportMetricTile}>
                      <Text style={styles.reportMetricNumber}>{reports.system_trace.runtime_metrics.length}</Text>
                      <Text style={styles.reportMetricLabel}>metrics</Text>
                    </View>
                    <View style={styles.reportMetricTile}>
                      <Text style={styles.reportMetricNumber}>{reports.system_trace.state_transitions.length}</Text>
                      <Text style={styles.reportMetricLabel}>transitions</Text>
                    </View>
                    <View style={styles.reportMetricTile}>
                      <Text style={styles.reportMetricNumber}>{reports.system_trace.runtime_lifecycle.length}</Text>
                      <Text style={styles.reportMetricLabel}>lifecycle</Text>
                    </View>
                  </View>
                  {reports.system_trace.notes.slice(-3).map((note, index) => (
                    <Text key={`developer-note-${index}`} style={styles.reportBodyText}>• {note}</Text>
                  ))}
                </View>
              )}

            </View>
          )}
          {showPCA && message.pcaState && !reports && (
            <View style={styles.pcaMeta}>
              <Text style={styles.pcaMetaRow}>
                <Text style={styles.pcaMetaLabel}>โมเดล: </Text>
                {message.pcaState.llm_provider} ({message.pcaState.llm_model})
              </Text>
              {message.pcaState.execution_time_ms != null && (
                <Text style={styles.pcaMetaRow}>
                  <Text style={styles.pcaMetaLabel}>เวลารวม: </Text>
                  {message.pcaState.execution_time_ms >= 1000
                    ? `${(message.pcaState.execution_time_ms / 1000).toFixed(2)}s`
                    : `${message.pcaState.execution_time_ms}ms`}
                </Text>
              )}
              <Text style={styles.pcaMetaRow}>
                <Text style={styles.pcaMetaLabel}>ขั้นตอน: </Text>
                {message.pcaState.trace.length} stages
              </Text>
              {message.pcaState.confidence_report && (
                <View style={styles.osCard}>
                  <Text style={styles.osCardTitle}>
                    คะแนนความมั่นใจ: {message.pcaState.confidence_report.score.toFixed(1)}/100 · {message.pcaState.confidence}
                  </Text>
                  <Text style={styles.osCardText}>
                    Evidence: {(message.pcaState.confidence_report.components.evidence_quality ?? 0).toFixed(3)}
                    {' · '}Verification: {(message.pcaState.confidence_report.verification_score * 100).toFixed(1)}%
                  </Text>
                  <Text style={styles.osCardText} numberOfLines={3}>
                    สูตร: {message.pcaState.confidence_report.method}
                  </Text>
                </View>
              )}
              {message.pcaState.evidence_report && (
                <View style={styles.osCard}>
                  <Text style={styles.osCardTitle}>
                    Evidence Matrix: {message.pcaState.evidence_report.items.length} รายการ
                  </Text>
                  <Text style={styles.osCardText}>
                    aggregate {message.pcaState.evidence_report.aggregate_score.toFixed(3)}
                    {' · '}coverage {message.pcaState.evidence_report.coverage_score.toFixed(3)}
                  </Text>
                  {message.pcaState.evidence_report.items.slice(0, 3).map((item) => (
                    <Text key={item.id} style={styles.osCardText} numberOfLines={2}>
                      • {item.source}: {item.composite_score.toFixed(3)} — {item.text}
                    </Text>
                  ))}
                </View>
              )}
              {message.pcaState.reasoning_quality && (
                <View style={styles.osCard}>
                  <Text style={styles.osCardTitle}>🧪 Reasoning Quality</Text>
                  <Text style={styles.osCardText}>
                    evidence {message.pcaState.reasoning_quality.evidence_count} · coverage {message.pcaState.reasoning_quality.evidence_coverage.toFixed(3)} · quality {message.pcaState.reasoning_quality.evidence_quality.toFixed(3)}
                  </Text>
                  <Text style={styles.osCardText}>
                    memory hits {message.pcaState.reasoning_quality.memory_hits} · conflicts {message.pcaState.reasoning_quality.conflict_count} · missing {message.pcaState.reasoning_quality.missing_information_count}
                  </Text>
                  <Text style={styles.osCardText}>
                    unsupported {message.pcaState.reasoning_quality.unsupported_claim_count} · verification {(message.pcaState.reasoning_quality.verification_pass_rate * 100).toFixed(1)}% · margin {message.pcaState.reasoning_quality.decision_margin.toFixed(3)}
                  </Text>
                </View>
              )}
              {message.pcaState.runtime_summary && (
                <View style={styles.osCard}>
                  <Text style={styles.osCardTitle}>⏱ Runtime Boundary</Text>
                  <Text style={styles.osCardText}>
                    Cognitive {message.pcaState.runtime_summary.cognitive.total_ms.toFixed(1)}ms · LLM {message.pcaState.runtime_summary.llm.request_ms.toFixed(1)}ms
                  </Text>
                  <Text style={styles.osCardText}>
                    pre-LLM {message.pcaState.runtime_summary.cognitive.pre_llm_ms.toFixed(1)}ms · post-LLM {message.pcaState.runtime_summary.cognitive.post_llm_ms.toFixed(1)}ms · retry {message.pcaState.runtime_summary.llm.retry_count}
                  </Text>
                </View>
              )}
              {message.pcaState.module_audit && message.pcaState.module_audit.length > 0 && (
                <View style={styles.osCard}>
                  <Text style={styles.osCardTitle}>Module Audit: {message.pcaState.module_audit.length} โมดูล</Text>
                  {message.pcaState.module_audit.map((audit) => (
                    <Text key={audit.module} style={styles.osCardText} numberOfLines={2}>
                      • {audit.module}: {audit.score != null ? audit.score.toFixed(3) : '—'} · {audit.algorithm}
                    </Text>
                  ))}
                </View>
              )}
              {message.pcaState.intent && (
                <View style={styles.osCard}>
                  <Text style={styles.osCardTitle}>🧭 Intent Router</Text>
                  <Text style={styles.osCardText}>
                    {message.pcaState.intent.type} → {message.pcaState.intent.pipeline} · confidence {message.pcaState.intent.confidence.toFixed(3)}
                  </Text>
                  <Text style={styles.osCardText} numberOfLines={3}>
                    {message.pcaState.intent.rationale}
                  </Text>
                </View>
              )}
              {message.pcaState.dataflow && message.pcaState.dataflow.length > 0 && (
                <View style={styles.osCard}>
                  <Text style={styles.osCardTitle}>🔗 Cognitive Dataflow: {message.pcaState.dataflow.length} edges</Text>
                  {message.pcaState.dataflow.slice(0, 8).map((flow) => (
                    <Text key={flow.id} style={styles.osCardText} numberOfLines={3}>
                      {flow.from} → {flow.to} · {flow.item_count} items{'\n'}
                      output [{flow.outputs.join(', ')}] → input [{flow.inputs.join(', ')}]
                    </Text>
                  ))}
                </View>
              )}
              {message.pcaState.intent?.type === 'decision' &&
                message.pcaState.decision_matrix &&
                message.pcaState.decision_matrix.options.length > 0 && (
                <View style={styles.osCard}>
                  <Text style={styles.osCardTitle}>
                    ⚡ Decision Matrix · selected {message.pcaState.decision_matrix.selected_option}
                  </Text>
                  <Text style={styles.osCardText} numberOfLines={3}>
                    {message.pcaState.decision_matrix.selection_reason}
                  </Text>
                  {message.pcaState.decision_matrix.options.map((option) => (
                    <Text key={option.id} style={styles.osCardText} numberOfLines={2}>
                      {option.id === message.pcaState?.decision_matrix?.selected_option ? '✓' : '•'} {option.label}: {option.weighted_score.toFixed(3)}
                      {' · '}{Object.entries(option.criteria).map(([criterion, value]) => `${criterion} ${(value ?? 0).toFixed(2)}`).join(' / ')}
                    </Text>
                  ))}
                </View>
              )}
              {message.pcaState.intent?.type === 'decision' && message.pcaState.counterfactual_analysis && (
                <View style={styles.osCard}>
                  <Text style={styles.osCardTitle}>↔ Counterfactual Stress Test</Text>
                  <Text style={styles.osCardText} numberOfLines={2}>
                    robust {message.pcaState.counterfactual_analysis.most_robust_option}
                    {' · '}sensitivity {message.pcaState.counterfactual_analysis.sensitivity_score.toFixed(3)}
                  </Text>
                  {message.pcaState.counterfactual_analysis.comparisons.map((comparison) => (
                    <Text key={comparison.option_id} style={styles.osCardText} numberOfLines={2}>
                      • {comparison.option_id}: {comparison.baseline_score.toFixed(3)} → {comparison.counterfactual_score.toFixed(3)}
                      {' · '}Δ {comparison.delta.toFixed(3)}
                    </Text>
                  ))}
                </View>
              )}
              {message.pcaState.intent?.type === 'decision' && message.pcaState.causal_reasoning && (
                <View style={styles.osCard}>
                  <Text style={styles.osCardTitle}>⛓ Causal Reasoning</Text>
                  <Text style={styles.osCardText}>
                    score {message.pcaState.causal_reasoning.score.toFixed(3)}
                    {' · '}links {message.pcaState.causal_reasoning.links.length}
                  </Text>
                  {message.pcaState.causal_reasoning.links.map((link) => (
                    <Text key={link.id} style={styles.osCardText} numberOfLines={3}>
                      • {link.cause} → {link.effect} · {link.relation} · {link.confidence.toFixed(3)}
                    </Text>
                  ))}
                </View>
              )}
              {message.pcaState.memory_retrieval && (
                <View style={styles.osCard}>
                  <Text style={styles.osCardTitle}>
                    💾 Memory Retrieval · {message.pcaState.memory_retrieval.matched_count}/{message.pcaState.memory_retrieval.candidate_count} hits · {message.pcaState.memory_retrieval.storage_backend ?? 'unknown'}
                  </Text>
                  <Text style={styles.osCardText} numberOfLines={2}>
                    query tokens: {message.pcaState.memory_retrieval.query_tokens.slice(0, 12).join(', ') || 'ไม่มี token'}
                  </Text>
                  {message.pcaState.memory_retrieval.hits.slice(0, 3).map((hit) => (
                    <Text key={`${hit.rank}-${hit.source}`} style={styles.osCardText} numberOfLines={2}>
                      #{hit.rank} {hit.source} · {hit.retrieval_score.toFixed(3)} · {hit.matched_tokens.join(', ') || 'ไม่มี token ที่ match'}
                    </Text>
                  ))}
                  {message.pcaState.memory_retrieval.miss_reason && (
                    <Text style={styles.osCardText} numberOfLines={2}>
                      miss: {message.pcaState.memory_retrieval.miss_reason}
                    </Text>
                  )}
                </View>
              )}
              {message.pcaState.runtime_metrics && message.pcaState.runtime_metrics.length > 0 && (
                <View style={styles.osCard}>
                  <Text style={styles.osCardTitle}>📊 Cognitive Operation Metrics</Text>
                  {message.pcaState.runtime_metrics.map((metric) => (
                    <Text key={metric.module} style={styles.osCardText} numberOfLines={2}>
                      • {metric.module}: {metric.input_count} in → {metric.output_count} out · evidence {metric.evidence_count} · memory {metric.memory_hits} · conflicts {metric.conflict_count}
                    </Text>
                  ))}
                </View>
              )}
              {/* Per-stage timing mini-list */}
              {message.pcaState.trace.map((entry, i) => {
                const info = STAGE_INFO[entry.stage];
                const ms = entry.duration_ms ?? 0;
                const msLabel = entry.measured === false
                  ? 'phase'
                  : ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms.toFixed(3)}ms`;
                const dotColor = ms >= 2000 ? '#ef4444' : ms >= 500 ? '#f59e0b' : ms >= 100 ? '#22d3ee' : '#22c55e';
                return (
                  <View key={i} style={styles.traceRow}>
                    <View style={[styles.traceDot, { backgroundColor: dotColor }]} />
                    <Text style={styles.traceStage} numberOfLines={1}>
                      {info?.icon ?? '▸'} {info?.th ?? entry.stage}
                    </Text>
                      <Text style={[styles.traceMs, { color: dotColor }]}>{msLabel}</Text>
                  </View>
                );
              })}
              {message.pcaState.runtime_lifecycle && message.pcaState.runtime_lifecycle.length > 0 && (
                <>
                  <Text style={[styles.pcaMetaRow, { marginTop: 8 }]}>
                    <Text style={styles.pcaMetaLabel}>FIRE Runtime: </Text>
                    BOOT → READY → UNDERSTAND → PLAN → REASON → VERIFY → RESPOND → REFLECT
                  </Text>
                  {message.pcaState.runtime_lifecycle.map((event, i) => (
                    <View key={`runtime-${i}`} style={styles.traceRow}>
                      <View style={[styles.phaseBadge, { backgroundColor: colors.primary + '22' }]}>
                        <Text style={[styles.phaseBadgeText, { color: colors.primary }]}>{event.phase}</Text>
                      </View>
                      <Text style={styles.traceStage} numberOfLines={1}>{event.action}</Text>
                      <Text style={styles.traceMs}>
                        {event.measured === false
                          ? 'phase marker'
                          : event.duration_ms >= 1000
                            ? `${(event.duration_ms / 1000).toFixed(2)}s · measured`
                            : `${event.duration_ms.toFixed(3)}ms · measured`}
                      </Text>
                    </View>
                  ))}
                </>
              )}
              {message.pcaState.governance && (
                <View style={styles.osCard}>
                  <Text style={styles.osCardTitle}>🛡 Governance: {message.pcaState.governance.status}</Text>
                  {message.pcaState.governance.safety_checks.map((check, i) => (
                    <Text key={`safety-${i}`} style={styles.osCardText}>• {check}</Text>
                  ))}
                </View>
              )}
              {message.pcaState.verification && (
                <View style={styles.osCard}>
                  <Text style={styles.osCardTitle}>✅ Verification: {message.pcaState.verification.status}</Text>
                  <Text style={styles.osCardText}>
                    ความสอดคล้อง: {message.pcaState.verification.consistency}
                  </Text>
                  <Text style={styles.osCardText}>
                    คะแนน: {((message.pcaState.verification.score ?? 0) * 100).toFixed(1)}%
                  </Text>
                  {(message.pcaState.verification.detailed_checks ?? []).map((check) => (
                    <Text key={check.criterion} style={styles.osCardText} numberOfLines={2}>
                      {check.passed ? '✓' : '✗'} {check.criterion}: {check.evidence}
                    </Text>
                  ))}
                </View>
              )}
              {message.pcaState.logical_verification && (
                <View style={styles.osCard}>
                  <Text style={styles.osCardTitle}>
                    🧠 Logical Verification: {message.pcaState.logical_verification.status}
                  </Text>
                  <Text style={styles.osCardText}>
                    score: {(message.pcaState.logical_verification.score * 100).toFixed(1)}%
                  </Text>
                  {message.pcaState.logical_verification.checks.map((check) => (
                    <Text key={check.criterion} style={styles.osCardText} numberOfLines={2}>
                      {check.passed ? '✓' : '✗'} {check.criterion}: {check.evidence}
                    </Text>
                  ))}
                </View>
              )}
              {message.pcaState.reasoning_graph && (
                <View style={styles.osCard}>
                  <Text style={styles.osCardTitle}>
                    🕸 Claim Graph · {message.pcaState.reasoning_graph.claims.length} claims · {message.pcaState.reasoning_graph.edges.length} links
                  </Text>
                  <Text style={styles.osCardText}>
                    selected: {message.pcaState.reasoning_graph.selected_option || '—'} · unsupported: {message.pcaState.reasoning_graph.unsupported_claim_count}
                  </Text>
                  {message.pcaState.reasoning_graph.claims.slice(0, 5).map((claim) => (
                    <Text key={claim.id} style={styles.osCardText} numberOfLines={2}>
                      {claim.status === 'supported' ? '✓' : claim.status === 'partial' ? '△' : '✗'} {claim.type} · {claim.support_score.toFixed(3)} · {claim.text}
                    </Text>
                  ))}
                </View>
              )}
              {message.pcaState.state_transitions && message.pcaState.state_transitions.length > 0 && (
                <View style={styles.osCard}>
                  <Text style={styles.osCardTitle}>
                    🔁 State Transitions · {message.pcaState.state_transitions.length} mutations
                  </Text>
                  {message.pcaState.state_transitions.slice(0, 6).map((transition) => (
                    <Text key={transition.id} style={styles.osCardText} numberOfLines={3}>
                      • {transition.module} · {transition.state_field}{'\n'}
                      {JSON.stringify(transition.before)} → {JSON.stringify(transition.after)}
                    </Text>
                  ))}
                </View>
              )}
              {message.pcaState.conflict_findings && message.pcaState.conflict_findings.length > 0 && (
                <View style={styles.osCard}>
                  <Text style={styles.osCardTitle}>⚠ Conflict Findings: {message.pcaState.conflict_findings.length}</Text>
                  {message.pcaState.conflict_findings.map((finding) => (
                    <Text key={finding.id} style={styles.osCardText} numberOfLines={3}>
                      • {finding.severity} · {finding.evidence}
                    </Text>
                  ))}
                </View>
              )}
              {message.pcaState.knowledge_map && (
                <View style={styles.knowledgeCard}>
                  <Text style={[styles.osCardTitle, { color: '#166534' }]}>
                    [ข้อเท็จจริง] {message.pcaState.knowledge_map.facts.length}
                  </Text>
                  <Text style={[styles.osCardTitle, { color: '#92400e' }]}>
                    [สมมติฐาน] {message.pcaState.knowledge_map.assumptions.length}
                  </Text>
                  <Text style={[styles.osCardTitle, { color: '#475569' }]}>
                    [ข้อมูลที่ขาด] {message.pcaState.knowledge_map.unknowns.length}
                  </Text>
                </View>
              )}
              <Text style={[styles.pcaMetaRow, { marginTop: 6 }]}>
                <Text style={styles.pcaMetaLabel}>บริบท: </Text>
                {message.pcaState.understanding}
              </Text>
              {renderExportControls(true)}
            </View>
          )}

          {/* Footer: actions */}
          <View style={styles.footer}>
            {elapsedLabel && (
              <View style={styles.elapsedBadge}>
                <Text style={styles.elapsedText}>{elapsedLabel}</Text>
              </View>
            )}
            <View style={styles.actions}>
              <Pressable
                onPress={handleCopy}
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}
                hitSlop={8}
              >
                <Ionicons
                  name={copied ? 'checkmark' : 'copy-outline'}
                  size={16}
                  color={copied ? '#22C55E' : colors.mutedForeground}
                />
                <Text style={[styles.actionLabel, copied && { color: '#22C55E' }]}>
                  {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleShare}
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}
                hitSlop={8}
              >
                <Ionicons name="share-outline" size={16} color={colors.mutedForeground} />
                <Text style={styles.actionLabel}>แชร์</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    wrapper: {
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    wrapperUser: { alignItems: 'flex-end' },
    wrapperAI: { alignItems: 'flex-start' },
    userBubble: {
      maxWidth: '80%',
      backgroundColor: colors.primary,
      borderRadius: 20,
      borderBottomRightRadius: 4,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    userText: {
      color: '#FFF',
      fontSize: 15,
      fontFamily: 'Inter_400Regular',
      lineHeight: 22,
    },
    aiBubble: {
      maxWidth: '96%',
      backgroundColor: colors.card,
      borderRadius: 20,
      borderBottomLeftRadius: 4,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    aiText: {
      color: colors.foreground,
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      lineHeight: 22,
    },
    bold: {
      color: colors.foreground,
      fontSize: 14,
      fontFamily: 'Inter_700Bold',
      lineHeight: 22,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 14,
      marginBottom: 4,
    },
    sectionTag: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTagText: {
      fontSize: 11,
      fontWeight: '700' as const,
      fontFamily: 'Inter_700Bold',
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700' as const,
      fontFamily: 'Inter_700Bold',
      flex: 1,
      flexWrap: 'wrap',
    },
    textBlock: { gap: 4, marginBottom: 4 },
    bulletRow: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'flex-start',
      marginBottom: 2,
    },
    bulletDot: {
      color: colors.primary,
      fontSize: 14,
      lineHeight: 22,
    },
    bulletText: {
      color: colors.foreground,
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      lineHeight: 22,
      flex: 1,
    },
    summaryBox: {
      marginTop: 12,
      backgroundColor: colors.primary + '18',
      borderRadius: 12,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      padding: 12,
    },
    summaryLabel: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: '700' as const,
      fontFamily: 'Inter_700Bold',
      letterSpacing: 1,
      marginBottom: 4,
    },
    summaryText: {
      color: colors.foreground,
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      lineHeight: 20,
    },
    hr: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 8,
    },
    tableScroll: {
      marginVertical: 8,
      maxWidth: '100%',
    },
    tableContent: {
      paddingRight: 4,
    },
    table: {
      minWidth: 320,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      overflow: 'hidden',
    },
    tableRow: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    tableHeaderRow: {
      borderTopWidth: 0,
      backgroundColor: colors.muted,
    },
    tableCell: {
      width: 128,
      paddingHorizontal: 9,
      paddingVertical: 8,
      color: colors.foreground,
      fontSize: 12,
      lineHeight: 18,
      fontFamily: 'Inter_400Regular',
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    tableHeaderCell: {
      color: colors.foreground,
      fontFamily: 'Inter_700Bold',
      fontWeight: '700' as const,
    },
    pcaToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    pcaToggleText: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
    },
    pcaConfidence: {
      color: colors.primary,
      fontSize: 11,
      fontFamily: 'Inter_600SemiBold',
      fontWeight: '600' as const,
    },
    confidencePanel: {
      backgroundColor: colors.card,
      borderRadius: 8,
      padding: 9,
      marginBottom: 8,
      gap: 5,
    },
    confidenceHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    confidenceTitle: {
      color: colors.foreground,
      fontSize: 11,
      fontFamily: 'Inter_600SemiBold',
      fontWeight: '600' as const,
    },
    confidenceScore: {
      fontSize: 12,
      fontFamily: 'Inter_700Bold',
      fontWeight: '700' as const,
    },
    confidenceTrack: {
      height: 7,
      borderRadius: 4,
      overflow: 'hidden',
      backgroundColor: colors.border,
    },
    confidenceFill: {
      height: '100%',
      borderRadius: 4,
    },
    confidenceBand: {
      fontSize: 10,
      fontFamily: 'Inter_500Medium',
    },
    pcaMeta: {
      marginTop: 8,
      backgroundColor: colors.muted,
      borderRadius: 8,
      padding: 10,
      gap: 4,
    },
    reportPanel: {
      marginTop: 8,
      backgroundColor: colors.muted,
      borderRadius: 10,
      padding: 8,
    },
    reportTabs: {
      flexDirection: 'row',
      gap: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 6,
    },
    reportTab: {
      flex: 1,
      minHeight: 32,
      paddingHorizontal: 4,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reportTabActive: {
      backgroundColor: colors.card,
    },
    reportTabText: {
      color: colors.mutedForeground,
      fontSize: 10,
      fontFamily: 'Inter_500Medium',
      textAlign: 'center',
    },
    reportTabTextActive: {
      color: colors.primary,
      fontFamily: 'Inter_700Bold',
      fontWeight: '700' as const,
    },
    reportSection: {
      paddingTop: 10,
      gap: 6,
    },
    reportSectionTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontFamily: 'Inter_700Bold',
      fontWeight: '700' as const,
    },
    reportSectionHint: {
      color: colors.mutedForeground,
      fontSize: 10,
      fontFamily: 'Inter_400Regular',
      marginBottom: 3,
    },
    reportExportPanel: {
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 5,
    },
    executiveSummary: {
      backgroundColor: colors.primary + '18',
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      borderRadius: 7,
      padding: 8,
      gap: 3,
      marginBottom: 2,
    },
    executiveSummaryLabel: {
      color: colors.primary,
      fontSize: 10,
      fontFamily: 'Inter_700Bold',
      fontWeight: '700' as const,
    },
    executiveSummaryText: {
      color: colors.foreground,
      fontSize: 11,
      lineHeight: 16,
      fontFamily: 'Inter_400Regular',
    },
    exportHeading: {
      color: colors.foreground,
      fontSize: 11,
      fontFamily: 'Inter_700Bold',
      fontWeight: '700' as const,
      marginTop: 8,
    },
    exportHint: {
      color: colors.mutedForeground,
      fontSize: 10,
      lineHeight: 15,
      fontFamily: 'Inter_400Regular',
    },
    exportTypeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
      marginTop: 3,
    },
    exportTypeBtn: {
      flexGrow: 1,
      minWidth: '30%',
      minHeight: 32,
      paddingHorizontal: 7,
      paddingVertical: 6,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    exportTypeBtnActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '18',
    },
    exportTypeLabel: {
      color: colors.mutedForeground,
      fontSize: 9,
      lineHeight: 13,
      fontFamily: 'Inter_500Medium',
      textAlign: 'center',
    },
    exportTypeLabelActive: {
      color: colors.primary,
      fontFamily: 'Inter_700Bold',
      fontWeight: '700' as const,
    },
    exportSelected: {
      color: colors.primary,
      fontSize: 10,
      fontFamily: 'Inter_600SemiBold',
      fontWeight: '600' as const,
      marginTop: 1,
    },
    reportGroupTitle: {
      color: colors.foreground,
      fontSize: 11,
      fontFamily: 'Inter_700Bold',
      fontWeight: '700' as const,
      marginTop: 5,
      marginBottom: 1,
    },
    reportMetricRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
      paddingVertical: 3,
    },
    reportMetricLabel: {
      color: colors.mutedForeground,
      fontSize: 10,
      fontFamily: 'Inter_400Regular',
    },
    reportMetricValue: {
      color: colors.foreground,
      fontSize: 10,
      fontFamily: 'Inter_600SemiBold',
      fontWeight: '600' as const,
      textAlign: 'right',
      flexShrink: 1,
    },
    reportMetricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
      marginVertical: 3,
    },
    reportMetricTile: {
      width: '48%',
      backgroundColor: colors.card,
      borderRadius: 7,
      padding: 7,
    },
    reportMetricNumber: {
      color: colors.primary,
      fontSize: 15,
      fontFamily: 'Inter_700Bold',
      fontWeight: '700' as const,
    },
    reportCallout: {
      backgroundColor: colors.card,
      borderRadius: 7,
      padding: 8,
      gap: 3,
    },
    researchCard: {
      marginTop: 10,
      backgroundColor: colors.primary + '10',
      borderColor: colors.primary + '55',
      borderWidth: 1,
      borderRadius: 10,
      padding: 10,
      gap: 7,
    },
    researchHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 8,
    },
    researchHeaderText: {
      flex: 1,
      gap: 2,
    },
    researchTitle: {
      color: colors.foreground,
      fontSize: 12,
      fontFamily: 'Inter_700Bold',
      fontWeight: '700' as const,
    },
    researchSubtitle: {
      color: colors.mutedForeground,
      fontSize: 9,
      fontFamily: 'Inter_400Regular',
    },
    researchOverall: {
      color: colors.primary,
      fontSize: 14,
      fontFamily: 'Inter_700Bold',
      fontWeight: '700' as const,
    },
    researchMetricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
    },
    researchMetricTile: {
      width: '31.8%',
      minWidth: 82,
      backgroundColor: colors.card,
      borderRadius: 7,
      padding: 6,
      gap: 2,
    },
    researchMetricValue: {
      color: colors.primary,
      fontSize: 12,
      fontFamily: 'Inter_700Bold',
      fontWeight: '700' as const,
    },
    researchMetricLabel: {
      color: colors.mutedForeground,
      fontSize: 8,
      lineHeight: 11,
      fontFamily: 'Inter_400Regular',
    },
    researchComparisonCard: {
      backgroundColor: colors.card,
      borderRadius: 7,
      padding: 7,
      gap: 4,
    },
    researchComparisonRow: {
      gap: 1,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 4,
    },
    researchComparisonLabel: {
      color: colors.foreground,
      fontSize: 9,
      fontFamily: 'Inter_600SemiBold',
      fontWeight: '600' as const,
    },
    researchComparisonValue: {
      color: colors.primary,
      fontSize: 9,
      fontFamily: 'Inter_400Regular',
    },
    researchSection: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 6,
      gap: 2,
    },
    researchLabel: {
      color: colors.foreground,
      fontSize: 10,
      fontFamily: 'Inter_700Bold',
      fontWeight: '700' as const,
    },
    researchBody: {
      color: colors.mutedForeground,
      fontSize: 9,
      lineHeight: 14,
      fontFamily: 'Inter_400Regular',
    },
    researchFindings: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 6,
      gap: 2,
    },
    evidenceItemRow: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 6,
      marginTop: 3,
      gap: 2,
    },
    reasoningTraceRow: {
      backgroundColor: colors.card,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      borderRadius: 7,
      padding: 8,
      gap: 3,
    },
    reasoningTraceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
    },
    reasoningTraceId: {
      color: colors.mutedForeground,
      fontSize: 9,
      fontFamily: 'Inter_500Medium',
      flexShrink: 1,
    },
    verificationCriterionRow: {
      backgroundColor: colors.card,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 8,
      gap: 3,
    },
    reportCalloutTitle: {
      color: colors.foreground,
      fontSize: 11,
      fontFamily: 'Inter_600SemiBold',
      fontWeight: '600' as const,
    },
    reportBodyText: {
      color: colors.mutedForeground,
      fontSize: 10,
      lineHeight: 15,
      fontFamily: 'Inter_400Regular',
    },
    pcaMetaRow: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      lineHeight: 18,
    },
    pcaMetaLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontWeight: '600' as const,
      color: colors.foreground,
    },
    traceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 2,
    },
    traceDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    traceStage: {
      flex: 1,
      color: colors.mutedForeground,
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
    },
    traceMs: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      fontWeight: '600' as const,
      minWidth: 48,
      textAlign: 'right',
    },
    phaseBadge: {
      minWidth: 58,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 5,
      alignItems: 'center',
    },
    phaseBadgeText: {
      fontSize: 8,
      fontFamily: 'Inter_700Bold',
      fontWeight: '700' as const,
    },
    osCard: {
      marginTop: 8,
      padding: 8,
      borderRadius: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 3,
    },
    osCardTitle: {
      color: colors.foreground,
      fontSize: 11,
      fontFamily: 'Inter_600SemiBold',
      fontWeight: '600' as const,
    },
    osCardText: {
      color: colors.mutedForeground,
      fontSize: 10,
      lineHeight: 15,
      fontFamily: 'Inter_400Regular',
    },
    knowledgeCard: {
      marginTop: 8,
      padding: 8,
      borderRadius: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 3,
    },
    exportRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 10,
    },
    exportHtmlBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#f97316',
      alignSelf: 'flex-start',
    },
    exportHtmlLabel: {
      color: '#f97316',
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
      fontWeight: '600' as const,
    },
    exportPdfBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#dc2626',
      alignSelf: 'flex-start',
    },
    exportPdfLabel: {
      color: '#dc2626',
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
      fontWeight: '600' as const,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    elapsedBadge: {
      backgroundColor: colors.primary + '22',
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    elapsedText: {
      color: colors.primary,
      fontSize: 11,
      fontFamily: 'Inter_500Medium',
    },
    actions: {
      flexDirection: 'row',
      gap: 12,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    actionLabel: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
    },
  });
}
