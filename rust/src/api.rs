#![allow(clippy::all)]

use std::sync::Arc;

use aide::{axum::ApiRouter, openapi::OpenApi, redoc::Redoc};
use axum::{
    Extension, Json,
    extract::{Path, Query},
    response::Response,
    routing::{get, post},
};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;
use tower_http::cors::CorsLayer;
use tracing::info;

pub mod openfrontapi;

use crate::{
    AnalysisQueueStatus, analysis,
    api::openfrontapi::{OpenFrontAPI, PublicLobbiesResponse},
    database::{
        APIAnalysisQueueEntry, APIFinishedGame, APIGetLobby, APIGetLobbyWithConfig, now_unix_sec,
    },
    oauth::APIUser,
    tasks,
};
use anyhow::Result;

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
async fn new_lobbies_handler(
    Extension(database): Extension<PgPool>,
    Json(body): Json<PublicLobbiesResponse>,
) -> Result<String, Response> {
    if let Some(lobby) = body.lobbies.first() {
        tasks::insert_new_game(&lobby, &database)
            .await
            .map_err(|e| {
                axum::response::Response::builder()
                    .status(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
                    .body(axum::body::Body::from(format!(
                        "Failed to insert new game: {}",
                        e
                    )))
                    .expect("Failed to build response for error message")
            })?;
    }

    Ok("Lobbies processed successfully".to_string())
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
    user: APIUser,
) -> Result<(), Response> {
    //Insert into analysis_queue
    let res = sqlx::query!(
        "INSERT INTO analysis_queue (game_id, requesting_user_id)
         VALUES ($1, $2)",
        game_id,
        user.user_id,
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
    user: APIUser,
) -> Result<(), Response> {
    // Set status to cancelled
    let res = sqlx::query!(
        "UPDATE analysis_queue SET status = 'Cancelled' WHERE game_id = $1 AND requesting_user_id = $2",
        game_id,
        user.user_id,
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
        SELECT
            game_id, requested_unix_sec,
            status as "status: AnalysisQueueStatus",
            started_unix_sec
        FROM analysis_queue
        WHERE
            status IN ('Pending', 'Running', 'NotFound', 'Failed', 'Stalled')
            AND (requested_unix_sec > $1 OR status = 'Pending' OR status = 'Running')

        ORDER BY requested_unix_sec ASC
        "#,
        // 3 hours ago
        now_unix_sec() - (3 * 60 * 60)
    )
    .fetch_all(&database)
    .await
    .map_err(|e| {
        axum::response::Response::builder()
            .status(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
            .body(axum::body::Body::from(format!(
                "Database query failed: {}",
                e
            )))
            .expect("Failed to build response")
    })?;

    let resp = rows
        .into_iter()
        .map(|r| APIAnalysisQueueEntry {
            game_id: r.game_id,
            queued_for_sec: now - r.requested_unix_sec,
            status: r.status,
            started_at_unix_sec: r.started_unix_sec,
        })
        .collect();

    Ok(Json(resp))
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
struct SingleUserResponse {
    user_id: String,
    username: String,
    friends: Vec<String>,
    openfront_player_data: Option<Value>,
}

async fn get_users_handler(
    Extension(database): Extension<PgPool>,
    Extension(cfg): Extension<Arc<crate::Config>>,
    _user: APIUser,
    Path(user_id): Path<String>,
) -> Result<Json<SingleUserResponse>, Response> {
    let user = sqlx::query!(
        "SELECT
            u.id, u.username, u.openfront_player_id
        FROM
            social.registered_users u
        WHERE
            u.id = $1
        ",
        user_id
    )
    .fetch_one(&database)
    .await
    .map_err(|e| {
        axum::response::Response::builder()
            .status(axum::http::StatusCode::NOT_FOUND)
            .body(axum::body::Body::from(format!("User not found: {}", e)))
            .expect("Failed to build response for error message")
    })?;

    let mut user_res = SingleUserResponse {
        user_id: user.id.clone(),
        username: user.username.clone(),
        friends: Vec::new(),
        openfront_player_data: None,
    };

    // Fetch friends
    let friends_res = sqlx::query!(
        "SELECT friend_id, user_id FROM social.friends WHERE user_id = $1 OR friend_id = $1",
        user.id
    )
    .fetch_all(&database)
    .await
    .map_err(|e| {
        axum::response::Response::builder()
            .status(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
            .body(axum::body::Body::from(format!(
                "Failed to fetch friends: {}",
                e
            )))
            .expect("Failed to build response for error message")
    })?;

    user_res.friends = friends_res
        .into_iter()
        .map(|f| {
            if f.user_id == user.id {
                f.friend_id
            } else {
                f.user_id
            }
        })
        .collect();

    // Fetch recent games
    if let Some(ofpid) = user.openfront_player_id {
        info!("Fetching OpenFront player data for user: {}", ofpid);
        user_res.openfront_player_data = Some(cfg.get_player_data(&ofpid).await.map_err(|e| {
            axum::response::Response::builder()
                .status(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
                .body(axum::body::Body::from(format!(
                    "Failed to fetch OpenFront player data: {}",
                    e
                )))
                .expect("Failed to build response for error message")
        })?);
    }

    Ok(Json(user_res))
}

pub async fn open_api_json(Extension(api): Extension<OpenApi>) -> impl aide::axum::IntoApiResponse {
    dbg!(&api);
    Json(api)
}

pub fn routes(database: PgPool, _openapi: OpenApi, cors: CorsLayer) -> ApiRouter {
    let api_routes = ApiRouter::new()
        .route("/lobbies", get(lobbies_handler).post(new_lobbies_handler))
        .route("/lobbies/{id}", get(lobbies_id_handler))
        .route("/analysis_queue", get(analysis_queue_handler))
        .route("/users/{user_id}", get(get_users_handler))
        .route("/games/{game_id}", get(game_handler))
        .route(
            "/games/{game_id}/analyze",
            post(game_analyze_handler).delete(game_analyze_handler_delete),
        )
        .nest("/analysis/", analysis::api::analysis_api_router());

    ApiRouter::new()
        .route("/health", get(|| async { "ok!" }))
        .nest("/api/v1/", api_routes)
        .nest("/oauth/discord/", crate::oauth::routes())
        .route("/openapi.json", get(open_api_json))
        .route("/redoc", Redoc::new("/openapi.json").axum_route())
        .layer(cors)
        .layer(Extension(database))
}
