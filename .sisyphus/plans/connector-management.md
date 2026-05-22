# Connector Management Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing Discord→Global Relay bridge dashboard with a full connector management system featuring a setup wizard, CRUD, status monitoring, and per-connector analytics.

**Architecture:** New `Connector` Prisma model stores per-endpoint configuration (Discord bot token, server selection, GR credentials). The dashboard is rebuilt with new pages (overview, wizard, connector detail) while the existing dashboard pages are replaced. Bridge backend remains unchanged. shadcn/ui components for all UI.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, shadcn/ui, Prisma/SQLite, NextAuth, Vitest (TDD), Recharts (time-series charts)

---

## TL;DR

> **Quick Summary**: Build a connector management dashboard that replaces the current one. Connectors represent Discord→Global Relay bridge endpoints. A multi-step wizard guides setup, each connector shows config/status/analytics with full CRUD.
>
> **Deliverables**:
> - New `Connector` Prisma model + migration
> - Data migration script (existing Server+GRConfig → Connector)
> - Multi-step Setup Wizard (Name → Discord OAuth → Server → Channels → GR → Review)
> - Dashboard overview page (all connectors with stats)
> - Connector detail page (config, status, CRUD, analytics charts)
> - Dashboard nav restructured for connector management
> - Fix existing dashboard CSS build error + missing SessionProvider
>
> **Estimated Effort**: Large (12-15 tasks, ~3-4 execution waves)
> **Parallel Execution**: YES — 5 waves, maximum 6 parallel tasks
> **Critical Path**: Prisma model → API routes → Wizard → Pages → Integration

---

## Context

### Original Request
"Use shadcn to design the UI as a guided setup wizard, save connection details in DB to make it persistent, support multiple connectors, then a dashboard and connector page showing list of all connectors and each connector shows its related configuration and status with CRUD and analytics."

### Interview Summary
**Key Discussions**:
- Connector = bridge endpoint (one Discord server ↔ Global Relay pairing)
- Replace existing dashboard entirely
- Wizard steps: Name → Discord OAuth → Select server → Pick channels → GR credentials → Review
- Analytics: Summary stats + time-series charts (daily volume, success rate, errors)
- Status: Enabled/Disabled toggle + Online/Offline/Error health
- Per-connector start/stop controls from the dashboard
- Wizard reusable for editing (pre-filled)
- New Connector model + keep existing Server/Channel/GRConfig models
- Auto-migrate existing data into one default Connector
- TDD approach

---

## Work Objectives

### Core Objective
Build a full connector management dashboard that replaces the current one, with a setup wizard, CRUD, live status, and per-connector analytics.

### Concrete Deliverables
- Prisma `Connector` model (stores all config per endpoint)
- Prisma migration + seed migration script
- REST API: `GET/POST/PUT/DELETE /api/connectors`
- REST API: `GET /api/connectors/[id]/analytics` (time-series data)
- REST API: `POST /api/connectors/[id]/toggle` (start/stop)
- Multi-step wizard component (6 steps)
- Dashboard overview page (connector cards + total stats)
- Connector detail page (config, CRUD, analytics charts, status)
- Dashboard nav restructured (connector-focused)
- Fix existing CSS build error (`border-border` undefined)
- Fix missing `SessionProvider` causing 500 on homepage

### Definition of Done
- [ ] `npm run build -w packages/dashboard` succeeds
- [ ] `npx vitest run` passes all tests (new + existing)
- [ ] `npx tsc --noEmit` passes for dashboard
- [ ] All wizard steps render and validate correctly
- [ ] Connector CRUD works end-to-end (create, read, update, delete)
- [ ] Analytics charts render with data from ArchiveLog
- [ ] Start/Stop toggle actually affects bridge behavior
- [ ] Existing data auto-migrated on first run

### Must Have
- Wizard that creates a fully configured connector
- Dashboard showing all connectors with health status
- Detail page with config edit, status, and analytics
- CRUD operations for connectors

### Must NOT Have (Guardrails)
- No changes to bridge backend logic (packages/bridge/src/)
- No changes to core, discord-bot, or gr-client packages
- No removal of existing data (migration only)
- No credential encryption in this phase (store as-is, flagged as future improvement)

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (Vitest)
- **Automated tests**: TDD — each task has failing test first, then implementation
- **Framework**: Vitest

