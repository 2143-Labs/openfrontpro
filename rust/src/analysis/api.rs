use std::sync::Arc;

use aide::axum::ApiRouter;
use axum::{Extension, Json, extract::Path, routing::get};
use schemars::JsonSchema;
use sqlx::PgPool;

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, JsonSchema)]
struct JErrorResponse {
    error: String,
}

fn error_response(_statuscode: u16, message: &str) -> Json<JErrorResponse> {
    Json(JErrorResponse {
        error: message.to_string(),
    })
}

#[axum::debug_handler]
async fn player_stats_handler(
    Extension(db): Extension<PgPool>,
    Extension(db2): Extension<Arc<tokio_postgres::Client>>,
    Path(game_id): Path<String>,
) -> axum::response::Result<Json<super::methods::ResStatsOverGame>> {
    let res = super::methods::get_troops_over_game(db, &game_id)
        .await
        .map_err(|e| error_response(500, &format!("Failed to get player stats: {}", e)))?;

    Ok(Json(res))
}

async fn general_events_handler(
    Extension(db): Extension<PgPool>,
    Path(game_id): Path<String>,
) -> axum::response::Result<Json<super::methods::ResGeneralEventsOverGame>> {
    let res = super::methods::get_general_events_over_game(db, &game_id)
        .await
        .map_err(|e| error_response(500, &format!("Failed to get general events: {}", e)))?;

    Ok(Json(res))
}

async fn display_events_handler(
    Extension(db): Extension<PgPool>,
    Path(game_id): Path<String>,
) -> axum::response::Result<Json<super::methods::ResDisplayEventsOverGame>> {
    let res = super::methods::get_display_events_over_game(db, &game_id)
        .await
        .map_err(|e| error_response(500, &format!("Failed to get display events: {}", e)))?;

    Ok(Json(res))
}

async fn players_handler(
    Extension(db): Extension<PgPool>,
    Extension(db2): Extension<Arc<tokio_postgres::Client>>,
    Path(game_id): Path<String>,
) -> axum::response::Result<Json<super::methods::ResPlayer>> {
    let res = super::methods::get_game_players(db, &game_id)
        .await
        .map_err(|e| error_response(500, &format!("Failed to get players: {}", e)))?;

    Ok(Json(res))
}

pub fn analysis_api_router() -> ApiRouter {
    ApiRouter::new()
        .route("/{game_id}/get_player_stats", get(player_stats_handler))
        .route("/{game_id}/get_general_events", get(general_events_handler))
        .route("/{game_id}/get_display_events", get(display_events_handler))
        .route("/{game_id}/players", get(players_handler))
}
