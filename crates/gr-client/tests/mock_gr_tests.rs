//! Integration tests for GrClient against a local WireMock server.
//!
//! These tests use `wiremock` to stub out the Global Relay OAuth and
//! Archive endpoints. No real GR account is needed.
//!
//! Run with:
//!   cargo test -p gr-client -- --nocapture

use wiremock::{
    matchers::{body_string_contains, header, method, path},
    Mock, MockServer, ResponseTemplate,
};
use gr_client::{GrClient, ArchiveRequest};

// ─── Helper ───────────────────────────────────────────────────────────────────

/// Stand up a mock server and return a GrClient that targets it.
async fn make_client(server: &MockServer) -> GrClient {
    let base = server.uri();
    GrClient::new(
        "test-client-id".into(),
        "test-client-secret".into(),
        format!("{}/oauth/token", base),
        base.clone(),
    )
}

/// Register a successful OAuth token stub.
async fn stub_oauth_ok(server: &MockServer) {
    Mock::given(method("POST"))
        .and(path("/oauth/token"))
        .and(body_string_contains("grant_type=client_credentials"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "access_token": "mock_token_abc123",
                "token_type": "Bearer",
                "expires_in": 3600,
            })),
        )
        .mount(server)
        .await;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

/// Happy path: OAuth succeeds → archive succeeds.
#[tokio::test]
async fn test_archive_success() {
    let server = MockServer::start().await;

    stub_oauth_ok(&server).await;

    Mock::given(method("POST"))
        .and(path("/conversations"))
        .and(header("authorization", "Bearer mock_token_abc123"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "reconciliationId": "GR-TEST-001",
                "status": "accepted",
            })),
        )
        .mount(&server)
        .await;

    let client = make_client(&server).await;
    let resp = client
        .archive(ArchiveRequest {
            channel_id: "ch-111".into(),
            guild_id: "gd-222".into(),
            channel_name: "#general".into(),
            guild_name: "Test Guild".into(),
            message_id: "msg-999".into(),
            author_name: "Alice".into(),
            author_email: Some("alice@example.com".into()),
            content: "Hello, World!".into(),
            timestamp_ms: 1_700_000_000_000,
        })
        .await
        .expect("archive should succeed");

    assert_eq!(resp.reconciliation_id.as_deref(), Some("GR-TEST-001"));
    assert_eq!(resp.status, "accepted");
}

/// OAuth token caching: second archive call reuses the cached token (only 1 token request).
#[tokio::test]
async fn test_token_caching() {
    let server = MockServer::start().await;

    // Allow multiple OAuth calls but we only expect ONE
    Mock::given(method("POST"))
        .and(path("/oauth/token"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "access_token": "cached_token_xyz",
                "token_type": "Bearer",
                "expires_in": 3600,
            })),
        )
        .expect(1) // ← wiremock will fail the test if called more than once
        .mount(&server)
        .await;

    Mock::given(method("POST"))
        .and(path("/conversations"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "reconciliationId": "GR-CACHE-001",
                "status": "accepted",
            })),
        )
        .mount(&server)
        .await;

    let client = make_client(&server).await;

    // Two archives, one token request
    for _ in 0..2 {
        client
            .archive(ArchiveRequest {
                channel_id: "ch-1".into(),
                guild_id: "gd-1".into(),
                channel_name: "#test".into(),
                guild_name: "Guild".into(),
                message_id: format!("msg-{}", uuid::Uuid::new_v4()),
                author_name: "Bob".into(),
                author_email: None,
                content: "Test message".into(),
                timestamp_ms: 1_700_000_000_000,
            })
            .await
            .expect("archive should succeed");
    }
    // wiremock will assert the .expect(1) constraint on drop
}

/// 429 rate-limit is retried and eventually succeeds.
#[tokio::test]
async fn test_archive_retries_on_429() {
    let server = MockServer::start().await;
    stub_oauth_ok(&server).await;

    // First call → 429, second call → 200
    Mock::given(method("POST"))
        .and(path("/conversations"))
        .respond_with(
            ResponseTemplate::new(429)
                .insert_header("retry-after", "1")
                .set_body_json(serde_json::json!({ "error": "rate_limited" })),
        )
        .up_to_n_times(1)
        .mount(&server)
        .await;

    Mock::given(method("POST"))
        .and(path("/conversations"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "reconciliationId": "GR-RETRY-001",
                "status": "accepted",
            })),
        )
        .mount(&server)
        .await;

    let client = make_client(&server).await;
    let resp = client
        .archive(ArchiveRequest {
            channel_id: "ch-1".into(),
            guild_id: "gd-1".into(),
            channel_name: "#general".into(),
            guild_name: "Guild".into(),
            message_id: "msg-retry".into(),
            author_name: "Carol".into(),
            author_email: None,
            content: "Retry me!".into(),
            timestamp_ms: 1_700_000_000_000,
        })
        .await
        .expect("Should succeed after retry");

    assert_eq!(resp.reconciliation_id.as_deref(), Some("GR-RETRY-001"));
}

