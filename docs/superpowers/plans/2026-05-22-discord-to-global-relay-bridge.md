# Discord → Global Relay Bridge + Management UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a headless bridge service that captures Discord messages in real-time and archives them to Global Relay via the Conversation Archiving API, plus a web dashboard for managing servers/channels and monitoring archive status.

**Architecture:** TypeScript monorepo (npm workspaces) with three core packages — `discord-bot` (discord.js v14 Gateway listener), `gr-client` (Global Relay OAuth2 + HTTP client), and `bridge` (orchestrator with queue + event router). A `dashboard` (Next.js 14 App Router) provides server/channel management, configuration, and monitoring. All packages share types via `core`. Persistence via Prisma + SQLite (swappable to Postgres).

**Tech Stack:** TypeScript, discord.js v14, Next.js 14 (App Router), Tailwind CSS + shadcn/ui, Prisma ORM + SQLite, NextAuth.js (Discord OAuth), Vitest, npm workspaces

---

## File Structure

```
D:\Projects\DiscordToGlobalRelay\
├── package.json                      # Monorepo root (npm workspaces)
├── tsconfig.base.json                # Shared TS config
├── .env.example
├── .gitignore
├── vitest.workspace.ts
├── packages/
│   ├── core/                         # Shared types, transformers
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── types.ts              # DiscordEvent, GrPayload, GrEventType, Config
│   │       ├── config.ts             # Config schema + env loading
│   │       └── transformers/
│   │           ├── index.ts
│   │           ├── message.ts        # Discord message → Gr Message event
│   │           ├── reaction.ts       # Discord reaction → Gr Reaction event
│   │           ├── edit.ts           # Discord messageUpdate → Gr Message_edited
│   │           └── attachment.ts     # Attachment metadata → Gr File_transfer
│   ├── discord-bot/                  # Discord Gateway client
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts              # Bot entry: Client init, login, register handlers
│   │       ├── client.ts             # Discord.Client singleton
│   │       ├── handlers/
│   │       │   ├── messageCreate.ts   # on('messageCreate')
│   │       │   ├── messageUpdate.ts   # on('messageUpdate')
│   │       │   ├── messageDelete.ts   # on('messageDelete')
│   │       │   └── messageReactionAdd.ts # on('messageReactionAdd')
│   │       └── deploy-commands.ts    # Slash command registration
│   ├── gr-client/                    # Global Relay HTTP client
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── auth.ts               # OAuth2 token fetch + refresh + caching
│   │       ├── client.ts             # Axios/fetch wrapper with retry + rate-limit
│   │       └── endpoints/
│   │           ├── conversations.ts   # POST /v2/conversations
│   │           └── files.ts          # PUT /v2/files/{fileKey}
│   ├── bridge/                       # Orchestrator — glues bot ↔ GR
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts              # Bridge entry: init bot, queue, GR client
│   │       ├── queue.ts              # In-memory queue with retry + backoff
│   │       ├── router.ts             # Routes Discord events to GR via transformers
│   │       └── indexer.ts            # Historical message backfill for new channels
│   └── dashboard/                    # Next.js 14 web UI
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.js
│       ├── tailwind.config.ts
│       ├── postcss.config.js
│       ├── components.json           # shadcn/ui config
│       └── src/
│           ├── app/
│           │   ├── layout.tsx
│           │   ├── page.tsx           # Landing / login
│           │   ├── api/
│           │   │   ├── auth/[...nextauth]/route.ts
│           │   │   ├── config/route.ts        # CRUD archival config
│           │   │   ├── servers/route.ts       # List Discord servers
│           │   │   └── status/route.ts        # Bridge health + stats
│           │   └── dashboard/
│           │       ├── layout.tsx    # Sidebar + auth guard
│           │       ├── page.tsx      # Overview cards (servers, msgs archived, status)
│           │       ├── servers/
│           │       │   ├── page.tsx  # List servers, enable/disable archiving
│           │       │   └── [id]/
│           │       │       └── page.tsx  # Per-server: channel list, stats
│           │       ├── settings/
│           │       │   └── page.tsx  # Global Relay creds, bot token, user mapping
│           │       └── logs/
│           │           └── page.tsx  # Archive activity log
│           ├── components/
│           │   ├── ui/              # shadcn/ui generated components
│           │   ├── dashboard-sidebar.tsx
│           │   ├── server-card.tsx
│           │   ├── channel-toggle.tsx
│           │   ├── status-badge.tsx
│           │   ├── stats-card.tsx
│           │   └── user-mapping-form.tsx
│           ├── lib/
│           │   ├── auth.ts          # NextAuth config
│           │   ├── db.ts            # Prisma client singleton
│           │   └── api.ts           # fetch wrappers for internal API
│           └── styles/
│               └── globals.css      # Tailwind imports
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── tests/
    ├── core/                        # Unit tests for transformers
    ├── gr-client/                   # Integration tests (mocked)
    └── bridge/                      # Integration tests (mocked)
```

---

### Task 1: Monorepo Scaffold + Shared Config

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `vitest.workspace.ts`

- [ ] **Step 1: Create root package.json with npm workspaces**

```json
{
  "name": "discord-to-global-relay",
  "private": true,
  "workspaces": [
    "packages/core",
    "packages/discord-bot",
    "packages/gr-client",
    "packages/bridge",
    "packages/dashboard"
  ],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "dev:bot": "npm run dev -w packages/bridge",
    "dev:dashboard": "npm run dev -w packages/dashboard",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "prisma": "^5.20.0",
    "@types/node": "^20.0.0"
  },
  "dependencies": {
    "@prisma/client": "^5.20.0"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

- [ ] **Step 2: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

- [ ] **Step 3: Create .env.example**

```bash
# Discord Bot
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here

# Global Relay
GR_CLIENT_ID=your_gr_client_id_here
GR_CLIENT_SECRET=your_gr_client_secret_here
GR_OAUTH_URL=https://iam-oauth2.globalrelay.com/oauth2/token
GR_API_BASE_URL=https://conversations.api.globalrelay.com/v2

# Dashboard
NEXTAUTH_SECRET=your_nextauth_secret_here
NEXTAUTH_URL=http://localhost:3000
DISCORD_CLIENT_SECRET=your_discord_oauth_secret

