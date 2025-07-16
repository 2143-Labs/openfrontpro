use std::{net::SocketAddr, path::Path};

use aide::{
    axum::ApiRouter,
    openapi::{Info, OpenApi},
    redoc::Redoc,
};
use anyhow::Context;
use axum::{Extension, Json, response::Response};
use clap::Parser;
use schemars::JsonSchema;
use sqlx::PgPool;

async fn serve_file(file_path: &Path) -> anyhow::Result<Response> {
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

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct Lobby {
    #[serde(rename = "gameID")]
    game_id: String,
    num_clients: i32,
    game_config: GameConfig,
    ms_until_start: u64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
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
}

async fn look_for_new_games(database: PgPool) -> anyhow::Result<()> {
    let mut expected_to_be_new_game_next_check = true;
    let mut last_game_id = String::new();
    loop {
        let new_games = get_new_games().await?;
        let first = new_games.first().context("No new games found...")?;

        let now_unix_sec = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .context("System time before UNIX EPOCH")?
            .as_secs();

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
                lobbies (game_id, teams, max_players, game_map, approx_num_players, first_seen_unix_sec, last_seen_unix_sec)
            VALUES
                ($1, $2, $3, $4, $5, $6, $6)
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
            now_unix_sec as i64
        ).execute(&database).await?;

        let num_players_left = first.game_config.max_players - first.num_clients;

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

async fn lobbies_handler(
    Extension(database): Extension<PgPool>,
) -> Result<Json<Vec<LobbyDBEntry>>, Response> {
    let res = sqlx::query_as!(
        LobbyDBEntry,
        "SELECT game_id, teams, max_players, game_map, approx_num_players, first_seen_unix_sec, last_seen_unix_sec FROM lobbies ORDER BY last_seen_unix_sec DESC LIMIT 1000 "
    )
    .fetch_all(&database)
    .await.map_err(|e| {
        axum::response::Response::builder()
            .status(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
            .body(axum::body::Body::from(format!("Database query failed: {}", e)))
            .expect("Failed to build response for error message")
    })?;

    Ok(Json(res))
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
                    serve_file(&Path::new("frontend/index.html")).await.unwrap()
                })),
        ));

    //sqlx::migrate!("./migrations")
    //.run(&database)
    //.await?;

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", config.port)).await?;

    tracing::info!("Listening on http://{}", listener.local_addr()?);

    tokio::spawn(async move {
        loop {
            if let Err(e) = look_for_new_games(database.clone()).await {
                tracing::error!("Error looking for new games: {}", e);
                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
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
