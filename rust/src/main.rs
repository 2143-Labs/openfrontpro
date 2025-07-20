use std::{net::SocketAddr, sync::Arc};

use aide::openapi::{Info, OpenApi};
use anyhow::Context;
use axum::Extension;
use clap::Parser;
use schemars::JsonSchema;
use sqlx::PgPool;

use database::AnalysisQueueStatus;

use tasks::{
    TaskSettings, keep_task_alive, look_for_lobby_games, look_for_new_games,
    look_for_new_games_in_analysis_queue,
};

use api::OpenFrontAPI;
use tokio::time::Duration;
use tower_http::services::ServeDir;
use utils::serve_file;

mod api;
mod database;
mod middleware;
mod oauth;
mod tasks;
mod utils;

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
    /// User agent to use for requests to OpenFront API
    pub useragent: Option<String>,

    #[clap(long, env)]
    /// User agent to use for requests to OpenFront API
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
/// Disable these tasks by passing them with the `-d` flag
pub enum ActiveTasks {
    LookForNewGames,
    LookForLobbyGames,
    LookForNewGamesInAnalysisQueue,
}

/// Spawn the background worker tasks
async fn launch_tasks(config: Arc<Config>, database: PgPool) -> anyhow::Result<()> {
    if !config.disable_tasks.contains(&ActiveTasks::LookForNewGames) {
        let db = database.clone();
        let cfg = config.clone();
        let ofapi = config.clone();
        keep_task_alive(
            move || look_for_new_games(ofapi.clone(), db.clone(), cfg.clone()),
            TaskSettings {
                sleep_time: Duration::ZERO,
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
        keep_task_alive(
            move || look_for_new_games_in_analysis_queue(ofapi.clone(), db.clone(), cfg.clone()),
            TaskSettings {
                sleep_time: Duration::from_secs(5),
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
        keep_task_alive(
            move || look_for_lobby_games(ofapi.clone(), db.clone(), cfg.clone()),
            TaskSettings {
                sleep_time: Duration::from_secs(60 * 5),
                ..Default::default()
            },
        );
    }

    Ok(())
}

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
        //.without_time()
        .init();

    // TODO: Make sure we don't have vulnerabilites around the frontend because CORS.
    // (especially around oauth stuff)
    //
    // Let other people freely call this API for their own frontends, as they nicely set a
    // user-agent to distinguish their apps
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
                "This API can be used to access match data, game analysis, players, and more"
                    .to_string(),
            ),
            ..Default::default()
        },
        ..Default::default()
    };

    let routes = api::routes(database.clone(), openapi.clone(), cors);

    // If we don't have a frontend folder then use this as a
    // minimal fallback.
    fn default_missing_response() -> axum::response::Response {
        axum::response::Response::builder()
            .status(axum::http::StatusCode::NOT_FOUND)
            .body(axum::body::Body::from("Not Found"))
            .expect("Failed to build 404 response")
    }

    // Assume this exists in the frontend at this path. TODO Maybe just serve the SPA?
    let missing_html = format!("{}/404.html", config.frontend_folder);

    let fin = routes
        .finish_api(&mut openapi)
        .layer(Extension(openapi.clone()))
        .layer(
            // TODO Figure out how to embed a "request_id" without a lot of boilerplate so that we
            // can tie the request and response together in the logs.
            tower_http::trace::TraceLayer::new_for_http()
                .on_request(middleware::LogOnRequest)
                .on_response(middleware::LogOnResponse),
        )
        // I'm not sure if this is working - /api/v1/lobbies/ doesn't work for me
        .layer(tower_http::normalize_path::NormalizePathLayer::trim_trailing_slash())
        // Serve the frontend from a static directory.
        .fallback_service(axum::routing::get_service(
            ServeDir::new(&*config.frontend_folder)
                .append_index_html_on_directories(true)
                // 404 Service
                .not_found_service(axum::routing::get(|| async move {
                    serve_file(std::path::Path::new(&missing_html))
                        .await
                        .unwrap_or(default_missing_response())
                })),
        ));

    // This launches db async tasks. This includes:
    //  - Looking for new lobbies
    //  - Downloading game data
    //  - Preparing the launch the simulation code
    launch_tasks(config.clone(), database.clone())
        .await
        .context("Failed to launch async tasks")?;

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", config.port)).await?;
    tracing::info!("HTTP Server Listening on {}", listener.local_addr()?);
    axum::serve(
        listener,
        fin.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    unreachable!("Server stopped unexpectedly");
}

#[cfg(test)]
mod test1 {
    use crate::api::PublicLobbiesResponse;

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
