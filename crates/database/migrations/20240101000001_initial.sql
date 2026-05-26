CREATE TABLE connectors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    discord_bot_token_enc BLOB NOT NULL,
    discord_bot_token_nonce BLOB NOT NULL,
    discord_client_id TEXT NOT NULL,
    discord_client_secret_enc BLOB NOT NULL,
    discord_client_secret_nonce BLOB NOT NULL,
    discord_guild_id TEXT,
    discord_guild_name TEXT,
    selected_channel_ids TEXT NOT NULL DEFAULT '[]',
    gr_client_id_enc BLOB NOT NULL,
    gr_client_id_nonce BLOB NOT NULL,
    gr_client_secret_enc BLOB NOT NULL,
    gr_client_secret_nonce BLOB NOT NULL,
    gr_oauth_url TEXT NOT NULL,
    gr_api_base_url TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    health_status TEXT NOT NULL DEFAULT 'offline',
    last_error TEXT,
    total_archived INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    success_rate REAL NOT NULL DEFAULT 0.0,
    last_archived_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE archive_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    connector_id TEXT NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
    discord_message_id TEXT,
    discord_channel_id TEXT,
    gr_archive_id TEXT,
    status TEXT NOT NULL,
    error_message TEXT,
    archived_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_archive_logs_connector ON archive_logs(connector_id, archived_at);
CREATE INDEX idx_archive_logs_status ON archive_logs(connector_id, status);