### QA Policy
Every task includes agent-executed QA scenarios:
- **API routes**: Bash/curl to send requests, assert status + response body
- **UI components**: Playwright (agent-browser) — navigate, interact, assert DOM, screenshot
- **Wizard flow**: Playwright — step through each step, verify form persistence, final submission
- **Evidence**: Saved to `.sisyphus/evidence/task-{N}-{scenario}.{ext}`

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — sequential, 4 tasks):
├── Task 1: Fix existing dashboard issues (CSS + SessionProvider)
├── Task 2: Add Connector model to Prisma schema + migration
├── Task 3: Data migration script (existing → Connector)
└── Task 4: Connector API routes (CRUD + analytics + toggle)

Wave 2 (Components — MAX PARALLEL, 5 tasks):
├── Task 5: Multi-step Wizard component (6-step form)
├── Task 6: ConnectorCard component (overview list item)
├── Task 7: StatusBadge + HealthIndicator components
├── Task 8: AnalyticsCharts component (summary + time-series)
└── Task 9: ConnectorForm (inline edit form for detail page)

Wave 3 (Pages — parallel, 4 tasks):
├── Task 10: Dashboard overview page (replace current dashboard/page.tsx)
├── Task 11: Connector detail page (config + CRUD + charts)
├── Task 12: New connector wizard page + edit connector page
└── Task 13: Dashboard navigation restructure

Wave 4 (Integration — sequential, 2 tasks):
├── Task 14: E2E tests (wizard flow + CRUD + analytics)
└── Task 15: Final polish (error states, loading, empty states, typecheck + build)

Critical Path: Task 1 → Task 2 → Task 4 → Task 5 → Tasks 10-12 → Task 14 → Task 15
```

---

## TODOs

- [ ] 1. Fix existing dashboard build issues

  **What to do**:
  1. Read `packages/dashboard/tailwind.config.ts` — add shadcn/ui color extensions (border, input, ring, background, foreground, etc.) to fix `border-border` CSS error
  2. Read `packages/dashboard/src/app/layout.tsx` — wrap children in `<SessionProvider>` (from `next-auth/react`) via a `'use client'` Providers component
  3. Kill existing `node` processes, restart `npm run dev -w packages/dashboard`
  4. Verify `curl http://localhost:3000` returns 200 (landing page)
  5. Run `npx tsc --noEmit` to confirm no type errors

  **Files**:
  - Modify: `packages/dashboard/tailwind.config.ts`
  - Create: `packages/dashboard/src/components/providers.tsx`
  - Modify: `packages/dashboard/src/app/layout.tsx`

  **Test (TDD)**:
  - No new tests — fixes existing broken build

  **QA Scenarios**:
  ```
  Scenario: Dashboard landing page loads without 500
    Tool: Bash (curl)
    Steps:
      1. curl http://localhost:3000 with timeout 15s
      2. Assert HTTP status 200
      3. Assert response contains "Discord → Global Relay" title
    Evidence: .sisyphus/evidence/task-1-landing-loaded.txt

  Scenario: Dashboard typecheck passes
    Tool: Bash
    Steps:
      1. npx tsc --noEmit
      2. Assert exit code 0
    Evidence: .sisyphus/evidence/task-1-typecheck.txt
  ```

  **Commit**: YES
  - Message: `fix(dashboard): add shadcn/ui color extensions and SessionProvider`
  - Files: `packages/dashboard/tailwind.config.ts packages/dashboard/src/components/providers.tsx packages/dashboard/src/app/layout.tsx`

