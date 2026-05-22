# Storyboard: Discord → Global Relay Bridge

> **Story Map — organized by user journey flow from left (foundation) to right (completion).**
> Columns represent build phases (waves). Rows represent user/developer activities.

---

## 🎬 Act 1: Foundation (The Platform)

> *"Before we can archive anything, we need a place to stand."*

### Wave 1: Scaffold & Types — Developer Experience

```
┌──────────────────────────────────────────────────────────────────┐
│  [1.1] Monorepo Scaffold                                         │
│  ┌─────────────────────────────────────┐  ┌───────────────────┐  │
│  │ Create root package.json             │  │ Create Prisma     │  │
│  │ with npm workspaces (5 packages)     │  │ schema (5 models)  │  │
│  └─────────────────────────────────────┘  └───────────────────┘  │
│  ┌─────────────────────────────────────┐  ┌───────────────────┐  │
│  │ Create tsconfig.base.json            │  │ npm install +     │  │
│  │ .env.example, .gitignore, vitest     │  │ prisma generate   │  │
│  └─────────────────────────────────────┘  └───────────────────┘  │
│                         ↓                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Commit: "chore: scaffold monorepo with workspaces, prisma"  │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  [1.2] Core Types Package                                        │
│  ┌─────────────────────────────────────┐  ┌───────────────────┐  │
│  │ package.json, tsconfig.json          │  │ types.ts — ALL    │  │
│  └─────────────────────────────────────┘  │ shared types:      │  │
│  ┌─────────────────────────────────────┐  │ - DiscordEvent     │  │
│  │ config.ts — loadConfig() reads env  │  │ - GrArchiveRequest │  │
│  └─────────────────────────────────────┘  │ - GrArchivePayload │  │
│  ┌─────────────────────────────────────┐  │ - BridgeConfig     │  │
│  │ index.ts — barrel export            │  └───────────────────┘  │
│  └─────────────────────────────────────┘                         │
│                         ↓                                        │
│  Commit: "feat(core): add shared types, config loader, barrel"   │
└──────────────────────────────────────────────────────────────────┘
```

**Narrative:** The developer sets up the workspace — all packages will share TypeScript configs, tooling, and dependency management. Shared types are defined so every package speaks the same data contract.

---

## 🎬 Act 2: The Pipeline (Core Engine)

> *"Now we build the conversion machinery — Discord events in, GR payloads out."*

### Wave 2: Transformers + GR Client + Discord Bot

