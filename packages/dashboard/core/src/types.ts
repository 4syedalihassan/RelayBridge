// ─── Discord Events (normalized) ───

export interface DiscordMessageEvent {
  type: 'Message';
  eventTime: number;
  messageId: string;
  channelId: string;
  serverId: string;
  authorId: string;
  authorName: string;
  authorEmail?: string;
  content: string;
  attachments: DiscordAttachment[];
  replyToMessageId?: string;
}

export interface DiscordMessageEditEvent {
  type: 'Message_edited';
  eventTime: number;
  messageId: string;
  channelId: string;
  serverId: string;
  authorId: string;
  authorName: string;
  authorEmail?: string;
  newContent: string;
  oldContent: string;
}

export interface DiscordReactionEvent {
  type: 'Reaction';
  eventTime: number;
  messageId: string;
  channelId: string;
  serverId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  emoji: string;
  messageAuthorId: string;
  messageAuthorName: string;
  messageContent: string;
}

export interface DiscordMessageDeleteEvent {
  type: 'Message_deleted';
  eventTime: number;
  messageId: string;
  channelId: string;
  serverId: string;
}

export interface DiscordAttachment {
  id: string;
  filename: string;
  url: string;
  contentType: string;
  sizeBytes: number;
}

export type DiscordNormalizedEvent =
  | DiscordMessageEvent
  | DiscordMessageEditEvent
  | DiscordReactionEvent
  | DiscordMessageDeleteEvent;

// ─── Global Relay Payload Types ───

export type GrEventType =
  | 'Message'
  | 'Context_reply'
  | 'Reaction'
  | 'Message_edited'
  | 'File_transfer'
  | 'User_joined'
  | 'User_left';

export interface GrParticipant {
  displayName: string;
  corporateEmail?: string;
  userType: 'initiator' | 'recipient' | 'affectedUser';
}

export interface GrFile {
  filename: string;
  fileKey: string;
  isInlined: boolean;
}

export interface GrConversationEvent {
  eventTime: number;
  eventType: GrEventType;
  systemText?: string;
  participants: GrParticipant[];
  content?: {
    message?: string;
    textType?: 'html' | 'plain';
  };
  files?: GrFile[];
  childEvents?: GrConversationEvent[];
}

export interface GrConversationOverview {
  externalConversationId: string;
  name?: string;
  conversationType: 'multi' | 'one_to_one';
  initialParticipants: GrParticipant[];
}

export interface GrArchiveRequest {
  conversationOverview: GrConversationOverview;
  conversationEvents: GrConversationEvent[];
}

export interface GrArchiveResponse {
  reconciliationId?: string;
  status: string;
  error?: string;
}

// ─── Bridge Configuration ───

export interface BridgeConfig {
  discordToken: string;
  discordClientId: string;
  grClientId: string;
  grClientSecret: string;
  grOauthUrl: string;
  grApiBaseUrl: string;
  grRateLimitRpm: number;
  queueMaxRetries: number;
  queueBackoffMs: number;
}
