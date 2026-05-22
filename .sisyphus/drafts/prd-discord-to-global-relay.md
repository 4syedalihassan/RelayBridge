# PRD: Discord → Global Relay Bridge + Management UI

## Introduction

Build a headless bridge service that captures Discord messages in real-time (messages, edits, reactions, deletions, file attachments) and archives them to **Global Relay** via the Conversation Archiving API for compliance recordkeeping. A companion web dashboard provides server/channel management, user-to-email mapping, Global Relay credential config, and archive monitoring.

Regulated industries (finance, healthcare, legal) require retention of all business communications. Discord is increasingly used for internal team communication but lacks enterprise archiving. This bridge fills the gap by piping Discord events into Global Relay, a FINRA/SEC-compliant archive.

## Goals

- Capture Discord messages, edits, reactions, deletions, and file attachments in real-time via the Gateway API
- Transform Discord events into Global Relay Conversation Archiving API payloads
- Archive transformed payloads to Global Relay with OAuth2 authentication, rate limiting, retry queue, and backoff
- Provide a Next.js web dashboard to manage which servers/channels are archived, configure Global Relay credentials, map Discord users to corporate emails, and view archive logs
- Support historical backfill for newly enabled channels (up to 10,000 messages)
- Persist all configuration (servers, channels, user mappings, archive logs) via Prisma + SQLite (swappable to Postgres)

## User Stories

### US-001: Monorepo scaffold
**Description:** As a developer, I need a monorepo with npm workspaces, shared TypeScript config, Prisma schema, and Vitest so that all packages share tooling and conventions.

**Acceptance Criteria:**
- [ ] Root `package.json` defines npm workspaces for all 5 packages
- [ ] `tsconfig.base.json` with strict ES2022 settings shared by all packages
- [ ] `.env.example` documents all required env vars
- [ ] `.gitignore` excludes node_modules, dist, .env, .next, *.db
- [ ] `vitest.workspace.ts` points at all packages
- [ ] Prisma schema defines all 5 models: Server, Channel, UserMapping, ArchiveLog, GlobalRelayConfig
- [ ] `npm install` completes and workspaces are linked
- [ ] Typecheck passes

### US-002: Core types package
**Description:** As a developer, I need shared TypeScript types for Discord normalized events, Global Relay payloads, and bridge configuration so that all packages speak the same language.

**Acceptance Criteria:**
- [ ] `packages/core` exports types for all 4 Discord event types (Message, Message_edited, Reaction, Message_deleted)
- [ ] `packages/core` exports Global Relay payload types (GrArchiveRequest, GrArchiveResponse, GrConversationEvent, GrParticipant, GrFile)
- [ ] `packages/core` exports `loadConfig()` that reads env vars and returns a typed `BridgeConfig`
- [ ] Barrel export from `index.ts`

### US-003: Discord → Global Relay transformers
**Description:** As a developer, I need transformer functions that convert Discord normalized events into Global Relay archive request payloads.

**Acceptance Criteria:**
- [ ] `toMessageArchiveRequest()` transforms `DiscordMessageEvent` → `GrArchiveRequest`
- [ ] `toReactionArchiveRequest()` transforms with child event for original message
- [ ] `toEditArchiveRequest()` transforms with old content as child event
- [ ] `toAttachmentArchiveRequests()` generates `File_transfer` events per attachment
- [ ] All 6+ test cases pass

### US-004: Global Relay API client
**Description:** As a developer, I need an HTTP client that authenticates via OAuth2 client credentials, archives conversations, and uploads files to Global Relay.

**Acceptance Criteria:**
- [ ] `TokenManager` fetches OAuth2 tokens, caches, refreshes with 60s safety margin
- [ ] `GrClient.archiveConversation()` sends POST with retries on 429 + exponential backoff
- [ ] `GrClient.uploadFile()` sends PUT
- [ ] Rate limit enforcement at 900 RPM (configurable)

### US-005: Discord bot event handlers
**Description:** As a developer, I need Discord Gateway event handlers that capture messages, edits, deletions, and reactions.

**Acceptance Criteria:**
- [ ] messageCreate: ignores bots, extracts author + content + attachments
- [ ] messageUpdate: ignores bots and no-op edits
- [ ] messageDelete: emits delete event
- [ ] messageReactionAdd: fetches partials, extracts emoji + message context
- [ ] `startBot()` and `stopBot()` lifecycle

### US-006: Bridge orchestrator with queue and router
**Description:** As a developer, I need an orchestrator connecting Discord bot → transformers → GR client via a retry queue.

**Acceptance Criteria:**
- [ ] `ArchiveQueue` with retry + exponential backoff
- [ ] `EventRouter` routes message/edit/reaction events through transformers
- [ ] `backfillChannel()` backfills up to 10K messages

