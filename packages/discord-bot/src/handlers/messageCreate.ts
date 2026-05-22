import { type Message } from 'discord.js';
import { type DiscordMessageEvent, type DiscordAttachment } from '@discord-gr/core';

export type MessageHandlerCallback = (event: DiscordMessageEvent) => void | Promise<void>;

const handlers: MessageHandlerCallback[] = [];

export function onMessage(callback: MessageHandlerCallback): void {
  handlers.push(callback);
}

export async function handleMessageCreate(message: Message): Promise<void> {
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
