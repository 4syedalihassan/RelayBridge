import {
  type DiscordMessageEvent,
  type GrArchiveRequest,
  type GrConversationEvent,
} from '../types.js';

export function toMessageArchiveRequest(
  event: DiscordMessageEvent,
  serverName: string,
  channelName: string,
): GrArchiveRequest {
  const conversationEvent: GrConversationEvent = {
    eventTime: event.eventTime,
    eventType: 'Message',
    participants: [
      {
        displayName: event.authorName,
        corporateEmail: event.authorEmail,
        userType: 'initiator',
      },
    ],
    content: {
      message: event.content,
    },
  };

  return {
    conversationOverview: {
      externalConversationId: `discord:${event.serverId}:${event.channelId}`,
      name: `#${channelName} — ${serverName}`,
      conversationType: 'multi',
      initialParticipants: [],
    },
    conversationEvents: [conversationEvent],
  };
}
