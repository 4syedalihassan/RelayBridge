import { PrismaClient } from '@prisma/client';
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
  private prisma: PrismaClient;

  constructor(grClient: GrClient, queue: ArchiveQueue, prisma: PrismaClient) {
    this.grClient = grClient;
    this.queue = queue;
    this.prisma = prisma;
  }

  private async isChannelArchived(channelId: string): Promise<boolean> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: { server: true },
    });
    if (!channel) return false;
    return channel.archivingEnabled && channel.server.archivingEnabled;
  }

  async handleMessage(event: DiscordMessageEvent, serverName: string, channelName: string): Promise<void> {
    if (!(await this.isChannelArchived(event.channelId))) return;

    const request = toMessageArchiveRequest(event, serverName, channelName);
    this.enqueueArchive(request, event.messageId);

    const attachmentRequests = toAttachmentArchiveRequests(event, serverName, channelName);
    for (const attReq of attachmentRequests) {
      this.enqueueArchive(attReq, `${event.messageId}-att`);
    }
  }

  async handleEdit(event: DiscordMessageEditEvent, serverName: string, channelName: string): Promise<void> {
    if (!(await this.isChannelArchived(event.channelId))) return;

    const request = toEditArchiveRequest(event, serverName, channelName);
    this.enqueueArchive(request, event.messageId);
  }

  async handleReaction(event: DiscordReactionEvent, serverName: string, channelName: string): Promise<void> {
    if (!(await this.isChannelArchived(event.channelId))) return;

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
