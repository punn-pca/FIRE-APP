---
name: Firekeeper OS integration
description: Durable rules for keeping the Firekeeper OS specification aligned with analysis behavior.
---

Firekeeper OS metadata is part of every analysis contract: the runtime lifecycle, governance/safety result, verification result, and fact/assumption/unknown knowledge map must be computed from the request and response, then exposed to the client and printable report.

**Why:** The uploaded Phoenix specification defines Firekeeper as a cognitive operating system rather than a chatbot, with explicit lifecycle, governance, verification, memory, and human-agency boundaries. Keeping these as structured metadata prevents the product from regressing into opaque prompt-only behavior.

**How to apply:** Any future analysis pipeline change should preserve the lifecycle order `BOOT → READY → UNDERSTAND → PLAN → REASON → RESPOND → VERIFY → REFLECT`, reduce confidence when evidence/context is weak, and keep the user as final decision-maker. 

Independent cognitive modules must emit auditable computation metadata, not only narrative labels: retrieval scores, evidence component scores, conflict findings, decision aggregation, and verification criteria with observed evidence.

**Why:** A timestamped pipeline alone proves orchestration but not independent reasoning. Exposing the inputs, method, intermediate scores, and pass/fail evidence makes the architecture inspectable for engineering and research use.

**How to apply:** Every new module should have a deterministic or explicitly identified algorithm, structured output in the API contract, client visibility, printable-report visibility where relevant, and regression coverage for both positive and negative cases.