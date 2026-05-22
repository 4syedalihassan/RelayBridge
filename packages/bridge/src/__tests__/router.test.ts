import { describe, it, expect, vi } from 'vitest';
import { EventRouter } from '../router.js';
import { ArchiveQueue } from '../queue.js';
import { GrClient } from '@discord-gr/gr-client';
import { type DiscordMessageEvent } from '@discord-gr/core';

function createMockPrisma(channelArchiving: boolean = true, serverArchiving: boolean = true) {
  return {
    channel: {
      findUnique: vi.fn().mockResolvedValue({
        id: '222',
        serverId: '333',
        name: 'general',
        archivingEnabled: channelArchiving,
        lastArchivedAt: null,
        server: {
          id: '333',
          name: 'My Server',
          iconUrl: null,
          archivingEnabled: serverArchiving,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }),
    },
  };
}

describe('EventRouter', () => {
  it('queues a message event for archival when archiving is enabled', async () => {
    const mockGrClient = { archiveConversation: vi.fn().mockResolvedValue({ reconciliationId: 'rec-1', status: 'success' }) } as unknown as GrClient;
    const queue = new ArchiveQueue(1, 100);
    const prisma = createMockPrisma(true, true);
    const router = new EventRouter(mockGrClient, queue, prisma as any);

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

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(mockGrClient.archiveConversation).toHaveBeenCalledTimes(1);
  });

  it('skips archival when channel archiving is disabled', async () => {
    const mockGrClient = { archiveConversation: vi.fn().mockResolvedValue({ reconciliationId: 'rec-1', status: 'success' }) } as unknown as GrClient;
    const queue = new ArchiveQueue(1, 100);
    const prisma = createMockPrisma(false, true);
    const router = new EventRouter(mockGrClient, queue, prisma as any);

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

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(mockGrClient.archiveConversation).not.toHaveBeenCalled();
  });

  it('skips archival when server archiving is disabled', async () => {
    const mockGrClient = { archiveConversation: vi.fn().mockResolvedValue({ reconciliationId: 'rec-1', status: 'success' }) } as unknown as GrClient;
    const queue = new ArchiveQueue(1, 100);
    const prisma = createMockPrisma(true, false);
    const router = new EventRouter(mockGrClient, queue, prisma as any);

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

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(mockGrClient.archiveConversation).not.toHaveBeenCalled();
  });

  it('skips archival when channel not found in DB', async () => {
    const mockGrClient = { archiveConversation: vi.fn().mockResolvedValue({ reconciliationId: 'rec-1', status: 'success' }) } as unknown as GrClient;
    const queue = new ArchiveQueue(1, 100);
    const prisma = {
      channel: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const router = new EventRouter(mockGrClient, queue, prisma as any);

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

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(mockGrClient.archiveConversation).not.toHaveBeenCalled();
  });
});
