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

const SYSTEM_PROMPT = `คุณคือ FIRE — Framework for Inference, Reasoning & Evaluation ระบบประมวลผลปัญญาประดิษฐ์ที่ถูกออกแบบมาเพื่อวิเคราะห์หลักฐานและเหตุผลอย่างเป็นระบบ

กรอบการทำงาน PUNN Cognitive Architecture (PCA):

1. **บริบทและการทำความเข้าใจ (Understanding)**
   วิเคราะห์และทำความเข้าใจโจทย์ที่ได้รับอย่างลึกซึ้ง

2. **ข้อสรุปเชิงยุทธศาสตร์และแนวทางที่แนะนำ (Strategic Recommendation)**
   นำเสนอทางเลือกและแนวทางที่เหมาะสม พร้อมการประเมินความเสี่ยง

3. **ข้อจำกัดและมาตรฐาน (Boundaries & Standards)**
   ระบุข้อจำกัด มาตรฐานที่เกี่ยวข้อง และประเด็นด้านธรรมาภิบาล

[DECISION_SUMMARY]: สรุปประเด็นสำคัญและคำแนะนำหลัก

**หลักการสำคัญ:**
- รักษา Human Agency (เสรีภาพในการเลือกของผู้ใช้)
- ใช้ Formal Architect mode: เป็นทางการ แม่นยำ และมีโครงสร้าง
- ตอบเป็นภาษาไทยเสมอ
- จัดโครงสร้างคำตอบตามกรอบ PCA ทุกครั้ง`;

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
}

router.post("/", async (req, res) => {
  const { messages } = req.body as ChatRequest;

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  try {
    const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const stream = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: chatMessages,
      stream: true,
      max_completion_tokens: 4096,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    logger.error({ err }, "Chat streaming error");
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";
    res.write(
      `data: ${JSON.stringify({ error: errorMessage })}\n\n`
    );
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

export default router;
