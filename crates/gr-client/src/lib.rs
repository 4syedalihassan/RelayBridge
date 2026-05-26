//! Global Relay API client — handles OAuth2 authentication and message archival.

pub mod auth;
pub mod client;

pub use client::{ArchiveRequest, ArchiveResponse, GrClient};
