use std::net::SocketAddr;

use aide::{
    axum::ApiRouter,
    openapi::{Info, OpenApi},
    redoc::Redoc,
};
use anyhow::Context;
use axum::{
    Extension, Json,
    extract::{Path, Query},
    response::Response,
};
use clap::Parser;
use schemars::JsonSchema;
use sqlx::PgPool;

async fn serve_file(file_path: &std::path::Path) -> anyhow::Result<Response> {
    let file_contents = tokio::fs::read(file_path).await?;

    let response = Response::builder()
        .header("Content-Type", "application/octet-stream")
        .body(axum::body::Body::from(file_contents))?;

    Ok(response)
}

pub async fn open_api_json(Extension(api): Extension<OpenApi>) -> impl aide::axum::IntoApiResponse {
    dbg!(&api);
    Json(api)
}

#[derive(Debug, Clone, clap::Parser)]
struct Config {
    #[clap(long, default_value = "3000")]
    pub port: u16,
    //#[clap(long, short, env)]
    //pub database_url: String,
    #[clap(long, env, default_value = "info")]
    pub rust_log: String,

    #[clap(
        long,
        env,
        default_value = "postgres://postgres@localhost:5432/openfrontpro"
    )]
    pub database_url: String,
}

// Example Response
//
// {"lobbies":[{"gameID":"8vpnPq5G","numClients":29,"gameConfig":{"gameMap":"Faroe Islands","gameType":"Public","difficulty":"Medium","disableNPCs":false,"infiniteGold":false,"infiniteTroops":false,"instantBuild":false,"gameMode":"Free For All","bots":400,"disabledUnits":[],"maxPlayers":40},"msUntilStart":13941}]}
// {"lobbies":[{"gameID":"U91rErJL","numClients":0,"gameConfig":{"gameMap":"Australia","gameType":"Public","difficulty":"Medium","disableNPCs":false,"infiniteGold":false,"infiniteTroops":false,"instantBuild":false,"gameMode":"Free For All","bots":400,"disabledUnits":[],"maxPlayers":50},"msUntilStart":59901}]}
// {"lobbies":[{"gameID":"PQaySEuD","numClients":33,"gameConfig":{"gameMap":"Gateway to the Atlantic","gameType":"Public","difficulty":"Medium","disableNPCs":true,"infiniteGold":false,"infiniteTroops":false,"instantBuild":false,"gameMode":"Team","bots":400,"disabledUnits":[],"maxPlayers":80,"playerTeams":4},"msUntilStart":45184}]}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
struct PublicLobbiesResponse {
    lobbies: Vec<Lobby>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct Lobby {
    #[serde(rename = "gameID")]
    game_id: String,
    num_clients: i32,
    game_config: GameConfig,
    ms_until_start: u64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, sqlx::FromRow, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct GameConfig {
    game_map: String,
    game_type: String,
    difficulty: String,
    #[serde(rename = "disableNPCs")]
    disable_npcs: bool,
    infinite_gold: bool,
    infinite_troops: bool,
    instant_build: bool,
    game_mode: String,
    bots: i32,
    disabled_units: Vec<String>,
    max_players: i32,
    player_teams: Option<i32>,
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn should_parse_lobby() {
        let jsons = [
            r#"{"lobbies":[{"gameID":"mieEQtXo","numClients":1,"gameConfig":{"gameMap":"World","gameType":"Public","difficulty":"Medium","disableNPCs":false,"infiniteGold":false,"infiniteTroops":false,"instantBuild":false,"gameMode":"Free For All","bots":400,"disabledUnits":[],"maxPlayers":50},"msUntilStart":57198}]}"#,
            r#"{"lobbies":[{"gameID":"Q7GMHhAv","numClients":16,"gameConfig":{"gameMap":"Africa","gameType":"Public","difficulty":"Medium","disableNPCs":false,"infiniteGold":false,"infiniteTroops":false,"instantBuild":false,"gameMode":"Free For All","bots":400,"disabledUnits":[],"maxPlayers":80},"msUntilStart":31378}]}"#,
        ];

        for json in jsons {
            let response: PublicLobbiesResponse = serde_json::from_str(json).unwrap();
            assert!(
                !response.lobbies.is_empty(),
                "Lobby list should not be empty"
            );
            assert!(
                response.lobbies[0].ms_until_start > 0,
                "ms_until_start should be greater than 0"
            );
            assert!(
                !response.lobbies[0].game_config.game_map.is_empty(),
                "game_map should not be empty"
            );
        }
    }
}

async fn get_new_games() -> anyhow::Result<Vec<Lobby>> {
    let new_games = reqwest::get("https://openfront.io/api/public_lobbies")
        .await?
        .json::<PublicLobbiesResponse>()
        .await?;

    Ok(new_games.lobbies)
}

/// This is put into the database for every lobby we see
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, sqlx::FromRow, JsonSchema)]
struct LobbyDBEntry {
    game_id: String,
    teams: Option<i32>,
    max_players: i32,
    game_map: String,
    approx_num_players: i32,
    /// Last seen timestamp in seconds
    first_seen_unix_sec: i64,
    /// Last seen timestamp in seconds
    last_seen_unix_sec: i64,
    completed: bool,
    lobby_config_json: serde_json::Value,
}

