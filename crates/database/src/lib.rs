//! SQLite database layer for DiscordToGlobalRelay.
//!
//! Provides a [`Database`] struct backed by a SQLite connection pool via `sqlx`.
//! All encrypted credential blobs are stored as raw `Vec<u8>`; encryption/decryption
//! is the responsibility of callers (the `bridge` crate).

use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePool, SqlitePoolOptions},
    Row,
};
use std::str::FromStr;
use async_trait::async_trait;
#[allow(unused_imports)]
use tracing::{debug, instrument};

// ─── Row types ────────────────────────────────────────────────────────────────

/// All columns from the `connectors` table.
#[derive(Debug, Clone)]
pub struct ConnectorRow {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub discord_bot_token_enc: Vec<u8>,
    pub discord_bot_token_nonce: Vec<u8>,
    pub discord_client_id: String,
    pub discord_client_secret_enc: Vec<u8>,
    pub discord_client_secret_nonce: Vec<u8>,
    pub discord_guild_id: Option<String>,
    pub discord_guild_name: Option<String>,
    pub selected_channel_ids: String,
    pub gr_client_id_enc: Vec<u8>,
    pub gr_client_id_nonce: Vec<u8>,
    pub gr_client_secret_enc: Vec<u8>,
    pub gr_client_secret_nonce: Vec<u8>,
    pub gr_oauth_url: String,
    pub gr_api_base_url: String,
    pub enabled: bool,
    pub health_status: String,
    pub last_error: Option<String>,
    pub total_archived: i64,
    pub failed_count: i64,
    pub success_rate: f64,
    pub last_archived_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// All columns from the `archive_logs` table.
#[derive(Debug, Clone)]
pub struct ArchiveLogRow {
    pub id: i64,
    pub connector_id: String,
    pub discord_message_id: Option<String>,
    pub discord_channel_id: Option<String>,
    pub gr_archive_id: Option<String>,
    pub status: String,
    pub error_message: Option<String>,
    pub archived_at: String,
}

/// Aggregated analytics summary across all connectors.
#[derive(Debug, Clone)]
pub struct AnalyticsSummaryRow {
    pub total_archived: i64,
    pub active_count: i64,
    pub overall_success_rate: f64,
    pub archived_today: i64,
}

/// Per-day archive volume for a single connector.
#[derive(Debug, Clone)]
pub struct DailyVolumeRow {
    pub date: String,
    pub count: i64,
}

// ─── Helper: map a sqlx row to ConnectorRow ───────────────────────────────────

fn map_connector_row(row: &sqlx::sqlite::SqliteRow) -> Result<ConnectorRow, sqlx::Error> {
    Ok(ConnectorRow {
        id: row.try_get("id")?,
        name: row.try_get("name")?,
        description: row.try_get("description")?,
        discord_bot_token_enc: row.try_get::<Vec<u8>, _>("discord_bot_token_enc")?,
        discord_bot_token_nonce: row.try_get::<Vec<u8>, _>("discord_bot_token_nonce")?,
        discord_client_id: row.try_get("discord_client_id")?,
        discord_client_secret_enc: row.try_get::<Vec<u8>, _>("discord_client_secret_enc")?,
        discord_client_secret_nonce: row.try_get::<Vec<u8>, _>("discord_client_secret_nonce")?,
        discord_guild_id: row.try_get("discord_guild_id")?,
        discord_guild_name: row.try_get("discord_guild_name")?,
        selected_channel_ids: row.try_get("selected_channel_ids")?,
        gr_client_id_enc: row.try_get::<Vec<u8>, _>("gr_client_id_enc")?,
        gr_client_id_nonce: row.try_get::<Vec<u8>, _>("gr_client_id_nonce")?,
        gr_client_secret_enc: row.try_get::<Vec<u8>, _>("gr_client_secret_enc")?,
        gr_client_secret_nonce: row.try_get::<Vec<u8>, _>("gr_client_secret_nonce")?,
        gr_oauth_url: row.try_get("gr_oauth_url")?,
        gr_api_base_url: row.try_get("gr_api_base_url")?,
        enabled: {
            let v: i64 = row.try_get("enabled")?;
            v != 0
        },
        health_status: row.try_get("health_status")?,
        last_error: row.try_get("last_error")?,
        total_archived: row.try_get("total_archived")?,
        failed_count: row.try_get("failed_count")?,
        success_rate: row.try_get("success_rate")?,
        last_archived_at: row.try_get("last_archived_at")?,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
    })
}

fn map_log_row(row: &sqlx::sqlite::SqliteRow) -> Result<ArchiveLogRow, sqlx::Error> {
    Ok(ArchiveLogRow {
        id: row.try_get("id")?,
        connector_id: row.try_get("connector_id")?,
        discord_message_id: row.try_get("discord_message_id")?,
        discord_channel_id: row.try_get("discord_channel_id")?,
        gr_archive_id: row.try_get("gr_archive_id")?,
        status: row.try_get("status")?,
        error_message: row.try_get("error_message")?,
        archived_at: row.try_get("archived_at")?,
    })
}

// ─── Database ─────────────────────────────────────────────────────────────────

/// Thread-safe SQLite database handle backed by a connection pool.
#[derive(Debug, Clone)]
pub struct Database {
    pool: SqlitePool,
}

impl Database {
    /// Open (or create) the SQLite database at `db_path` and return a connected [`Database`].
    ///
    /// Uses WAL journal mode for better concurrent read performance.
    #[instrument(skip_all, fields(db_path))]
    pub async fn connect(db_path: &str) -> Result<Self, sqlx::Error> {
        debug!("Opening SQLite database at {db_path}");
        let opts = SqliteConnectOptions::from_str(db_path)?
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal);

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(opts)
            .await?;