- [ ] 2. Add Connector model to Prisma schema

  **What to do**:
  1. Add `Connector` model to `prisma/schema.prisma` with fields:
     - `id` (String, @id @default(cuid()))
     - `name` (String)
     - `description` (String?)
     - discordBotToken, discordClientId, discordClientSecret (all String)
     - discordGuildId, discordGuildName (String)
     - selectedChannelIds (String @default("[]") — JSON array)
     - grClientId, grClientSecret, grOauthUrl, grApiBaseUrl (all String)
     - enabled (Boolean @default(false))
     - healthStatus (String @default("offline") — "online"|"offline"|"error")
     - lastError (String?)
     - totalArchived (Int @default(0))
     - failedCount (Int @default(0))
     - successRate (Float @default(0))
     - lastArchivedAt (DateTime?)
     - createdAt, updatedAt
  2. Write a TDD test for the model
  3. Run `npx prisma generate` to regenerate client
  4. Run `npx prisma db push` to apply schema (dev mode)

  **Files**:
  - Modify: `prisma/schema.prisma`
  - Create: `tests/unit/prisma-schema.test.ts`

  **Test (TDD)**:
  ```typescript
  import { describe, it, expect } from 'vitest';
  import { PrismaClient } from '@prisma/client';

  describe('Connector model', () => {
    it('should be defined on PrismaClient', () => {
      const prisma = new PrismaClient();
      expect(prisma.connector).toBeDefined();
      prisma.$disconnect();
    });

    it('should have all required fields', () => {
      // Verify model fields via type check
      type ConnectorFields = keyof NonNullable<Awaited<ReturnType<typeof prisma.connector.findFirst>>>;
      // Compile-time check — if model missing fields, this won't compile
    });
  });
  ```

  **QA Scenarios**:
  ```
  Scenario: Prisma client includes Connector model
    Tool: Bash
    Steps:
      1. npx prisma generate
      2. Use node -e "const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); console.log(typeof p.connector); p.\$disconnect()"
      3. Assert output is "object"
    Evidence: .sisyphus/evidence/task-2-connector-model.txt
  ```

  **Commit**: YES
  - Message: `feat(db): add Connector model to Prisma schema`

- [ ] 3. Data migration script (existing → Connector)

  **What to do**:
  1. Create `prisma/migrate-existing.ts` that:
     - Queries existing Server + Channel + GlobalRelayConfig
     - Creates one Connector per Server with its GR config
     - Collects all channel IDs into selectedChannelIds JSON
     - Sets enabled=true if any channels had archivingEnabled
     - Preserves totalArchived count from ArchiveLog
  2. Write a TDD test verifying migration produces correct Connector records
  3. Run migration script against dev DB

  **Files**:
  - Create: `prisma/migrate-existing.ts`
  - Create: `tests/unit/migration.test.ts`

  **Test (TDD)**:
  ```typescript
  import { describe, it, expect, beforeAll, afterAll } from 'vitest';
  import { PrismaClient } from '@prisma/client';

  describe('Data migration', () => {
    it('should create one Connector per existing Server');
    it('should embed selected channel IDs as JSON array');
    it('should copy GR credentials from GlobalRelayConfig');
    it('should set enabled based on archivingEnabled flag');
  });
  ```

  **QA Scenarios**:
  ```
  Scenario: Migration creates correct Connector records
    Tool: Bash
    Steps:
      1. Run: npx ts-node prisma/migrate-existing.ts
      2. Check exit code 0
      3. Verify DB via: npx prisma studio or sqlite3 query
    Evidence: .sisyphus/evidence/task-3-migration.txt
  ```

  **Commit**: YES
  - Message: `feat(db): add data migration script for existing records`

- [ ] 4. Connector API routes

  **What to do**:
  1. Create `packages/dashboard/src/app/api/connectors/route.ts`:
     - `GET` — list all connectors with stats (from Connector model + ArchiveLog counts)
     - `POST` — create new connector (validate required fields)
  2. Create `packages/dashboard/src/app/api/connectors/[id]/route.ts`:
     - `GET` — single connector with full details
     - `PUT` — update connector fields
     - `DELETE` — delete connector (cascade: remove Server/Channel/Logs?)
  3. Create `packages/dashboard/src/app/api/connectors/[id]/toggle/route.ts`:
     - `POST` — toggle connector enabled/disabled (will notify bridge)
  4. Create `packages/dashboard/src/app/api/connectors/[id]/analytics/route.ts`:
     - `GET` — return time-series analytics from ArchiveLog (grouped by day/week)
  5. All routes use NextAuth session guard (`getServerSession`)
  6. Write TDD tests for all endpoints
  7. Run `npx tsc --noEmit` to verify

  **Files**:
  - Create: `packages/dashboard/src/app/api/connectors/route.ts`
  - Create: `packages/dashboard/src/app/api/connectors/[id]/route.ts`
  - Create: `packages/dashboard/src/app/api/connectors/[id]/toggle/route.ts`
  - Create: `packages/dashboard/src/app/api/connectors/[id]/analytics/route.ts`
  - Create: `tests/api/connectors.test.ts`

  **Test (TDD)**:
  ```typescript
  import { describe, it, expect } from 'vitest';

  describe('Connectors API', () => {
    it('GET /api/connectors returns array');
    it('POST /api/connectors creates new connector');
    it('GET /api/connectors/[id] returns single connector');
    it('PUT /api/connectors/[id] updates connector');
    it('DELETE /api/connectors/[id] removes connector');
    it('POST /api/connectors/[id]/toggle flips enabled');
    it('GET /api/connectors/[id]/analytics returns time-series');
    it('returns 401 when unauthenticated');
  });
  ```

  **QA Scenarios**:
  ```
  Scenario: Create connector via API
    Tool: Bash (curl)
    Steps:
      1. POST /api/connectors with JSON body containing name, discordBotToken, grClientId, etc.
      2. Assert response status 200/201
      3. Assert response body has id
    Evidence: .sisyphus/evidence/task-4-create.txt

  Scenario: List connectors
    Tool: Bash (curl)
    Steps:
      1. GET /api/connectors
      2. Assert status 200
      3. Assert response is array
    Evidence: .sisyphus/evidence/task-4-list.txt

  Scenario: Toggle connector
    Tool: Bash (curl)
    Steps:
      1. POST /api/connectors/[id]/toggle
      2. Assert status 200
      3. Assert enabled field flipped
    Evidence: .sisyphus/evidence/task-4-toggle.txt
  ```

  **Commit**: YES
  - Message: `feat(api): add connector CRUD + analytics API routes`

