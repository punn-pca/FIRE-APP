# FIRE KEEPER OS

ระบบสนทนาและ research evaluation สำหรับตรวจสอบคำตอบ หลักฐาน reasoning trace ความมั่นใจ และความสอดคล้องของ AI อย่างโปร่งใส

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the Express API server on `PORT`
- `pnpm --filter @workspace/fire-keeper run dev` — run the Expo mobile/web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server exec tsx src/__tests__/regression.ts` — run PCA and Research Evaluation regressions
- Required env: `DATABASE_URL`, `OPENAI_API_KEY`, `SESSION_SECRET`, and `PORT`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/routes/analyze.ts` — PCA pipeline, report layers, Truth Engine and Research Evaluation
- `artifacts/fire-keeper/app/index.tsx` — chat screen, API calls and research evaluation action
- `artifacts/fire-keeper/components/MessageBubble.tsx` — answer rendering, report tabs and HTML/PDF export
- `lib/db/src/schema/` — PostgreSQL/Drizzle schema
- `screenshots/` — real app screenshots used in documentation
- `README.md` — setup, API overview and project capabilities
- `CONTRIBUTING.md` — contribution and verification rules

## Architecture decisions

- The normal user answer is fixed before audit; audit does not rewrite, retry, or block it.
- PostgreSQL is the source of truth for persistent memory.
- User Report, Analyst Report and System Trace are separate report layers.
- Research Evaluation compares answer content with generated Truth Engine output; model self-labels are evaluated separately as Explanation Consistency.
- Structured audit traces are exposed instead of private model chain-of-thought.

## Product

FIRE KEEPER OS supports Thai/English conversations, evidence and confidence analysis, verification gates, memory retrieval, report export, and an opt-in Research Evaluation mode that generates synthetic worlds, ground truth, plausibility traps and counterfactual tests.

## User preferences

- Display timestamps in `Asia/Bangkok`.
- Preserve the separation between normal answers and audit metadata.
- Prefer complete, inspectable reports over short excerpts.

## Gotchas

- `PORT` is required by the API server; do not hardcode a port in application code.
- Do not commit `.env` or credentials; use Replit Secrets for workspace/deployment secrets.
- API and Expo workflows must be restarted after source, package, or run-command changes.
- When report fields change, update API types, Expo rendering, exports and regression tests together.

## Pointers

- See `README.md` for setup and product overview.
- See `CONTRIBUTING.md` for development and review rules.
