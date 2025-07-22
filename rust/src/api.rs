#![allow(clippy::all)]

use aide::{axum::ApiRouter, openapi::OpenApi, redoc::Redoc};
use axum::{
    extract::{Path, Query}, response::Response, routing::{get, post}, Extension, Json
};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;
use tower_http::cors::CorsLayer;

use std::future::Future;
use std::sync::Arc;

use crate::{
    Config,
    database::{APIAnalysisQueueEntry, APIFinishedGame, APIGetLobby, APIGetLobbyWithConfig, AnalysisQueueStatus, GameConfig},
};
use anyhow::Result;

use crate::utils::ReqwestErrorHandlingExtension;

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
struct LobbyQueryParams {
    completed: Option<bool>,
    has_analysis: Option<bool>,
    game_map: Option<String>,
    /// Unix timestamp in seconds
    after: Option<i64>,
    /// Unix timestamp in seconds
    before: Option<i64>,
}

async fn lobbies_id_handler(
    Extension(database): Extension<PgPool>,
    Path(id): Path<String>,
) -> Result<Json<APIGetLobbyWithConfig>, Response> {
    let d = sqlx::query_as!(
        APIGetLobbyWithConfig,
        r#"SELECT
            lo.*,
            (co.inserted_at_unix_sec IS NOT NULL) AS "analysis_complete!"
        FROM
            lobbies lo
            LEFT JOIN analysis_1.completed_analysis co
            ON lo.game_id = co.game_id
        WHERE lo.game_id = $1"#,
        id
    );

    let lobby = d.fetch_one(&database).await.map_err(|e| {
        axum::response::Response::builder()
            .status(axum::http::StatusCode::NOT_FOUND)
            .body(axum::body::Body::from(format!("Lobby not found: {}", e)))
            .expect("Failed to build response for error message")
    })?;

    Ok(Json(lobby))
}

