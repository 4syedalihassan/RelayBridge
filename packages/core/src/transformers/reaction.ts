import {
  type DiscordReactionEvent,
  type GrArchiveRequest,
  type GrConversationEvent,
} from '../types.js';

export function toReactionArchiveRequest(
  event: DiscordReactionEvent,
  serverName: string,
  channelName: string,
): GrArchiveRequest {
  const childEvent: GrConversationEvent = {
    eventTime: event.eventTime - 1000,
    eventType: 'Message',
    participants: [
      {
        displayName: event.messageAuthorName,
        corporateEmail: undefined,
        userType: 'initiator',
      },
    ],
    content: {
      message: event.messageContent,
    },
  };

  const parentEvent: GrConversationEvent = {
    eventTime: event.eventTime,
    eventType: 'Reaction',
    systemText: `Reacted with ${event.emoji}`,
    participants: [
      {
        displayName: event.userName,
        corporateEmail: event.userEmail,
        userType: 'initiator',
      },
    ],
    childEvents: [childEvent],
  };

  return {
    conversationOverview: {
      externalConversationId: `discord:${event.serverId}:${event.channelId}`,
      name: `#${channelName} — ${serverName}`,
      conversationType: 'multi',
      initialParticipants: [],
    },
    conversationEvents: [parentEvent],
  };
}