- [ ] 5. Multi-step Wizard component

  **What to do**:
  1. Create `packages/dashboard/src/components/connector-wizard.tsx` — a client component that renders a 6-step form:
     - **Step 1: Name & Description** — Text inputs for connector name, optional description
     - **Step 2: Discord OAuth** — "Sign in with Discord" button, fetches guilds the user administers via `/api/auth/session` + Discord API. If user already authed, show connected status
     - **Step 3: Select Server** — Dropdown of guilds from Discord (fetched in Step 2), each with icon + name. "Next" disabled until selection made
     - **Step 4: Pick Channels** — After server selected, fetch guild channels via Discord API. Show text channels as toggle list. User selects which to archive
     - **Step 5: GR Credentials** — Form fields for GR Client ID, Client Secret, OAuth URL, API Base URL (with defaults pre-filled)
     - **Step 6: Review** — Summary of all selections with edit buttons per section. "Create Connector" submit button
  2. Each step validates its inputs before allowing "Next"
  3. All wizard state managed with React useState (no external state library needed)
  4. On final submit, POST to `/api/connectors` with all collected data
  5. On success, navigate to new connector detail page
  6. Wizard accepts optional `initialData` prop — if provided, pre-fills all steps (for edit mode)
  7. Write TDD tests for: each step validation, final submission, edit pre-fill

  **Files**:
  - Create: `packages/dashboard/src/components/connector-wizard.tsx`
  - Create: `packages/dashboard/src/components/wizard-step-name.tsx`
  - Create: `packages/dashboard/src/components/wizard-step-discord.tsx`
  - Create: `packages/dashboard/src/components/wizard-step-server.tsx`
  - Create: `packages/dashboard/src/components/wizard-step-channels.tsx`
  - Create: `packages/dashboard/src/components/wizard-step-gr.tsx`
  - Create: `packages/dashboard/src/components/wizard-step-review.tsx`
  - Create: `tests/components/connector-wizard.test.tsx`

  **Test (TDD)**:
  ```typescript
  describe('ConnectorWizard', () => {
    it('renders step 1 (name) initially');
    it('disables Next if name is empty on step 1');
    it('advances to next step on valid Next click');
    it('allows going back to previous step');
    it('shows review summary with all selections');
    it('submits POST /api/connectors on final submit');
    it('pre-fills all steps when initialData prop provided');
  });
  ```

  **QA Scenarios**:
  ```
  Scenario: Wizard step 1 validation
    Tool: Playwright
    Steps:
      1. Navigate to /connectors/new
      2. Assert step 1 "Name" input is visible
      3. Click "Next" with empty name
      4. Assert validation error shown
      5. Type "Test Connector" and click Next
      6. Assert wizard advances to step 2
    Evidence: .sisyphus/evidence/task-5-wizard-step1.png

  Scenario: Wizard creates connector end-to-end
    Tool: Playwright
    Steps:
      1. Fill step 1 (name)
      2. Fill step 2 (simulate Discord auth state)
      3. Step 3: Select server from dropdown
      4. Step 4: Toggle some channels
      5. Step 5: Fill GR credentials
      6. Step 6: Review and click "Create Connector"
      7. Assert redirect to connector detail page
      8. Assert success toast/message shown
    Evidence: .sisyphus/evidence/task-5-wizard-e2e.png
  ```

  **Commit**: YES
  - Message: `feat(connector): add multi-step setup wizard component`

