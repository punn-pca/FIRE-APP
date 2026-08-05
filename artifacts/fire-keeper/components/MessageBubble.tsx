import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Share,
  Platform,
  ToastAndroid,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

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
  source: 'user_input' | 'conversation_history' | 'memory';
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
}

export interface LogicalVerification {
  status: 'ผ่าน' | 'ต้องตรวจสอบ';
  checks: VerificationCheck[];
  score: number;
}

export interface KnowledgeMap {
  facts: string[];
  assumptions: string[];
  unknowns: string[];
}

export interface PCAState {
  user_input?: string;
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
  logical_verification?: LogicalVerification;
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

// ─── Stage metadata ───────────────────────────────────────────────────────────

const STAGE_INFO: Record<string, { icon: string; th: string; en: string; desc: string }> = {
  OBSERVATION:         { icon: '👁',  th: 'สังเกตการณ์',         en: 'Observation',          desc: 'รับข้อมูลจากผู้ใช้ ตรวจจับภาษา บันทึก input ดิบ' },
  UNDERSTANDING:       { icon: '🧠', th: 'ทำความเข้าใจ',         en: 'Understanding',        desc: 'วิเคราะห์เจตนาและบริบทของคำถาม จำแนกประเภทปัญหา' },
  PURPOSE:             { icon: '🎯', th: 'กำหนดจุดประสงค์',     en: 'Purpose',              desc: 'ระบุเป้าหมาย ข้อจำกัด และขอบเขตของการวิเคราะห์' },
  MEMORY:              { icon: '💾', th: 'ดึงความจำ',            en: 'Memory Retrieval',     desc: 'ค้นหาข้อมูลจากหน่วยความจำระยะยาวและบริบทที่เกี่ยวข้อง' },
  MENTAL_MODEL:        { icon: '🗺', th: 'แบบจำลองความคิด',     en: 'Mental Model',         desc: 'เลือกกรอบการวิเคราะห์ที่เหมาะสม (PUNN FIRE Framework)' },
  HYPOTHESIS:          { icon: '💡', th: 'ตั้งสมมติฐาน',         en: 'Hypothesis',           desc: 'สร้างสมมติฐานเบื้องต้นจากข้อมูลที่มี ระบุความน่าจะเป็น' },
  EVIDENCE_EVALUATION: { icon: '⚖️', th: 'ประเมินหลักฐาน',       en: 'Evidence Evaluation',  desc: 'รวบรวมและประเมินน้ำหนักหลักฐานจากหลายแหล่ง' },
  CRITIQUE:            { icon: '🔍', th: 'วิจารณ์และตรวจสอบ',   en: 'Critique',             desc: 'ระบุข้อจำกัด ความเสี่ยง ข้อมูลที่ขาด ตรวจสอบ bias' },
  DECISION:            { icon: '⚡', th: 'ตัดสินใจเชิงกลยุทธ์', en: 'Decision',             desc: 'คำนวณระดับความมั่นใจ สรุปทิศทางการตอบ รักษา Human Agency' },
  COMMUNICATION:       { icon: '🤖', th: 'สื่อสาร (LLM)',        en: 'Communication (LLM)',  desc: 'ส่ง prompt ไปยัง OpenAI GPT รอและประมวลผล response' },
  REFLECTION:          { icon: '🔄', th: 'สะท้อนคิด',            en: 'Reflection',           desc: 'ทบทวนกระบวนการทั้งหมด ตรวจสอบความสอดคล้องของผลลัพธ์' },
  LEARNING:            { icon: '📚', th: 'บทเรียนและ Agency',    en: 'Learning',             desc: 'สกัดบทเรียน ยืนยันสิทธิ์ตัดสินใจของผู้ใช้ อัปเดต state' },
};

// ─── HTML Report Generator ────────────────────────────────────────────────────

function generateHtmlReport(question: string, answer: string, pca: PCAState): string {
  const totalMs = pca.execution_time_ms ?? 0;
  const maxMs = Math.max(...pca.trace.map((t) => t.duration_ms ?? 0), 1);
  const dateStr = pca.start_time
    ? new Date(pca.start_time).toLocaleString('th-TH', { dateStyle: 'full', timeStyle: 'medium' })
    : new Date().toLocaleString('th-TH');

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
      ? `${new Date(entry.started_at).toISOString().slice(11, 23)}–${new Date(entry.ended_at ?? entry.started_at).toISOString().slice(11, 23)}`
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
      <td class="c-ts">${event.started_at ? `${new Date(event.started_at).toISOString().slice(11, 23)}–${new Date(event.ended_at ?? event.started_at).toISOString().slice(11, 23)}` : ''}</td>
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
  const logicalVerificationItems = (pca.logical_verification?.checks ?? []).map((check) =>
    `<li><strong>${escHtml(check.criterion)}</strong> — ${check.passed ? 'ผ่าน' : 'ไม่ผ่าน'} (${check.score.toFixed(2)})<br><span class="detail">${escHtml(check.rule)}<br>${escHtml(check.evidence)}</span></li>`
  ).join('');
  const factItems = (pca.knowledge_map?.facts ?? []).map((c) => `<li>${escHtml(c)}</li>`).join('');
  const assumptionItems = (pca.knowledge_map?.assumptions ?? []).map((c) => `<li>${escHtml(c)}</li>`).join('');
  const unknownItems = (pca.knowledge_map?.unknowns ?? []).map((c) => `<li>${escHtml(c)}</li>`).join('');

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FIRE KEEPER — PCA Report</title>
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
    <div class="logo-title">FIRE KEEPER</div>
    <div class="logo-sub">PUNN Cognitive Architecture (PCA) — Analysis Report</div>
  </div>
</div>

<!-- META STRIP -->
<div class="meta-strip">
  <div class="meta-item"><span class="meta-lbl">วันที่:</span><span class="meta-val">${escHtml(dateStr)}</span></div>
  <div class="meta-item"><span class="meta-lbl">โมเดล:</span><span class="meta-val">${escHtml(pca.llm_provider ?? 'openai')} / ${escHtml(pca.llm_model ?? 'gpt-4o')}</span></div>
  <div class="meta-item"><span class="meta-lbl">เวลารวม:</span><span class="meta-val">${totalMs >= 1000 ? (totalMs / 1000).toFixed(2) + ' s' : totalMs + ' ms'}</span></div>
  <div class="meta-item"><span class="meta-lbl">ขั้นตอน:</span><span class="meta-val">${pca.trace.length} stages</span></div>
  <div class="meta-item"><span class="meta-lbl">ความมั่นใจ:</span><span class="cbadge ${confClass}">${pca.confidence}</span></div>
</div>

<!-- QUESTION -->
<div class="section">
  <div class="sec-title">❓ คำถาม / สิ่งที่วิเคราะห์</div>
  <div class="question-box">${escHtml(question)}</div>
</div>

<!-- PCA TIMELINE -->
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

<!-- FIREKEEPER OS RUNTIME -->
<div class="section">
  <div class="sec-title">⚙️ Firekeeper OS Runtime Lifecycle</div>
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
    <tbody>${decisionRows || '<tr><td colspan="5">ไม่มีทางเลือก</td></tr>'}</tbody>
  </table>
</div>

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

<!-- ANSWER (page break before if long) -->
<div class="section page-break">
  <div class="sec-title">💬 ผลการวิเคราะห์</div>
  <div class="answer-box">${escHtml(answer)}</div>
    <div class="score-box">
      <span class="score-chip">confidence: ${escHtml(pca.confidence)} (${(pca.confidence_report?.score ?? 0).toFixed(1)}/100)</span>
      <span class="score-chip">verification: ${((pca.confidence_report?.verification_score ?? 0) * 100).toFixed(1)}%</span>
    </div>
    <div class="detail">สูตร confidence: ${escHtml(pca.confidence_report?.method ?? 'ไม่มีข้อมูลสูตร')}</div>
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
  Generated by FIRE KEEPER · PUNN Cognitive Architecture (PCA) · ${new Date().getFullYear()}
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

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  elapsedMs?: number;
  pcaState?: PCAState;
  timestamp?: string;
}

interface ParsedSection {
  type: 'header' | 'text' | 'summary' | 'bullet' | 'hr';
  stageNum?: number;
  title?: string;
  content: string;
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