        Ok(Self { pool })
    }

    /// Run all pending SQLx migrations from the `migrations/` directory embedded
    /// at compile time via the [`sqlx::migrate!`] macro.
    pub async fn run_migrations(&self) -> Result<(), sqlx::Error> {
        sqlx::migrate!()
            .run(&self.pool)
            .await?;
        Ok(())
    }

    // ── Connectors ────────────────────────────────────────────────────────────

    /// Insert a new connector row and return the created row.
    #[allow(clippy::too_many_arguments)]
    pub async fn create_connector(
        &self,
        id: &str,
        name: &str,
        description: Option<&str>,
        discord_client_id: &str,
        discord_guild_id: Option<&str>,
        discord_guild_name: Option<&str>,
        selected_channel_ids: &str,
        gr_oauth_url: &str,
        gr_api_base_url: &str,
        discord_bot_token_enc: &[u8],
        discord_bot_token_nonce: &[u8],
        discord_client_secret_enc: &[u8],
        discord_client_secret_nonce: &[u8],
        gr_client_id_enc: &[u8],
        gr_client_id_nonce: &[u8],
        gr_client_secret_enc: &[u8],
        gr_client_secret_nonce: &[u8],
    ) -> Result<ConnectorRow, sqlx::Error> {
        sqlx::query(
            r#"
            INSERT INTO connectors (
                id, name, description,
                discord_bot_token_enc, discord_bot_token_nonce,
                discord_client_id,
                discord_client_secret_enc, discord_client_secret_nonce,
                discord_guild_id, discord_guild_name,
                selected_channel_ids,
                gr_client_id_enc, gr_client_id_nonce,
                gr_client_secret_enc, gr_client_secret_nonce,
                gr_oauth_url, gr_api_base_url
            ) VALUES (
                ?, ?, ?,
                ?, ?,
                ?,
                ?, ?,
                ?, ?,
                ?,
                ?, ?,
                ?, ?,
                ?, ?
            )
            "#,
        )
        .bind(id)
        .bind(name)
        .bind(description)
        .bind(discord_bot_token_enc)
        .bind(discord_bot_token_nonce)
        .bind(discord_client_id)
        .bind(discord_client_secret_enc)
        .bind(discord_client_secret_nonce)
        .bind(discord_guild_id)
        .bind(discord_guild_name)
        .bind(selected_channel_ids)
        .bind(gr_client_id_enc)
        .bind(gr_client_id_nonce)
        .bind(gr_client_secret_enc)
        .bind(gr_client_secret_nonce)
        .bind(gr_oauth_url)
        .bind(gr_api_base_url)
        .execute(&self.pool)
        .await?;

        self.get_connector(id)
            .await?
            .ok_or_else(|| sqlx::Error::RowNotFound)
    }

    /// Fetch a single connector by primary key.
    pub async fn get_connector(&self, id: &str) -> Result<Option<ConnectorRow>, sqlx::Error> {
        let rows = sqlx::query("SELECT * FROM connectors WHERE id = ?")
            .bind(id)
            .fetch_all(&self.pool)
            .await?;

        rows.first().map(map_connector_row).transpose()
    }

    /// Fetch all connectors ordered by `created_at`.
    pub async fn list_connectors(&self) -> Result<Vec<ConnectorRow>, sqlx::Error> {
        let rows = sqlx::query("SELECT * FROM connectors ORDER BY created_at ASC")
            .fetch_all(&self.pool)
            .await?;

        rows.iter().map(map_connector_row).collect()
    }

