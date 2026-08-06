---
name: Clerk personal memory boundary
description: Durable constraints for authentication and per-user memory isolation.
---

All personal-memory reads and writes must be scoped by the authenticated Clerk user ID, and unauthenticated API requests must not reach memory or analysis routes.

**Why:** Personal context is private account data; a global fallback or missing user predicate could expose one member's memories to another.

**How to apply:** Keep authentication middleware before protected routes, use the user ID in PostgreSQL queries and any operational fallback file path, and preserve a public health check separately.

Development schema changes for the memory user boundary are applied with Drizzle; production schema changes must wait for Replit Publish's schema diff and migration flow.

**Why:** Replit manages production database schema updates during Publish, so startup-time or custom production DDL would create an unsafe split between development and production.

**How to apply:** Push only to development while building, then inspect and confirm the `user_id` schema diff during Publish before enabling the feature in production.