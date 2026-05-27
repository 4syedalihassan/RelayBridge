//! Transport module for local socket IPC (UDS/Named Pipe).

pub mod protocol;
pub mod local_socket;

pub use local_socket::{LocalSocketManager, LocalSocketServer, LocalStream, LocalListener, connect};
