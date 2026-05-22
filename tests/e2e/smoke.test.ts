import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toMessageArchiveRequest } from '../../packages/core/src/transformers/message.js';
import { toReactionArchiveRequest } from '../../packages/core/src/transformers/reaction.js';
import { toEditArchiveRequest } from '../../packages/core/src/transformers/edit.js';
import { toAttachmentArchiveRequests } from '../../packages/core/src/transformers/attachment.js';
import { EventRouter } from '../../packages/bridge/src/router.js';
import { ArchiveQueue } from '../../packages/bridge/src/queue.js';
import type { DiscordMessageEvent, DiscordReactionEvent, DiscordMessageEditEvent } from '../../packages/core/src/types.js';

describe('Discord -> Global Relay Bridge - E2E Smoke', () => {
  describe('Configuration', () => {
    it('should throw when environment variables are missing', async () => {
      const { loadConfig } = await import('../../packages/core/src/config.js');
      expect(() => loadConfig()).toThrow('Missing required environment variables');
    });
  });

  describe('Transformers', () => {
    it('should transform a text message payload', () => {
      const event: DiscordMessageEvent = {
        type: 'Message',
        eventTime: Date.now(),
        messageId: '111',
        channelId: '222',
        serverId: '333',
        authorId: '444',
        authorName: 'TestUser',
        content: 'Hello world',
        attachments: [],
      };

      const result = toMessageArchiveRequest(event, 'Test Server', 'general');
      expect(result).toBeDefined();
      expect(result.conversationOverview.externalConversationId).toBe('discord:333:222');
      expect(result.conversationEvents).toHaveLength(1);
      expect(result.conversationEvents[0].content?.message).toBe('Hello world');
    });

    it('should transform a reaction event', () => {
      const event: DiscordReactionEvent = {
        type: 'Reaction',
        eventTime: Date.now(),
        messageId: '111',
        channelId: '222',
        serverId: '333',
        userId: '555',
        userName: 'Bob',
        emoji: '👍',
        messageAuthorId: '444',
        messageAuthorName: 'Alice',
        messageContent: 'Hello',
      };

      const result = toReactionArchiveRequest(event, 'Test Server', 'general');
      expect(result).toBeDefined();
      expect(result.conversationEvents[0].eventType).toBe('Reaction');
      expect(result.conversationEvents[0].childEvents).toHaveLength(1);
    });

    it('should transform an edit event', () => {
      const event: DiscordMessageEditEvent = {
        type: 'Message_edited',
        eventTime: Date.now(),
        messageId: '111',
        channelId: '222',
        serverId: '333',
        authorId: '444',
        authorName: 'Alice',
        newContent: 'edited',
        oldContent: 'original',
      };

      const result = toEditArchiveRequest(event, 'Test Server', 'general');
      expect(result).toBeDefined();
      expect(result.conversationEvents[0].eventType).toBe('Message_edited');
    });

    it('should generate attachment events', () => {
      const event: DiscordMessageEvent = {
        type: 'Message',
        eventTime: Date.now(),
        messageId: '111',
        channelId: '222',
        serverId: '333',
        authorId: '444',
        authorName: 'TestUser',
        content: 'files',
        attachments: [
          { id: 'a1', filename: 'doc.pdf', url: 'https://cdn.example.com/doc.pdf', contentType: 'application/pdf', sizeBytes: 100 },
        ],
      };

      const results = toAttachmentArchiveRequests(event, 'Test Server', 'general');
      expect(results).toHaveLength(1);
      expect(results[0].conversationEvents[0].eventType).toBe('File_transfer');
    });

    it('should handle empty content gracefully', () => {
      const event: DiscordMessageEvent = {
        type: 'Message',
        eventTime: Date.now(),
        messageId: '111',
        channelId: '222',
        serverId: '333',
        authorId: '444',
        authorName: 'TestUser',
        content: '',
        attachments: [],
      };

      const result = toMessageArchiveRequest(event, 'Test Server', 'general');
      expect(result).toBeDefined();
      expect(result.conversationEvents[0].content?.message).toBe('');
    });
  });

  describe('Archive Queue', () => {
    it('should execute queued items', async () => {
      const queue = new ArchiveQueue(3, 50);
      let executed = false;
      queue.enqueue({
        id: 'smoke-1',
        execute: async () => { executed = true; },
        retriesLeft: 3,
        backoffMs: 50,
      });
      await new Promise((r) => setTimeout(r, 100));
      expect(executed).toBe(true);
    });

    it('should retry failed items', async () => {
      const queue = new ArchiveQueue(2, 10);
      let attempts = 0;
      queue.enqueue({
        id: 'smoke-2',
        execute: async () => { attempts++; throw new Error('fail'); },
        retriesLeft: 2,
        backoffMs: 10,
      });
      await new Promise((r) => setTimeout(r, 500));
      expect(attempts).toBe(3);
    });
  });

  describe('EventRouter', () => {
    it('should construct with mocked dependencies', () => {
      const mockClient = { archiveConversation: vi.fn() } as any;
      const queue = new ArchiveQueue();
      const router = new EventRouter(mockClient, queue);
      expect(router).toBeInstanceOf(EventRouter);
    });
  });

  describe('Prisma Schema Integrity', () => {
    it('should have Server and Channel models available via Prisma', async () => {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      try {
        expect(prisma.server).toBeDefined();
        expect(prisma.channel).toBeDefined();
        expect(prisma.userMapping).toBeDefined();
        expect(prisma.archiveLog).toBeDefined();
        expect(prisma.globalRelayConfig).toBeDefined();
      } finally {
        await prisma.$disconnect();
      }
    });
  });
});