### US-007: Dashboard — scaffold, auth, layout
**Description:** As an admin user, I want to log in with Discord OAuth and see a dashboard.

**Acceptance Criteria:**
- [ ] Next.js 14 App Router with Tailwind + shadcn/ui
- [ ] Discord OAuth via NextAuth.js
- [ ] Landing page with "Sign in with Discord"
- [ ] Dashboard layout with sidebar navigation

### US-008: Dashboard — Overview and status
**Description:** As an admin, I want to see key stats at a glance.

**Acceptance Criteria:**
- [ ] Stats cards: Servers count, Active Channels, Uptime
- [ ] Recent archive activity table
- [ ] `/api/status` endpoint

### US-009: Dashboard — Server and channel management
**Description:** As an admin, I want to enable/disable archiving per server and per channel.

**Acceptance Criteria:**
- [ ] Server list with icons and archive toggles
- [ ] Server detail page with channel-level toggles
- [ ] `/api/servers` fetches guilds from Discord API

### US-010: Dashboard — Global Relay configuration
**Description:** As an admin, I want to configure GR credentials from the UI.

**Acceptance Criteria:**
- [ ] Settings form: Client ID, Client Secret, OAuth URL, API Base URL
- [ ] Save to DB via `/api/config` PATCH

### US-011: Dashboard — Archive logs
**Description:** As an admin, I want to view archive history.

**Acceptance Criteria:**
- [ ] Logs table: Event Type, Status, Reconciliation ID, Archived At
- [ ] Status as colored badges

### US-012: User-to-email mapping
**Description:** As an admin, I want to map Discord users to corporate emails.

**Acceptance Criteria:**
- [ ] Mapping form on server detail page
- [ ] API GET/POST at `/api/servers/{id}/users`
- [ ] Email included in GR participant payload

### US-013: Bridge DB integration
**Description:** As a developer, I want the bridge to read channel config and user mappings from DB.

**Acceptance Criteria:**
- [ ] Checks `archivingEnabled` before archiving
- [ ] Looks up corporate email from UserMapping
- [ ] Syncs Discord servers/channels into Prisma on startup

### US-014: E2E smoke test and README
**Description:** As a developer, I want a smoke test and README.

**Acceptance Criteria:**
- [ ] Smoke test validates full pipeline
- [ ] README documents architecture, setup, supported events

## Functional Requirements

- FR-1: Real-time capture of messageCreate, messageUpdate, messageDelete, messageReactionAdd
- FR-2: All events normalized into typed DiscordNormalizedEvent structures
- FR-3: Transformers convert to GrArchiveRequest matching GR API v2 schema
- FR-4: OAuth2 client credentials with token caching + auto-refresh
- FR-5: Rate limiting (900 RPM default), retry on 429, exponential backoff (max 3)
- FR-6: In-memory FIFO queue with per-item retry
- FR-7: Discord OAuth login via NextAuth.js
- FR-8: List Discord servers, enable/disable archive at server + channel level
- FR-9: Configure GR credentials from UI
- FR-10: Map Discord users to corporate emails
- FR-11: View archive logs with status
- FR-12: Bridge syncs servers/channels to DB on startup
- FR-13: Check DB for archivingEnabled before archiving
- FR-14: Historical backfill up to 10K messages
- FR-15: File attachments archived as File_transfer events

## Non-Goals

- No real-time dashboard notifications (WebSocket/SSE)
- No scheduled archiving — real-time + manual backfill only
- No multi-tenant RBAC
- No export/download from dashboard
- No dead letter queue for permanently failed items
- No voice/forum/stage channel support
- No attachment binary upload (metadata only)

## Technical Considerations

- **Monorepo:** npm workspaces, 5 packages (core, discord-bot, gr-client, bridge, dashboard)
- **Persistence:** Prisma ORM + SQLite (swappable to Postgres)
- **Auth:** NextAuth.js v4 (Discord OAuth) + OAuth2 client credentials (GR)
- **Rate Limiting:** 900 RPM sliding window
- **Queue:** In-memory FIFO with retry + exponential backoff
- **Discord Intents:** Guilds, GuildMessages, MessageContent, GuildMessageReactions
- **Testing:** Vitest

## Success Metrics

- Events archived within 5 seconds (excluding retries)
- 100% transformer test coverage
- Dashboard loads in under 2 seconds
- FIFO processing with no data loss on successful delivery

## Open Questions

- Binary file upload to GR? Deferred — metadata only for v1
- Persistent queue state for crash recovery? Deferred — in-memory only
- User join/leave capture? Types exist but no handler
