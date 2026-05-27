import {
  type DiscordMessageEditEvent,
  type GrArchiveRequest,
  type GrConversationEvent,
} from '../types.js';

export function toEditArchiveRequest(
  event: DiscordMessageEditEvent,
  serverName: string,
  channelName: string,
): GrArchiveRequest {
  const childEvent: GrConversationEvent = {
    eventTime: event.eventTime - 1000,
    eventType: 'Message',
    participants: [
      {
        displayName: event.authorName,
        corporateEmail: event.authorEmail,
        userType: 'initiator',
      },
    ],
    content: {
      message: event.oldContent,
    },
  };

  const parentEvent: GrConversationEvent = {
    eventTime: event.eventTime,
    eventType: 'Message_edited',
    participants: [
      {
        displayName: event.authorName,
        corporateEmail: event.authorEmail,
        userType: 'initiator',
      },
    ],
    content: {
      message: event.newContent,
    },
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
