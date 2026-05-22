import { type Message, type PartialMessage } from 'discord.js';
import { type DiscordMessageDeleteEvent } from '@discord-gr/core';

export type DeleteHandlerCallback = (event: DiscordMessageDeleteEvent) => void | Promise<void>;

const handlers: DeleteHandlerCallback[] = [];

export function onMessageDelete(callback: DeleteHandlerCallback): void {
  handlers.push(callback);
}

export async function handleMessageDelete(message: Message | PartialMessage): Promise<void> {
  const resolved = message as Message;
  if (!resolved.guild) return;

  const event: DiscordMessageDeleteEvent = {
    type: 'Message_deleted',
    eventTime: Date.now(),
    messageId: resolved.id,
    channelId: resolved.channelId,
    serverId: resolved.guildId!,
  };

  for (const handler of handlers) {
    await handler(event);
  }
}
