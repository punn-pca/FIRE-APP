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

Firekeeper OS reports are intentionally separated into User Report, Analyst Report, and System Trace; decision matrices and audit details belong to Analyst Report, while runtime lineage belongs only to System Trace.

**Why:** Mixing the normal answer with audit cards made the mobile response repetitive and exposed implementation detail to users.

**How to apply:** Keep the user answer fixed and readable by default, expose the two diagnostic layers on demand, and preserve the same three-layer boundaries in API responses, shares, HTML, and PDF exports.

User-facing answers should be concise natural Markdown: lead with the answer, use short paragraphs and bullets, and use compact Markdown tables for comparisons; never expose PCA labels or pipeline headings in the main answer.

**Why:** The underlying analysis is multi-stage, but showing its internal structure makes ordinary answers noisy and difficult to scan on mobile.

**How to apply:** Keep PCA metadata in the collapsible report tabs, constrain the communication prompt to clean formatting, and render headings, lists, and horizontally scrollable tables in the answer bubble.

Executive Summary is a complete decision-facing digest, not a character-limited excerpt: preserve the full answer and append relevant missing information, conflicts, and decision direction when available.

**Why:** A short excerpt removed the context users needed, especially for comparisons and decisions with limitations or trade-offs.

**How to apply:** Generate the summary from the final state after response normalization, and use the same complete summary in the User Report UI and exports.

HTML/PDF exports must preserve the report-layer boundary as three independently selectable documents: User Report, Analyst Report, and System Trace.

**Why:** A single combined document hid the intended audience and made it unclear which report a user was sharing.

**How to apply:** Keep the combined report as an optional legacy path, but expose explicit report-type selection and include the selected type in the filename and document title.