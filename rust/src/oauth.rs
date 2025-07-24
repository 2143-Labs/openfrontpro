#![allow(unused)]
use std::sync::Arc;

use aide::{IntoApi, axum::ApiRouter};
use anyhow::Result;
use axum::{
    Extension, RequestPartsExt,
    extract::{FromRequestParts, OptionalFromRequestParts, Query},
    response::Response,
};
use axum_extra::extract::CookieJar;
use reqwest::Client;
use schemars::JsonSchema;
use serde::Deserialize;
use sqlx::PgPool;

use crate::Config;

/// Discord OAuth configuration extracted from the main Config
#[derive(Debug, Clone)]
pub struct OAuthBundle {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: u64,
    pub refresh_token: String,
    pub scope: String,
}

//{
//"id": "262351348534738945",
//"username": "john2143",
//"avatar": "f3e0bba6767b9bbb3e724bf75e4b34a2",
//"discriminator": "0",
//"public_flags": 0,
//"flags": 0,
//"banner": null,
//"accent_color": 11753991,
//"global_name": "John2143",
//"avatar_decoration_data": null,
//"collectibles": null,
//"display_name_styles": null,
//"banner_color": "#b35a07",
//"clan": null,
//"primary_guild": null,
//"mfa_enabled": false,
//"locale": "en-US",
//"premium_type": 3
//}
#[derive(Debug, Clone, Deserialize)]
pub struct DiscordUser {
    pub id: String,
    pub username: String,
    pub avatar: Option<String>,
    pub banner: Option<String>,
    pub accent_color: Option<u32>,
    pub global_name: Option<String>,
}

pub fn authorization_url(state: &str, cfg: &OAuthBundle) -> String {
    format!(
        "https://discord.com/api/oauth2/authorize?client_id={}&redirect_uri={}&response_type=code&scope=identify+openid&state={}",
        cfg.client_id,
        urlencoding::encode(&cfg.redirect_uri),
        urlencoding::encode(state)
    )
}

pub async fn exchange_code(code: &str, cfg: &OAuthBundle) -> Result<TokenResponse> {
    let params = [
        ("client_id", cfg.client_id.as_str()),
        ("client_secret", cfg.client_secret.as_str()),
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
CREATE TABLE social.user_sessions (
    session_id SERIAL PRIMARY KEY,
    created_at_unix_sec BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
    expires_at_unix_sec BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) + 3600 * 24), -- 1 day
    user_id CHAR(10) NOT NULL REFERENCES social.registered_users(id) ON DELETE CASCADE,
    session_token_hash TEXT NOT NULL UNIQUE,
);
*/

pub struct APIUser {
    pub user_id: String,
    pub username: String,
}

