import { type MessageReaction, type User, type PartialMessageReaction, type PartialUser } from 'discord.js';
import { type DiscordReactionEvent } from '@discord-gr/core';

export type ReactionHandlerCallback = (event: DiscordReactionEvent) => void | Promise<void>;

const handlers: ReactionHandlerCallback[] = [];

export function onReaction(callback: ReactionHandlerCallback): void {
  handlers.push(callback);
}

export async function handleReactionAdd(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> {
  if (user.bot) return;

  if (reaction.partial) await reaction.fetch();
  const message = reaction.message;
  if (message.partial) await message.fetch();

  if (!message.guild) return;

  const resolvedReaction = reaction as MessageReaction;
  const resolvedUser = user as User;

  const event: DiscordReactionEvent = {
    type: 'Reaction',
    eventTime: Date.now(),
    messageId: message.id,
    channelId: message.channelId,
    serverId: message.guildId!,
    userId: resolvedUser.id,
    userName: resolvedUser.displayName,
    emoji: resolvedReaction.emoji.name ?? 'unknown',
    messageAuthorId: message.author?.id ?? '',
    messageAuthorName: message.author?.displayName ?? 'Unknown',
    messageContent: message.content ?? '',
  };

  for (const handler of handlers) {
    await handler(event);
  }
}