- [ ] 6. ConnectorCard component

  **What to do**:
  1. Create `packages/dashboard/src/components/connector-card.tsx` — a card displaying:
     - Connector name + description (truncated)
     - Health status badge (Online/Offline/Error with color)
     - Enabled/Disabled indicator
     - Quick stats: total archived, success rate, last archived time
     - Click navigates to connector detail page
     - Start/Stop toggle directly on the card
  2. Uses shadcn/ui Card, Badge, Switch components
  3. Write TDD tests

  **Files**:
  - Create: `packages/dashboard/src/components/connector-card.tsx`
  - Create: `tests/components/connector-card.test.tsx`

  **Test (TDD)**:
  ```typescript
  describe('ConnectorCard', () => {
    it('renders connector name and description');
    it('shows health status badge with correct color');
    it('shows enabled/disabled toggle');
    it('calls onToggle when switch clicked');
    it('displays totalArchived count');
    it('navigates to connector detail on click');
  });
  ```

  **QA Scenarios**:
  ```
  Scenario: ConnectorCard renders correctly
    Tool: Playwright
    Steps:
      1. Render ConnectorCard with mock data (name="Test", status="online", enabled=true)
      2. Assert name "Test" visible
      3. Assert "Online" badge with green color
      4. Assert switch is toggled on
    Evidence: .sisyphus/evidence/task-6-card.png
  ```

  **Commit**: YES (groups with Task 7)

- [ ] 7. StatusBadge + HealthIndicator components

  **What to do**:
  1. Create `packages/dashboard/src/components/status-badge-enhanced.tsx`:
     - Props: `status: 'online' | 'offline' | 'error'`, `enabled: boolean`
     - Shows: colored dot + label (Online=green, Offline=gray, Error=red)
     - If disabled, shows "Disabled" in muted color regardless of health
  2. Create `packages/dashboard/src/components/health-indicator.tsx`:
     - Animated pulse dot for "online" status
     - Shows last error text on hover/tooltip for "error" status
     - Shows "last seen" timestamp for "offline" status
  3. Write TDD tests

  **Files**:
  - Create: `packages/dashboard/src/components/status-badge-enhanced.tsx`
  - Create: `packages/dashboard/src/components/health-indicator.tsx`
  - Create: `tests/components/status-badge-enhanced.test.tsx`

  **Test (TDD)**:
  ```typescript
  describe('StatusBadgeEnhanced', () => {
    it('renders green for online');
    it('renders red for error with lastError tooltip');
    it('renders gray for offline');
    it('shows "Disabled" when enabled=false regardless of status');
  });
  ```

  **Commit**: YES (groups with Task 6)
  - Message: `feat(connector): add ConnectorCard, StatusBadge, and HealthIndicator components`

- [ ] 8. AnalyticsCharts component

  **What to do**:
  1. Install Recharts: `npm install recharts -w packages/dashboard`
  2. Create `packages/dashboard/src/components/analytics-charts.tsx` with:
     - **Summary Stats Row**: Cards showing Total Archived, Success Rate %, Failed Count, Last Archived (timestamp)
     - **Daily Volume Chart**: Recharts `BarChart` — X=date, Y=count, grouped by status (success/failed)
     - **Success Rate Trend**: Recharts `LineChart` — 7-day rolling success rate
     - **Error Breakdown**: Pie chart of error types (if available) or simple list
  3. Fetches data from `/api/connectors/[id]/analytics`
  4. Loading state (skeleton), empty state ("No data yet — start archiving!"), error state
  5. Write TDD tests

  **Files**:
  - Create: `packages/dashboard/src/components/analytics-charts.tsx`
  - Create: `tests/components/analytics-charts.test.tsx`

  **Test (TDD)**:
  ```typescript
  describe('AnalyticsCharts', () => {
    it('renders summary stats row with correct values');
    it('renders bar chart with daily volume data');
    it('renders line chart with success rate trend');
    it('shows loading skeleton while fetching');
    it('shows empty state when no data');
    it('shows error state on fetch failure');
  });
  ```

  **QA Scenarios**:
  ```
  Scenario: Analytics renders with data
    Tool: Playwright
    Steps:
      1. Mock /api/connectors/[id]/analytics to return sample time-series data
      2. Render AnalyticsCharts
      3. Assert "Total Archived: 150" visible
      4. Assert bar chart is rendered (check for SVG elements)
    Evidence: .sisyphus/evidence/task-8-analytics.png
  ```

  **Commit**: YES
  - Message: `feat(connector): add AnalyticsCharts component with Recharts`

