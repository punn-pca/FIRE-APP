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

Auditable metadata is not sufficient if it is only post-hoc: evidence, decision, and verification outputs must be injected into generation and enforce a retry, block, or explicit insufficient-evidence fallback when required checks fail.

**Why:** A review found that a model can produce an answer independently of the computed audit artifacts, while keyword-only verification can still raise confidence. That creates explainability without causal control.

**How to apply:** Treat module outputs as control inputs to the communication stage, verify substantive grounding rather than keyword presence, and test route-level influence—not only pure helper functions.

Generated API clients are part of the runtime contract, not only type artifacts: after OpenAPI codegen, the Expo/Metro workflow must be restarted cleanly so the bundle resolves regenerated modules.

**Why:** A stale duplicate Expo process held the managed port during contract regeneration and masked a valid generated client as a runtime import failure.

**How to apply:** Run codegen before client checks, confirm generated files exist, restart the exact managed mobile workflow once, and inspect the new bundle logs before declaring the client broken.