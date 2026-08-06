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

Export actions must be rendered beside the user-facing answer whenever report layers exist; they must not live only inside the collapsible PCA panel.

**Why:** The API returns `reports` for normal successful answers, so a condition that renders export controls only when reports are absent hides the controls in the common path.

**How to apply:** Keep report inspection collapsible, but place HTML/PDF actions and the three report-type selector in the visible answer footer. On web, HTML downloads directly and PDF opens the selected report in the browser print flow for “Save as PDF”; native uses Expo Print and Sharing.

Keep normal and legacy report export controls on one renderer, and preserve the specific popup-blocked error instead of replacing it with a generic PDF failure.

**Why:** The two data shapes need different placement, but duplicated controls drifted in labels and accessibility behavior; popup blocking is actionable only when the user is told to allow pop-ups.

**How to apply:** Call the shared renderer from the visible `reports` path and the legacy PCA metadata path. Wrap web HTML/PDF actions so popup errors explain the browser setting while native HTML retains its clipboard recovery.

High-level reasoning audits should expose structured, inspectable summaries rather than private model chain-of-thought.

**Why:** Firekeeper needs to be reviewable as an evaluation system while preserving the separation between a user answer and internal model deliberation.

**How to apply:** Build Analyst Report fields for evidence, assumptions, summarized reasoning trace, limitations, and verification criteria. Give each item stable IDs and cross-reference evidence, assumption, limitation, and verification IDs; show the same contract in mobile UI and Analyst HTML/PDF exports.

Research evaluation must score externally derived truth separately from the model's self-reported labels.

**Why:** A live evaluation showed that a model can calculate the correct ground-truth value while emitting an incorrect `truth_assessment`; conflating the two falsely lowers Truth Accuracy.

**How to apply:** Let Truth Accuracy compare answer content with Truth Engine outputs, while Explanation Consistency reports self-label/trace alignment and Self Calibration compares declared confidence with empirical accuracy.