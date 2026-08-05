---
name: Firekeeper Thai time and exports
description: Durable rules for timezone display and report file export behavior.
---

Firekeeper displays user-facing timestamps in `Asia/Bangkok` explicitly, including report metadata, stage/lifecycle clocks, session exports, and generated filenames. Stored ISO timestamps may remain UTC; presentation must convert them.

**Why:** Device and server timezone settings vary, and UTC clock slices make the report appear several hours off to Thai users.

**How to apply:** Use the shared Thai date/clock formatters for every UI/export timestamp. Do not slice `toISOString()` for visible clock values.

Reports have real export paths: web downloads `.html`, web PDF uses the browser print dialog, native HTML is written to app storage and shared, and native PDF is generated with Expo Print, copied to app storage, and shared.

**Why:** Sharing HTML text or putting report content on the clipboard does not produce a usable file for the user.

**How to apply:** Keep HTML and PDF actions separate in the UI and preserve clipboard fallback only when file creation or sharing fails.

For native file exports, use Expo Sharing's `shareAsync` with the saved file URI; React Native's generic `Share.share` is not a reliable file-share API across devices.

**Why:** Generic sharing can treat a local URI as plain text or silently fail, while Expo Sharing is designed for local file URLs and MIME types.

**How to apply:** Save HTML/PDF/TXT to app storage, share with `shareAsync`, use browser downloads on web, and keep clipboard fallback for unavailable share targets.