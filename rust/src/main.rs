#![allow(unused)]
use std::{net::SocketAddr, sync::Arc};

mod api;
mod database;
mod middleware;
mod oauth;
mod tasks;
mod utils;

use aide::openapi::{Info, OpenApi};
use anyhow::Context;
use axum::Extension;
use clap::Parser;
use schemars::JsonSchema;
use sqlx::PgPool;

// Import database types
use database::{
    AnalysisQueueStatus, FinshedGameDBEntry, GameConfig, LobbyDBEntry, LobbyDBEntryNoConfig,
    PlayerTeams, StringOrInt, now_unix_sec,
};

// Import utility functions
#[cfg(test)]
use api::MockOpenFrontAPI;
use api::{Lobby, OpenFrontAPI, PublicLobbiesResponse};
#[cfg(test)]
use utils::load_game_in_test;
use utils::serve_file;

#[derive(Debug, Clone, clap::Parser)]
pub struct Config {
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

    #[clap(long, env)]
    pub useragent: Option<String>,

    #[clap(long, env)]
    pub cookie: Option<String>,

    #[clap(long, env, default_value = "https://openfront.io/api/public_lobbies")]
    pub openfront_lobby_url: String,

    #[clap(long, env, default_value = "https://api.openfront.io")]
    pub openfront_api_url: String,

    #[clap(long, env, default_value = "./frontend")]
    pub frontend_folder: String,

    #[clap(long, env)]
    pub discord_client_id: Option<String>,

    #[clap(long, env)]
    pub discord_client_secret: Option<String>,

    #[clap(
        long,
        env,
        default_value = "http://localhost:3000/auth/discord/callback"
    )]
    pub discord_redirect_uri: String,

    #[clap(long, env, short = 'd')]
    pub disable_tasks: Vec<ActiveTasks>,
}

#[derive(
    Debug, Clone, serde::Deserialize, serde::Serialize, JsonSchema, clap::ValueEnum, PartialEq, Eq,
)]
pub enum ActiveTasks {
    LookForNewGames,
    LookForLobbyGames,
    LookForNewGamesInAnalysisQueue,
}

// Example Response
//
// {"lobbies":[{"gameID":"8vpnPq5G","numClients":29,"gameConfig":{"gameMap":"Faroe Islands","gameType":"Public","difficulty":"Medium","disableNPCs":false,"infiniteGold":false,"infiniteTroops":false,"instantBuild":false,"gameMode":"Free For All","bots":400,"disabledUnits":[],"maxPlayers":40},"msUntilStart":13941}]}
// {"lobbies":[{"gameID":"U91rErJL","numClients":0,"gameConfig":{"gameMap":"Australia","gameType":"Public","difficulty":"Medium","disableNPCs":false,"infiniteGold":false,"infiniteTroops":false,"instantBuild":false,"gameMode":"Free For All","bots":400,"disabledUnits":[],"maxPlayers":50},"msUntilStart":59901}]}
// {"lobbies":[{"gameID":"PQaySEuD","numClients":33,"gameConfig":{"gameMap":"Gateway to the Atlantic","gameType":"Public","difficulty":"Medium","disableNPCs":true,"infiniteGold":false,"infiniteTroops":false,"instantBuild":false,"gameMode":"Team","bots":400,"disabledUnits":[],"maxPlayers":80,"playerTeams":4},"msUntilStart":45184}]}