```
┌──────────────────────────────────────────────────────────────────┐
│  [2.1] Event Transformers (Discord → GR)                        │
│                                                                  │
│   Discord Event         Transformer             GR Payload       │
│  ┌──────────────┐    ┌──────────────┐      ┌────────────────┐   │
│  │ Message       │───▶│ toMessage    │─────▶│ GrArchiveReq   │   │
│  │ (create)      │    │ ArchiveReq   │      │ (Message)      │   │
│  └──────────────┘    └──────────────┘      └────────────────┘   │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐      ┌────────────────┐   │
│  │ Reaction      │───▶│ toReaction   │─────▶│ GrArchiveReq   │   │
│  │ (add)         │    │ ArchiveReq   │      │ (Reaction +    │   │
│  └──────────────┘    └──────────────┘      │  child msg)     │   │
│                                            └────────────────┘   │
│  ┌──────────────┐    ┌──────────────┐      ┌────────────────┐   │
│  │ Message Edit  │───▶│ toEdit       │─────▶│ GrArchiveReq   │   │
│  │ (update)      │    │ ArchiveReq   │      │ (Edited +      │   │
│  └──────────────┘    └──────────────┘      │  old content)   │   │
│                                            └────────────────┘   │
│  ┌──────────────┐    ┌──────────────┐      ┌────────────────┐   │
│  │ Attachment    │───▶│ toAttachment │─────▶│ GrArchiveReq[] │   │
│  │ (files)       │    │ ArchiveReq   │      │ (File_transfer)│   │
│  └──────────────┘    └──────────────┘      └────────────────┘   │
│                                                                  │
│  Tests: TDD approach — write failing tests FIRST                 │
│  Commit: "feat(core): add Discord→GR event transformers"         │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  [2.2] Global Relay API Client                                   │
│                                                                  │
│  ┌─────────────────────┐    ┌─────────────────────────────┐      │
│  │ TokenManager         │    │ GrClient                     │     │
│  │ ┌─────────────────┐  │    │ ┌─────────────────────────┐ │     │
│  │ │ getToken()       │  │    │ │ archiveConversation()  │ │     │
│  │ │ OAuth2 client    │──┼────┼─▶│ POST /v2/conversations │ │     │
│  │ │ credentials grant │  │    │ │ Bearer auth            │ │     │
│  │ │ Cache + refresh  │  │    │ │ 429 retry + backoff    │ │     │
│  │ └─────────────────┘  │    │ └─────────────────────────┘ │     │
│  │                      │    │ ┌─────────────────────────┐ │     │
│  │                      │    │ │ uploadFile()            │ │     │
│  │                      │    │ │ PUT /v2/files/{key}     │ │     │
│  │                      │    │ └─────────────────────────┘ │     │
│  └─────────────────────┘    │ ┌─────────────────────────┐ │     │
│                             │ │ Rate limiter (900 RPM)  │ │     │
│                             │ └─────────────────────────┘ │     │
│                             └─────────────────────────────┘      │
│  Tests: mocked HTTP + token caching + rate limit scenarios        │
│  Commit: "feat(gr-client): add TokenManager + GrClient"           │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  [2.3] Discord Bot Event Handlers                                │
│                                                                  │
│   Gateway Events          Handler               Normalized Event │
│  ┌──────────────┐    ┌──────────────┐      ┌────────────────┐   │
│  │ MessageCreate │───▶│handleMsgCreate│─────▶│DiscordMsgEvent │   │
│  └──────────────┘    └──────────────┘      └────────────────┘   │
│  ┌──────────────┐    ┌──────────────┐      ┌────────────────┐   │
│  │ MessageUpdate │───▶│handleMsgUpdate│─────▶│DiscordEditEvent│   │
│  └──────────────┘    └──────────────┘      └────────────────┘   │
│  ┌──────────────┐    ┌──────────────┐      ┌────────────────┐   │
│  │ MessageDelete │───▶│handleMsgDel  │─────▶│DiscordDelEvent │   │
│  └──────────────┘    └──────────────┘      └────────────────┘   │
│  ┌──────────────┐    ┌──────────────┐      ┌────────────────┐   │
│  │ReactionAdd   │───▶│handleReactAdd│─────▶│DiscordReactEvent│  │
│  └──────────────┘    └──────────────┘      └────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │ startBot() — registers handlers, deploys /status cmd    │     │
│  │ stopBot()  — graceful shutdown                          │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  Commit: "feat(discord-bot): add Gateway event handlers"         │
└──────────────────────────────────────────────────────────────────┘
```

**Narrative:** The pipeline is built in parallel — transformers convert Discord events to GR format, the GR client handles auth and API calls with retries, and the Discord bot captures events in real-time. Each piece is tested in isolation.

---

## 🎬 Act 3: The Orchestra (Bridge)

> *"Now we wire it all together — events flow from Discord → transformers → queue → GR."*

### Wave 3: Bridge Orchestrator

