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
