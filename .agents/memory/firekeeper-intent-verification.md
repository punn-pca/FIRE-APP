---
name: Intent-aware verification
description: Durable rules for keeping Firekeeper route selection, evidence, and verification aligned.
---

Intent routing is a control boundary, not only a display field: explanatory, summary, comparison, and general questions must not create decision alternatives or inherit decision-only wording and checks.

**Why:** Treating every question as a decision caused conceptual questions such as “รักคืออะไร” to receive action-oriented fallbacks and fail valid explanatory responses.

**How to apply:** Route before analysis, expose the route in API/mobile/report metadata, use route-specific dataflow/state transitions, and verify conclusions against the selected route.

`user_input` is context, never factual evidence. A zero-citation response is valid when no non-user evidence is available; it must not receive a failed grounding score merely because no citation exists.

**Why:** The question itself cannot substantiate its answer, while an evidence-free but explicitly bounded decision response can still pass when the system clearly identifies missing information and preserves human agency.

**How to apply:** Filter `user_input` from allowed citations and reasoning claims, allow zero citations only when the allowed evidence set is empty, and keep the overall verification gate at 100%.

User-facing answers must be normalized separately from PCA audit output: non-decision routes should return the extracted natural-language answer, while lifecycle, evidence, verification, and reasoning metadata remain in `pcaState` and exports.

**Why:** A valid LLM analysis can still be a poor product response when it exposes the full internal report instead of answering the user's question.

**How to apply:** Lock the natural-language answer first, then audit it without rewriting or blocking it; remove internal PCA headings and citation placeholders from user-facing text while retaining the full audit in state and exports.