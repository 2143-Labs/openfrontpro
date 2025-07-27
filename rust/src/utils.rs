#![allow(clippy::all)]

use axum::response::Response;
use serde::de::DeserializeOwned;
use std::future::Future;

/// Serves a file from the filesystem as an HTTP response
pub async fn serve_file(file_path: &std::path::Path) -> anyhow::Result<Response> {
    let mime = mime_guess::from_path(file_path)
        .first_or_octet_stream()
        .to_string();
    let file_contents = tokio::fs::read(file_path).await?;

    let response = Response::builder()
        .header("Content-Type", mime)
        .body(axum::body::Body::from(file_contents))?;

    Ok(response)
}

/// Extension trait for reqwest::Response to provide error handling with anyhow
pub trait ReqwestErrorHandlingExtension
where
    Self: Sized + Send,
{
    fn anyhow_error_text(self) -> impl Future<Output = anyhow::Result<String>> + Send;

    fn anyhow_error_json<T: DeserializeOwned>(
        self,
    ) -> impl Future<Output = anyhow::Result<T>> + Send {
        async move {
            let text = self.anyhow_error_text().await?;
            Ok(serde_json::from_str(&text)?)
        }
    }
}

impl ReqwestErrorHandlingExtension for reqwest::Response {
    async fn anyhow_error_text(self) -> anyhow::Result<String> {
        let status = self.status();
        let url = self.url().to_string();
        let mut text = self.text().await?;

        if !status.is_success() {
            if let Ok(t) = serde_json::from_str::<serde_json::Value>(&text) {
                text = serde_json::to_string_pretty(&t).unwrap();
            }
            tracing::error!(text);
            anyhow::bail!(
                "API Call failed {:?} with code {}: {}",
                url,
                status.as_u16(),
                text
            );
        }

        Ok(text)
    }
}

/// Helper function to load game data for tests
#[cfg(test)]
pub fn load_game_in_test(game_id: &str) -> Option<serde_json::Value> {
    // load it from ./examples/gamedata/
    let dir = include_dir::include_dir!("$CARGO_MANIFEST_DIR/examples/gamedata");
    let file = dir.get_file(&format!("{}.json", game_id))?;
    let json: serde_json::Value = serde_json::from_slice(file.contents())
        .expect("Failed to parse game JSON from examples/gamedata");

    Some(json)
}