- [ ] 9. ConnectorForm (inline edit component)

  **What to do**:
  1. Create `packages/dashboard/src/components/connector-form.tsx`:
     - Inline edit form for connector detail page
     - Sections: Discord Config (token, clientId, clientSecret), GR Config (clientId, secret, URLs)
     - Server/Channel selection (reuse wizard-style selection)
     - "Save Changes" button → PUT `/api/connectors/[id]`
     - "Cancel" button → revert to read-only view
  2. Tab-based layout: Config | Channels | Credentials
  3. Validation on save
  4. Success/error feedback
  5. Write TDD tests

  **Files**:
  - Create: `packages/dashboard/src/components/connector-form.tsx`
  - Create: `tests/components/connector-form.test.tsx`

  **Test (TDD)**:
  ```typescript
  describe('ConnectorForm', () => {
    it('renders config tabs');
    it('pre-fills with existing connector data');
    it('validates required fields before save');
    it('calls PUT /api/connectors/[id] on save');
    it('reverts changes on Cancel');
    it('shows success notification after save');
  });
  ```

  **QA Scenarios**:
  ```
  Scenario: Edit connector inline
    Tool: Playwright
    Steps:
      1. Navigate to connector detail page
      2. Click "Edit" button
      3. Change connector name
      4. Click "Save Changes"
      5. Assert success message
      6. Assert page shows updated name
    Evidence: .sisyphus/evidence/task-9-edit.png
  ```

  **Commit**: YES
  - Message: `feat(connector): add inline edit form component`

- [ ] 10. Dashboard overview page (replace current)

  **What to do**:
  1. Replace `packages/dashboard/src/app/dashboard/page.tsx` with new overview:
     - **Top row**: Summary stats cards (Total Connectors, Active Connectors, Total Archived Today, Overall Success Rate)
     - **Main content**: Grid of ConnectorCards showing all connectors
     - **"Add Connector" button** → navigates to `/connectors/new`
     - **Empty state**: "No connectors yet. Create your first one!" with CTA button
     - **Loading state**: Skeleton cards while fetching
     - **Error state**: Error message with retry button
  2. Fetches from `GET /api/connectors` on mount
  3. Real-time status polling (optional — refresh every 30s)
  4. Remove old server/channel/logs content
  5. Write TDD tests

  **Files**:
  - Modify: `packages/dashboard/src/app/dashboard/page.tsx`
  - Create: `tests/pages/dashboard-overview.test.tsx`

  **Test (TDD)**:
  ```typescript
  describe('Dashboard Overview', () => {
    it('renders total connectors count');
    it('shows list of ConnectorCards');
    it('shows empty state when no connectors');
    it('shows loading skeleton initially');
    it('navigates to wizard on "Add Connector" click');
  });
  ```

  **QA Scenarios**:
  ```
  Scenario: Dashboard overview loads
    Tool: Playwright
    Steps:
      1. Navigate to /dashboard
      2. Assert "Connectors" heading visible
      3. If connectors exist: assert cards visible
      4. If no connectors: assert "No connectors yet" empty state
      5. Assert "Add Connector" button visible
    Evidence: .sisyphus/evidence/task-10-overview.png
  ```

  **Commit**: YES (groups with Task 13)

