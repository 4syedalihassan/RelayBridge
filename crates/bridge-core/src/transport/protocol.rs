//! Protocol definitions and frame serialization/deserialization for the local socket IPC.

use serde::{Deserialize, Serialize};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RequestFrame {
    pub id: String,
    pub method: String,
    pub params: serde_json::Value,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ResponseFrame {
    pub id: String,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
}

/// Writes a length-prefixed JSON frame asynchronously.
pub async fn write_frame<S, T>(stream: &mut S, frame: &T) -> std::io::Result<()>
where
    S: AsyncWriteExt + Unpin,
    T: Serialize,
{
    let bytes = serde_json::to_vec(frame)?;
    let len = bytes.len() as u32;
    stream.write_all(&len.to_be_bytes()).await?;
    stream.write_all(&bytes).await?;
    stream.flush().await?;
    Ok(())
}

/// Reads a length-prefixed JSON frame asynchronously.
pub async fn read_frame<S, T>(stream: &mut S) -> std::io::Result<T>
where
    S: AsyncReadExt + Unpin,
    T: serde::de::DeserializeOwned,
{
    let mut len_bytes = [0u8; 4];
    stream.read_exact(&mut len_bytes).await?;
    let len = u32::from_be_bytes(len_bytes) as usize;
    let mut buf = vec![0u8; len];
    stream.read_exact(&mut buf).await?;
    let frame = serde_json::from_slice(&buf)?;
    Ok(frame)
}