  for (const line of lines) {
    const h3Match = line.match(/^###\s+(\d+)\.\s+(.*)/);
    const h3HashMatch = line.match(/^###\s+#\s+(.*)/);
    const h3Plain = line.match(/^###\s+(.*)/);
    const summaryMatch = line.match(/^\[DECISION_SUMMARY\]:\s*(.*)/);
    const hrMatch = line.match(/^[=─]{4,}/);

    if (h3Match) {
      flushText();
      sections.push({ type: 'header', stageNum: parseInt(h3Match[1], 10), title: h3Match[2].trim(), content: '' });
    } else if (h3HashMatch) {
      flushText();
      sections.push({ type: 'header', title: h3HashMatch[1].trim(), content: '' });
    } else if (h3Plain && !h3Match) {
      flushText();
      sections.push({ type: 'header', title: h3Plain[1].trim(), content: '' });
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
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <Text key={i} style={boldStyle}>{part.slice(2, -2)}</Text>;
    }
    return <Text key={i} style={baseStyle}>{part}</Text>;
  });
}

interface MessageBubbleProps {
  message: Message;
}

async function shareAsFile(content: string, filename: string) {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
    await navigator.share({ text: content, title: filename });
    return;
  }
  await Share.share({ message: content, title: filename });
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const colors = useColors();
  const styles = createStyles(colors);
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [showPCA, setShowPCA] = useState(false);

  const sections = useMemo(() => {
    if (isUser) return null;
    return parsePCAContent(message.content);
  }, [message.content, isUser]);

  const hasPCA = sections && sections.some((s) => s.type === 'header');

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
    const question = message.pcaState.user_input ?? message.pcaState.observations[0] ?? '';
    const html = generateHtmlReport(question, message.content, message.pcaState);

    if (Platform.OS === 'web') {
      // Web: trigger a real file download
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FIRE_KEEPER_Report_${Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // Native: share the HTML text so the user can save to Files and open in browser
      try {
        await Share.share({ message: html, title: 'FIRE KEEPER PCA Report' });
      } catch {
        await Clipboard.setStringAsync(html);
        Alert.alert('คัดลอกแล้ว', 'คัดลอก HTML ไปยังคลิปบอร์ดแล้ว เปิดในเบราว์เซอร์เพื่อพิมพ์ได้เลยครับ');
      }
    }
  }, [message]);