- [ ] 11. Connector detail page

  **What to do**:
  1. Create `packages/dashboard/src/app/dashboard/connectors/[id]/page.tsx`:
     - **Header**: Connector name, StatusBadgeEnhanced, Enabled/Disabled toggle
     - **Tabs layout**:
       - **Tab 1: Overview** — Health status, last archived, quick stats
       - **Tab 2: Configuration** — Read-only config display + "Edit" button that switches to ConnectorForm
       - **Tab 3: Analytics** — AnalyticsCharts component
       - **Tab 4: Channels** — List of selected Discord channels with toggles
     - **Start/Stop button** — POST to `/api/connectors/[id]/toggle`
     - **Danger zone** — Delete connector with confirmation dialog
     - Loading, error, not-found states
  2. Fetches `GET /api/connectors/[id]` on mount
  3. Write TDD tests

  **Files**:
  - Create: `packages/dashboard/src/app/dashboard/connectors/[id]/page.tsx`
  - Create: `tests/pages/connector-detail.test.tsx`

  **Test (TDD)**:
  ```typescript
  describe('Connector Detail', () => {
    it('renders connector name in header');
    it('shows tabs: Overview, Configuration, Analytics, Channels');
    it('switches to edit mode on Edit click');
    it('toggles enabled/disabled');
    it('deletes connector with confirmation');
    it('shows 404 for non-existent connector');
  });
  ```

  **QA Scenarios**:
  ```
  Scenario: Connector detail loads and displays tabs
    Tool: Playwright
    Steps:
      1. Navigate to /dashboard/connectors/[id] (use a known ID)
      2. Assert connector name in header
      3. Click each tab and assert content changes
      4. Assert "Overview" tab shows health and stats
      5. Assert "Configuration" tab shows config values
      6. Assert "Analytics" tab shows charts
    Evidence: .sisyphus/evidence/task-11-detail.png

  Scenario: Toggle connector enabled/disabled
    Tool: Playwright
    Steps:
      1. On detail page, click enabled toggle
      2. Assert toggle state changed
      3. Reload page — assert toggle persists
    Evidence: .sisyphus/evidence/task-11-toggle.png
  ```

  **Commit**: YES (groups with Task 12)

- [ ] 12. New connector wizard + edit connector pages

  **What to do**:
  1. Create `packages/dashboard/src/app/dashboard/connectors/new/page.tsx`:
     - Renders ConnectorWizard without initialData
     - "New Connector" heading with breadcrumb back to dashboard
  2. Create `packages/dashboard/src/app/dashboard/connectors/[id]/edit/page.tsx`:
     - Renders ConnectorWizard with initialData fetched from `/api/connectors/[id]`
     - "Edit Connector" heading
     - On submit, calls PUT `/api/connectors/[id]` instead of POST
  3. Write TDD tests

  **Files**:
  - Create: `packages/dashboard/src/app/dashboard/connectors/new/page.tsx`
  - Create: `packages/dashboard/src/app/dashboard/connectors/[id]/edit/page.tsx`
  - Create: `tests/pages/connector-new.test.tsx`

  **Test (TDD)**:
  ```typescript
  describe('New Connector Page', () => {
    it('renders wizard on /connectors/new');
    it('submits POST /api/connectors');
    it('redirects to detail on success');
  });
  describe('Edit Connector Page', () => {
    it('pre-fills wizard with existing data');
    it('submits PUT /api/connectors/[id]');
  });
  ```

  **QA Scenarios**:
  ```
  Scenario: New connector wizard page
    Tool: Playwright
    Steps:
      1. Navigate to /dashboard/connectors/new
      2. Assert wizard step 1 visible
      3. Complete wizard
      4. Assert redirect to new connector detail
    Evidence: .sisyphus/evidence/task-12-new-page.png
  ```

  **Commit**: YES (groups with Task 11)
  - Message: `feat(connector): add connector detail, new, and edit pages`

- [ ] 13. Dashboard navigation restructure

  **What to do**:
  1. Read and update `packages/dashboard/src/components/dashboard-sidebar.tsx`:
     - Change nav items:
       - Dashboard (overview) → `/dashboard`
       - Connectors → `/dashboard/connectors` (list)
       - Settings → Keep/update as needed
       - Remove old: Servers, Logs links
     - Add "New Connector" quick-action button at bottom
  2. Update `packages/dashboard/src/components/dashboard-layout.tsx` if needed
  3. Remove old page routes that were replaced:
     - `/dashboard/servers/` pages → can be redirected or removed
     - `/dashboard/logs/` → analytics moved to connector detail
     - `/dashboard/settings/` → settings integrated into connector detail
  4. Write TDD tests

  **Files**:
  - Modify: `packages/dashboard/src/components/dashboard-sidebar.tsx`
  - Possibly modify: `packages/dashboard/src/app/dashboard/layout.tsx`

  **Test (TDD)**:
  ```typescript
  describe('Dashboard Sidebar', () => {
    it('shows Dashboard link to /dashboard');
    it('shows Connectors link');
    it('highlights active route');
    it('has Add Connector quick action');
    it('does not show old server/log links');
  });
  ```

  **Commit**: YES (groups with Task 10)
  - Message: `feat(dashboard): restructure navigation for connector management`