impl LobbyDBEntry {
    pub fn lobby_config(&self) -> GameConfig {
        serde_json::from_value(self.lobby_config_json.clone()).expect("Invalid lobby config JSON in database")
    }
}

fn now_unix_sec() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("System time before UNIX EPOCH")
        .as_secs() as i64
}

async fn look_for_new_games(database: PgPool) -> anyhow::Result<()> {
    let mut expected_to_be_new_game_next_check = true;
    let mut last_game_id = String::new();
    loop {
        let new_games = get_new_games().await?;
        let first = new_games.first().context("No new games found...")?;

        if first.game_id != last_game_id {
            tracing::info!(
                expected_to_be_new_game_next_check,
                "New game found: {}",
                first.game_id
            );
            if !expected_to_be_new_game_next_check {
                // We got a new game earlier than expected. The last one must have been full.
                sqlx::query!(
                    "UPDATE lobbies SET approx_num_players = max_players WHERE game_id = $1",
                    last_game_id
                )
                .execute(&database)
                .await?;
            }
            last_game_id = first.game_id.clone();
        }

        sqlx::query!(
            "INSERT INTO
                lobbies (game_id, teams, max_players, game_map, approx_num_players, first_seen_unix_sec, last_seen_unix_sec, lobby_config_json)
            VALUES
                ($1, $2, $3, $4, $5, $6, $6, $7)
            ON CONFLICT (game_id)
            DO UPDATE
                SET approx_num_players = $5
                , last_seen_unix_sec = $6
            ",
            first.game_id,
            first.game_config.player_teams,
            first.game_config.max_players,
            first.game_config.game_map,
            first.num_clients,
            now_unix_sec(),
            serde_json::to_value(&first.game_config).unwrap()
        ).execute(&database).await?;

        let num_players_left = (first.game_config.max_players - first.num_clients).max(0);

        // Wait between 3 and 15 seconds before checking again.
        let next_time = (first.ms_until_start)
            .min(15500)
            .min(num_players_left as u64 * 1000)
            .max(3500)
            - 500;

        expected_to_be_new_game_next_check = next_time > first.ms_until_start;

        tracing::info!(
            "Lobby {} {} has {}/{} players. Starts in {}ms",
            first.game_id,
            first.game_config.game_map,
            first.num_clients,
            first.game_config.max_players,
            first.ms_until_start
        );
        tracing::info!("Next check in {}ms", next_time);
        tokio::time::sleep(tokio::time::Duration::from_millis(next_time)).await;
    }
}

async fn check_if_game_finished(game_id: &str) -> anyhow::Result<(serde_json::Value, bool)> {
    let finished = reqwest::get(format!("https://api.openfront.io/game/{}", game_id))
        .await?
        .json::<serde_json::Value>()
        .await?;

    if finished.get("error").is_some() {
        if finished["error"] == "Not found" {
            return Ok((finished, false));
        }
    }

    if finished.get("gitCommit").is_some() {
        // Game is finished!
        let winning_id = finished["info"]["winner"][1].as_str();
        tracing::info!(winning_id, game_id, "Game is finished.");

        for player in finished["info"]["players"].as_array().unwrap() {
            if player["clientID"].as_str() == winning_id {
                tracing::info!("Winning player: {}", player["username"]);
            }
        }

        return Ok((finished, true));
    }

    tracing::error!("Game {} is in an unknown other state.", game_id);

    anyhow::bail!("Game {} is in an unknown state: {:?}", game_id, finished);
}

async fn look_for_finished_games(database: PgPool) -> anyhow::Result<()> {
    loop {
        let unfinished_games = sqlx::query!(
            "SELECT game_id FROM lobbies WHERE completed = false AND last_seen_unix_sec < extract(epoch from (NOW() - INTERVAL '10 minutes'))"
        ).fetch_all(&database).await?;

        tracing::info!(
            "Found {} unfinished games, checking if they are finished...",
            unfinished_games.len()
        );

        for game in unfinished_games {
            let game_id = &game.game_id;
            let (result_json, finished) = check_if_game_finished(game_id).await?;
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

            if !finished {
                tracing::info!("Game {} is still unfinished.", game_id);
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                continue;
            }

            let mut txn = database.begin().await?;
            sqlx::query!(
                "UPDATE lobbies SET completed = true WHERE game_id = $1",
                game_id
            )
            .execute(&mut *txn)
            .await?;

            sqlx::query!(
                "INSERT INTO finished_games (game_id, result_json) VALUES ($1, $2)",
                game_id,
                result_json
            )
            .execute(&mut *txn)
            .await?;

            txn.commit().await?;

            let dur_secs = result_json["info"]["duration"].as_i64().unwrap_or(0);
            let num_turns = result_json["info"]["num_turns"].as_i64().unwrap_or(0);
            tracing::info!(dur_secs, num_turns, "Game {} is finished. Adding results to db.", game_id);

        }

        tokio::time::sleep(tokio::time::Duration::from_secs(60 * 5)).await;
    }
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, JsonSchema)]
struct LobbyQueryParams {
    completed: Option<bool>,
    game_map: Option<String>,
}

