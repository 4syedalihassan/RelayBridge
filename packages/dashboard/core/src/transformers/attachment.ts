import {
  type DiscordMessageEvent,
  type GrArchiveRequest,
  type GrConversationEvent,
} from '../types.js';

export function toAttachmentArchiveRequests(
  event: DiscordMessageEvent,
  serverName: string,
  channelName: string,
): GrArchiveRequest[] {
  if (event.attachments.length === 0) return [];

  return event.attachments.map((att) => {
    const fileKey = `default/discord/${event.serverId}/${event.channelId}/${att.id}/${att.filename}`;

    const conversationEvent: GrConversationEvent = {
      eventTime: event.eventTime,
      eventType: 'File_transfer',
      participants: [
        {
          displayName: event.authorName,
          corporateEmail: event.authorEmail,
          userType: 'initiator',
        },
      ],
      files: [
        {
          filename: att.filename,
          fileKey,
          isInlined: false,
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
  });
}
