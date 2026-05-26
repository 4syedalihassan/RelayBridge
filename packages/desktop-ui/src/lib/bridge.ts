/**
 * Tauri bridge client — wraps @tauri-apps/api invoke() so the frontend
 * never imports Tauri directly from components. This abstraction also
 * lets us run the UI standalone (with mock data) without Tauri installed.
 */

import { invoke } from '@tauri-apps/api/core'

export type HealthStatus = 'online' | 'offline' | 'error'
export type ArchiveStatus = 'success' | 'failed'
export type ChannelKind = 'text' | 'voice' | 'announcement' | 'other'

export interface DiscordConfig {
  bot_token: string
  client_id: string
  client_secret: string
  guild_id?: string
  guild_name?: string
  selected_channel_ids: string[]
}

export interface GrConfig {
  client_id: string
  client_secret: string
  oauth_url: string
  api_base_url: string
}

export interface Connector {
  id: string
  name: string
  description?: string
  discord_config: DiscordConfig
  gr_config: GrConfig
  enabled: boolean
  health_status: HealthStatus
  last_error?: string
  total_archived: number
  failed_count: number
  success_rate: number
  last_archived_at?: string
  created_at: string
  updated_at: string
}

export interface CreateConnectorRequest {
  name: string
  description?: string
  discord_config: DiscordConfig
  gr_config: GrConfig
}

export interface UpdateConnectorRequest {
  name?: string
  description?: string
  discord_config?: DiscordConfig
  gr_config?: GrConfig
  enabled?: boolean
}

export interface GuildInfo {
  id: string
  name: string
}

export interface ChannelInfo {
  id: string
  name: string
  kind: ChannelKind
}

export interface AnalyticsSummary {
  total_archived: number
  active_connections: number
  overall_success_rate: number
  archived_today: number
}

export interface DailyVolume {
  date: string
  count: number
}

export interface ConnectorAnalytics {
  connector_id: string
  total_archived: number
  failed_count: number
  success_rate: number
  daily_volume: DailyVolume[]
}

export interface AppConfig {
  db_path: string
  log_level: string
  socket_path: string
  auto_start: boolean
  auto_update: boolean
}

// ── API client ───────────────────────────────────────────────────────────────

export const bridge = {
  // Connectors
  listConnectors: () => invoke<Connector[]>('list_connectors'),
  getConnector: (id: string) => invoke<Connector>('get_connector', { id }),
  createConnector: (req: CreateConnectorRequest) =>
    invoke<Connector>('create_connector', { req }),
  updateConnector: (id: string, req: UpdateConnectorRequest) =>
    invoke<Connector>('update_connector', { id, req }),
  deleteConnector: (id: string) => invoke<void>('delete_connector', { id }),
  toggleConnector: (id: string, enabled: boolean) =>
    invoke<void>('toggle_connector', { id, enabled }),

  // Discord helpers
  getDiscordGuilds: () => invoke<GuildInfo[]>('get_discord_guilds'),
  getDiscordChannels: (guildId: string) =>
    invoke<ChannelInfo[]>('get_discord_channels', { guildId }),

  // Analytics
  getAnalyticsSummary: () => invoke<AnalyticsSummary>('get_analytics_summary'),
  getConnectorAnalytics: (id: string) =>
    invoke<ConnectorAnalytics>('get_connector_analytics', { id }),

  // Health + Config
  getHealth: () => invoke<HealthStatus>('get_health'),
  getConfig: () => invoke<AppConfig>('get_config'),
  updateConfig: (config: AppConfig) => invoke<void>('update_config', { config }),
}