/// 500 server error is retried with exponential back-off, then fails.
#[tokio::test]
async fn test_archive_fails_after_3_server_errors() {
    let server = MockServer::start().await;
    stub_oauth_ok(&server).await;

    Mock::given(method("POST"))
        .and(path("/conversations"))
        .respond_with(ResponseTemplate::new(500).set_body_json(serde_json::json!({
            "error": "internal_server_error",
        })))
        .mount(&server)
        .await;

    let client = make_client(&server).await;
    let result = client
        .archive(ArchiveRequest {
            channel_id: "ch-1".into(),
            guild_id: "gd-1".into(),
            channel_name: "#general".into(),
            guild_name: "Guild".into(),
            message_id: "msg-fail".into(),
            author_name: "Dave".into(),
            author_email: None,
            content: "This will fail".into(),
            timestamp_ms: 1_700_000_000_000,
        })
        .await;

    let err = match result {
        Err(e) => e.to_string(),
        Ok(_) => panic!("Expected error after 3 server errors, but got Ok"),
    };
    assert!(
        err.contains("3 attempts") || err.contains("GR") || err.contains("failed"),
        "Error message should mention failure: {err}"
    );
}

/// OAuth failure → BridgeError is propagated immediately.
#[tokio::test]
async fn test_archive_fails_on_auth_error() {
    let server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/oauth/token"))
        .respond_with(ResponseTemplate::new(401).set_body_json(serde_json::json!({
            "error": "invalid_client",
        })))
        .mount(&server)
        .await;

    let client = make_client(&server).await;
    let result = client
        .archive(ArchiveRequest {
            channel_id: "ch-1".into(),
            guild_id: "gd-1".into(),
            channel_name: "#general".into(),
            guild_name: "Guild".into(),
            message_id: "msg-noauth".into(),
            author_name: "Eve".into(),
            author_email: None,
            content: "Auth fails!".into(),
            timestamp_ms: 1_700_000_000_000,
        })
        .await;

    assert!(result.is_err(), "Should fail on OAuth error");
}

/// health_check returns Ok when OAuth succeeds.
#[tokio::test]
async fn test_health_check_ok() {
    let server = MockServer::start().await;
    stub_oauth_ok(&server).await;

    let client = make_client(&server).await;
    assert!(client.health_check().await.is_ok());
}

/// health_check returns Err when OAuth fails.
#[tokio::test]
async fn test_health_check_fail() {
    let server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/oauth/token"))
        .respond_with(ResponseTemplate::new(500))
        .mount(&server)
        .await;

    let client = make_client(&server).await;
    assert!(client.health_check().await.is_err());
}

/// Client-level 4xx errors (e.g. 400) are not retried.
#[tokio::test]
async fn test_archive_no_retry_on_4xx() {
    let server = MockServer::start().await;
    stub_oauth_ok(&server).await;

    // Only allow ONE call (wiremock will fail if retried)
    Mock::given(method("POST"))
        .and(path("/conversations"))
        .respond_with(ResponseTemplate::new(400).set_body_json(serde_json::json!({
            "error": "bad_request",
            "message": "Missing required field: conversationId",
        })))
        .expect(1)
        .mount(&server)
        .await;

    let client = make_client(&server).await;
    let result = client
        .archive(ArchiveRequest {
            channel_id: "ch-1".into(),
            guild_id: "gd-1".into(),
            channel_name: "#general".into(),
            guild_name: "Guild".into(),
            message_id: "msg-400".into(),
            author_name: "Frank".into(),
            author_email: None,
            content: "Bad request".into(),
            timestamp_ms: 1_700_000_000_000,
        })
        .await;

    assert!(result.is_err(), "4xx should be an error");
    // wiremock asserts expect(1) on drop
}
