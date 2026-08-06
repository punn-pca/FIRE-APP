---
name: FIRE framework integration
description: Durable rules for keeping the FIRE analysis framework aligned with product behavior.
---

FIRE metadata is part of every analysis contract: the runtime lifecycle, governance/safety result, verification result, and fact/assumption/unknown knowledge map must be computed from the request and response, then exposed to the client and printable report.

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

The cognitive trace should represent causal dataflow, not only a chronological timeline: each edge names the producing module's outputs, consuming module's inputs, transformation, and item count; decision output must include a weighted alternative matrix; retrieval and verification must expose their diagnostics.

**Why:** A timeline can show that modules ran without showing how state moved or why a selected direction won. Explicit lineage, alternatives, retrieval misses, and logical checks make the trace inspectable as an architecture.

**How to apply:** Preserve the shared trace contract across API, mobile panel, and printable report. Keep phase timing separate from operation metrics, load persisted memory before retrieval, and make evidence/decision/verification outputs generation controls rather than post-hoc annotations.

Claim-level reasoning and state mutations should be derived from the same finalized PCA state and exposed together in the API, mobile panel, and printable report.

**Why:** A graph assembled separately from the pipeline can look explanatory while missing the actual evidence, selected option, conflicts, or confidence mutation that produced the response.

**How to apply:** Build claims from evidence/hypotheses/unknowns/decision state, connect them with typed relations and support weights, and record state transitions with before/after values, trigger, and user-visible impact. Keep unsupported claims explicit rather than hiding them in an overall pass status.