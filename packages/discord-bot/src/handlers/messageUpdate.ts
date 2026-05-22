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
