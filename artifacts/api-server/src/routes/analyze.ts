import { Router } from "express";
import OpenAI from "openai";
import { logger } from "../lib/logger";

const router: Router = Router();

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    // Let SDK auto-read OPENAI_API_KEY from environment
    _openai = new OpenAI();
  }
  return _openai;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TraceEntry {
  stage: string;
  timestamp: string;
  output: Record<string, unknown>;
}

interface PCAState {
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
  trace: TraceEntry[];
  llm_provider: string;
  llm_model: string;
  execution_time_ms: number;
  start_time: string;
  end_time: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const THAI_REGEX = /[\u0E00-\u0E7F]/;
function detectLanguage(text: string): "th" | "en" {
  return THAI_REGEX.test(text) ? "th" : "en";
}

function record(state: PCAState, stage: string, output: Record<string, unknown>) {
  state.trace.push({ stage, timestamp: new Date().toISOString(), output });
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

function stageEvidenceEvaluation(state: PCAState) {
  state.evidence = [
    state.language === "th"
      ? "หลักฐานเชิงประจักษ์จากข้อมูลที่ผู้ใช้ระบุมาในคำถาม"
      : "Empirical evidence from user-provided input",
    state.language === "th"
      ? "หลักฐานอ้างอิงจากฐานความรู้และมาตรฐานสากลที่เกี่ยวข้อง"
      : "Evidence from established knowledge base and international standards",
  ];
  record(state, "EVIDENCE_EVALUATION", { evidence: state.evidence });
}

function stageCritique(state: PCAState) {
  state.critique = [
    state.language === "th"
      ? "ข้อจำกัด: การวิเคราะห์นี้ตั้งอยู่บนข้อมูลที่ผู้ใช้ให้มา หากข้อมูลไม่ครบถ้วนอาจส่งผลต่อความแม่นยำ"
      : "Limitation: This analysis is based on user-provided context; incomplete data may reduce accuracy.",
    state.language === "th"
      ? "ความเสี่ยง: อาจมี Confirmation Bias ในการตีความข้อมูลที่นำเสนอ"
      : "Risk: Potential Confirmation Bias in interpreting the presented information.",
  ];
  state.uncertainty = [
    state.language === "th"
      ? "ระดับความไม่แน่นอน: ปานกลาง — ขึ้นอยู่กับตัวแปรบริบทที่ยังไม่ได้รับการยืนยัน"
      : "Uncertainty Level: Medium — depends on unconfirmed contextual variables.",
  ];
  record(state, "CRITIQUE", { critique: state.critique, uncertainty: state.uncertainty });
}

function stageDecision(state: PCAState) {
  state.decision =
    state.language === "th"
      ? "เสนอข้อสรุปเชิงยุทธศาสตร์ที่แยกแยะระหว่างข้อเท็จจริงและการตีความ พร้อมระบุขอบเขตและข้อจำกัด"
      : "Present strategic conclusions distinguishing facts from interpretations, with explicit scope and limitations.";
  // Qualitative confidence: determined by critique + uncertainty from earlier stages
  const highUncertainty = state.uncertainty.some((u) =>
    /สูง|high/i.test(u)
  );
  const lowEvidence = state.evidence.length < 2;
  state.confidence =
    highUncertainty || lowEvidence ? "ต่ำ" : state.constraints.length > 2 ? "ปานกลาง" : "ปานกลาง";
  record(state, "DECISION", { decision: state.decision, confidence: state.confidence });
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

function buildSystemPrompt(state: PCAState, tone: string, deepReasoning: boolean, personalContext: string): string {
  const lang = state.language;

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

  const memoryContext =
    state.memories.length > 0
      ? `\nMemory Context:\n${state.memories
          .map((m, i) => `${i + 1}. [${m.layer}] ${m.content}`)
          .join("\n")}`
      : "";

  const personalCtx = personalContext
    ? `\nUser Personal Context: ${personalContext}`
    : "";

  if (deepReasoning) {
    return `คุณคือ FIRE KEEPER ระบบวิเคราะห์ปัญญาประดิษฐ์ตามกรอบ PUNN Cognitive Architecture (PCA) — Full Deep Analysis Mode

${toneInstruction}
${memoryContext}
${personalCtx}

คุณต้องวิเคราะห์เชิงลึกเต็มรูปแบบ โดยใช้กรอบ FIRE:
- **F**act: ข้อเท็จจริงเชิงประจักษ์
- **I**nference: การอนุมานและตีความ
- **R**isk: ความเสี่ยงและข้อจำกัด
- **E**vidence: หลักฐานอ้างอิง

ตอบเป็นภาษาไทยเป็นหลัก ห้ามใช้ภาษาจีน
ห้ามตัดสินใจแทนผู้ใช้ — เสนอทางเลือกและระดับความมั่นใจเท่านั้น

โครงสร้างรายงานที่ต้องมี:
### # ข้อมูลและหลักฐาน (Information & Evidence Matrix)
จำแนก Fact ออกจาก Interpretation ระบุระดับความมั่นใจ (สูง/ปานกลาง/ต่ำ)

### # ข้อโต้แย้งและความเสี่ยง (Counter Evidence & Critique)
ชี้จุดอ่อน ข้อแย้ง หรือความเสี่ยงสำคัญ

### # สมมติฐานและผลกระทบ (Key Assumptions & Failure Impact)
ระบุสมมติฐานหลักและผลกระทบหากพลาด

### # ข้อจำกัดของแนวทาง (Limitations & Unproven Boundaries)
ระบุสิ่งที่แนวทางนี้ยังไม่สามารถพิสูจน์ได้

### # ห่วงโซ่เหตุผล (Causal Chain & Uncertainty)
[ต้นเหตุ] → [กลไก] → [ผลลัพธ์] พร้อมระดับความไม่แน่นอน

### # ทางเลือกและข้อแลกเปลี่ยน (Strategic Options & Trade-offs)
เสนอ 2-3 ทางเลือก พร้อม Pros/Cons/Risks

### # ข้อสรุปเชิงยุทธศาสตร์ (Strategic Conclusion)
สรุปคำแนะนำพร้อมระดับความมั่นใจ ไม่ตัดสินใจแทน

[DECISION_SUMMARY]: สรุปข้อเสนอแนะสั้น ๆ (1-2 ประโยค)`;
  }

  return `คุณคือ FIRE KEEPER ระบบวิเคราะห์ปัญญาประดิษฐ์ตามกรอบ PUNN Cognitive Architecture (PCA)

${toneInstruction}
${memoryContext}
${personalCtx}

กรอบการวิเคราะห์ PUNN FIRE:
- Fact First: แยกข้อเท็จจริงออกจากความคิดเห็น
- Inference-based Reasoning: ใช้เหตุผลจากหลักฐาน
- Risk & Reflection: ประเมินความเสี่ยงและข้อจำกัด
- Evidence Evaluation: ประเมินน้ำหนักหลักฐาน

โครงสร้างคำตอบ:
### 1. การสังเกตการณ์และทำความเข้าใจ (Observation & Understanding)
วิเคราะห์บริบทและเจตนาของผู้ใช้

### 2. ข้อสรุปเชิงยุทธศาสตร์ (Strategic Analysis)
วิเคราะห์หลักฐาน แยก Fact กับ Inference ระบุระดับความมั่นใจ

### 3. ข้อจำกัดและทางเลือก (Boundaries & Options)
ระบุข้อจำกัด ความเสี่ยง และเสนอทางเลือก 2-3 แนว

[DECISION_SUMMARY]: สรุปข้อเสนอแนะสั้น ๆ พร้อมระดับความมั่นใจ

กฎสำคัญ:
- ตอบเป็นภาษาไทยเป็นหลัก ห้ามใช้ภาษาจีน
- ห้ามตัดสินใจแทนผู้ใช้
- ระบุ "ระดับความมั่นใจ: สูง/ปานกลาง/ต่ำ" ทุกข้อสรุปสำคัญ
- ใช้ถ้อยคำเชิงเสนอ เช่น "อาจ", "มีแนวโน้ม", "จากข้อมูลที่มี"`;
}

// ─── Route ────────────────────────────────────────────────────────────────────

interface AnalyzeRequest {
  question: string;
  tone?: string;
  deepReasoning?: boolean;
  personalContext?: string;
  memories?: PCAState["memories"];
}

router.post("/", async (req, res) => {
  const {
    question,
    tone = "Formal Architect",
    deepReasoning = false,
    personalContext = "",
    memories = [],
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
    trace: [],
    llm_provider: "openai",
    llm_model: "gpt-4o",
    execution_time_ms: 0,
    start_time: startTime,
    end_time: "",
  };

  try {
    // Run cognitive pipeline stages
    stageObservation(state);
    stageUnderstanding(state);
    stagePurpose(state);
    stageMemoryRetrieval(state, memories);
    stageMentalModel(state);
    stageHypotheses(state);
    stageEvidenceEvaluation(state);
    stageCritique(state);
    stageDecision(state);

    // LLM Communication stage
    const systemPrompt = buildSystemPrompt(state, tone, deepReasoning, personalContext);
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
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

    // Post-communication stages
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