impl<S: Sync> FromRequestParts<S> for APIUser {
    type Rejection = axum::response::Response;

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        state: &S,
    ) -> std::result::Result<Self, Self::Rejection> {
        let cookies = CookieJar::from_headers(&parts.headers);
        let session_token = cookies
            .get("session_token")
            .map(|c| c.value().to_string())
            .or_else(|| {
                parts
                    .headers
                    .get("Authorization")
                    .and_then(|h| h.to_str().ok())
                    .and_then(|s| s.strip_prefix("Bearer "))
                    .map(|s| s.to_string())
            });

        let rejection = |msg: &str| {
            Response::builder()
                .status(axum::http::StatusCode::UNAUTHORIZED)
                //as text/plain
                .header(axum::http::header::CONTENT_TYPE, "text/plain")
                .header(axum::http::header::CACHE_CONTROL, "no-cache")
                .body(axum::body::Body::from(msg.to_string()))
                .unwrap()
        };

        let Some(their_token) = session_token else {
            return Err(rejection(
                "Sorry, to call this API you need either an discord login or session token.",
            ));
        };

        let Extension(db_extension) = parts.extract::<Extension<PgPool>>().await.map_err(|_| {
            rejection("Sorry, authorization is currently unavailable. Try again later.")
        })?;

        let user = sqlx::query_as!(
            APIUser,
            r#"
            SELECT u.id AS user_id, u.username
            FROM social.registered_users u
            JOIN social.user_sessions s ON s.user_id = u.id
            WHERE
                s.session_token_hash = encode(digest($1, 'sha256'), 'hex')
                AND s.expires_at_unix_sec > EXTRACT(EPOCH FROM NOW())
            "#,
            their_token
        )
        .fetch_optional(&db_extension)
        .await
        .map_err(|_| rejection("Sorry, authorization is currently unavailable. Try again later."))?
        .ok_or_else(|| {
            rejection("Invalid session token or session expired. Please log in with discord again.")
        })?;

        Ok(user)
    }
}

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

    let cfg = config
        .get_discord_oauth()
        .expect("Discord OAuth configuration not found");

    let token_response = exchange_code(&code, &cfg)
        .await
        .map_err(|e| basic_error_response(&format!("Failed to exchange code: {}", e)))?;
    let user = fetch_user(&token_response.access_token)
        .await
        .map_err(|e| basic_error_response(&format!("Failed to fetch user: {}", e)))?;

    println!("{:?}", token_response);

    let global_name = user
        .global_name
        .as_deref()
        .unwrap_or(user.username.as_str());

    // Check if we have this user,
    let res = sqlx::query!(
        r#"
        INSERT INTO social.discord_link (user_id, discord_user_id, discord_username, discord_avatar, discord_global_name)
        VALUES (social.generate_user_uid(10), $1, $2, $3, $4)
        ON CONFLICT (discord_user_id)
        DO UPDATE SET
            discord_avatar = EXCLUDED.discord_avatar,
            discord_global_name = EXCLUDED.discord_global_name
        RETURNING user_id
        "#,
        user.id,
        user.username,
        user.avatar,
        global_name,
    ).fetch_one(&database)
        .await
        .map_err(|e| {
            basic_error_response(&format!("Failed to insert or fetch user: {}", e))
        })?;

    let user_id = res.user_id;
    let res = sqlx::query!(
        r#"
        INSERT INTO social.registered_users (id, username)
        VALUES ($1, $2)
        ON CONFLICT (id) DO UPDATE
        -- no real change; just keep existing values
        SET username = registered_users.username
        RETURNING username, id
        "#,
        user_id,
        user.username,
    )
    .fetch_one(&database)
    .await
    .map_err(|e| {
        basic_error_response(&format!("Failed to insert or fetch registered user: {}", e))
    })?;

    let seen_username = res.username;

    let api_token = sqlx::query!(
        r#"
        WITH new_token AS (
            SELECT encode(gen_random_bytes(20), 'base64') AS token
        )
        INSERT INTO social.user_sessions (user_id, session_token_hash)
        VALUES ($1, encode(digest((SELECT token FROM new_token), 'sha256'), 'hex'))
        RETURNING (
            SELECT token FROM new_token
        ) AS session_token
        "#,
        user_id
    )
    .fetch_one(&database)
    .await
    .map_err(|e| basic_error_response(&format!("Failed to create user session: {}", e)))?;

    let api_token = api_token
        .session_token
        .expect("How is is possible to not have a session token?");

    let res = Response::builder()
        .status(axum::http::StatusCode::FOUND)
        .header(axum::http::header::CONTENT_TYPE, "text/plain")
        .header(axum::http::header::CACHE_CONTROL, "no-cache")
        // Send them back to /
        .header(axum::http::header::LOCATION, "/")
        // Add logged in cookies
        //   1. discord user id
        //   2. api token
        .header(
            axum::http::header::SET_COOKIE,
            format!(
                "discord_user_id={}; Path=/; HttpOnly; Secure; SameSite=Strict",
                user.id
            ),
        )
        .header(
            axum::http::header::SET_COOKIE,
            format!(
                "session_token={}; Path=/; HttpOnly; Secure; SameSite=Strict",
                api_token
            ),
        )
        .body(axum::body::Body::from(format!(
            "User {} (discord {} = {}) authenticated successfully",
            seen_username, user.username, global_name
        )))
        .map_err(|e| basic_error_response(&format!("Failed to build response: {}", e)))?;

    Ok(res)
}

async fn login_redir_handler(Extension(config): Extension<Arc<Config>>) -> Response {
    let state = "some_random_state"; // This should be a securely generated random state

    let cfg = config
        .get_discord_oauth()
        .expect("Discord OAuth configuration not found on prod?");
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