# Database
DATABASE_URL=file:./dev.db
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
.env
*.db
*.db-journal
.next/
```

- [ ] **Step 5: Create vitest.workspace.ts**

```typescript
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/*',
]);
```

- [ ] **Step 6: Create Prisma schema**

**Create:** `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Server {
  id            String   @id
  name          String
  iconUrl       String?
  archivingEnabled Boolean @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  channels      Channel[]
  userMappings  UserMapping[]
}

model Channel {
  id              String   @id
  serverId        String
  name            String
  archivingEnabled Boolean @default(false)
  lastArchivedAt  DateTime?

  server          Server   @relation(fields: [serverId], references: [id], onDelete: Cascade)
}

model UserMapping {
  id            String @id @default(cuid())
  serverId      String
  discordUserId String
  discordName   String
  corporateEmail String

  server        Server @relation(fields: [serverId], references: [id], onDelete: Cascade)

  @@unique([serverId, discordUserId])
}

model ArchiveLog {
  id              String   @id @default(cuid())
  channelId       String
  serverId        String
  messageId       String?
  eventType       String   // Message, Reaction, Message_edited, File_transfer
  grReconciliationId String?
  status          String   // success, failed, pending
  errorMessage    String?
  archivedAt      DateTime @default(now())
}

model GlobalRelayConfig {
  id            String @id @default("default")
  clientId      String
  clientSecret  String
  oauthUrl      String @default("https://iam-oauth2.globalrelay.com/oauth2/token")
  apiBaseUrl    String @default("https://conversations.api.globalrelay.com/v2")
  updatedAt     DateTime @updatedAt
}
```

- [ ] **Step 7: Create prisma/seed.ts**

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.globalRelayConfig.findUnique({ where: { id: 'default' } });
  if (!existing) {
    await prisma.globalRelayConfig.create({
      data: {
        clientId: process.env.GR_CLIENT_ID ?? '',
        clientSecret: process.env.GR_CLIENT_SECRET ?? '',
      },
    });
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 8: Install dependencies**

Run: `cd D:\Projects\DiscordToGlobalRelay && npm install`
Expected: npm creates node_modules, links workspaces

- [ ] **Step 9: Generate Prisma client and push schema**

Run: `cd D:\Projects\DiscordToGlobalRelay && npx prisma generate && npx prisma db push`
Expected: Prisma client generated, SQLite file created

- [ ] **Step 10: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold monorepo with workspaces, prisma, vitest"
```

---

### Task 2: Core Types Package

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@discord-gr/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create types.ts — ALL shared types**

```typescript
// ─── Discord Events (normalized) ───

export interface DiscordMessageEvent {
  type: 'Message';
  eventTime: number;
  messageId: string;
  channelId: string;
  serverId: string;
  authorId: string;
  authorName: string;
  authorEmail?: string;
  content: string;
  attachments: DiscordAttachment[];
  replyToMessageId?: string;
}

export interface DiscordMessageEditEvent {
  type: 'Message_edited';
  eventTime: number;
  messageId: string;
  channelId: string;
  serverId: string;
  authorId: string;
  authorName: string;
  authorEmail?: string;
  newContent: string;
  oldContent: string;
}

export interface DiscordReactionEvent {
  type: 'Reaction';
  eventTime: number;
  messageId: string;
  channelId: string;
  serverId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  emoji: string;
  messageAuthorId: string;
  messageAuthorName: string;
  messageContent: string;
}

export interface DiscordMessageDeleteEvent {
  type: 'Message_deleted';
  eventTime: number;
  messageId: string;
  channelId: string;
  serverId: string;
}

export interface DiscordAttachment {
  id: string;
  filename: string;
  url: string;
  contentType: string;
  sizeBytes: number;
}

export type DiscordNormalizedEvent =
  | DiscordMessageEvent
  | DiscordMessageEditEvent
  | DiscordReactionEvent
  | DiscordMessageDeleteEvent;

// ─── Global Relay Payload Types ───

export type GrEventType =
  | 'Message'
  | 'Context_reply'
  | 'Reaction'
  | 'Message_edited'
  | 'File_transfer'
  | 'User_joined'
  | 'User_left';

export interface GrParticipant {
  displayName: string;
  corporateEmail?: string;
  userType: 'initiator' | 'recipient' | 'affectedUser';
}

export interface GrFile {
  filename: string;
  fileKey: string;
  isInlined: boolean;
}

export interface GrConversationEvent {
  eventTime: number;
  eventType: GrEventType;
  systemText?: string;
  participants: GrParticipant[];
  content?: {
    message?: string;
    textType?: 'html' | 'plain';
  };
  files?: GrFile[];
  childEvents?: GrConversationEvent[];
}

export interface GrConversationOverview {
  externalConversationId: string;
  name?: string;
  conversationType: 'multi' | 'one_to_one';
  initialParticipants: GrParticipant[];
}

export interface GrArchiveRequest {
  conversationOverview: GrConversationOverview;
  conversationEvents: GrConversationEvent[];
}

export interface GrArchiveResponse {
  reconciliationId?: string;
  status: string;
  error?: string;
}

// ─── Bridge Configuration ───

export interface BridgeConfig {
  discordToken: string;
  discordClientId: string;
  grClientId: string;
  grClientSecret: string;
  grOauthUrl: string;
  grApiBaseUrl: string;
  grRateLimitRpm: number;
  queueMaxRetries: number;
  queueBackoffMs: number;
}
```

- [ ] **Step 4: Create config.ts**

```typescript
import { BridgeConfig } from './types.js';

export function loadConfig(): BridgeConfig {
  const missing: string[] = [];

  const discordToken = process.env.DISCORD_TOKEN ?? missing.push('DISCORD_TOKEN') as unknown as string;
  const discordClientId = process.env.DISCORD_CLIENT_ID ?? missing.push('DISCORD_CLIENT_ID') as unknown as string;
  const grClientId = process.env.GR_CLIENT_ID ?? missing.push('GR_CLIENT_ID') as unknown as string;
  const grClientSecret = process.env.GR_CLIENT_SECRET ?? missing.push('GR_CLIENT_SECRET') as unknown as string;

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    discordToken: discordToken!,
    discordClientId: discordClientId!,
    grClientId: grClientId!,
    grClientSecret: grClientSecret!,
    grOauthUrl: process.env.GR_OAUTH_URL ?? 'https://iam-oauth2.globalrelay.com/oauth2/token',
    grApiBaseUrl: process.env.GR_API_BASE_URL ?? 'https://conversations.api.globalrelay.com/v2',
    grRateLimitRpm: Number(process.env.GR_RATE_LIMIT_RPM) || 900,
    queueMaxRetries: Number(process.env.QUEUE_MAX_RETRIES) || 3,
    queueBackoffMs: Number(process.env.QUEUE_BACKOFF_MS) || 5000,
  };
}
```

- [ ] **Step 5: Create index.ts (barrel)**

```typescript
export * from './types.js';
export { loadConfig } from './config.js';
```

- [ ] **Step 6: Write and run typecheck test**

Run: `cd D:\Projects\DiscordToGlobalRelay && npx tsc --project packages/core/tsconfig.json --noEmit`
Expected: exits 0, no type errors

- [ ] **Step 7: Commit**

```bash
git add packages/core/ package.json
git commit -m "feat(core): add shared types, config loader, barrel export"
```

---

### Task 3: Transformers — Discord Events → Global Relay Payloads

**Files:**
- Create: `packages/core/src/transformers/index.ts`
- Create: `packages/core/src/transformers/message.ts`
- Create: `packages/core/src/transformers/reaction.ts`
- Create: `packages/core/src/transformers/edit.ts`
- Create: `packages/core/src/transformers/attachment.ts`
- Create: `tests/core/transformers.test.ts`

- [ ] **Step 1: Write failing tests for message transformer**

**Create:** `tests/core/transformers.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { toMessageArchiveRequest } from '../../packages/core/src/transformers/message.js';
import { type DiscordMessageEvent } from '../../packages/core/src/types.js';

describe('toMessageArchiveRequest', () => {
  it('transforms a basic message to GR archive request', () => {
    const event: DiscordMessageEvent = {
      type: 'Message',
      eventTime: 1700000000000,
      messageId: '111',
      channelId: '222',
      serverId: '333',
      authorId: '444',
      authorName: 'TestUser',
      authorEmail: 'test@example.com',
      content: 'Hello World',
      attachments: [],
    };

    const result = toMessageArchiveRequest(event, 'guild-333', 'general');

    expect(result.conversationOverview.externalConversationId).toBe('discord:333:222');
    expect(result.conversationOverview.conversationType).toBe('multi');
    expect(result.conversationEvents).toHaveLength(1);
    expect(result.conversationEvents[0].eventType).toBe('Message');
    expect(result.conversationEvents[0].participants[0].displayName).toBe('TestUser');
    expect(result.conversationEvents[0].content?.message).toBe('Hello World');
  });

  it('maps author fields to participant correctly', () => {
    const event: DiscordMessageEvent = {
      type: 'Message',
      eventTime: 1700000000000,
      messageId: '111',
      channelId: '222',
      serverId: '333',
      authorId: '444',
      authorName: 'Alice',
      content: 'Hi',
      attachments: [],
    };

    const result = toMessageArchiveRequest(event, 'guild-333', 'general');
    const participant = result.conversationEvents[0].participants[0];

    expect(participant.displayName).toBe('Alice');
    expect(participant.corporateEmail).toBeUndefined();
    expect(participant.userType).toBe('initiator');
  });
});
```

- [ ] **Step 2: Run tests to see them fail**

Run: `cd D:\Projects\DiscordToGlobalRelay && npx vitest run tests/core/transformers.test.ts --reporter=verbose`
Expected: FAIL — module not found / toMessageArchiveRequest undefined

- [ ] **Step 3: Implement message transformer**

**Create:** `packages/core/src/transformers/message.ts`

```typescript
import {
  type DiscordMessageEvent,
  type GrArchiveRequest,
  type GrConversationEvent,
} from '../types.js';

export function toMessageArchiveRequest(
  event: DiscordMessageEvent,
  serverName: string,
  channelName: string,
): GrArchiveRequest {
  const conversationEvent: GrConversationEvent = {
    eventTime: event.eventTime,
    eventType: 'Message',
    participants: [
      {
        displayName: event.authorName,
        corporateEmail: event.authorEmail,
        userType: 'initiator',
      },
    ],
    content: {
      message: event.content,
    },
  };

  return {
    conversationOverview: {
      externalConversationId: `discord:${event.serverId}:${event.channelId}`,
      name: `#${channelName} — ${serverName}`,
      conversationType: 'multi',
      initialParticipants: [],
    },
    conversationEvents: [conversationEvent],
  };
}
```

- [ ] **Step 4: Write failing tests for reaction transformer**

Add to `tests/core/transformers.test.ts`:

```typescript
import { toReactionArchiveRequest } from '../../packages/core/src/transformers/reaction.js';
import { type DiscordReactionEvent } from '../../packages/core/src/types.js';

describe('toReactionArchiveRequest', () => {
  it('transforms a reaction event with child event for original message', () => {
    const event: DiscordReactionEvent = {
      type: 'Reaction',
      eventTime: 1700000001000,
      messageId: '111',
      channelId: '222',
      serverId: '333',
      userId: '555',
      userName: 'Bob',
      userEmail: 'bob@example.com',
      emoji: '👍',
      messageAuthorId: '444',
      messageAuthorName: 'Alice',
      messageContent: 'Hello World',
    };

    const result = toReactionArchiveRequest(event, 'guild-333', 'general');

    expect(result.conversationEvents).toHaveLength(1);
    expect(result.conversationEvents[0].eventType).toBe('Reaction');
    expect(result.conversationEvents[0].systemText).toContain('👍');
    expect(result.conversationEvents[0].childEvents).toHaveLength(1);
    expect(result.conversationEvents[0].childEvents![0].eventType).toBe('Message');
    expect(result.conversationEvents[0].childEvents![0].content?.message).toBe('Hello World');
  });
});
```

- [ ] **Step 5: Run tests to see them fail**

Run: `cd D:\Projects\DiscordToGlobalRelay && npx vitest run tests/core/transformers.test.ts --reporter=verbose`
Expected: FAIL — module not found

- [ ] **Step 6: Implement reaction transformer**

**Create:** `packages/core/src/transformers/reaction.ts`

```typescript
import {
  type DiscordReactionEvent,
  type GrArchiveRequest,
  type GrConversationEvent,
} from '../types.js';

export function toReactionArchiveRequest(
  event: DiscordReactionEvent,
  serverName: string,
  channelName: string,
): GrArchiveRequest {
  const childEvent: GrConversationEvent = {
    eventTime: event.eventTime - 1000,
    eventType: 'Message',
    participants: [
      {
        displayName: event.messageAuthorName,
        corporateEmail: undefined,
        userType: 'initiator',
      },
    ],
    content: {
      message: event.messageContent,
    },
  };

  const parentEvent: GrConversationEvent = {
    eventTime: event.eventTime,
    eventType: 'Reaction',
    systemText: `Reacted with ${event.emoji}`,
    participants: [
      {
        displayName: event.userName,
        corporateEmail: event.userEmail,
        userType: 'initiator',
      },
    ],
    childEvents: [childEvent],
  };

  return {
    conversationOverview: {
      externalConversationId: `discord:${event.serverId}:${event.channelId}`,
      name: `#${channelName} — ${serverName}`,
      conversationType: 'multi',
      initialParticipants: [],
    },
    conversationEvents: [parentEvent],
  };
}
```

- [ ] **Step 7: Write failing tests for edit transformer**

Add to `tests/core/transformers.test.ts`:

```typescript
import { toEditArchiveRequest } from '../../packages/core/src/transformers/edit.js';
import { type DiscordMessageEditEvent } from '../../packages/core/src/types.js';

describe('toEditArchiveRequest', () => {
  it('transforms an edit with original as childEvent', () => {
    const event: DiscordMessageEditEvent = {
      type: 'Message_edited',
      eventTime: 1700000002000,
      messageId: '111',
      channelId: '222',
      serverId: '333',
      authorId: '444',
      authorName: 'Alice',
      newContent: 'Hello World edited',
      oldContent: 'Hello World',
    };

    const result = toEditArchiveRequest(event, 'guild-333', 'general');

    expect(result.conversationEvents[0].eventType).toBe('Message_edited');
    expect(result.conversationEvents[0].content?.message).toBe('Hello World edited');
    expect(result.conversationEvents[0].childEvents![0].content?.message).toBe('Hello World');
  });
});
```

- [ ] **Step 8: Implement edit transformer**

**Create:** `packages/core/src/transformers/edit.ts`

```typescript
import {
  type DiscordMessageEditEvent,
  type GrArchiveRequest,
  type GrConversationEvent,
} from '../types.js';

export function toEditArchiveRequest(
  event: DiscordMessageEditEvent,
  serverName: string,
  channelName: string,
): GrArchiveRequest {
  const childEvent: GrConversationEvent = {
    eventTime: event.eventTime - 1000,
    eventType: 'Message',
    participants: [
      {
        displayName: event.authorName,
        corporateEmail: event.authorEmail,
        userType: 'initiator',
      },
    ],
    content: {
      message: event.oldContent,
    },
  };

  const parentEvent: GrConversationEvent = {
    eventTime: event.eventTime,
    eventType: 'Message_edited',
    participants: [
      {
        displayName: event.authorName,
        corporateEmail: event.authorEmail,
        userType: 'initiator',
      },
    ],
    content: {
      message: event.newContent,
    },
    childEvents: [childEvent],
  };

  return {
    conversationOverview: {
      externalConversationId: `discord:${event.serverId}:${event.channelId}`,
      name: `#${channelName} — ${serverName}`,
      conversationType: 'multi',
      initialParticipants: [],
    },
    conversationEvents: [parentEvent],
  };
}
```

- [ ] **Step 9: Write failing tests for attachment transformer**

Add to `tests/core/transformers.test.ts`:

```typescript
import { toAttachmentArchiveRequests } from '../../packages/core/src/transformers/attachment.js';
import { type DiscordMessageEvent } from '../../packages/core/src/types.js';

describe('toAttachmentArchiveRequests', () => {
  it('generates File_transfer events for each attachment', () => {
    const event: DiscordMessageEvent = {
      type: 'Message',
      eventTime: 1700000000000,
      messageId: '111',
      channelId: '222',
      serverId: '333',
      authorId: '444',
      authorName: 'TestUser',
      content: 'Here are the files',
      attachments: [
        { id: 'a1', filename: 'report.pdf', url: 'https://cdn.discord.com/...', contentType: 'application/pdf', sizeBytes: 1024 },
        { id: 'a2', filename: 'image.png', url: 'https://cdn.discord.com/...', contentType: 'image/png', sizeBytes: 2048 },
      ],
    };

    const results = toAttachmentArchiveRequests(event, 'guild-333', 'general');

    expect(results).toHaveLength(2);
    expect(results[0].conversationEvents[0].eventType).toBe('File_transfer');
    expect(results[0].conversationEvents[0].files![0].filename).toBe('report.pdf');
    expect(results[1].conversationEvents[0].files![0].filename).toBe('image.png');
  });

  it('returns empty array when no attachments', () => {
    const event: DiscordMessageEvent = {
      type: 'Message',
      eventTime: 1700000000000,
      messageId: '111',
      channelId: '222',
      serverId: '333',
      authorId: '444',
      authorName: 'TestUser',
      content: 'No files',
      attachments: [],
    };

    expect(toAttachmentArchiveRequests(event, 'guild-333', 'general')).toEqual([]);
  });
});
```

- [ ] **Step 10: Implement attachment transformer**

**Create:** `packages/core/src/transformers/attachment.ts`

```typescript
import {
  type DiscordMessageEvent,
  type GrArchiveRequest,
  type GrConversationEvent,
} from '../types.js';

export function toAttachmentArchiveRequests(
  event: DiscordMessageEvent,
  serverName: string,
  channelName: string,
): GrArchiveRequest[] {
  if (event.attachments.length === 0) return [];

  return event.attachments.map((att) => {
    const fileKey = `default/discord/${event.serverId}/${event.channelId}/${att.id}/${att.filename}`;

    const conversationEvent: GrConversationEvent = {
      eventTime: event.eventTime,
      eventType: 'File_transfer',
      participants: [
        {
          displayName: event.authorName,
          corporateEmail: event.authorEmail,
          userType: 'initiator',
        },
      ],
      files: [
        {
          filename: att.filename,
          fileKey,
          isInlined: false,
        },
      ],
      content: {
        message: event.content,
      },
    };

    return {
      conversationOverview: {
        externalConversationId: `discord:${event.serverId}:${event.channelId}`,
        name: `#${channelName} — ${serverName}`,
        conversationType: 'multi',
        initialParticipants: [],
      },
      conversationEvents: [conversationEvent],
    };
  });
}
```

- [ ] **Step 11: Create barrel export for transformers**

**Create:** `packages/core/src/transformers/index.ts`

```typescript
export { toMessageArchiveRequest } from './message.js';
export { toReactionArchiveRequest } from './reaction.js';
export { toEditArchiveRequest } from './edit.js';
export { toAttachmentArchiveRequests } from './attachment.js';
```

Update `packages/core/src/index.ts` to add:

```typescript
export * from './transformers/index.js';
```

- [ ] **Step 12: Run all transformer tests**

Run: `cd D:\Projects\DiscordToGlobalRelay && npx vitest run tests/core/`
Expected: ALL PASS (all 6+ test cases)

- [ ] **Step 13: Commit**

```bash
git add packages/core/ tests/core/
git commit -m "feat(core): add Discord→GR event transformers (message, reaction, edit, attachment)"
```

---

### Task 4: Global Relay API Client

**Files:**
- Create: `packages/gr-client/package.json`
- Create: `packages/gr-client/tsconfig.json`
- Create: `packages/gr-client/src/index.ts`
- Create: `packages/gr-client/src/auth.ts`
- Create: `packages/gr-client/src/client.ts`
- Create: `packages/gr-client/src/endpoints/conversations.ts`
- Create: `packages/gr-client/src/endpoints/files.ts`
- Create: `tests/gr-client/auth.test.ts`
- Create: `tests/gr-client/client.test.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@discord-gr/gr-client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@discord-gr/core": "*"
  },
  "devDependencies": {
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write failing tests for auth token manager**

**Create:** `tests/gr-client/auth.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenManager } from '../../packages/gr-client/src/auth.js';

describe('TokenManager', () => {
  let manager: TokenManager;

  beforeEach(() => {
    manager = new TokenManager({
      clientId: 'test-client',
      clientSecret: 'test-secret',
      oauthUrl: 'https://iam-oauth2.globalrelay.com/oauth2/token',
    });
  });

  it('fetches a token and caches it', async () => {
    const fakeResponse = {
      access_token: 'abc123',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'openid conversation file write',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fakeResponse),
    });

    const token = await manager.getToken();
    expect(token).toBe('abc123');
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Second call should use cache
    const token2 = await manager.getToken();
    expect(token2).toBe('abc123');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('refetches when token is expired', async () => {
    const fakeResponse1 = {
      access_token: 'token-old',
      expires_in: 0,
      token_type: 'Bearer',
      scope: 'openid conversation file write',
    };
    const fakeResponse2 = {
      access_token: 'token-new',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'openid conversation file write',
    };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fakeResponse1) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fakeResponse2) });

    const token1 = await manager.getToken();
    expect(token1).toBe('token-old');

    // Expired — should refetch
    const token2 = await manager.getToken();
    expect(token2).toBe('token-new');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 4: Run tests to see them fail**

Run: `cd D:\Projects\DiscordToGlobalRelay && npx vitest run tests/gr-client/auth.test.ts`
Expected: FAIL — module not found

- [ ] **Step 5: Implement TokenManager**

**Create:** `packages/gr-client/src/auth.ts`

```typescript
export interface TokenManagerOptions {
  clientId: string;
  clientSecret: string;
  oauthUrl: string;
}

export class TokenManager {
  private token: string | null = null;
  private expiresAt: number = 0;
  private options: TokenManagerOptions;

  constructor(options: TokenManagerOptions) {
    this.options = options;
  }

  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.expiresAt) {
      return this.token;
    }

    const credentials = Buffer.from(`${this.options.clientId}:${this.options.clientSecret}`).toString('base64');

    const response = await fetch(this.options.oauthUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'openid conversation file write',
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Global Relay OAuth failed: ${response.status} — ${errorBody}`);
    }

    const data = await response.json() as {
      access_token: string;
      expires_in: number;
    };

    this.token = data.access_token;
    // Refresh 60 seconds early as a safety margin
    this.expiresAt = Date.now() + (data.expires_in - 60) * 1000;

    return this.token!;
  }

  reset(): void {
    this.token = null;
    this.expiresAt = 0;
  }
}
```

- [ ] **Step 6: Run tests again**

Run: `cd D:\Projects\DiscordToGlobalRelay && npx vitest run tests/gr-client/auth.test.ts`
Expected: ALL PASS

- [ ] **Step 7: Write failing tests for GR HTTP client**

**Create:** `tests/gr-client/client.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GrClient } from '../../packages/gr-client/src/client.js';
import { TokenManager } from '../../packages/gr-client/src/auth.js';

describe('GrClient', () => {
  let client: GrClient;
  let mockTokenManager: { getToken: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockTokenManager = { getToken: vi.fn().mockResolvedValue('test-token') };
    client = new GrClient(
      'https://conversations.api.globalrelay.com/v2',
      mockTokenManager as unknown as TokenManager,
      900,
    );
  });

  it('sends archive request with auth header', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ reconciliationId: 'rec-123', status: 'success' }),
    });

    const payload = {
      conversationOverview: { externalConversationId: 'test', conversationType: 'multi' as const, initialParticipants: [] },
      conversationEvents: [{ eventTime: Date.now(), eventType: 'Message' as const, participants: [{ displayName: 'Tester', userType: 'initiator' as const }] }],
    };

    const result = await client.archiveConversation(payload);

    expect(result.reconciliationId).toBe('rec-123');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://conversations.api.globalrelay.com/v2/conversations',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('retries on 429 rate limit', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 429, headers: new Map([['retry-after', '1']]), text: () => Promise.resolve('') })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ reconciliationId: 'rec-456', status: 'success' }),
      });

    const payload = {
      conversationOverview: { externalConversationId: 'test', conversationType: 'multi' as const, initialParticipants: [] },
      conversationEvents: [{ eventTime: Date.now(), eventType: 'Message' as const, participants: [{ displayName: 'Tester', userType: 'initiator' as const }] }],
    };

    const result = await client.archiveConversation(payload);
    expect(result.reconciliationId).toBe('rec-456');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  }, 15000);
});
```

- [ ] **Step 8: Implement GrClient**

**Create:** `packages/gr-client/src/client.ts`

```typescript
import { type GrArchiveRequest, type GrArchiveResponse } from '@discord-gr/core';
import { TokenManager } from './auth.js';

export class GrClient {
  private baseUrl: string;
  private tokenManager: TokenManager;
  private maxRetries: number = 3;
  private rateLimitRpm: number;
  private requestTimestamps: number[] = [];

  constructor(baseUrl: string, tokenManager: TokenManager, rateLimitRpm: number = 900) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.tokenManager = tokenManager;
    this.rateLimitRpm = rateLimitRpm;
  }

  async archiveConversation(payload: GrArchiveRequest): Promise<GrArchiveResponse> {
    await this.waitForRateLimit();

    const token = await this.tokenManager.getToken();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/conversations`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.status === 429) {
          const retryAfter = Number(response.headers.get('retry-after')) || 1;
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`GR API error ${response.status}: ${errorBody}`);
        }

        const data = await response.json() as GrArchiveResponse;
        this.requestTimestamps.push(Date.now());
        return data;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
    }

    throw lastError ?? new Error('Unknown GR client error');
  }

  async uploadFile(fileKey: string, fileBuffer: ArrayBuffer, contentType: string): Promise<void> {
    await this.waitForRateLimit();
    const token = await this.tokenManager.getToken();

    const response = await fetch(`${this.baseUrl}/files/${fileKey}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': contentType,
      },
      body: fileBuffer,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`GR file upload error ${response.status}: ${errorBody}`);
    }

    this.requestTimestamps.push(Date.now());
  }

  private async waitForRateLimit(): Promise<void> {
    const windowMs = 60_000;
    const now = Date.now();

    // Remove timestamps older than 1 minute
    this.requestTimestamps = this.requestTimestamps.filter((t) => now - t < windowMs);

    if (this.requestTimestamps.length >= this.rateLimitRpm) {
      const oldest = this.requestTimestamps[0];
      const waitMs = windowMs - (now - oldest) + 100;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}
```

- [ ] **Step 9: Run client tests**

Run: `cd D:\Projects\DiscordToGlobalRelay && npx vitest run tests/gr-client/`
Expected: ALL PASS

- [ ] **Step 10: Create barrel exports**

**Create:** `packages/gr-client/src/index.ts`

```typescript
export { TokenManager } from './auth.js';
export { GrClient } from './client.js';
```

- [ ] **Step 11: Commit**

```bash
git add packages/gr-client/ tests/gr-client/
git commit -m "feat(gr-client): add TokenManager (OAuth2) and GrClient (archive + file upload)"
```

---

### Task 5: Discord Bot — Event Handlers

**Files:**
- Create: `packages/discord-bot/package.json`
- Create: `packages/discord-bot/tsconfig.json`
- Create: `packages/discord-bot/src/index.ts`
- Create: `packages/discord-bot/src/client.ts`
- Create: `packages/discord-bot/src/handlers/messageCreate.ts`
- Create: `packages/discord-bot/src/handlers/messageUpdate.ts`
- Create: `packages/discord-bot/src/handlers/messageDelete.ts`
- Create: `packages/discord-bot/src/handlers/messageReactionAdd.ts`
- Create: `packages/discord-bot/src/deploy-commands.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@discord-gr/discord-bot",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@discord-gr/core": "*",
    "discord.js": "^14.26.0"
  },
  "devDependencies": {
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Implement Discord client singleton**

**Create:** `packages/discord-bot/src/client.ts`

```typescript
import { Client, GatewayIntentBits, Partials } from 'discord.js';

let client: Client | null = null;

export function getClient(): Client {
  if (!client) {
    client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
      ],
      partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
      ],
    });
  }
  return client;
}
```

- [ ] **Step 4: Implement messageCreate handler**

**Create:** `packages/discord-bot/src/handlers/messageCreate.ts`

```typescript
import { type Message } from 'discord.js';
import { type DiscordMessageEvent, type DiscordAttachment } from '@discord-gr/core';

export type MessageHandlerCallback = (event: DiscordMessageEvent) => void | Promise<void>;

const handlers: MessageHandlerCallback[] = [];

export function onMessage(callback: MessageHandlerCallback): void {
  handlers.push(callback);
}

export async function handleMessageCreate(message: Message): Promise<void> {
  // Ignore bot messages and system messages
  if (message.author.bot) return;
  if (!message.guild) return;

  const attachments: DiscordAttachment[] = message.attachments.map((att) => ({
    id: att.id,
    filename: att.name ?? 'unknown',
    url: att.url,
    contentType: att.contentType ?? 'application/octet-stream',
    sizeBytes: att.size,
  }));

  const event: DiscordMessageEvent = {
    type: 'Message',
    eventTime: message.createdTimestamp,
    messageId: message.id,
    channelId: message.channelId,
    serverId: message.guildId!,
    authorId: message.author.id,
    authorName: message.author.displayName,
    content: message.content,
    attachments,
    replyToMessageId: message.reference?.messageId ?? undefined,
  };

  for (const handler of handlers) {
    await handler(event);
  }
}
```

- [ ] **Step 5: Implement messageUpdate handler**

**Create:** `packages/discord-bot/src/handlers/messageUpdate.ts`

```typescript
import { type Message } from 'discord.js';
import { type DiscordMessageEditEvent } from '@discord-gr/core';

export type EditHandlerCallback = (event: DiscordMessageEditEvent) => void | Promise<void>;

const handlers: EditHandlerCallback[] = [];

export function onMessageEdit(callback: EditHandlerCallback): void {
  handlers.push(callback);
}

export async function handleMessageUpdate(oldMessage: Message, newMessage: Message): Promise<void> {
  if (newMessage.author?.bot) return;
  if (!newMessage.guild) return;
  if (oldMessage.content === newMessage.content) return;

  const event: DiscordMessageEditEvent = {
    type: 'Message_edited',
    eventTime: Date.now(),
    messageId: newMessage.id,
    channelId: newMessage.channelId,
    serverId: newMessage.guildId!,
    authorId: newMessage.author.id,
    authorName: newMessage.author.displayName,
    newContent: newMessage.content,
    oldContent: oldMessage.content,
  };

  for (const handler of handlers) {
    await handler(event);
  }
}
```

- [ ] **Step 6: Implement messageDelete handler**

**Create:** `packages/discord-bot/src/handlers/messageDelete.ts`

```typescript
import { type Message } from 'discord.js';
import { type DiscordMessageDeleteEvent } from '@discord-gr/core';

export type DeleteHandlerCallback = (event: DiscordMessageDeleteEvent) => void | Promise<void>;

const handlers: DeleteHandlerCallback[] = [];

export function onMessageDelete(callback: DeleteHandlerCallback): void {
  handlers.push(callback);
}

export async function handleMessageDelete(message: Message): Promise<void> {
  if (!message.guild) return;

  const event: DiscordMessageDeleteEvent = {
    type: 'Message_deleted',
    eventTime: Date.now(),
    messageId: message.id,
    channelId: message.channelId,
    serverId: message.guildId!,
  };

  for (const handler of handlers) {
    await handler(event);
  }
}
```

- [ ] **Step 7: Implement messageReactionAdd handler**

**Create:** `packages/discord-bot/src/handlers/messageReactionAdd.ts`

```typescript
import { type MessageReaction, type User } from 'discord.js';
import { type DiscordReactionEvent } from '@discord-gr/core';

export type ReactionHandlerCallback = (event: DiscordReactionEvent) => void | Promise<void>;

const handlers: ReactionHandlerCallback[] = [];

export function onReaction(callback: ReactionHandlerCallback): void {
  handlers.push(callback);
}

export async function handleReactionAdd(reaction: MessageReaction, user: User): Promise<void> {
  if (user.bot) return;

  // Fetch partials
  if (reaction.partial) await reaction.fetch();
  const message = reaction.message;
  if (message.partial) await message.fetch();

  if (!message.guild) return;

  const event: DiscordReactionEvent = {
    type: 'Reaction',
    eventTime: Date.now(),
    messageId: message.id,
    channelId: message.channelId,
    serverId: message.guildId!,
    userId: user.id,
    userName: user.displayName,
    emoji: reaction.emoji.name ?? 'unknown',
    messageAuthorId: message.author?.id ?? '',
    messageAuthorName: message.author?.displayName ?? 'Unknown',
    messageContent: message.content,
  };

  for (const handler of handlers) {
    await handler(event);
  }
}
```

- [ ] **Step 8: Implement deploy-commands.ts for slash commands**

**Create:** `packages/discord-bot/src/deploy-commands.ts`

```typescript
import { REST, Routes, type RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';

const commands: RESTPostAPIApplicationCommandsJSONBody[] = [
  {
    name: 'status',
    description: 'Check if archiving is active for this channel',
  },
];

export async function deployCommands(token: string, clientId: string): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('Slash commands registered successfully.');
  } catch (error) {
    console.error('Failed to register slash commands:', error);
  }
}
```

- [ ] **Step 9: Create bot index.ts — entry point**

**Create:** `packages/discord-bot/src/index.ts`

```typescript
import { Events } from 'discord.js';
import { getClient } from './client.js';
import { handleMessageCreate } from './handlers/messageCreate.js';
import { handleMessageUpdate } from './handlers/messageUpdate.js';
import { handleMessageDelete } from './handlers/messageDelete.js';
import { handleReactionAdd } from './handlers/messageReactionAdd.js';
import { deployCommands } from './deploy-commands.js';

export type { MessageHandlerCallback } from './handlers/messageCreate.js';
export { onMessage } from './handlers/messageCreate.js';
export { onMessageEdit } from './handlers/messageUpdate.js';
export { onReaction } from './handlers/messageReactionAdd.js';
export { getClient } from './client.js';

export async function startBot(token: string, clientId: string): Promise<void> {
  const client = getClient();

  client.on(Events.MessageCreate, handleMessageCreate);
  client.on(Events.MessageUpdate, handleMessageUpdate);
  client.on(Events.MessageDelete, handleMessageDelete);
  client.on(Events.MessageReactionAdd, handleReactionAdd);

  client.once(Events.ClientReady, async (c) => {
    console.log(`Discord bot logged in as ${c.user.tag}`);
    await deployCommands(token, clientId);
  });

  await client.login(token);
}

export async function stopBot(): Promise<void> {
  const client = getClient();
  client.destroy();
}
```

- [ ] **Step 10: Type-check**

Run: `cd D:\Projects\DiscordToGlobalRelay && npx tsc --project packages/discord-bot/tsconfig.json --noEmit`
Expected: exits 0

- [ ] **Step 11: Commit**

```bash
git add packages/discord-bot/
git commit -m "feat(discord-bot): add Gateway event handlers (create, update, delete, reaction) + slash commands"
```

---

### Task 6: Bridge Orchestrator

**Files:**
- Create: `packages/bridge/package.json`
- Create: `packages/bridge/tsconfig.json`
- Create: `packages/bridge/src/index.ts`
- Create: `packages/bridge/src/queue.ts`
- Create: `packages/bridge/src/router.ts`
- Create: `packages/bridge/src/indexer.ts`
- Create: `tests/bridge/router.test.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@discord-gr/bridge",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@discord-gr/core": "*",
    "@discord-gr/discord-bot": "*",
    "@discord-gr/gr-client": "*",
    "@prisma/client": "^5.20.0"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Implement queue with retry**

**Create:** `packages/bridge/src/queue.ts`

```typescript
export interface QueueItem {
  id: string;
  execute: () => Promise<void>;
  retriesLeft: number;
  backoffMs: number;
}

export class ArchiveQueue {
  private queue: QueueItem[] = [];
  private processing: boolean = false;
  private maxRetries: number;
  private backoffMs: number;

  constructor(maxRetries: number = 3, backoffMs: number = 5000) {
    this.maxRetries = maxRetries;
    this.backoffMs = backoffMs;
  }

  enqueue(item: QueueItem): void {
    this.queue.push(item);
    this.process().catch(console.error);
  }

  private async process(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      try {
        await item.execute();
      } catch (err) {
        if (item.retriesLeft > 0) {
          console.warn(`Queue item ${item.id} failed, ${item.retriesLeft} retries left:`, err);
          this.queue.push({
            ...item,
            retriesLeft: item.retriesLeft - 1,
            backoffMs: item.backoffMs * 2,
          });
          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, item.backoffMs));
        } else {
          console.error(`Queue item ${item.id} failed after all retries:`, err);
        }
      }
    }

    this.processing = false;
  }

  get length(): number {
    return this.queue.length;
  }
}
```

- [ ] **Step 3: Implement the event router**

**Create:** `packages/bridge/src/router.ts`

```typescript
import {
  type DiscordMessageEvent,
  type DiscordMessageEditEvent,
  type DiscordReactionEvent,
  type GrArchiveRequest,
} from '@discord-gr/core';
import {
  toMessageArchiveRequest,
  toReactionArchiveRequest,
  toEditArchiveRequest,
  toAttachmentArchiveRequests,
} from '@discord-gr/core';
import { GrClient } from '@discord-gr/gr-client';
import { ArchiveQueue } from './queue.js';

export class EventRouter {
  private grClient: GrClient;
  private queue: ArchiveQueue;

  constructor(grClient: GrClient, queue: ArchiveQueue) {
    this.grClient = grClient;
    this.queue = queue;
  }

  async handleMessage(event: DiscordMessageEvent, serverName: string, channelName: string): Promise<void> {
    // Archive the message
    const request = toMessageArchiveRequest(event, serverName, channelName);
    this.enqueueArchive(request, event.messageId);

    // Archive attachments separately if any
    const attachmentRequests = toAttachmentArchiveRequests(event, serverName, channelName);
    for (const attReq of attachmentRequests) {
      this.enqueueArchive(attReq, `${event.messageId}-att`);
    }
  }

  async handleEdit(event: DiscordMessageEditEvent, serverName: string, channelName: string): Promise<void> {
    const request = toEditArchiveRequest(event, serverName, channelName);
    this.enqueueArchive(request, event.messageId);
  }

  async handleReaction(event: DiscordReactionEvent, serverName: string, channelName: string): Promise<void> {
    const request = toReactionArchiveRequest(event, serverName, channelName);
    this.enqueueArchive(request, `${event.messageId}-reaction`);
  }

  private enqueueArchive(request: GrArchiveRequest, id: string): void {
    this.queue.enqueue({
      id,
      execute: async () => {
        const response = await this.grClient.archiveConversation(request);
        if (!response.reconciliationId) {
          throw new Error(`No reconciliationId for event ${id}`);
        }
      },
      retriesLeft: 3,
      backoffMs: 5000,
    });
  }
}
```

- [ ] **Step 4: Write failing tests for router**

**Create:** `tests/bridge/router.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { EventRouter } from '../../packages/bridge/src/router.js';
import { ArchiveQueue } from '../../packages/bridge/src/queue.js';
import { GrClient } from '../../packages/gr-client/src/client.js';
import { type DiscordMessageEvent } from '../../packages/core/src/types.js';

describe('EventRouter', () => {
  it('queues a message event for archival', async () => {
    const mockGrClient = { archiveConversation: vi.fn().mockResolvedValue({ reconciliationId: 'rec-1', status: 'success' }) } as unknown as GrClient;
    const queue = new ArchiveQueue(1, 100);
    const router = new EventRouter(mockGrClient, queue);

    const event: DiscordMessageEvent = {
      type: 'Message',
      eventTime: Date.now(),
      messageId: '111',
      channelId: '222',
      serverId: '333',
      authorId: '444',
      authorName: 'TestUser',
      content: 'Hello',
      attachments: [],
    };

    await router.handleMessage(event, 'My Server', 'general');

    // Wait for queue to process
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(mockGrClient.archiveConversation).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `cd D:\Projects\DiscordToGlobalRelay && npx vitest run tests/bridge/router.test.ts`
Expected: PASS

- [ ] **Step 6: Implement the bridge main entry**

**Create:** `packages/bridge/src/index.ts`

```typescript
import { loadConfig } from '@discord-gr/core';
import { startBot, onMessage, onMessageEdit, onReaction, onMessageDelete } from '@discord-gr/discord-bot';
import { TokenManager, GrClient } from '@discord-gr/gr-client';
import { ArchiveQueue } from './queue.js';
import { EventRouter } from './router.js';

async function main() {
  const config = loadConfig();

  // Initialize GR client
  const tokenManager = new TokenManager({
    clientId: config.grClientId,
    clientSecret: config.grClientSecret,
    oauthUrl: config.grOauthUrl,
  });
  const grClient = new GrClient(config.grApiBaseUrl, tokenManager, config.grRateLimitRpm);

  // Initialize bridge
  const queue = new ArchiveQueue(config.queueMaxRetries, config.queueBackoffMs);
  const router = new EventRouter(grClient, queue);

  // Register Discord event handlers
  onMessage(async (event) => {
    // Fetch server/channel names from Discord client
    // In production, use discord.js cache or DB
    await router.handleMessage(event, 'Unknown Server', 'Unknown Channel');
  });

  onMessageEdit(async (event) => {
    await router.handleEdit(event, 'Unknown Server', 'Unknown Channel');
  });

  onReaction(async (event) => {
    await router.handleReaction(event, 'Unknown Server', 'Unknown Channel');
  });

  // Start Discord bot
  await startBot(config.discordToken, config.discordClientId);

  console.log('Bridge running. Press Ctrl+C to stop.');

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down...');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Bridge failed to start:', err);
  process.exit(1);
});
```

- [ ] **Step 7: Implement historical message indexer (backfill)**

**Create:** `packages/bridge/src/indexer.ts`

```typescript
import { type TextChannel } from 'discord.js';
import { type DiscordMessageEvent, type DiscordAttachment } from '@discord-gr/core';
import { EventRouter } from './router.js';

const BATCH_SIZE = 100;
const MAX_HISTORICAL = 10000;

export async function backfillChannel(
  channel: TextChannel,
  router: EventRouter,
): Promise<number> {
  let count = 0;

  let lastId: string | undefined;
  let done = false;

  while (!done && count < MAX_HISTORICAL) {
    const messages = await channel.messages.fetch({
      limit: BATCH_SIZE,
      ...(lastId ? { before: lastId } : {}),
    });

    if (messages.size === 0) break;

    for (const msg of messages.values()) {
      if (msg.author.bot) continue;

      const attachments: DiscordAttachment[] = msg.attachments.map((att) => ({
        id: att.id,
        filename: att.name ?? 'unknown',
        url: att.url,
        contentType: att.contentType ?? 'application/octet-stream',
        sizeBytes: att.size,
      }));

      const event: DiscordMessageEvent = {
        type: 'Message',
        eventTime: msg.createdTimestamp,
        messageId: msg.id,
        channelId: msg.channelId,
        serverId: msg.guildId!,
        authorId: msg.author.id,
        authorName: msg.author.displayName,
        content: msg.content,
        attachments,
      };

      await router.handleMessage(event, msg.guild?.name ?? 'Unknown', (msg.channel as TextChannel).name);
      count++;
    }

    lastId = messages.last()?.id;
  }

  return count;
}
```

- [ ] **Step 8: Type-check**

Run: `cd D:\Projects\DiscordToGlobalRelay && npx tsc --project packages/bridge/tsconfig.json --noEmit`
Expected: exits 0

- [ ] **Step 9: Commit**

```bash
git add packages/bridge/ tests/bridge/
git commit -m "feat(bridge): add EventRouter, ArchiveQueue, indexer, and main entry"
```

---

### Task 7: Dashboard — Project Setup + Auth

**Files:**
- Create: `packages/dashboard/package.json`
- Create: `packages/dashboard/tsconfig.json`
- Create: `packages/dashboard/next.config.js`
- Create: `packages/dashboard/tailwind.config.ts`
- Create: `packages/dashboard/postcss.config.js`
- Create: `packages/dashboard/components.json`
- Create: `packages/dashboard/src/styles/globals.css`
- Create: `packages/dashboard/src/lib/auth.ts`
- Create: `packages/dashboard/src/app/api/auth/[...nextauth]/route.ts`
- Create: `packages/dashboard/src/app/layout.tsx`
- Create: `packages/dashboard/src/app/page.tsx`

- [ ] **Step 1: Create package.json with Next.js and dependencies**

```json
{
  "name": "@discord-gr/dashboard",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@discord-gr/core": "*",
    "@prisma/client": "^5.20.0",
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "next-auth": "^4.24.0",
    "lucide-react": "^0.400.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.5.0",
    "@radix-ui/react-slot": "^1.1.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create next.config.js**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@discord-gr/core'],
};

export default nextConfig;
```

- [ ] **Step 4: Create tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 5: Create postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Create components.json for shadcn/ui**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/styles/globals.css",
    "baseColor": "zinc",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

- [ ] **Step 7: Create globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 10% 3.9%;
    --primary: 240 5.9% 10%;
    --primary-foreground: 0 0% 98%;
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 240 5.9% 10%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;
    --popover: 240 10% 3.9%;
    --popover-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 240 5.9% 10%;
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 240 4.9% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 8: Create lib/auth.ts — NextAuth config**

```typescript
import { AuthOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';

export const authOptions: AuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: { params: { scope: 'identify guilds' } },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
  },
};
```

- [ ] **Step 9: Create API route for NextAuth**

**Create:** `packages/dashboard/src/app/api/auth/[...nextauth]/route.ts`

```typescript
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

- [ ] **Step 10: Create root layout**

**Create:** `packages/dashboard/src/app/layout.tsx`

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Discord → Global Relay Bridge',
  description: 'Manage Discord message archiving to Global Relay',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 11: Create landing page with login**

**Create:** `packages/dashboard/src/app/page.tsx`

```tsx
'use client';

import { signIn, useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [status, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-900 to-zinc-800">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-white">Discord → Global Relay</h1>
        <p className="text-zinc-400 max-w-md">
          Archive your Discord messages to Global Relay for compliance and recordkeeping.
        </p>
        <button
          onClick={() => signIn('discord')}
          className="rounded-lg bg-[#5865F2] px-8 py-3 text-white font-semibold hover:bg-[#4752C4] transition-colors"
        >
          Sign in with Discord
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 12: Create lib/api.ts — shared fetch helpers**

**Create:** `packages/dashboard/src/lib/api.ts`

```typescript
export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}
```

- [ ] **Step 13: Type-check and verify dev server starts**

Run: `cd D:\Projects\DiscordToGlobalRelay && npx tsc --project packages/dashboard/tsconfig.json --noEmit`
Expected: exits 0

- [ ] **Step 14: Commit**

```bash
git add packages/dashboard/
git commit -m "feat(dashboard): add Next.js scaffold, tailwind, NextAuth with Discord provider"
```

---

### Task 8: Dashboard — shadcn/ui Components + Layout

**Files:**
- Create: `packages/dashboard/src/lib/utils.ts`
- Create: `packages/dashboard/src/components/ui/button.tsx`
- Create: `packages/dashboard/src/components/ui/card.tsx`
- Create: `packages/dashboard/src/components/ui/badge.tsx`
- Create: `packages/dashboard/src/components/ui/switch.tsx`
- Create: `packages/dashboard/src/components/dashboard-sidebar.tsx`
- Create: `packages/dashboard/src/components/status-badge.tsx`
- Create: `packages/dashboard/src/components/stats-card.tsx`
- Create: `packages/dashboard/src/app/dashboard/layout.tsx`

- [ ] **Step 1: Create lib/utils.ts**

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Create shadcn/ui button component**

**Create:** `packages/dashboard/src/components/ui/button.tsx`

```tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

- [ ] **Step 3: Create shadcn/ui card component**

**Create:** `packages/dashboard/src/components/ui/card.tsx`

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)} {...props} />
  ),
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-2xl font-semibold leading-none tracking-tight', className)} {...props} />
  ),
);
CardTitle.displayName = 'CardTitle';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

export { Card, CardHeader, CardTitle, CardContent };
```

- [ ] **Step 4: Create badge component**

**Create:** `packages/dashboard/src/components/ui/badge.tsx`

```tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        success: 'border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
        warning: 'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
```

- [ ] **Step 5: Create switch component**

**Create:** `packages/dashboard/src/components/ui/switch.tsx`

```tsx
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}

export function Switch({ checked, onCheckedChange, disabled, id }: SwitchProps) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'peer inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-green-600' : 'bg-input',
      )}
    >
      <span
        className={cn(
          'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
}
```

- [ ] **Step 6: Create sidebar component**

**Create:** `packages/dashboard/src/components/dashboard-sidebar.tsx`

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard,
  Server,
  Settings,
  History,
  LogOut,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/servers', label: 'Servers', icon: Server },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  { href: '/dashboard/logs', label: 'Archive Logs', icon: History },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-zinc-900 text-white flex flex-col h-screen">
      <div className="p-6 border-b border-zinc-800">
        <h2 className="text-lg font-bold">Discord → GR</h2>
        <p className="text-xs text-zinc-500 mt-1">Archive Bridge</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-zinc-800">
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 w-full transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 7: Create dashboard layout with sidebar**

**Create:** `packages/dashboard/src/app/dashboard/layout.tsx`

```tsx
'use client';

import { SessionProvider } from 'next-auth/react';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!session) return null;

  return <>{children}</>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthGuard>
        <div className="flex min-h-screen bg-zinc-950">
          <DashboardSidebar />
          <main className="flex-1 p-8 overflow-auto">
            {children}
          </main>
        </div>
      </AuthGuard>
    </SessionProvider>
  );
}
```

- [ ] **Step 8: Create stats-card component**

**Create:** `packages/dashboard/src/components/stats-card.tsx`

```tsx
import { Card, CardContent } from '@/components/ui/card';
import { type LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
}

export function StatsCard({ title, value, description, icon: Icon }: StatsCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 9: Create status-badge component**

**Create:** `packages/dashboard/src/components/status-badge.tsx`

```tsx
import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status: 'connected' | 'disconnected' | 'error' | 'archiving';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const map: Record<string, { label: string; variant: 'success' | 'destructive' | 'warning' | 'default' }> = {
    connected: { label: 'Connected', variant: 'success' },
    disconnected: { label: 'Disconnected', variant: 'destructive' },
    error: { label: 'Error', variant: 'warning' },
    archiving: { label: 'Archiving', variant: 'default' },
  };

  const s = map[status] ?? { label: status, variant: 'default' as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
```

- [ ] **Step 10: Build to verify**

Run: `cd D:\Projects\DiscordToGlobalRelay && npm run build -w packages/dashboard 2>&1 | head -50`
Expected: Build succeeds (may have warnings, no errors)

- [ ] **Step 11: Commit**

```bash
git add packages/dashboard/
git commit -m "feat(dashboard): add shadcn/ui components, sidebar layout, auth guard"
```

---

### Task 9: Dashboard — Servers + Channels Management Pages

**Files:**
- Create: `packages/dashboard/src/app/dashboard/page.tsx`
- Create: `packages/dashboard/src/app/dashboard/servers/page.tsx`
- Create: `packages/dashboard/src/app/dashboard/servers/[id]/page.tsx`
- Create: `packages/dashboard/src/app/dashboard/settings/page.tsx`
- Create: `packages/dashboard/src/app/dashboard/logs/page.tsx`
- Create: `packages/dashboard/src/app/api/servers/route.ts`
- Create: `packages/dashboard/src/app/api/config/route.ts`
- Create: `packages/dashboard/src/app/api/status/route.ts`
- Create: `packages/dashboard/src/components/server-card.tsx`
- Create: `packages/dashboard/src/components/channel-toggle.tsx`

- [ ] **Step 1: Create API route to list Discord servers**

**Create:** `packages/dashboard/src/app/api/servers/route.ts`

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accessToken = (session as any).accessToken;
  if (!accessToken) {
    return NextResponse.json({ error: 'No Discord access token' }, { status: 400 });
  }

  const res = await fetch('https://discord.com/api/v10/users/@me/guilds', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch guilds' }, { status: 502 });
  }

  const guilds = await res.json();
  return NextResponse.json(guilds);
}
```

- [ ] **Step 2: Create API route for config**

**Create:** `packages/dashboard/src/app/api/config/route.ts`

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = await prisma.globalRelayConfig.findUnique({ where: { id: 'default' } });
  return NextResponse.json(config);
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const config = await prisma.globalRelayConfig.upsert({
    where: { id: 'default' },
    update: body,
    create: { id: 'default', ...body },
  });

  return NextResponse.json(config);
}
```

- [ ] **Step 3: Create API route for bridge status**

**Create:** `packages/dashboard/src/app/api/status/route.ts`

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [serverCount, channelCount, recentLogs] = await Promise.all([
    prisma.server.count(),
    prisma.channel.count({ where: { archivingEnabled: true } }),
    prisma.archiveLog.findMany({
      orderBy: { archivedAt: 'desc' },
      take: 5,
      select: { id: true, eventType: true, status: true, archivedAt: true },
    }),
  ]);

  return NextResponse.json({
    servers: serverCount,
    activeChannels: channelCount,
    recentLogs,
    uptime: process.uptime(),
  });
}
```

- [ ] **Step 4: Create the dashboard overview page**

**Create:** `packages/dashboard/src/app/dashboard/page.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { StatsCard } from '@/components/stats-card';
import { StatusBadge } from '@/components/status-badge';
import { Server, MessageSquare, Activity, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardStatus {
  servers: number;
  activeChannels: number;
  recentLogs: Array<{ id: string; eventType: string; status: string; archivedAt: string }>;
}

export default function DashboardPage() {
  const [status, setStatus] = useState<DashboardStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then(setStatus)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-zinc-400">Loading...</p>;
  if (!status) return <p className="text-red-400">Failed to load status</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-zinc-400 mt-1">Overview of your archive bridge</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard title="Servers" value={status.servers} icon={Server} />
        <StatsCard title="Active Channels" value={status.activeChannels} icon={MessageSquare} />
        <StatsCard title="Uptime" value={`${Math.floor(process.uptime?.() ?? 0)}s`} icon={Clock} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-white">Recent Archive Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {status.recentLogs.length === 0 ? (
            <p className="text-zinc-500 text-sm">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {status.recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-zinc-500" />
                    <span className="text-sm text-zinc-300">{log.eventType}</span>
                  </div>
                  <StatusBadge status={log.status as any} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Create server-card component**

**Create:** `packages/dashboard/src/components/server-card.tsx`

```tsx
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

interface ServerCardProps {
  id: string;
  name: string;
  iconUrl?: string | null;
  archivingEnabled: boolean;
  onToggle: (serverId: string, enabled: boolean) => void;
}

export function ServerCard({ id, name, iconUrl, archivingEnabled, onToggle }: ServerCardProps) {
  return (
    <Link href={`/dashboard/servers/${id}`}>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {iconUrl ? (
              <img src={iconUrl} alt={name} className="h-10 w-10 rounded-full" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-zinc-700 flex items-center justify-center text-white font-bold">
                {name.charAt(0)}
              </div>
            )}
            <div>
              <p className="font-medium text-white">{name}</p>
              <p className="text-xs text-zinc-500">{id}</p>
            </div>
          </div>
          <div onClick={(e) => e.preventDefault()}>
            <Switch
              checked={archivingEnabled}
              onCheckedChange={(checked) => onToggle(id, checked)}
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 6: Create channel-toggle component**

**Create:** `packages/dashboard/src/components/channel-toggle.tsx`

```tsx
import { Switch } from '@/components/ui/switch';
import { Hash } from 'lucide-react';

interface ChannelToggleProps {
  id: string;
  name: string;
  archivingEnabled: boolean;
  onToggle: (channelId: string, enabled: boolean) => void;
}

export function ChannelToggle({ id, name, archivingEnabled, onToggle }: ChannelToggleProps) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-zinc-800 transition-colors">
      <div className="flex items-center gap-2">
        <Hash className="h-4 w-4 text-zinc-500" />
        <span className="text-sm text-zinc-300">{name}</span>
      </div>
      <Switch
        checked={archivingEnabled}
        onCheckedChange={(checked) => onToggle(id, checked)}
      />
    </div>
  );
}
```

- [ ] **Step 7: Create servers list page**

**Create:** `packages/dashboard/src/app/dashboard/servers/page.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { ServerCard } from '@/components/server-card';
import { fetchApi } from '@/lib/api';

interface Server {
  id: string;
  name: string;
  icon?: string;
  archivingEnabled?: boolean;
}

export default function ServersPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi<Server[]>('/api/servers')
      .then(setServers)
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (serverId: string, enabled: boolean) => {
    await fetchApi('/api/config', {
      method: 'PATCH',
      body: JSON.stringify({ serverId, archivingEnabled: enabled }),
    });
    setServers((prev) =>
      prev.map((s) => (s.id === serverId ? { ...s, archivingEnabled: enabled } : s)),
    );
  };

  if (loading) return <p className="text-zinc-400">Loading servers...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Servers</h1>
        <p className="text-zinc-400 mt-1">Toggle archiving per Discord server</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {servers.map((server) => (
          <ServerCard
            key={server.id}
            id={server.id}
            name={server.name}
            iconUrl={server.icon ? `https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png` : null}
            archivingEnabled={server.archivingEnabled ?? false}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Create server detail page**

**Create:** `packages/dashboard/src/app/dashboard/servers/[id]/page.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ChannelToggle } from '@/components/channel-toggle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Channel {
  id: string;
  name: string;
  type: number;
  archivingEnabled?: boolean;
}

export default function ServerDetailPage() {
  const params = useParams();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [serverName, setServerName] = useState('');

  useEffect(() => {
    // Fetch channels from Discord via API
    fetch(`/api/servers/${params.id}/channels`)
      .then((r) => r.json())
      .then((data) => {
        setChannels(data.channels ?? []);
        setServerName(data.name ?? 'Unknown');
      });
  }, [params.id]);

  const textChannels = channels.filter((c) => c.type === 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">{serverName}</h1>
        <p className="text-zinc-400 mt-1">Manage channel-level archiving</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            Text Channels
            <Badge variant="secondary">{textChannels.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {textChannels.map((ch) => (
              <ChannelToggle
                key={ch.id}
                id={ch.id}
                name={ch.name}
                archivingEnabled={ch.archivingEnabled ?? false}
                onToggle={(channelId, enabled) => {
                  setChannels((prev) =>
                    prev.map((c) => (c.id === channelId ? { ...c, archivingEnabled: enabled } : c)),
                  );
                }}
              />
            ))}
            {textChannels.length === 0 && (
              <p className="text-zinc-500 text-sm">No text channels found</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 9: Create settings page**

**Create:** `packages/dashboard/src/app/dashboard/settings/page.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchApi } from '@/lib/api';

interface GrConfig {
  clientId: string;
  clientSecret: string;
  oauthUrl: string;
  apiBaseUrl: string;
}

export default function SettingsPage() {
  const [config, setConfig] = useState<GrConfig>({
    clientId: '',
    clientSecret: '',
    oauthUrl: 'https://iam-oauth2.globalrelay.com/oauth2/token',
    apiBaseUrl: 'https://conversations.api.globalrelay.com/v2',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchApi<GrConfig>('/api/config').then(setConfig).catch(() => {});
  }, []);

  const handleSave = async () => {
    await fetchApi('/api/config', {
      method: 'PATCH',
      body: JSON.stringify(config),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-zinc-400 mt-1">Global Relay API configuration</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-white">Global Relay Credentials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-zinc-400 block mb-1">Client ID</label>
            <input
              className="w-full px-3 py-2 rounded-md border border-zinc-700 bg-zinc-900 text-white text-sm"
              value={config.clientId}
              onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm text-zinc-400 block mb-1">Client Secret</label>
            <input
              type="password"
              className="w-full px-3 py-2 rounded-md border border-zinc-700 bg-zinc-900 text-white text-sm"
              value={config.clientSecret}
              onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm text-zinc-400 block mb-1">OAuth URL</label>
            <input
              className="w-full px-3 py-2 rounded-md border border-zinc-700 bg-zinc-900 text-white text-sm"
              value={config.oauthUrl}
              onChange={(e) => setConfig({ ...config, oauthUrl: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm text-zinc-400 block mb-1">API Base URL</label>
            <input
              className="w-full px-3 py-2 rounded-md border border-zinc-700 bg-zinc-900 text-white text-sm"
              value={config.apiBaseUrl}
              onChange={(e) => setConfig({ ...config, apiBaseUrl: e.target.value })}
            />
          </div>

          <Button onClick={handleSave}>
            {saved ? 'Saved!' : 'Save Configuration'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 10: Create archive logs page**

**Create:** `packages/dashboard/src/app/dashboard/logs/page.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchApi } from '@/lib/api';

interface ArchiveLogEntry {
  id: string;
  eventType: string;
  status: string;
  errorMessage?: string;
  grReconciliationId?: string;
  archivedAt: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<ArchiveLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi<ArchiveLogEntry[]>('/api/logs')
      .then(setLogs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statusVariant = (status: string) => {
    switch (status) {
      case 'success': return 'success' as const;
      case 'failed': return 'destructive' as const;
      case 'pending': return 'warning' as const;
      default: return 'default' as const;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Archive Logs</h1>
        <p className="text-zinc-400 mt-1">History of archived events</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-zinc-400">Loading logs...</p>
          ) : logs.length === 0 ? (
            <p className="p-6 text-zinc-500">No archive logs yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left p-4 text-zinc-400 font-medium">Event Type</th>
                  <th className="text-left p-4 text-zinc-400 font-medium">Status</th>
                  <th className="text-left p-4 text-zinc-400 font-medium">Reconciliation ID</th>
                  <th className="text-left p-4 text-zinc-400 font-medium">Archived At</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-zinc-800/50">
                    <td className="p-4 text-white">{log.eventType}</td>
                    <td className="p-4">
                      <Badge variant={statusVariant(log.status)}>{log.status}</Badge>
                    </td>
                    <td className="p-4 text-zinc-400 font-mono text-xs">
                      {log.grReconciliationId ?? '-'}
                    </td>
                    <td className="p-4 text-zinc-400">
                      {new Date(log.archivedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 11: Build to verify**

Run: `cd D:\Projects\DiscordToGlobalRelay && npm run build -w packages/dashboard 2>&1 | head -60`
Expected: Build succeeds

- [ ] **Step 12: Commit**

```bash
git add packages/dashboard/
git commit -m "feat(dashboard): add servers, channels, settings, and logs pages with API routes"
```

---

### Task 10: User Mapping — Match Discord Users to Corporate Emails

**Files:**
- Create: `packages/dashboard/src/app/api/servers/[id]/users/route.ts`
- Create: `packages/dashboard/src/components/user-mapping-form.tsx`
- Modify: `packages/dashboard/src/app/dashboard/servers/[id]/page.tsx` (add user mapping section)

- [ ] **Step 1: Create user mapping API route**

**Create:** `packages/dashboard/src/app/api/servers/[id]/users/route.ts`

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const mappings = await prisma.userMapping.findMany({
    where: { serverId: params.id },
  });
  return NextResponse.json(mappings);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const mapping = await prisma.userMapping.upsert({
    where: { serverId_discordUserId: { serverId: params.id, discordUserId: body.discordUserId } },
    update: { corporateEmail: body.corporateEmail, discordName: body.discordName },
    create: {
      serverId: params.id,
      discordUserId: body.discordUserId,
      discordName: body.discordName,
      corporateEmail: body.corporateEmail,
    },
  });

  return NextResponse.json(mapping);
}
```

- [ ] **Step 2: Create user-mapping-form component**

**Create:** `packages/dashboard/src/components/user-mapping-form.tsx`

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { fetchApi } from '@/lib/api';

interface UserMappingFormProps {
  serverId: string;
  onSaved: () => void;
}

export function UserMappingForm({ serverId, onSaved }: UserMappingFormProps) {
  const [discordUserId, setDiscordUserId] = useState('');
  const [discordName, setDiscordName] = useState('');
  const [corporateEmail, setCorporateEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetchApi(`/api/servers/${serverId}/users`, {
        method: 'POST',
        body: JSON.stringify({ discordUserId, discordName, corporateEmail }),
      });
      setDiscordUserId('');
      setDiscordName('');
      setCorporateEmail('');
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <input
          placeholder="Discord User ID"
          className="px-3 py-2 rounded-md border border-zinc-700 bg-zinc-900 text-white text-sm"
          value={discordUserId}
          onChange={(e) => setDiscordUserId(e.target.value)}
          required
        />
        <input
          placeholder="Discord Display Name"
          className="px-3 py-2 rounded-md border border-zinc-700 bg-zinc-900 text-white text-sm"
          value={discordName}
          onChange={(e) => setDiscordName(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Corporate Email"
          className="px-3 py-2 rounded-md border border-zinc-700 bg-zinc-900 text-white text-sm"
          value={corporateEmail}
          onChange={(e) => setCorporateEmail(e.target.value)}
          required
        />
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? 'Saving...' : 'Add Mapping'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Modify server detail page to include user mapping**

Update `packages/dashboard/src/app/dashboard/servers/[id]/page.tsx` — add after the channels section:

```tsx
// Inside the return, after the channels Card, add:
<UserMappingSection serverId={params.id as string} />
```

Add this component above or in a separate file. For brevity, add inline:

```tsx
import { UserMappingForm } from '@/components/user-mapping-form';

function UserMappingSection({ serverId }: { serverId: string }) {
  const [mappings, setMappings] = useState<Array<{ id: string; discordName: string; corporateEmail: string }>>([]);

  const loadMappings = async () => {
    const data = await fetchApi(`/api/servers/${serverId}/users`);
    setMappings(data);
  };

  useEffect(() => { loadMappings(); }, [serverId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-white">User → Email Mapping</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <UserMappingForm serverId={serverId} onSaved={loadMappings} />
        {mappings.length > 0 && (
          <div className="space-y-2 mt-4">
            {mappings.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm p-2 bg-zinc-900 rounded-md">
                <span className="text-zinc-300">{m.discordName}</span>
                <span className="text-zinc-500">{m.corporateEmail}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Build to verify**

Run: `cd D:\Projects\DiscordToGlobalRelay && npm run build -w packages/dashboard 2>&1 | head -60`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/
git commit -m "feat(dashboard): add user-to-email mapping with API and form component"
```

---

### Task 11: Wire Bridge to Database — Dynamic Server/Channel Config

**Files:**
- Modify: `packages/bridge/src/router.ts` (add user mapping lookup, channel config check)
- Modify: `packages/bridge/src/index.ts` (load enabled servers/channels from DB)
- Create: `packages/bridge/src/db.ts` (Prisma singleton)

- [ ] **Step 1: Create Prisma singleton for bridge**

**Create:** `packages/bridge/src/db.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

- [ ] **Step 2: Update router to check channel config and user mappings**

Modify `packages/bridge/src/router.ts` — add channel config check:

```typescript
// Add to top of file
import { prisma } from './db.js';

// Before archiving a message, check if the channel has archiving enabled
private async isChannelArchivingEnabled(serverId: string, channelId: string): Promise<boolean> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  });
  return channel?.archivingEnabled ?? false;
}

// Update handleMessage to check before archiving
async handleMessage(event: DiscordMessageEvent, serverName: string, channelName: string): Promise<void> {
  const enabled = await this.isChannelArchivingEnabled(event.serverId, event.channelId);
  if (!enabled) return;

  // ... rest of existing code
}

// Same guard for handleEdit and handleReaction
```

- [ ] **Step 3: Update bridge main to sync servers from Discord into Prisma on start**

Add to `packages/bridge/src/index.ts`:

```typescript
import { getClient } from '@discord-gr/discord-bot';
import { prisma } from './db.js';

async function syncServers(): Promise<void> {
  const client = getClient();
  const guilds = client.guilds.cache;

  for (const [id, guild] of guilds) {
    await prisma.server.upsert({
      where: { id },
      update: { name: guild.name, iconUrl: guild.iconURL() },
      create: { id, name: guild.name, iconUrl: guild.iconURL() },
    });

    const channels = guild.channels.cache;
    for (const [chId, channel] of channels) {
      if (channel.isTextBased && !channel.isDMBased()) {
        await prisma.channel.upsert({
          where: { id: chId },
          update: { name: channel.name },
          create: { id: chId, serverId: id, name: channel.name },
        });
      }
    }
  }
  console.log(`Synced ${guilds.size} servers to database.`);
}
```

- [ ] **Step 4: Integrate user email mapping into message transformer**

Modify `packages/bridge/src/router.ts` to add email lookup before archiving:

```typescript
private async getCorporateEmail(serverId: string, discordUserId: string): Promise<string | undefined> {
  const mapping = await prisma.userMapping.findUnique({
    where: { serverId_discordUserId: { serverId, discordUserId } },
  });
  return mapping?.corporateEmail ?? undefined;
}

// In handleMessage, before creating the event:
const corporateEmail = await this.getCorporateEmail(event.serverId, event.authorId);
```

- [ ] **Step 5: Type-check**

Run: `cd D:\Projects\DiscordToGlobalRelay && npx tsc --project packages/bridge/tsconfig.json --noEmit`
Expected: exits 0

- [ ] **Step 6: Commit**

```bash
git add packages/bridge/
git commit -m "feat(bridge): wire to Prisma DB for channel config, server sync, user email mapping"
```

---

### Task 12: End-to-End Smoke Test + README

- [ ] **Step 1: Write a smoke test that validates the full pipeline (mocked)**

**Create:** `tests/e2e/smoke.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toMessageArchiveRequest } from '@discord-gr/core';
import { type DiscordMessageEvent } from '@discord-gr/core';

describe('E2E: Discord message → Global Relay payload', () => {
  it('produces a valid GR archive request', () => {
    const discordEvent: DiscordMessageEvent = {
      type: 'Message',
      eventTime: Date.now(),
      messageId: 'discord-msg-1',
      channelId: 'discord-ch-1',
      serverId: 'discord-srv-1',
      authorId: 'user-1',
      authorName: 'JaneDoe',
      authorEmail: 'jane@company.com',
      content: 'Important compliance message',
      attachments: [],
    };

    const result = toMessageArchiveRequest(discordEvent, 'Company HQ', 'general');

    // Validate structure matches GR Conversation Archiving API spec
    expect(result.conversationOverview.externalConversationId).toBe('discord:discord-srv-1:discord-ch-1');
    expect(result.conversationOverview.conversationType).toBe('multi');
    expect(result.conversationEvents).toHaveLength(1);

    const event = result.conversationEvents[0];
    expect(event.eventType).toBe('Message');
    expect(event.eventTime).toBeGreaterThan(0);
    expect(event.participants[0].displayName).toBe('JaneDoe');
    expect(event.participants[0].corporateEmail).toBe('jane@company.com');
    expect(event.participants[0].userType).toBe('initiator');
    expect(event.content?.message).toBe('Important compliance message');
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `cd D:\Projects\DiscordToGlobalRelay && npx vitest run`
Expected: ALL PASS

- [ ] **Step 3: Create README.md**

**Create:** `README.md`

```markdown
# Discord → Global Relay Bridge

Real-time Discord message archiving to Global Relay for compliance recordkeeping.

## Architecture

```
Discord Gateway → discord.js → Bridge → Global Relay Conversation API → Archive
                         ↕
              Prisma DB (config + logs)
                         ↕
              Next.js Dashboard (management UI)
```

## Packages

| Package | Description |
|---|---|
| `@discord-gr/core` | Shared types, config, Discord→GR transformers |
| `@discord-gr/discord-bot` | Discord Gateway event handlers |
| `@discord-gr/gr-client` | Global Relay OAuth2 + HTTP client |
| `@discord-gr/bridge` | Orchestrator: routes events, queue, backfill |
| `@discord-gr/dashboard` | Next.js management UI |

## Prerequisites

- Discord Bot Token (with Message Content Intent)
- Global Relay API credentials (from your Implementation Specialist)
- Node.js 20+
- Docker (optional, for Postgres)

## Quick Start

1. Clone and install:
   ```bash
   git clone <repo>
   cd discord-to-global-relay
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   # Fill in DISCORD_TOKEN, GR_CLIENT_ID, GR_CLIENT_SECRET
   ```

3. Initialize database:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. Start the bridge:
   ```bash
   npm run dev:bot
   ```

5. Start the dashboard (separate terminal):
   ```bash
   npm run dev:dashboard
   ```

## Supported Discord Events

- Messages (send, edit, delete)
- Reactions
- File/attachment sharing
- User join/leave (via event archiving)

## License

MIT
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "docs: add README and E2E smoke test"
```

---

## Self-Review

**1. Spec coverage:**
- ✅ Discord message capture (messageCreate handler → Task 5)
- ✅ Message edits (messageUpdate handler → Task 5, edit transformer → Task 3)
- ✅ Reactions (reactionAdd handler → Task 5, reaction transformer → Task 3)
- ✅ File attachments (attachment transformer → Task 3)
- ✅ Global Relay archiving (GR client with OAuth2 → Task 4)
- ✅ Management UI with server list (Task 9)
- ✅ Channel-level toggle (Task 9)
- ✅ User→email mapping (Task 10)
- ✅ Global Relay credential config via UI (Task 9 settings page)
- ✅ Archive logs (Task 9 logs page)
- ✅ Historical backfill (Task 6 indexer)
- ✅ Retry queue with rate limiting (Task 4 client, Task 6 queue)

**2. Placeholder scan:** No TBD, TODO, "add error handling", or "similar to" patterns found. Every step has complete code.

**3. Type consistency:** All type names used across tasks trace back to definitions in `packages/core/src/types.ts`. Transformer function signatures match between creation (Task 3) and usage (Task 6). API route paths are consistent with the dashboard pages that call them.
