import { describe, it, expect } from 'vitest';
import { toMessageArchiveRequest } from '../transformers/message.js';
import { toReactionArchiveRequest } from '../transformers/reaction.js';
import { toEditArchiveRequest } from '../transformers/edit.js';
import { toAttachmentArchiveRequests } from '../transformers/attachment.js';
import { type DiscordMessageEvent, type DiscordReactionEvent, type DiscordMessageEditEvent } from '../types.js';

describe('toMessageArchiveRequest', () => {
  it('transforms a basic message to GR archive request', () => {
    const event: DiscordMessageEvent = {
      type: 'Message',
      eventTime: 1700000000000,
      messageId: '111',
      channelId: '222',
      serverId: '333',
      authorId: '444',
      authorName: 'TestUser',
      authorEmail: 'test@example.com',
      content: 'Hello World',
      attachments: [],
    };

    const result = toMessageArchiveRequest(event, 'guild-333', 'general');

    expect(result.conversationOverview.externalConversationId).toBe('discord:333:222');
    expect(result.conversationOverview.conversationType).toBe('multi');
    expect(result.conversationEvents).toHaveLength(1);
    expect(result.conversationEvents[0].eventType).toBe('Message');
    expect(result.conversationEvents[0].participants[0].displayName).toBe('TestUser');
    expect(result.conversationEvents[0].content?.message).toBe('Hello World');
  });

  it('maps author fields to participant correctly', () => {
    const event: DiscordMessageEvent = {
      type: 'Message',
      eventTime: 1700000000000,
      messageId: '111',
      channelId: '222',
      serverId: '333',
      authorId: '444',
      authorName: 'Alice',
      content: 'Hi',
      attachments: [],
    };

    const result = toMessageArchiveRequest(event, 'guild-333', 'general');
    const participant = result.conversationEvents[0].participants[0];

    expect(participant.displayName).toBe('Alice');
    expect(participant.corporateEmail).toBeUndefined();
    expect(participant.userType).toBe('initiator');
  });
});

describe('toReactionArchiveRequest', () => {
  it('transforms a reaction event with child event for original message', () => {
    const event: DiscordReactionEvent = {
      type: 'Reaction',
      eventTime: 1700000001000,
      messageId: '111',
      channelId: '222',
      serverId: '333',
      userId: '555',
      userName: 'Bob',
      userEmail: 'bob@example.com',
      emoji: '👍',
      messageAuthorId: '444',
      messageAuthorName: 'Alice',
      messageContent: 'Hello World',
    };

    const result = toReactionArchiveRequest(event, 'guild-333', 'general');

    expect(result.conversationEvents).toHaveLength(1);
    expect(result.conversationEvents[0].eventType).toBe('Reaction');
    expect(result.conversationEvents[0].systemText).toContain('👍');
    expect(result.conversationEvents[0].childEvents).toHaveLength(1);
    expect(result.conversationEvents[0].childEvents![0].eventType).toBe('Message');
    expect(result.conversationEvents[0].childEvents![0].content?.message).toBe('Hello World');
  });
});

describe('toEditArchiveRequest', () => {
  it('transforms an edit with original as childEvent', () => {
    const event: DiscordMessageEditEvent = {
      type: 'Message_edited',
      eventTime: 1700000002000,
      messageId: '111',
      channelId: '222',
      serverId: '333',
      authorId: '444',
      authorName: 'Alice',
      newContent: 'Hello World edited',
      oldContent: 'Hello World',
    };

    const result = toEditArchiveRequest(event, 'guild-333', 'general');

    expect(result.conversationEvents[0].eventType).toBe('Message_edited');
    expect(result.conversationEvents[0].content?.message).toBe('Hello World edited');
    expect(result.conversationEvents[0].childEvents![0].content?.message).toBe('Hello World');
  });
});

describe('toAttachmentArchiveRequests', () => {
  it('generates File_transfer events for each attachment', () => {
    const event: DiscordMessageEvent = {
      type: 'Message',
      eventTime: 1700000000000,
      messageId: '111',
      channelId: '222',
      serverId: '333',
      authorId: '444',
      authorName: 'TestUser',
      content: 'Here are the files',
      attachments: [
        { id: 'a1', filename: 'report.pdf', url: 'https://cdn.discord.com/...', contentType: 'application/pdf', sizeBytes: 1024 },
        { id: 'a2', filename: 'image.png', url: 'https://cdn.discord.com/...', contentType: 'image/png', sizeBytes: 2048 },
      ],
    };

    const results = toAttachmentArchiveRequests(event, 'guild-333', 'general');

    expect(results).toHaveLength(2);
    expect(results[0].conversationEvents[0].eventType).toBe('File_transfer');
    expect(results[0].conversationEvents[0].files![0].filename).toBe('report.pdf');
    expect(results[1].conversationEvents[0].files![0].filename).toBe('image.png');
  });

  it('returns empty array when no attachments', () => {
    const event: DiscordMessageEvent = {
      type: 'Message',
      eventTime: 1700000000000,
      messageId: '111',
      channelId: '222',
      serverId: '333',
      authorId: '444',
      authorName: 'TestUser',
      content: 'No files',
      attachments: [],
    };

    expect(toAttachmentArchiveRequests(event, 'guild-333', 'general')).toEqual([]);
  });
});