async fn lobbies_handler(
    Extension(database): Extension<PgPool>,
    Query(params): Query<LobbyQueryParams>,
) -> Result<Json<Vec<APIGetLobby>>, Response> {
    let mut querybuilder = sqlx::query_builder::QueryBuilder::new(
        r#"
        SELECT
            lo.game_id, lo.teams, lo.max_players, lo.game_map, lo.approx_num_players,
            lo.first_seen_unix_sec, lo.last_seen_unix_sec, lo.completed,
            (co.inserted_at_unix_sec IS NOT NULL) AS "analysis_complete!"
        FROM
            public.lobbies lo
            LEFT JOIN analysis_1.completed_analysis co
            ON lo.game_id = co.game_id
        "#,
    );

    let mut _has_where = false;

    if let Some(completed) = params.completed {
        if _has_where {
            querybuilder.push(" AND ");
        } else {
            querybuilder.push(" WHERE ");
        }
        _has_where = true;

        querybuilder.push(" completed = ");
        querybuilder.push_bind(completed);
    }

    if let Some(ref before) = params.before {
        if _has_where {
            querybuilder.push(" AND ");
        } else {
            querybuilder.push(" WHERE ");
        }
        _has_where = true;

        querybuilder.push("last_seen_unix_sec < ");
        querybuilder.push_bind(before);
    }

    if let Some(ref after) = params.after {
        if _has_where {
            querybuilder.push(" AND ");
        } else {
            querybuilder.push(" WHERE ");
        }
        _has_where = true;

        querybuilder.push("first_seen_unix_sec > ");
        querybuilder.push_bind(after);
    }

    if let Some(ref game_map) = params.game_map {
        if _has_where {
            querybuilder.push(" AND ");
        } else {
            querybuilder.push(" WHERE ");
        }
        _has_where = true;

        querybuilder.push("game_map = ");
        querybuilder.push_bind(game_map);
    }

    if let Some(has_analysis) = params.has_analysis {
        if _has_where {
            querybuilder.push(" AND ");
        } else {
            querybuilder.push(" WHERE ");
        }
        _has_where = true;

        querybuilder.push("co.inserted_at_unix_sec IS ");
        if has_analysis {
            querybuilder.push("NOT NULL");
        } else {
            querybuilder.push("NULL");
        }
    }

    querybuilder.push(" ORDER BY last_seen_unix_sec DESC LIMIT 100");

    let res: Vec<APIGetLobby> = querybuilder
        .build_query_as()
        .fetch_all(&database)
        .await
        .map_err(|e| {
            axum::response::Response::builder()
                .status(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
                .body(axum::body::Body::from(format!(
                    "Database query failed: {}",
                    e
                )))
                .expect("Failed to build response for error message")
        })?;

    Ok(Json(res))
}

async fn game_handler(
    Extension(database): Extension<PgPool>,
    Path(game_id): Path<String>,
) -> Result<Json<Value>, Response> {
    let lobby = sqlx::query_as!(
        APIFinishedGame,
        "SELECT game_id, result_json, inserted_at_unix_sec FROM finished_games WHERE game_id = $1",
        game_id
    )
    .fetch_one(&database)
    .await
    .map_err(|e| {
        axum::response::Response::builder()
            .status(axum::http::StatusCode::NOT_FOUND)
            .body(axum::body::Body::from(format!("Lobby not found: {}", e)))
            .expect("Failed to build response for error message")
    })?;

    Ok(Json(lobby.result_json))
}

async fn game_analyze_handler(
    Extension(database): Extension<PgPool>,
    Path(game_id): Path<String>,
) -> Result<(), Response> {
    //Insert into analysis_queue
    let res = sqlx::query!(
        "INSERT INTO analysis_queue (game_id)
         VALUES ($1)",
        game_id,
    )
    .execute(&database)
    .await;

    match res {
        Ok(_) => Ok(()),
        Err(e) => Err(axum::response::Response::builder()
            .status(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
            .body(axum::body::Body::from(format!(
                "Failed to queue analysis: {}",
                e
            )))
            .expect("Failed to build response for error message")),
    }
}

async fn game_analyze_handler_delete(
    Extension(database): Extension<PgPool>,
    Path(game_id): Path<String>,
) -> Result<(), Response> {
    // Set status to cancelled
    let res = sqlx::query!(
        "UPDATE analysis_queue SET status = 'Cancelled' WHERE game_id = $1",
        game_id,
    )
    .execute(&database)
    .await;

    match res {
        Ok(_) => Ok(()),
        Err(e) => Err(axum::response::Response::builder()
            .status(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
            .body(axum::body::Body::from(format!(
                "Failed to cancel analysis: {}",
                e
            )))
            .expect("Failed to build response for error message")),
    }
}

async fn analysis_queue_handler(
    Extension(database): Extension<PgPool>,
) -> Result<Json<Vec<APIAnalysisQueueEntry>>, Response> {
    // current unix time
    let now = crate::database::now_unix_sec();

    let rows = sqlx::query!(
        r#"
        SELECT game_id, requested_unix_sec
        FROM analysis_queue
        WHERE status = ANY($1)
        ORDER BY requested_unix_sec ASC
        "#,
        &[
            AnalysisQueueStatus::Pending,
            AnalysisQueueStatus::Running
        ] as &[AnalysisQueueStatus]
    )
    .fetch_all(&database)
    .await
    .map_err(|e| axum::response::Response::builder()
        .status(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
        .body(axum::body::Body::from(format!("Database query failed: {}", e)))
        .expect("Failed to build response"))?;

    let resp = rows
        .into_iter()
        .map(|r| APIAnalysisQueueEntry {
            game_id: r.game_id,
            queued_for_sec: now - r.requested_unix_sec,
        })
        .collect();

    Ok(Json(resp))
}

pub async fn open_api_json(Extension(api): Extension<OpenApi>) -> impl aide::axum::IntoApiResponse {
    dbg!(&api);
    Json(api)
}

/// Response from openfront.io/public/lobbies
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PublicLobbiesResponse {
    pub lobbies: Vec<Lobby>,
}

/// See [`PublicLobbiesResponse`]
#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Lobby {
    #[serde(rename = "gameID")]
    pub game_id: String,
    pub num_clients: i32,
    pub game_config: GameConfig,
    pub ms_until_start: u64,
}

#[mockall::automock]
/// Trait for OpenFront API interactions
pub trait OpenFrontAPI {
    fn get_game_json(&self, game_id: &str) -> impl Future<Output = Result<Value>> + Send;
    fn get_lobbies(&self) -> impl Future<Output = Result<PublicLobbiesResponse>> + Send;
}

impl OpenFrontAPI for Config {
    async fn get_game_json(&self, game_id: &str) -> Result<Value> {
        let url = format!("{}/game/{}", self.openfront_api_url, game_id);

        let finished = reqwest::get(url).await?.json::<Value>().await?;

        Ok(finished)
    }

    async fn get_lobbies(&self) -> Result<PublicLobbiesResponse> {
        let mut base = reqwest::Client::new().get(&self.openfront_lobby_url);
        if let Some(ref useragent) = self.useragent {
            base = base.header(reqwest::header::USER_AGENT, useragent);
        }
        if let Some(ref cookie) = self.cookie {
            base = base.header(reqwest::header::COOKIE, cookie);
        }

        let new_games = base
            .send()
            .await?
            .anyhow_error_json::<PublicLobbiesResponse>()
            .await?;

        Ok(new_games)
    }
}

impl<T> OpenFrontAPI for &T
where
    T: OpenFrontAPI + ?Sized,
{
    fn get_game_json(&self, game_id: &str) -> impl Future<Output = Result<Value>> + Send {
        T::get_game_json(self, game_id)
    }

    fn get_lobbies(&self) -> impl Future<Output = Result<PublicLobbiesResponse>> + Send {
        T::get_lobbies(self)
    }
}

impl<T> OpenFrontAPI for Arc<T>
where
    T: OpenFrontAPI + ?Sized,
{
    fn get_game_json(&self, game_id: &str) -> impl Future<Output = Result<Value>> + Send {
        T::get_game_json(self, game_id)
    }

    fn get_lobbies(&self) -> impl Future<Output = Result<PublicLobbiesResponse>> + Send {
        T::get_lobbies(self)
    }
}

pub fn routes(database: PgPool, _openapi: OpenApi, cors: CorsLayer) -> ApiRouter {
    let api_routes = ApiRouter::new()
        .route("/lobbies", get(lobbies_handler))
        .route("/lobbies/{id}", get(lobbies_id_handler))
        .route("/games/{game_id}", get(game_handler))
        .route(
            "/games/{game_id}/analyze",
            post(game_analyze_handler).delete(game_analyze_handler_delete),
        );

    ApiRouter::new()
        .route("/health", get(|| async { "ok!" }))
        .nest("/api/v1/", api_routes)
        .nest("/oauth/discord/", crate::oauth::routes())
        .route("/openapi.json", get(open_api_json))
        .route("/redoc", Redoc::new("/openapi.json").axum_route())
        .layer(cors)
        .layer(Extension(database))
}