#[cfg(test)]
mod test1 {
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

// Import task functions
use tasks::{
    TaskSettings, keep_task_alive, look_for_lobby_games, look_for_new_games,
    look_for_new_games_in_analysis_queue,
};

/// CREATE TABLE IF NOT EXISTS finished_games (
///     game_id CHAR(8) PRIMARY KEY,
///     result_json JSONB NOT NULL,
///     is_ok BOOLEAN NOT NULL DEFAULT TRUE,
///     inserted_at_unix_sec bigint NOT NULL DEFAULT extract(epoch from NOW()),
///     FOREIGN KEY (game_id) REFERENCES lobbies(game_id) ON DELETE CASCADE
/// );
/// CREATE TYPE analysis_queue_status AS ENUM (
///     'Pending',
///     'Running',
///     'Completed',
///     'NotFound',
///     'Failed',
///     'Stalled',
///     'Cancelled',
///     'CompletedAlready'
/// );
///
/// CREATE TABLE public.analysis_queue (
///     game_id CHAR(8) NOT NULL,
///     requesting_user_id CHAR(10),
///     requested_unix_sec BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
///     started_unix_sec BIGINT,
///     status analysis_queue_status NOT NULL DEFAULT 'Pending',
///     FOREIGN KEY (requesting_user_id) REFERENCES social.registered_users(id) ON DELETE CASCADE
/// );
///

#[tokio::main(flavor = "multi_thread", worker_threads = 16)]
async fn main() -> anyhow::Result<()> {
    let config = Config::parse();
    let config = std::sync::Arc::new(config);

    let database = PgPool::connect(&config.database_url)
        .await
        .context("Failed to connect to the database")?;

    sqlx::migrate!("./migrations").run(&database).await?;

    tracing::info!("Migrations applied successfully");

    tracing_subscriber::fmt()
        //.with_max_level(tracing::Level::INFO)
        .with_env_filter(&config.rust_log)
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

    let missing_html = format!("{}/404.html", config.frontend_folder);

    let routes = api::routes(database.clone(), openapi.clone(), cors);

    let fin = routes
        .finish_api(&mut openapi)
        .layer(Extension(openapi.clone()))
        .layer(
            tower_http::trace::TraceLayer::new_for_http()
                .on_request(middleware::LogOnRequest)
                .on_response(middleware::LogOnResponse),
        )
        .layer(tower_http::normalize_path::NormalizePathLayer::trim_trailing_slash())
        .fallback_service(axum::routing::get_service(
            tower_http::services::ServeDir::new(&*config.frontend_folder)
                .append_index_html_on_directories(true)
                .not_found_service(axum::routing::get(|| async move {
                    serve_file(std::path::Path::new(&missing_html))
                        .await
                        .unwrap_or(
                            axum::response::Response::builder()
                                .status(axum::http::StatusCode::NOT_FOUND)
                                .body(axum::body::Body::from(
                                    "Sorry! The frontend folder is missing!",
                                ))
                                .expect("Failed to build 404 response"),
                        )
                })),
        ));

    if !config.disable_tasks.contains(&ActiveTasks::LookForNewGames) {
        let db = database.clone();
        let cfg = config.clone();
        let ofapi = config.clone();
        tasks::keep_task_alive(
            move || tasks::look_for_new_games(ofapi.clone(), db.clone(), cfg.clone()),
            tasks::TaskSettings {
                sleep_time: tokio::time::Duration::ZERO,
                ..Default::default()
            },
        );
    }

    if !config
        .disable_tasks
        .contains(&ActiveTasks::LookForNewGamesInAnalysisQueue)
    {
        let db = database.clone();
        let cfg = config.clone();
        let ofapi = config.clone();
        tasks::keep_task_alive(
            move || {
                tasks::look_for_new_games_in_analysis_queue(ofapi.clone(), db.clone(), cfg.clone())
            },
            tasks::TaskSettings {
                sleep_time: tokio::time::Duration::from_secs(5),
                ..Default::default()
            },
        );
    }

    if !config
        .disable_tasks
        .contains(&ActiveTasks::LookForLobbyGames)
    {
        let db = database.clone();
        let cfg = config.clone();
        let ofapi = config.clone();
        tasks::keep_task_alive(
            move || tasks::look_for_lobby_games(ofapi.clone(), db.clone(), cfg.clone()),
            tasks::TaskSettings {
                sleep_time: tokio::time::Duration::from_secs(60 * 5),
                ..Default::default()
            },
        );
    }

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", config.port)).await?;
    tracing::info!("Listening on {}", listener.local_addr()?);
    axum::serve(
        listener,
        fin.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    anyhow::bail!("Server stopped unexpectedly");
}

#[cfg(test)]
mod test2 {
    use futures::FutureExt;

    use super::*;

    fn create_mocked_api() -> MockOpenFrontAPI {
        let mut mocked_api = MockOpenFrontAPI::new();
        mocked_api.expect_get_lobbies().returning(|| {
            async {
                Ok(PublicLobbiesResponse {
                    lobbies: vec![Lobby {
                        game_id: "testgame".to_string(),
                        num_clients: 1,
                        game_config: GameConfig {
                            game_map: "Test Map".to_string(),
                            game_type: "Public".to_string(),
                            difficulty: "Medium".to_string(),
                            disable_npcs: false,
                            infinite_gold: false,
                            infinite_troops: false,
                            instant_build: false,
                            game_mode: "Free For All".to_string(),
                            bots: 0,
                            disabled_units: vec![],
                            max_players: 10,
                            player_teams: None,
                        },
                        ms_until_start: 60000,
                    }],
                })
            }
            .boxed()
        });

        mocked_api.expect_get_game_json().returning(|game_id| {
            let game_id = game_id.to_string();
            async move {
                if let Some(json) = load_game_in_test(&game_id) {
                    Ok(json)
                } else {
                    Err(anyhow::anyhow!("Game not found"))
                }
            }
            .boxed()
        });

        mocked_api
    }

    // SQLX Tests:
    #[sqlx::test]
    async fn test_insert_lobby(pool: PgPool) {
        let mut mocked_api = create_mocked_api();
    }
}
