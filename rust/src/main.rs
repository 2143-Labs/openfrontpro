use std::{net::SocketAddr, path::Path};

use aide::{axum::ApiRouter, openapi::{Info, OpenApi}, redoc::Redoc};
use axum::{response::Response, Extension, Json};
use clap::Parser;

async fn serve_file(file_path: &Path) -> anyhow::Result<Response> {
    let file_contents = tokio::fs::read(file_path).await?;

    let response = axum::response::Response::builder()
        .header("Content-Type", "application/octet-stream")
        .body(axum::body::Body::from(file_contents))?;


    Ok(response)
}

pub async fn open_api_json(
    Extension(api): Extension<OpenApi>,
) -> impl aide::axum::IntoApiResponse {
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

}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = Config::parse();

    tracing_subscriber::fmt()
        //.with_max_level(tracing::Level::INFO)
        .with_env_filter(config.rust_log)
        .with_target(false)
        // disabling time is handy because CloudWatch will add the ingestion time.
        .without_time()
        .init();

    let cors = tower_http::cors::CorsLayer::new()
        .allow_origin(tower_http::cors::Any)
        .allow_methods(vec![axum::http::Method::GET, axum::http::Method::POST, axum::http::Method::PUT, 
                          axum::http::Method::DELETE, axum::http::Method::OPTIONS])
        .allow_headers(tower_http::cors::Any);


    let routes = ApiRouter::new()
        .api_route("/", aide::axum::routing::get(|| async { "Hello, World!" }))
        .route("/robots.txt", axum::routing::get(|| async { "User-agent: *\nDisallow: /" }))
        .route("/openapi.json", axum::routing::get(open_api_json))
        .route("/redoc", Redoc::new("/openapi.json").axum_route());

    let mut openapi = OpenApi {
        info: Info {
            title: "openfront.pro".to_string(),
            version: "1.0.0".to_string(),
            description: Some("This API can be used to access elo data, match data, and more".to_string()),
            ..Default::default()
        },
        ..Default::default()
    };

    let fin = routes
        .finish_api(&mut openapi)
        .layer(Extension(openapi.clone()))
        //.layer(NormalizePathLayer::trim_trailing_slash())
        .layer(cors)
        .fallback_service(axum::routing::get_service(
            tower_http::services::ServeDir::new("frontend")
                .append_index_html_on_directories(true)
                .not_found_service(axum::routing::get(|| async { serve_file(&Path::new("frontend/index.html")).await.unwrap() })),
        ));



    //sqlx::migrate!("./migrations")
        //.run(&database)
        //.await?;

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", config.port)).await?;

    tracing::info!("Listening on http://{}", listener.local_addr()?);

    axum::serve(
        listener,
        fin.into_make_service_with_connect_info::<SocketAddr>(),
    ).await?;

    anyhow::bail!("Server stopped unexpectedly");
}
