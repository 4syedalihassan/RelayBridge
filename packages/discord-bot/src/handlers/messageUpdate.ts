import { type Message, type PartialMessage } from 'discord.js';
import { type DiscordMessageEditEvent } from '@discord-gr/core';

export type EditHandlerCallback = (event: DiscordMessageEditEvent) => void | Promise<void>;

const handlers: EditHandlerCallback[] = [];

export function onMessageEdit(callback: EditHandlerCallback): void {
  handlers.push(callback);
}

export async function handleMessageUpdate(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage): Promise<void> {
  const resolvedNew = newMessage as Message;
  const resolvedOld = oldMessage as Message;

  if (resolvedNew.author?.bot) return;
  if (!resolvedNew.guild) return;
  if (resolvedOld.content === resolvedNew.content) return;

  const event: DiscordMessageEditEvent = {
    type: 'Message_edited',
    eventTime: Date.now(),
    messageId: resolvedNew.id,
    channelId: resolvedNew.channelId,
    serverId: resolvedNew.guildId!,
    authorId: resolvedNew.author.id,
    authorName: resolvedNew.author.displayName,
    newContent: resolvedNew.content ?? '',
    oldContent: resolvedOld.content ?? '',
  };

  for (const handler of handlers) {
    await handler(event);
  }
}