```
┌──────────────────────────────────────────────────────────────────┐
│  [3.1] Bridge — The Conductor                                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    Event Flow                                │  │
│  │                                                              │  │
│  │  Discord Gateway                                              │  │
│  │       │                                                       │  │
│  │       ▼                                                       │  │
│  │  ┌─────────────────┐                                         │  │
│  │  │ Discord Bot      │  onMessage / onEdit / onReaction       │  │
│  │  │ (event handlers) │─────────────────────────────────────┐  │  │
│  │  └─────────────────┘                                      │  │  │
│  │       │                                                    │  │  │
│  │       ▼                                                    │  │  │
│  │  ┌─────────────────┐                                       │  │  │
│  │  │   EventRouter    │  Transforms + enqueues               │  │  │
│  │  │  ┌───────────┐  │                                       │  │  │
│  │  │  │ handleMsg  │──┼──▶ toMessageArchiveRequest()         │  │  │
│  │  │  │ handleEdit │──┼──▶ toEditArchiveRequest()            │  │  │
│  │  │  │ handleReact│──┼──▶ toReactionArchiveRequest()        │  │  │
│  │  │  └───────────┘  │                                       │  │  │
│  │  └──────┬──────────┘                                       │  │  │
│  │         │                                                    │  │  │
│  │         ▼                                                    │  │  │
│  │  ┌─────────────────┐                    ┌────────────────┐  │  │  │
│  │  │   ArchiveQueue   │──▶ retry? ───────▶│    GrClient     │  │  │  │
│  │  │  (FIFO + backoff)│   yes↑  ┌─────── │ archiveConvers.│  │  │  │
│  │  └─────────────────┘        │  │ no     │ POST /v2/...   │  │  │  │
│  │                            │  │        └────────────────┘  │  │  │
│  │                            │  │        ┌────────────────┐  │  │  │
│  │                            │  └────────│ Log to DB     │  │  │  │
│  │                            │           │ (success/fail) │  │  │  │
│  │                            │           └────────────────┘  │  │  │
│  │                            └───────────────────────────────┘  │  │
│  │                                                              │  │
│  │  ┌──────────────────────────────────────────────────┐         │  │
│  │  │ backfillChannel() — historical messages (10K max)│         │  │
│  │  └──────────────────────────────────────────────────┘         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Commit: "feat(bridge): add EventRouter, ArchiveQueue, indexer"  │
└──────────────────────────────────────────────────────────────────┘
```

**Narrative:** The bridge is the brain. It receives events from the Discord bot, transforms them using the core transformers, queues them with retry logic, and sends them to Global Relay. It also supports backfilling historical messages when a new channel is enabled.

---

## 🎬 Act 4: The Dashboard (Management UI)

> *"Now we give admins control — what to archive, where to send it, and who to map."*

### Wave 4: Dashboard Pages

```
┌──────────────────────────────────────────────────────────────────┐
│  [4.1] Dashboard Scaffold + Auth                                 │
│                                                                  │
│  ┌─────────────────────┐  ┌────────────────────────────┐         │
│  │  Landing Page        │  │  Dashboard Layout           │        │
│  │  ┌─────────────────┐  │  │  ┌────────────────────┐   │        │
│  │  │  Sign in with    │  │  │  │ ┌──────┐ ┌──────┐  │   │        │
│  │  │  Discord button  │──┼──┼──│Sidebar│ │Main  │  │   │        │
│  │  └─────────────────┘  │  │  │ │Nav   │ │Content│  │   │        │
│  │  (unauthenticated)    │  │  │ └──────┘ └──────┘  │   │        │
│  └─────────────────────┘  │  │  │ Overview           │   │        │
│                           │  │  │ Servers            │   │        │
│                           │  │  │ Settings           │   │        │
│                           │  │  │ Archive Logs       │   │        │
│                           │  │  │ Sign Out           │   │        │
│                           │  │  └────────────────────┘   │        │
│                           │  └────────────────────────────┘        │
│                                                                  │
│  shadcn/ui components: Button, Card, Badge, Switch               │
│  NextAuth.js Discord OAuth with `identify guilds` scope          │
│                                                                  │
│  Commit: "feat(dashboard): add Next.js scaffold, tailwind, auth" │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  [4.2] Dashboard Pages — Admin Workflow                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                     Admin Journey                            │  │
│  │                                                              │  │
│  │  Login ──▶ Overview ──▶ Servers ──▶ Server Detail            │  │
│  │              │              │              │                  │  │
│  │              │              │              ├── Toggle channels│  │
│  │              │              │              └── Map users      │  │
│  │              │              │                  to emails      │  │
│  │              │              │                                 │  │
│  │              ├── Stats     └── Enable/disable archiving       │  │
│  │              │   cards                                        │  │
│  │              │             ┌──────────────┐                   │  │
│  │              └── Recent    │   Settings    │                  │  │
│  │                  logs      │  GR creds     │                  │  │
│  │                            │  form         │                  │  │
│  │                            └──────────────┘                   │  │
│  │                            ┌──────────────┐                   │  │
│  │                            │  Archive Logs │                  │  │
│  │                            │  Table view   │                  │  │
│  │                            └──────────────┘                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  API Routes: /api/status, /api/servers, /api/config, /api/logs   │
│                                                                  │
│  Commit: "feat(dashboard): add servers, channels, settings"      │
│  Commit: "feat(dashboard): add user-to-email mapping"            │
└──────────────────────────────────────────────────────────────────┘
```

