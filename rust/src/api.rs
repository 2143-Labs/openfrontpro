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
    database::{APIAnalysisQueueEntry, APIFinishedGame, APIGetLobby, APIGetLobbyWithConfig},
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

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema, sqlx::FromRow)]
struct DBAnalysisQueueEntry {
    game_id: String,
    requested_unix_sec: i64,
    status: AnalysisQueueStatus,
    started_unix_sec: Option<i64>,
}

impl DBAnalysisQueueEntry {
    fn into_api_entry(self) -> APIAnalysisQueueEntry {
        APIAnalysisQueueEntry {
            game_id: self.game_id,
            queued_for_sec: crate::database::now_unix_sec() - self.requested_unix_sec,
            status: self.status,
            started_at_unix_sec: self.started_unix_sec,
        }
    }
}

fn into_error_resp(e: impl std::fmt::Display) -> Response {
    axum::response::Response::builder()
        .status(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
        .body(axum::body::Body::from(format!("Error: {}", e)))
        .expect("Failed to build response for error message")
}

async fn analysis_queue_handler(
    Extension(database): Extension<PgPool>,
) -> Result<Json<Vec<APIAnalysisQueueEntry>>, Response> {
    // current unix time
    let now = crate::database::now_unix_sec();

    let rows1 = sqlx::query_as!(
        DBAnalysisQueueEntry,
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
        now - (3 * 60 * 60)
    )
    .fetch_all(&database)
    .await
    .map_err(into_error_resp)?;

    let rows2 = sqlx::query_as!(
        DBAnalysisQueueEntry,
        r#"
        SELECT
            game_id, requested_unix_sec,
            status as "status: AnalysisQueueStatus",
            started_unix_sec
        FROM analysis_queue
        WHERE
            status IN ('Completed', 'Cancelled')
            AND (requested_unix_sec > $1)

        ORDER BY requested_unix_sec ASC
        "#,
        // 5 mins ago
        now - (5 * 60)
    )
    .fetch_all(&database)
    .await
    .map_err(into_error_resp)?;

    let mut resp: Vec<_> = rows1
        .into_iter()
        .chain(rows2.into_iter())
        .map(DBAnalysisQueueEntry::into_api_entry)
        .collect();

    // Sort:
    //   1. Running first
    //   2. All others by requested_unix_sec ascending
    resp.sort_by(|a, b| {
        if a.status == AnalysisQueueStatus::Running && b.status != AnalysisQueueStatus::Running {
            std::cmp::Ordering::Less
        } else if a.status != AnalysisQueueStatus::Running
            && b.status == AnalysisQueueStatus::Running
        {
            std::cmp::Ordering::Greater
        } else {
            a.queued_for_sec.cmp(&b.queued_for_sec)
        }
    });

    Ok(Json(resp))
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
pub struct SingleUserResponse {
    user_id: String,
    username: String,
    friends: Vec<String>,
    openfront_player_data: Option<Value>,
    recent_games: Vec<SingleRecentGameEntry>,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
pub struct SingleRecentGameEntry {
    game_id: String,
    client_id: String,
    name_in_that_game: Option<String>,
    flag_in_that_game: Option<String>,
    analysis_complete_time: Option<i64>,
}

async fn get_users_handler(
    Extension(database): Extension<PgPool>,
    Extension(cfg): Extension<Arc<crate::Config>>,
    //_user: APIUser,
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
        recent_games: Vec::new(),
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

    // Fetch overlay player data games
    if let Some(ref ofpid) = user.openfront_player_id {
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

        //Fetch recent games
        user_res.recent_games = sqlx::query_as!(
            SingleRecentGameEntry,
            r#"SELECT
                tpig.game_id, tpig.client_id,
                plys.name AS "name_in_that_game?",
                plys.flag AS "flag_in_that_game?",
                ca.inserted_at_unix_sec AS "analysis_complete_time?"
            FROM
                social.tracked_player_in_game tpig
                LEFT JOIN analysis_1.players plys
                ON
                    tpig.client_id = plys.client_id
                    AND tpig.game_id = plys.game_id
                LEFT JOIN analysis_1.completed_analysis ca
                ON
                    tpig.game_id = ca.game_id
            WHERE
                openfront_player_id = $1
            ORDER BY
                ca.inserted_at_unix_sec DESC NULLS LAST
            "#,
            ofpid
        )
        .fetch_all(&database)
        .await
        .map_err(|e| {
            axum::response::Response::builder()
                .status(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
                .body(axum::body::Body::from(format!(
                    "Failed to fetch recent games: {}",
                    e
                )))
                .expect("Failed to build response for error message")
        })?;
    }

    Ok(Json(user_res))
}

pub async fn open_api_json(Extension(api): Extension<OpenApi>) -> impl aide::axum::IntoApiResponse {
    dbg!(&api);
    Json(api)
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
pub struct APIUserListResponse {
    users: Vec<APIUserItem>,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema, sqlx::FromRow)]
pub struct APIUserItem {
    user_id: Option<String>,
    username: Option<String>,
    is_tracked: Option<bool>,
}

pub async fn all_users_handler(
    Extension(database): Extension<PgPool>,
) -> Result<Json<APIUserListResponse>, Response> {
    let users = sqlx::query_as!(
        APIUserItem,
        "SELECT
            ru.id as user_id, ru.username,
            COALESCE(top.is_tracking, false) as is_tracked
        FROM
            social.registered_users ru
            LEFT JOIN social.tracked_openfront_players top
        ON
            top.openfront_player_id = ru.openfront_player_id
        "
    )
    .fetch_all(&database)
    .await
    .map_err(|e| {
        axum::response::Response::builder()
            .status(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
            .body(axum::body::Body::from(format!(
                "Failed to fetch users: {}",
                e
            )))
            .expect("Failed to build response for error message")
    })?;

    let response = APIUserListResponse { users };

    Ok(Json(response))
}

pub fn routes(_openapi: OpenApi, cors: CorsLayer) -> ApiRouter {
    let api_routes = ApiRouter::new()
        .route("/lobbies", get(lobbies_handler).post(new_lobbies_handler))
        .route("/lobbies/{id}", get(lobbies_id_handler))
        .route("/analysis_queue", get(analysis_queue_handler))
        .route("/users", get(all_users_handler))
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
}
