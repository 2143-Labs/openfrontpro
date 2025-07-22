#![allow(unused)]
use std::sync::Arc;

use aide::{axum::ApiRouter,  IntoApi};
use anyhow::Result;
use axum::{extract::Query, response::Response, Extension};
use reqwest::Client;
use schemars::JsonSchema;
use serde::Deserialize;
use sqlx::PgPool;

use crate::Config;

/// Discord OAuth configuration extracted from the main Config
#[derive(Debug, Clone)]
pub struct DiscordOAuthConfig {
    pub client_id: String,
    pub secret: String,
    pub redirect_uri: String,
}

impl DiscordOAuthConfig {
    /// Create DiscordOAuthConfig from the main application Config
    pub fn from_env(config: &Config) -> Self {
        Self {
            client_id: config
                .discord_client_id
                .clone()
                .expect("Discord client ID must be configured"),
            secret: config
                .discord_client_secret
                .clone()
                .expect("Discord client secret must be configured"),
            redirect_uri: config.discord_redirect_uri.clone(),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: u64,
    pub refresh_token: String,
    pub scope: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DiscordUser {
    pub id: String,
    pub username: String,
    pub discriminator: String,
    pub email: Option<String>,
}

pub fn authorization_url(state: &str, cfg: &DiscordOAuthConfig) -> String {
    format!(
        "https://discord.com/api/oauth2/authorize?client_id={}&redirect_uri={}&response_type=code&scope=identify+openid&state={}",
        cfg.client_id,
        urlencoding::encode(&cfg.redirect_uri),
        urlencoding::encode(state)
    )
}

pub async fn exchange_code(code: &str, cfg: &DiscordOAuthConfig) -> Result<TokenResponse> {
    let params = [
        ("client_id", cfg.client_id.as_str()),
        ("client_secret", cfg.secret.as_str()),
        ("grant_type", "authorization_code"),
        ("code", code),
        ("redirect_uri", cfg.redirect_uri.as_str()),
    ];

    let client = Client::new();
    let res = client
        .post("https://discord.com/api/oauth2/token")
        .form(&params)
        .send()
        .await?;

    let token_response: TokenResponse = res.json().await?;
    Ok(token_response)
}

pub async fn fetch_user(token: &str) -> Result<DiscordUser> {
    let client = Client::new();
    let res = client
        .get("https://discord.com/api/users/@me")
        .bearer_auth(token)
        .send()
        .await?;

    let user: DiscordUser = res.json().await?;
    Ok(user)
}

#[derive(Debug, Deserialize, JsonSchema)]
struct CallbackAPIParams {
    code: Option<String>,
    error: Option<String>,
    state: String,
}

fn basic_error_response(error: &str) -> Response {
    Response::builder()
        .status(axum::http::StatusCode::BAD_REQUEST)
        .body(axum::body::Body::from(format!("Error: {}", error)))
        .unwrap()
}

/*
CREATE TABLE social.registered_users (
    id CHAR(10) NOT NULL PRIMARY KEY DEFAULT social.generate_user_uid(10),
    username TEXT NOT NULL UNIQUE,
    openfront_player_id TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE social.discord_link (
   user_id CHAR(10) NOT NULL PRIMARY KEY,
   discord_user_id BIGINT NOT NULL UNIQUE,
   discord_username TEXT NOT NULL,
   discord_discriminator TEXT,
   discord_avatar TEXT,
   created_at_unix_sec BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
);
*/

async fn callback_api_handler(
    Extension(database): Extension<PgPool>,
    Extension(config): Extension<Arc<Config>>,
    Query(params): Query<CallbackAPIParams>,
) -> Result<Response, Response> {
    if let Some(error) = params.error {
        return Err(basic_error_response(&error));
    }

    let Some(code) = params.code else {
        return Err(basic_error_response("Missing 'code' parameter in callback"));
    };

    let cfg = DiscordOAuthConfig::from_env(&config);
    let token_response = exchange_code(&code, &cfg).await.map_err(|e| {
        basic_error_response(&format!("Failed to exchange code: {}", e))
    })?;
    let user = fetch_user(&token_response.access_token).await.map_err(|e| {
        basic_error_response(&format!("Failed to fetch user: {}", e))
    })?;

    println!("{:?}", token_response);

    // Check if we have this user,
    let res = sqlx::query!(
        r#"
        INSERT INTO social.discord_link (user_id, discord_user_id, discord_username, discord_discriminator)
        VALUES (social.generate_user_uid(10), $1, $2, $3)
        ON CONFLICT (discord_user_id) DO NOTHING
        RETURNING user_id
        "#, 
        user.id,
        user.username,
        user.discriminator,
    ).fetch_one(&database)
        .await
        .map_err(|e| {
            basic_error_response(&format!("Failed to insert or fetch user: {}", e))
        })?;

    let user_id = res.user_id;
    // Add users to db:

    let res = Response::builder()
        .status(axum::http::StatusCode::FOUND)
        .header(axum::http::header::CONTENT_TYPE, "text/plain")
        .header(axum::http::header::CACHE_CONTROL, "no-cache")
        // Send them back to /
        .header(axum::http::header::LOCATION, "/")
        // Add logged in cookies
        .header(
            axum::http::header::SET_COOKIE,
            format!(
                "discord_user_id={}; Path=/; HttpOnly; Secure; SameSite=Strict",
                user.id
            ),
        )
        .body(axum::body::Body::from(format!(
            "User {}#{} authenticated successfully",
            user.username, user.discriminator
        )))
        .map_err(|e| {
            basic_error_response(&format!("Failed to build response: {}", e))
        })?;

    Ok(res)
}

async fn login_redir_handler(
    Extension(config): Extension<Arc<Config>>,
) -> Response {
    let state = "some_random_state"; // This should be a securely generated random state

    let cfg = DiscordOAuthConfig::from_env(&config);
    let url = authorization_url(state, &cfg);
    Response::builder()
        .status(axum::http::StatusCode::FOUND)
        .header(axum::http::header::LOCATION, url)
        .body(axum::body::Body::empty())
        .unwrap()
}

/// Creates and returns the OAuth API router
pub fn routes() -> ApiRouter {
    // This lives under oauth/discord/
    ApiRouter::new()
        .route("/callback", axum::routing::get(callback_api_handler))
        .route("/login", axum::routing::get(login_redir_handler))
}
