import { describe, it, expect, vi } from 'vitest';
import { EventRouter } from '../router.js';
import { ArchiveQueue } from '../queue.js';
import { GrClient } from '@discord-gr/gr-client';
import { type DiscordMessageEvent } from '@discord-gr/core';

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

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(mockGrClient.archiveConversation).toHaveBeenCalledTimes(1);
  });
});
