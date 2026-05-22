import { BridgeConfig } from './types.js';

export function loadConfig(): BridgeConfig {
  const missing: string[] = [];

  const discordToken = process.env.DISCORD_TOKEN ?? missing.push('DISCORD_TOKEN') as unknown as string;
  const discordClientId = process.env.DISCORD_CLIENT_ID ?? missing.push('DISCORD_CLIENT_ID') as unknown as string;
  const grClientId = process.env.GR_CLIENT_ID ?? missing.push('GR_CLIENT_ID') as unknown as string;
  const grClientSecret = process.env.GR_CLIENT_SECRET ?? missing.push('GR_CLIENT_SECRET') as unknown as string;

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    discordToken: discordToken!,
    discordClientId: discordClientId!,
    grClientId: grClientId!,
    grClientSecret: grClientSecret!,
    grOauthUrl: process.env.GR_OAUTH_URL ?? 'https://iam-oauth2.globalrelay.com/oauth2/token',
    grApiBaseUrl: process.env.GR_API_BASE_URL ?? 'https://conversations.api.globalrelay.com/v2',
    grRateLimitRpm: Number(process.env.GR_RATE_LIMIT_RPM) || 900,
    queueMaxRetries: Number(process.env.QUEUE_MAX_RETRIES) || 3,
    queueBackoffMs: Number(process.env.QUEUE_BACKOFF_MS) || 5000,
  };
}
