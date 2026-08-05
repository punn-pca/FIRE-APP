---
name: Firekeeper memory and runtime boundaries
description: Durable rules for persisted memory retrieval, verification safety, and runtime reporting.
---

Persistent Firekeeper memory uses PostgreSQL as the source of truth, with the file store allowed only as an explicit operational fallback. Retrieval diagnostics must identify the backend so a fallback is never mistaken for normal persistence.

**Why:** Memory retrieval is part of the cognitive architecture, and silently treating a local file as durable memory can produce inconsistent answers across sessions or environments.

**How to apply:** Keep database schema changes in Drizzle, load memory asynchronously before retrieval, expose backend/hit diagnostics, and preserve a clear fallback marker when the database is unavailable.

Reasoning quality is reported independently from elapsed time. LLM request timing/token usage and deterministic cognitive pipeline timing are separate runtime contracts; a model's latency must not be used as a proxy for reasoning quality.

**Why:** LLM latency is dominated by network/model behavior, while reasoning quality depends on evidence, coverage, conflicts, missing information, decision margin, and substantive verification.

**How to apply:** Extend quality metrics and runtime summaries independently in the API, mobile panel, and printable report. Count only actual LLM calls as retries; label deterministic verification fallback separately.