async fn lobbies_handler(
    Extension(database): Extension<PgPool>,
    Query(params): Query<LobbyQueryParams>,
) -> Result<Json<Vec<LobbyDBEntry>>, Response> {
    let mut querybuilder = sqlx::query_builder::QueryBuilder::new(
        "SELECT lobby_config_json, game_id, teams, max_players, game_map, approx_num_players, first_seen_unix_sec, last_seen_unix_sec, completed FROM lobbies",
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

    querybuilder.push(" ORDER BY last_seen_unix_sec DESC");

    let res: Vec<LobbyDBEntry> = querybuilder
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

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, JsonSchema)]
struct FinshedGameDBEntry {
    game_id: String,
    result_json: serde_json::Value,
    inserted_at_unix_sec: i64,
}

async fn game_handler(
    Extension(database): Extension<PgPool>,
    Path(game_id): Path<String>,
) -> Result<Json<serde_json::Value>, Response> {
    let lobby = sqlx::query_as!(
        FinshedGameDBEntry,
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

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = Config::parse();

    let database = PgPool::connect(&config.database_url)
        .await
        .context("Failed to connect to the database")?;

    tracing_subscriber::fmt()
        //.with_max_level(tracing::Level::INFO)
        .with_env_filter(config.rust_log)
        .with_target(false)
        // disabling time is handy because CloudWatch will add the ingestion time.
        .without_time()
        .init();

    let cors = tower_http::cors::CorsLayer::new()
        .allow_origin(tower_http::cors::Any)
        .allow_methods(vec![
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers(tower_http::cors::Any);

    let routes = ApiRouter::new()
        .api_route("/", aide::axum::routing::get(|| async { "Hello, World!" }))
        .route("/lobbies", axum::routing::get(lobbies_handler))
        .route("/games/{game_id}", axum::routing::get(game_handler))
        //.route(
        //"/robots.txt",
        //axum::routing::get(|| async { "User-agent: *\nDisallow: /" }),
        //)
        .route("/openapi.json", axum::routing::get(open_api_json))
        .route("/redoc", Redoc::new("/openapi.json").axum_route());

    let mut openapi = OpenApi {
        info: Info {
            title: "openfront.pro".to_string(),
            version: "1.0.0".to_string(),
            description: Some(
                "This API can be used to access elo data, match data, and more".to_string(),
            ),
            ..Default::default()
        },
        ..Default::default()
    };

    let fin = routes
        .finish_api(&mut openapi)
        .layer(Extension(openapi.clone()))
        .layer(Extension(database.clone()))
        //.layer(NormalizePathLayer::trim_trailing_slash())
        .layer(cors)
        .fallback_service(axum::routing::get_service(
            tower_http::services::ServeDir::new("frontend")
                .append_index_html_on_directories(true)
                .not_found_service(axum::routing::get(|| async {
                    serve_file(&std::path::Path::new("frontend/index.html"))
                        .await
                        .unwrap()
                })),
        ));

    //sqlx::migrate!("./migrations")
    //.run(&database)
    //.await?;

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", config.port)).await?;

    tracing::info!("Listening on http://{}", listener.local_addr()?);

    let db = database.clone();
    tokio::spawn(async move {
        let mut backoff = 0;
        loop {
            if let Err(e) = look_for_new_games(db.clone()).await {
                tracing::error!("Error looking for new games: {}", e);
                tokio::time::sleep(tokio::time::Duration::from_secs(5 + backoff.min(11) * 5)).await;
                backoff += 1;
            } else {
                backoff = 0;
            }
        }
    });

    let db = database.clone();
    tokio::spawn(async move {
        let mut backoff = 0;
        loop {
            if let Err(e) = look_for_finished_games(db.clone()).await {
                tracing::error!("Error looking for finished games: {}", e);
                tokio::time::sleep(tokio::time::Duration::from_secs(5 + backoff.min(11) * 5)).await;
                backoff += 1;
            } else {
                backoff = 0;
            }
        }
    });

    axum::serve(
        listener,
        fin.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    anyhow::bail!("Server stopped unexpectedly");
}
