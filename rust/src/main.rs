use std::{net::SocketAddr, sync::Arc};

use aide::openapi::{Info, OpenApi};
use anyhow::Context;
use axum::Extension;
use clap::Parser;
use schemars::JsonSchema;
use sqlx::{PgPool, postgres::PgPoolOptions};

use database::AnalysisQueueStatus;

use tasks::{
    TaskSettings, keep_task_alive, look_for_lobby_games, look_for_new_games,
    look_for_new_games_in_analysis_queue,
};

use tokio::time::Duration;
use tower_http::services::ServeDir;
use utils::serve_file;

use crate::{database::APIGetLobby, oauth::OAuthBundle};

mod analysis;
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
        default_value = "http://localhost:3000/oauth/discord/callback"
    )]
    pub discord_redirect_uri: String,

    #[clap(long, env, short = 'd')]
    pub disable_tasks: Vec<ActiveTasks>,

    #[clap(long, env, short = 'e')]
    pub extra_tasks: Vec<ActiveTasks>,
}

impl Config {
    pub fn get_discord_oauth(&self) -> Option<OAuthBundle> {
        if let (Some(client_id), Some(client_secret)) = (
            self.discord_client_id.clone(),
            self.discord_client_secret.clone(),
        ) {
            Some(OAuthBundle {
                client_id,
                client_secret,
                redirect_uri: self.discord_redirect_uri.clone(),
            })
        } else {
            None
        }
    }
}

#[derive(
    Debug, Clone, serde::Deserialize, serde::Serialize, JsonSchema, clap::ValueEnum, PartialEq, Eq,
)]
/// Disable these tasks by passing them with the `-d` flag
pub enum ActiveTasks {
    /// Read the current public lobbies and look for new games
    LookForOpenfrontLobbies,
    /// Look for the lobbies to each complete so we can download the game data
    LookForFinishedLobbies,
    /// Download game data for the games that are in the analysis queue
    LookForNewGamesInAnalysisQueue,
    /// If analysis takes longer than 30 minutes, then we update state = Stalled
    LookForOldRunningGames,
    /// TODO If a session has expired, we can delete it from db
    LookForOldSessions,
    /// For every registered player we have with an openfront ID, look for their games
    LookForTrackedPlayerGames,
    /// Extra tasks: pull from prpod
    PullLobbiesFromPROD,
}

/// Spawn the background worker tasks
async fn launch_tasks(config: Arc<Config>, database: PgPool) -> anyhow::Result<()> {
    if config
        .extra_tasks
        .contains(&ActiveTasks::LookForOpenfrontLobbies)
    {
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
        .contains(&ActiveTasks::LookForFinishedLobbies)
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

    /// TODO If analysis takes longer than 30 minutes, then we update state = Stalled
    /// LookForOldRunningGames,
    if !config
        .disable_tasks
        .contains(&ActiveTasks::LookForOldRunningGames)
    {
        let db = database.clone();
        let cfg = config.clone();
        keep_task_alive(
            move || tasks::look_for_old_running_games(db.clone(), cfg.clone()),
            TaskSettings {
                sleep_time: Duration::from_secs(60 * 5),
                ..Default::default()
            },
        );
    }

    // TODO If a session has expired, we can delete it from db
    // LookForOldSessions,
    //
    // TODO For every registered player we have with an openfront ID, look for their games
    // LookForTrackedPlayerGames,
    if !config
        .disable_tasks
        .contains(&ActiveTasks::LookForTrackedPlayerGames)
    {
        let db = database.clone();
        let ofapi = config.clone();
        keep_task_alive(
            move || tasks::look_for_tracked_player_games(db.clone(), ofapi.clone()),
            TaskSettings {
                sleep_time: Duration::from_secs(60),
                ..Default::default()
            },
        );
    }

    if config
        .extra_tasks
        .contains(&ActiveTasks::PullLobbiesFromPROD)
    {
        let _db = database.clone();
        let _cfg = config.clone();
        keep_task_alive(
            move || async {
                let _oldlobbies = reqwest::get("https://openfront.pro/api/v1/lobbies")
                    .await
                    .context("Failed to fetch lobbies from openfront.pro")?
                    .json::<Vec<APIGetLobby>>()
                    .await
                    .context("Failed to parse lobbies from openfront.pro")?;

                Ok(())
            },
            TaskSettings {
                sleep_time: Duration::from_secs(60 * 60),
                ..Default::default()
            },
        );
    }

    Ok(())
}

#[tokio::main(flavor = "multi_thread", worker_threads = 16)]
async fn main() -> anyhow::Result<()> {
    let config = Config::parse();
    tracing_subscriber::fmt()
        //.with_max_level(tracing::Level::INFO)
        .with_env_filter(&config.rust_log)
        .with_target(false)
        //.without_time()
        .init();

    tracing::info!(
        config.frontend_folder,
        "Starting OpenFront API server! Connecting to database..."
    );

    if config.get_discord_oauth().is_some() {
        tracing::info!("Discord OAuth is enabled");
    } else {
        tracing::warn!("Discord OAuth is not enabled, no client ID or secret provided");
    }

    let database = PgPoolOptions::new()
        .min_connections(2)
        .max_connections(16)
        .acquire_timeout(Duration::from_secs(5))
        .connect_lazy(&config.database_url)
        .context("Failed to create database connection pool")?;

    let config = std::sync::Arc::new(config);

    let db = database.clone();
    tokio::spawn(async move {
        match sqlx::migrate!("./migrations").run(&db).await {
            Ok(_) => tracing::info!("Database migrations applied successfully"),
            Err(e) => tracing::error!("Failed to apply database migrations: {}", e),
        }
    });

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

    // just serve the SPA?
    let missing_html = format!("{}/index.html", config.frontend_folder);

    let index_html = axum::routing::get(|| async move {
        serve_file(std::path::Path::new(&missing_html))
            .await
            .unwrap_or(default_missing_response())
    });

    let fin = routes
        // Frontend routes
        .route("/game/{game_id}", index_html.clone())
        .route("/user/{user_id}", index_html.clone())
        .finish_api(&mut openapi)
        .layer(Extension(openapi.clone()))
        .layer(Extension(config.clone()))
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
                .not_found_service(index_html),
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
