# Story Points: Discord → Global Relay Bridge

> **Fibonacci scale (1, 2, 3, 5, 8, 13, 21)** — relative effort estimation.
> Velocity baseline: 1 point ≈ 30-60 minutes for a focused developer.

---

## Point Breakdown by User Story

| ID | Story | Complexity | Risk | Uncertainty | **Points** |
|----|-------|------------|------|-------------|-----------|
| **US-001** | Monorepo Scaffold | Medium | Low | Low | **5** |
| **US-002** | Core Types Package | Low | Low | Low | **3** |
| **US-003** | Event Transformers | Medium | Medium | Low | **5** |
| **US-004** | Global Relay API Client | Medium | High | Medium | **5** |
| **US-005** | Discord Bot Handlers | Medium | Medium | Low | **5** |
| **US-006** | Bridge Orchestrator | Medium | High | Medium | **5** |
| **US-007** | Dashboard Scaffold + Auth | Medium | Medium | Low | **5** |
| **US-008** | Dashboard Overview | Low | Low | Low | **3** |
| **US-009** | Server/Channel Management | Medium | Low | Low | **5** |
| **US-010** | GR Configuration | Low | Low | Low | **2** |
| **US-011** | Archive Logs | Low | Low | Low | **2** |
| **US-012** | User Mapping | Low | Low | Low | **3** |
| **US-013** | Bridge DB Integration | Low | Medium | Low | **3** |
| **US-014** | E2E Smoke Test + README | Low | Low | Low | **2** |
| | | | | **TOTAL** | **53** |

---

## Detailed Estimates

### Wave 1: Foundation (11 points)

| Story | Points | Rationale |
|-------|--------|-----------|
| **US-001** — Monorepo Scaffold | **5** | 7 files (package.json, tsconfig.base.json, .env.example, .gitignore, vitest.workspace.ts, prisma/schema.prisma, seed.ts). Prisma schema has 5 models with relations. npm install + prisma generate + db push. First commit. |
| **US-002** — Core Types Package | **3** | 4 files (package.json, tsconfig.json, types.ts, config.ts). Types are straightforward interfaces. config.ts reads env vars. Small barrel export. Typecheck to verify. |

### Wave 2: Core Engine (15 points)

| Story | Points | Rationale |
|-------|--------|-----------|
| **US-003** — Event Transformers | **5** | 4 transformer files + barrel export + test file with 6+ test cases. TDD approach (write tests first, then implement). Need to understand GR API schema to map fields correctly. File_transfer logic has edge cases (empty attachments → empty array). |
| **US-004** — Global Relay API Client | **5** | OAuth2 protocol knowledge required. Token caching with expiry-aware refresh. Rate limiting with sliding window (900 RPM). Retry on 429 with retry-after header. Exponential backoff for transient errors. 2 test files covering auth + client. Higher risk due to external API dependency (cannot test against real API without credentials). |
| **US-005** — Discord Bot Handlers | **5** | 5 files (index, client, 3 handlers + deploy-commands). Gateway intent configuration. Partial fetching for reactions. Different event shapes for create/update/delete. Singleton pattern for Client. Slash command registration. |

### Wave 3: Bridge Orchestrator (5 points)

| Story | Points | Rationale |
|-------|--------|-----------|
| **US-006** — Bridge Orchestrator | **5** | 4 files (package.json, queue.ts, router.ts, indexer.ts, index.ts). Queue with retry + backoff is non-trivial concurrent logic. Router wires transformers to GR client. Indexer paginates Discord API (up to 10K messages). Main entry wires everything together. Integration test for router. |

### Wave 4: Dashboard UI (17 points)

| Story | Points | Rationale |
|-------|--------|-----------|
| **US-007** — Dashboard Scaffold + Auth | **5** | Next.js 14 App Router setup. Tailwind + shadcn/ui init + CSS variables (light/dark). NextAuth.js with Discord provider. Landing page with sign-in. Dashboard layout with sidebar. Auth guard. 11+ files. |
| **US-008** — Dashboard Overview | **3** | Stats cards + status API (/api/status). Recent activity log table. Simple client-side fetch + render. 2 files. |
| **US-009** — Server/Channel Management | **5** | Server list page with toggles. Server detail page with channel toggles. API route to fetch guilds from Discord API. 3 page files + 2 component files + 1 API route. Discord API integration. |
| **US-010** — GR Configuration | **2** | Settings form (4 fields). PATCH /api/config endpoint. Load existing config on mount. Save + feedback. 2 files. |
| **US-011** — Archive Logs | **2** | Table with badges. /api/logs endpoint. Empty state. 2 files. |
| **US-012** — User Mapping | **3** | Form component + API route (GET/POST with upsert). Integration into server detail page. 2 files + 1 modification. |

### Wave 5: Integration + Ship (5 points)

| Story | Points | Rationale |
|-------|--------|-----------|
| **US-013** — Bridge DB Integration | **3** | Prisma singleton. Channel config check (isArchivingEnabled). Email lookup. Server/channel sync on startup. 3 file modifications. Low complexity but cross-cutting. |
| **US-014** — E2E Smoke Test + README | **2** | 1 smoke test validating full pipeline. README with architecture, setup, quick start. Low effort, high value. |

---

## Velocity & Sprint Planning

### Estimated Velocity
- **Solo developer (focused):** 8-12 points/day
- **With interruptions:** 5-8 points/day
- **Paired/async:** 12-16 points/day

### Sprint Plan

| Sprint | Stories | Points | Cumulative |
|--------|---------|--------|------------|
| Sprint 1 | US-001, US-002 | 8 | 8 |
| Sprint 2 | US-003, US-004, US-005 | 15 | 23 |
| Sprint 3 | US-006, US-007 | 10 | 33 |
| Sprint 4 | US-008, US-009, US-010 | 10 | 43 |
| Sprint 5 | US-011, US-012, US-013, US-014 | 10 | 53 |

**Total project estimate: 53 story points ≈ 5-7 working days (solo)**

---

## Risk Adjustments

| Risk Factor | Impact | Point Buffer |
|-------------|--------|-------------|
| Global Relay API contract uncertain | May need schema adjustments | +3 (contingency) |
| Discord API changes (rare) | Handler breakage | +1 |
| First-time shadcn/ui setup issues | Configuration friction | +1 |
| **Adjusted Total** | | **58 points** |

---

## Point Distribution by Wave

```
Wave 1: Foundation    ████████████ 11 pts (19%)
Wave 2: Core Engine   ████████████████ 15 pts (26%)
Wave 3: Bridge        █████ 5 pts (9%)
Wave 4: Dashboard     ██████████████████ 17 pts (29%)
Wave 5: Integration   █████ 5 pts (9%)
Contingency           █████ 5 pts (9%)
                       ─────────────────
                       58 pts total
```

## Key Takeaways

- **Core pipeline** (Waves 1-3) = 31 pts (53%) — this is the critical path
- **Dashboard** (Wave 4) = 17 pts (29%) — parallelizable once API contracts are set
- **Integration** (Wave 5) = 5 pts (9%) — quick final mile
- **Risk buffer** = 5 pts (9%)
- **Biggest single item**: US-001, US-003, US-004, US-005, US-006, US-007, US-009 at 5 pts each
- **Early wins**: US-010 (2 pts), US-011 (2 pts), US-014 (2 pts)