    /// Enable or disable a connector.
    pub async fn update_connector_enabled(
        &self,
        id: &str,
        enabled: bool,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "UPDATE connectors SET enabled = ?, updated_at = datetime('now') WHERE id = ?",
        )
        .bind(i64::from(enabled))
        .bind(id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Update the health status (and optional last error) of a connector.
    pub async fn update_connector_health(
        &self,
        id: &str,
        status: &str,
        last_error: Option<&str>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "UPDATE connectors SET health_status = ?, last_error = ?, updated_at = datetime('now') WHERE id = ?",
        )
        .bind(status)
        .bind(last_error)
        .bind(id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Update the archival statistics for a connector.
    pub async fn update_connector_stats(
        &self,
        id: &str,
        total_archived: i64,
        failed_count: i64,
        success_rate: f64,
        last_archived_at: Option<&str>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"UPDATE connectors
               SET total_archived = ?, failed_count = ?, success_rate = ?,
                   last_archived_at = ?, updated_at = datetime('now')
               WHERE id = ?"#,
        )
        .bind(total_archived)
        .bind(failed_count)
        .bind(success_rate)
        .bind(last_archived_at)
        .bind(id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Delete a connector (cascade deletes its archive logs via FK).
    pub async fn delete_connector(&self, id: &str) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM connectors WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ── Archive logs ──────────────────────────────────────────────────────────

    /// Insert a new archive log entry and return the auto-generated row id.
    pub async fn create_archive_log(
        &self,
        connector_id: &str,
        discord_message_id: Option<&str>,
        discord_channel_id: Option<&str>,
        gr_archive_id: Option<&str>,
        status: &str,
        error_message: Option<&str>,
    ) -> Result<i64, sqlx::Error> {
        let result = sqlx::query(
            r#"INSERT INTO archive_logs
               (connector_id, discord_message_id, discord_channel_id, gr_archive_id, status, error_message)
               VALUES (?, ?, ?, ?, ?, ?)"#,
        )
        .bind(connector_id)
        .bind(discord_message_id)
        .bind(discord_channel_id)
        .bind(gr_archive_id)
        .bind(status)
        .bind(error_message)
        .execute(&self.pool)
        .await?;

        Ok(result.last_insert_rowid())
    }

    /// Fetch the most recent `limit` archive log entries for a connector.
    pub async fn get_archive_logs(
        &self,
        connector_id: &str,
        limit: i64,
    ) -> Result<Vec<ArchiveLogRow>, sqlx::Error> {
        let rows = sqlx::query(
            r#"SELECT * FROM archive_logs
               WHERE connector_id = ?
               ORDER BY archived_at DESC
               LIMIT ?"#,
        )
        .bind(connector_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        rows.iter().map(map_log_row).collect()
    }

    // ── Analytics ─────────────────────────────────────────────────────────────

    /// Return a high-level analytics summary across **all** connectors.
    pub async fn get_analytics_summary(&self) -> Result<AnalyticsSummaryRow, sqlx::Error> {
        // Total archived & active connector count
        let agg_row = sqlx::query(
            r#"SELECT
                 COALESCE(SUM(total_archived), 0)   AS total_archived,
                 COALESCE(SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END), 0) AS active_count,
                 COALESCE(AVG(CASE WHEN total_archived > 0 THEN success_rate ELSE NULL END), 0.0) AS overall_success_rate
               FROM connectors"#,
        )
        .fetch_one(&self.pool)
        .await?;

        let total_archived: i64 = agg_row.try_get("total_archived")?;
        let active_count: i64 = agg_row.try_get("active_count")?;
        let overall_success_rate: f64 = agg_row.try_get("overall_success_rate")?;

        // Archived today
        let today_row = sqlx::query(
            r#"SELECT COALESCE(COUNT(*), 0) AS archived_today
               FROM archive_logs
               WHERE status = 'success'
                 AND date(archived_at) = date('now')"#,
        )
        .fetch_one(&self.pool)
        .await?;

        let archived_today: i64 = today_row.try_get("archived_today")?;

        Ok(AnalyticsSummaryRow {
            total_archived,
            active_count,
            overall_success_rate,
            archived_today,
        })
    }

    /// Return daily success counts for a given connector over the past `days` days.
    pub async fn get_connector_analytics(
        &self,
        connector_id: &str,
        days: i64,
    ) -> Result<Vec<DailyVolumeRow>, sqlx::Error> {
        let rows = sqlx::query(
            r#"SELECT date(archived_at) AS date, COUNT(*) AS count
               FROM archive_logs
               WHERE connector_id = ?
                 AND status = 'success'
                 AND archived_at >= datetime('now', ? || ' days')
               GROUP BY date(archived_at)
               ORDER BY date ASC"#,
        )
        .bind(connector_id)
        .bind(format!("-{days}"))
        .fetch_all(&self.pool)
        .await?;

        rows.iter()
            .map(|r| {
                Ok(DailyVolumeRow {
                    date: r.try_get("date")?,
                    count: r.try_get("count")?,
                })
            })
            .collect()
    }
}

// ─── Implementation of BridgeDb for Database ─────────────────────────────────

impl From<ConnectorRow> for bridge_core::types::EncryptedConnector {
    fn from(row: ConnectorRow) -> Self {
        Self {
            id: uuid::Uuid::parse_str(&row.id).unwrap(),
            name: row.name,
            description: row.description,
            discord_bot_token: bridge_core::Encrypted {
                ciphertext: row.discord_bot_token_enc,
                nonce: row.discord_bot_token_nonce,
            },
            discord_client_id: row.discord_client_id,
            discord_client_secret: bridge_core::Encrypted {
                ciphertext: row.discord_client_secret_enc,
                nonce: row.discord_client_secret_nonce,
            },
            discord_guild_id: row.discord_guild_id,
            discord_guild_name: row.discord_guild_name,
            selected_channel_ids: serde_json::from_str(&row.selected_channel_ids).unwrap_or_default(),
            gr_client_id: bridge_core::Encrypted {
                ciphertext: row.gr_client_id_enc,
                nonce: row.gr_client_id_nonce,
            },
            gr_client_secret: bridge_core::Encrypted {
                ciphertext: row.gr_client_secret_enc,
                nonce: row.gr_client_secret_nonce,
            },
            gr_oauth_url: row.gr_oauth_url,
            gr_api_base_url: row.gr_api_base_url,
            enabled: row.enabled,
            health_status: match row.health_status.as_str() {
                "online" => bridge_core::types::HealthStatus::Online,
                "error" => bridge_core::types::HealthStatus::Error,
                _ => bridge_core::types::HealthStatus::Offline,
            },
            last_error: row.last_error,
            total_archived: row.total_archived as u64,
            failed_count: row.failed_count as u64,
            success_rate: row.success_rate,
            last_archived_at: row.last_archived_at.and_then(|s| {
                chrono::DateTime::parse_from_rfc3339(&s).ok().map(|dt| dt.with_timezone(&chrono::Utc))
            }),
            created_at: chrono::DateTime::parse_from_rfc3339(&row.created_at).ok().map(|dt| dt.with_timezone(&chrono::Utc)).unwrap_or_else(chrono::Utc::now),
            updated_at: chrono::DateTime::parse_from_rfc3339(&row.updated_at).ok().map(|dt| dt.with_timezone(&chrono::Utc)).unwrap_or_else(chrono::Utc::now),
        }
    }
}

#[async_trait]
impl bridge_core::db::BridgeDb for Database {
    async fn list_connectors(&self) -> Result<Vec<bridge_core::types::EncryptedConnector>, bridge_core::error::BridgeError> {
        let rows = self.list_connectors().await
            .map_err(|e| bridge_core::error::BridgeError::Database(e))?;
        Ok(rows.into_iter().map(|r| r.into()).collect())
    }

    async fn get_connector(&self, id: &bridge_core::types::ConnectorId) -> Result<Option<bridge_core::types::EncryptedConnector>, bridge_core::error::BridgeError> {
        let opt = self.get_connector(&id.to_string()).await
            .map_err(|e| bridge_core::error::BridgeError::Database(e))?;
        Ok(opt.map(|r| r.into()))
    }

    async fn create_connector(&self, conn: &bridge_core::types::EncryptedConnector) -> Result<(), bridge_core::error::BridgeError> {
        let channels_json = serde_json::to_string(&conn.selected_channel_ids).unwrap_or_default();
        self.create_connector(
            &conn.id.to_string(),
            &conn.name,
            conn.description.as_deref(),
            &conn.discord_client_id,
            conn.discord_guild_id.as_deref(),
            conn.discord_guild_name.as_deref(),
            &channels_json,
            &conn.gr_oauth_url,
            &conn.gr_api_base_url,
            &conn.discord_bot_token.ciphertext,
            &conn.discord_bot_token.nonce,
            &conn.discord_client_secret.ciphertext,
            &conn.discord_client_secret.nonce,
            &conn.gr_client_id.ciphertext,
            &conn.gr_client_id.nonce,
            &conn.gr_client_secret.ciphertext,
            &conn.gr_client_secret.nonce,
        ).await.map_err(|e| bridge_core::error::BridgeError::Database(e))?;
        Ok(())
    }

    async fn update_connector(&self, conn: &bridge_core::types::EncryptedConnector) -> Result<(), bridge_core::error::BridgeError> {
        let channels_json = serde_json::to_string(&conn.selected_channel_ids).unwrap_or_default();
        let health_status_str = match conn.health_status {
            bridge_core::types::HealthStatus::Online => "online",
            bridge_core::types::HealthStatus::Error => "error",
            bridge_core::types::HealthStatus::Offline => "offline",
        };
        sqlx::query(
            r#"UPDATE connectors
               SET name = ?, description = ?,
                   discord_bot_token_enc = ?, discord_bot_token_nonce = ?,
                   discord_client_id = ?,
                   discord_client_secret_enc = ?, discord_client_secret_nonce = ?,
                   discord_guild_id = ?, discord_guild_name = ?,
                   selected_channel_ids = ?,
                   gr_client_id_enc = ?, gr_client_id_nonce = ?,
                   gr_client_secret_enc = ?, gr_client_secret_nonce = ?,
                   gr_oauth_url = ?, gr_api_base_url = ?,
                   enabled = ?, health_status = ?, last_error = ?,
                   total_archived = ?, failed_count = ?, success_rate = ?,
                   last_archived_at = ?, updated_at = datetime('now')
               WHERE id = ?"#
        )
        .bind(&conn.name)
        .bind(&conn.description)
        .bind(&conn.discord_bot_token.ciphertext)
        .bind(&conn.discord_bot_token.nonce)
        .bind(&conn.discord_client_id)
        .bind(&conn.discord_client_secret.ciphertext)
        .bind(&conn.discord_client_secret.nonce)
        .bind(&conn.discord_guild_id)
        .bind(&conn.discord_guild_name)
        .bind(&channels_json)
        .bind(&conn.gr_client_id.ciphertext)
        .bind(&conn.gr_client_id.nonce)
        .bind(&conn.gr_client_secret.ciphertext)
        .bind(&conn.gr_client_secret.nonce)
        .bind(&conn.gr_oauth_url)
        .bind(&conn.gr_api_base_url)
        .bind(i64::from(conn.enabled))
        .bind(health_status_str)
        .bind(&conn.last_error)
        .bind(conn.total_archived as i64)
        .bind(conn.failed_count as i64)
        .bind(conn.success_rate)
        .bind(conn.last_archived_at.map(|dt| dt.to_rfc3339()))
        .bind(&conn.id.to_string())
        .execute(&self.pool)
        .await
        .map_err(|e| bridge_core::error::BridgeError::Database(e))?;
        Ok(())
    }

    async fn delete_connector(&self, id: &bridge_core::types::ConnectorId) -> Result<(), bridge_core::error::BridgeError> {
        self.delete_connector(&id.to_string()).await
            .map_err(|e| bridge_core::error::BridgeError::Database(e))?;
        Ok(())
    }

    async fn get_analytics_summary(&self) -> Result<bridge_core::types::AnalyticsSummary, bridge_core::error::BridgeError> {
        let r = self.get_analytics_summary().await
            .map_err(|e| bridge_core::error::BridgeError::Database(e))?;
        Ok(bridge_core::types::AnalyticsSummary {
            total_archived: r.total_archived as u64,
            active_connections: r.active_count as u64,
            overall_success_rate: r.overall_success_rate,
            archived_today: r.archived_today as u64,
        })
    }

    async fn get_connector_analytics(&self, id: &bridge_core::types::ConnectorId) -> Result<bridge_core::types::ConnectorAnalytics, bridge_core::error::BridgeError> {
        let r = self.get_connector_analytics(&id.to_string(), 30).await
            .map_err(|e| bridge_core::error::BridgeError::Database(e))?;
        
        let conn_opt = self.get_connector(&id.to_string()).await
            .map_err(|e| bridge_core::error::BridgeError::Database(e))?;

        let (total_archived, failed_count, success_rate) = if let Some(c) = conn_opt {
            (c.total_archived as u64, c.failed_count as u64, c.success_rate)
        } else {
            (0, 0, 0.0)
        };

        Ok(bridge_core::types::ConnectorAnalytics {
            connector_id: *id,
            total_archived,
            failed_count,
            success_rate,
            daily_volume: r.into_iter().map(|dv| {
                bridge_core::types::DailyVolume {
                    date: chrono::NaiveDate::parse_from_str(&dv.date, "%Y-%m-%d")
                        .unwrap_or_else(|_| chrono::Utc::now().date_naive()),
                    count: dv.count as u64,
                }
            }).collect(),
        })
    }
}