- [ ] 14. E2E integration tests

  **What to do**:
  1. Create `tests/e2e/connector-flow.test.ts` with:
     - **Test 1: Wizard creates connector**
       - Mock Discord OAuth session
       - Simulate wizard submission with full payload
       - Verify connector appears in list
     - **Test 2: Connector CRUD**
       - Create → Read → Update → Delete a connector via API
       - Verify each operation persists correctly
     - **Test 3: Analytics endpoint**
       - Create connector + sample ArchiveLog records
       - GET analytics → verify daily volume, success rate
     - **Test 4: Toggle connector**
       - Create connector, toggle enabled/disabled
       - Verify state flips
     - **Test 5: Migration integrity**
       - Run migration script
       - Verify all existing Server records have corresponding Connector
  2. All tests use in-memory/test DB (Vitest setup)
  3. Run full suite: `npx vitest run`

  **Files**:
  - Create: `tests/e2e/connector-flow.test.ts`

  **Test (TDD)** — All tests from task description

  **QA Scenarios**:
  ```
  Scenario: Full E2E test suite passes
    Tool: Bash
    Steps:
      1. npx vitest run
      2. Assert exit code 0
      3. Assert all test suites pass (connector CRUD, wizard, analytics, toggle)
    Evidence: .sisyphus/evidence/task-14-e2e.txt
  ```

  **Commit**: YES
  - Message: `test(connector): add E2E integration tests for connector flow`

- [ ] 15. Final polish — Error states, loading, empty states, build verification

  **What to do**:
  1. Audit every page/component for:
     - **Loading state**: Each data-fetching component shows skeleton/spinner
     - **Error state**: API failures show error message with retry button
     - **Empty state**: No-data scenarios show helpful empty state with CTA
     - **404 state**: Invalid connector IDs show "Connector not found"
  2. Audit form validation:
     - All required fields show validation errors
     - Token/secret fields have Show/Hide toggle
     - Confirmation dialog before delete
  3. Run final verifications:
     - `npx tsc --noEmit` — zero type errors
     - `npm run build -w packages/dashboard` — build succeeds
     - `npx vitest run` — all tests pass
  4. Clean up old pages that were replaced (servers/, logs/, settings/ if fully replaced)

  **Files**:
  - Various component/page tweaks
  - Remove: old page directories if confirmed replaced

  **QA Scenarios**:
  ```
  Scenario: Build and typecheck pass
    Tool: Bash
    Steps:
      1. npx tsc --noEmit
      2. npm run build -w packages/dashboard
      3. Assert both exit 0
    Evidence: .sisyphus/evidence/task-15-build.txt

  Scenario: Dashboard loads without errors
    Tool: Playwright
    Steps:
      1. Navigate to /dashboard
      2. Assert no console errors
      3. Assert page renders without crash
    Evidence: .sisyphus/evidence/task-15-no-errors.png
  ```

  **Commit**: YES
  - Message: `chore: final polish — states, build verification, cleanup`

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — Verify all "Must Have" delivered, no "Must NOT Have" violated
- [ ] F2. **Build + Typecheck** — `tsc --noEmit` + `npm run build` for dashboard
- [ ] F3. **Full Test Suite** — `npx vitest run` all pass
- [ ] F4. **Real QA** — Execute every QA scenario from every task (Playwright for UI, curl for API)

---

## Commit Strategy

- Group by logical change (per task or per pair of related tasks)
- Conventional commits: `feat(connector):`, `fix(dashboard):`, `test(connector):`, `refactor:`

---

## Success Criteria

### Verification Commands
```bash
npm run build -w packages/dashboard    # Build succeeds
npx vitest run                          # All tests pass
npx tsc --noEmit                        # No type errors
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] API routes respond correctly
- [ ] Wizard creates connector end-to-end
- [ ] Analytics render with data
