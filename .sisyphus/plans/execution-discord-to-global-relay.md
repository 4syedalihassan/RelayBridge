# Execution Plan: Discord → Global Relay Bridge + Management UI

## Reference Plan
`docs/superpowers/plans/2026-05-22-discord-to-global-relay-bridge.md` (3896 lines, 12 tasks)

## Tech Stack
- TypeScript npm workspaces monorepo (core, discord-bot, gr-client, bridge, dashboard)
- discord.js v14, Next.js 14 App Router, Tailwind CSS + shadcn/ui, Prisma ORM + SQLite, NextAuth.js (Discord OAuth), Vitest

## Infrastructure Constraints
- OS: Windows PowerShell — NEVER use `&&`; use `;` to chain
- Babel must be bypassed; use `tsx` for running TypeScript directly
- Git on `master`, commit `eaa9e85` — conventional commits, `tsc --noEmit` before each commit
- Hard rules in OPENCODE.md: double-check logic, always use git, always log progress, max 15 min between commits

## Wave Strategy

```
Wave 1 (Foundation — single agent, sequential within due to config deps):
├── Task 1: Monorepo Scaffold + Shared Config (root package.json, tsconfig.base, .env.example, vitest.workspace, .gitignore)
├── Task 2: Core Types Package (types.ts, config.ts, transformers/)
└── → Commit: "feat: scaffold monorepo with core types package"

Wave 2 (Core Packages — parallel with task() per package):
├── Task 3: Transformers (message.ts, reaction.ts, edit.ts, attachment.ts)
├── Task 4: Global Relay API Client (auth.ts, client.ts, endpoints/conversations.ts, endpoints/files.ts)
├── Task 5: Discord Bot (client.ts, handlers/, deploy-commands.ts)
└── → Commit: "feat: add transformers, gr-client, and discord-bot packages"

Wave 3 (Integration + Dashboard):
├── Task 6: Bridge Orchestrator (queue.ts, router.ts, indexer.ts)
├── Task 7: Dashboard Setup + Auth (Next.js project, NextAuth.js, Discord OAuth)
├── Task 8: Dashboard shadcn/ui Components + Layout (UI components, sidebar, dashboard layout)
└── → Commit: "feat: add bridge orchestrator and dashboard scaffold"

Wave 4 (Dashboard Features + DB Wiring):
├── Task 9: Dashboard Pages (servers, channels, settings, logs)
├── Task 10: User Mapping (match Discord users to corporate emails)
├── Task 11: Wire Bridge to DB (Prisma schema, dynamic config from DB)
└── → Commit: "feat: complete dashboard pages and DB integration"

Wave 5 (Finish):
├── Task 12: E2E Smoke Test + README
└── → Commit: "feat: add e2e smoke test and README"
```

## Agent Dispatch
- **Quick tasks** (scaffold, config files, simple components): `category="quick"`
- **Deep tasks** (transformers, bridge logic, auth): `category="deep"`
- **Visual tasks** (dashboard UI, shadcn): `category="visual-engineering"`
- **Verification tasks**: `subagent_type="oracle"`

## QA Strategy
- After each wave, run: `tsc --noEmit` on all packages
- After Wave 3+: `npm run build` on dashboard
- Final: E2E smoke test per Task 12 checklist
- All verification agent-executed via Bash/curl/Playwright