  const handleShare = useCallback(async () => {
    const timestamp = new Date().toLocaleString('th-TH');
    const filename = `FIRE_KEEPER_${Date.now()}.txt`;
    let content = `=== FIRE KEEPER — PUNN PCA Analysis ===\nวันที่: ${timestamp}\n\n`;

    if (message.pcaState) {
      content += `ระดับความมั่นใจ (ประมาณการเชิงคุณภาพ): ${message.pcaState.confidence}\n`;
      content += `โมเดล: ${message.pcaState.llm_provider ?? 'openai'} (${message.pcaState.llm_model ?? 'gpt-4o'})\n`;
      if (message.pcaState.execution_time_ms) {
        content += `เวลาประมวลผล: ${(message.pcaState.execution_time_ms / 1000).toFixed(2)}s\n`;
      }
      content += '\n';
    }

    content += `=== คำตอบ ===\n${message.content}\n`;

    if (message.pcaState) {
      content += `\n=== กระบวนการคิด PCA ===\n`;
      content += `เข้าใจบริบท: ${message.pcaState.understanding}\n`;
      content += `เป้าหมาย: ${message.pcaState.purpose}\n`;
      content += `\nข้อวิจารณ์:\n${message.pcaState.critique.map((c) => `- ${c}`).join('\n')}\n`;
      content += `\nการสะท้อนคิด:\n${message.pcaState.reflection.map((r) => `- ${r}`).join('\n')}\n`;
    }

    try {
      await shareAsFile(content, filename);
    } catch (err) {
      // Fallback to basic share
      await Share.share({ message: content, title: 'FIRE KEEPER Analysis' });
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
          {!hasPCA ? (
            <Text style={styles.aiText}>{message.content}</Text>
          ) : (
            <View>{renderSections()}</View>
          )}

          {/* PCA Meta (collapsible) */}
          {message.pcaState && (
            <Pressable onPress={() => setShowPCA(!showPCA)} style={styles.pcaToggle}>
              <Text style={styles.pcaToggleText}>
                {showPCA ? '▲ ซ่อนข้อมูล PCA' : '▼ แสดงข้อมูล PCA'}
              </Text>
              <Text style={[
                styles.pcaConfidence,
                message.pcaState.confidence === 'สูง' && { color: '#22c55e' },
                message.pcaState.confidence === 'ต่ำ' && { color: '#f97316' },
                message.pcaState.confidence === 'ไม่สามารถประเมินได้' && { color: '#94a3b8' },
              ]}>
                ความมั่นใจ: {message.pcaState.confidence}
              </Text>
            </Pressable>
          )}
          {showPCA && message.pcaState && (
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
              {message.pcaState.decision_matrix && message.pcaState.decision_matrix.options.length > 0 && (
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
                    </Text>
                  ))}
                </View>
              )}
              {message.pcaState.memory_retrieval && (
                <View style={styles.osCard}>
                  <Text style={styles.osCardTitle}>
                    💾 Memory Retrieval · {message.pcaState.memory_retrieval.matched_count}/{message.pcaState.memory_retrieval.candidate_count} hits
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
                    <Text style={styles.pcaMetaLabel}>Firekeeper OS: </Text>
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
              {/* Export HTML button */}
              <Pressable
                onPress={handleExportHtml}
                style={({ pressed }) => [styles.exportHtmlBtn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="document-outline" size={13} color="#f97316" />
                <Text style={styles.exportHtmlLabel}>ส่งออก HTML (พิมพ์ได้ · A4)</Text>
              </Pressable>
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
    pcaMeta: {
      marginTop: 8,
      backgroundColor: colors.muted,
      borderRadius: 8,
      padding: 10,
      gap: 4,
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
    exportHtmlBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 10,
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
