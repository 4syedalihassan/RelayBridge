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