**Narrative:** The admin logs in with Discord, sees an overview of bridge health, then configures which servers/channels to archive, maps Discord users to corporate emails for compliance, and monitors archive activity.

---

## 🎬 Act 5: Final Integration

> *"Connect the bridge to the database, verify everything works, ship it."*

### Wave 5: DB Integration + Smoke Test + Ship

```
┌──────────────────────────────────────────────────────────────────┐
│  [5.1] Bridge ↔ Database Integration                             │
│                                                                  │
│  Bridge startup ──▶ syncServers() ──▶ upsert Discord guilds      │
│                                       and channels into Prisma   │
│                                                                  │
│  Before archiving:                                               │
│    router.handleMessage() ──▶ isChannelArchivingEnabled()        │
│                               getCorporateEmail()                │
│                                                                  │
│  Commit: "feat(bridge): wire to Prisma DB for channel config"    │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  [5.2] Smoke Test + README                                       │
│                                                                  │
│  ┌────────────────────────────────────────┐                      │
│  │  E2E Smoke Test:                       │                      │
│  │  1. Create DiscordMessageEvent          │                      │
│  │  2. Run through toMessageArchiveRequest()│                     │
│  │  3. Assert valid GrArchiveRequest shape  │                     │
│  └────────────────────────────────────────┘                      │
│                                                                  │
│  ┌────────────────────────────────────────┐                      │
│  │  README.md:                             │                     │
│  │  - Architecture diagram                 │                     │
│  │  - Package descriptions                 │                     │
│  │  - Prerequisites + Quick Start          │                     │
│  │  - Supported events                     │                     │
│  └────────────────────────────────────────┘                      │
│                                                                  │
│  npm run test ──▶ ALL PASS                                       │
│  Final commit: "docs: add README and E2E smoke test"            │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  [5.3] 🎉 Full System Flow                                       │
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐   │
│  │ Discord   │───▶│ Bridge   │───▶│ Global    │   │ SQLite   │   │
│  │ Gateway   │    │ (bot +   │    │ Relay API │   │ (config,  │   │
│  │ (events)  │    │  router) │    │ (archive) │   │  logs)   │   │
│  └──────────┘    └──────────┘    └──────────┘   └──────────┘   │
│                       ↕                                           │
│                  ┌──────────┐                                    │
│                  │ Dashboard │                                    │
│                  │ (web UI)  │                                    │
│                  └──────────┘                                    │
└──────────────────────────────────────────────────────────────────┘
```

**Narrative:** The bridge reads configuration from the database (which channels to archive, user-to-email mappings) instead of hardcoded values. Everything is tested end-to-end. The project is documented and ready to ship.

---

## 🗺️ Story Map Summary

| Wave | Story ID | Title | Priority | Effort | Dependencies |
|------|----------|-------|----------|--------|--------------|
| **W1** | US-001 | Monorepo Scaffold | P0 | M | None |
| **W1** | US-002 | Core Types Package | P0 | S | US-001 |
| **W2** | US-003 | Event Transformers | P0 | M | US-002 |
| **W2** | US-004 | Global Relay API Client | P0 | M | US-002 |
| **W2** | US-005 | Discord Bot Handlers | P0 | M | US-002 |
| **W3** | US-006 | Bridge Orchestrator | P0 | M | US-003, US-004, US-005 |
| **W4** | US-007 | Dashboard Scaffold + Auth | P0 | M | US-001 |
| **W4** | US-008 | Dashboard Overview | P1 | S | US-007 |
| **W4** | US-009 | Server/Channel Management | P1 | M | US-007 |
| **W4** | US-010 | GR Configuration | P1 | S | US-007 |
| **W4** | US-011 | Archive Logs | P1 | S | US-007 |
| **W4** | US-012 | User Mapping | P1 | S | US-009 |
| **W5** | US-013 | Bridge DB Integration | P0 | S | US-006, US-001 |
| **W5** | US-014 | E2E Smoke Test + README | P1 | S | US-003, US-006 |

**Legend:** P0 = Must have (core pipeline), P1 = Should have (management), P2 = Nice to have
**Effort:** S = Small (<2hr), M = Medium (2-4hr), L = Large (4-8hr)
