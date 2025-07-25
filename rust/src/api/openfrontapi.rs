use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::future::Future;
use std::sync::Arc;

use crate::{
    Config,
    database::GameConfig,
};
use anyhow::Result;

use crate::utils::ReqwestErrorHandlingExtension;

/// Response from openfront.io/public/lobbies
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PublicLobbiesResponse {
    pub lobbies: Vec<Lobby>,
}

/// See [`PublicLobbiesResponse`]
#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Lobby {
    #[serde(rename = "gameID")]
    pub game_id: String,
    pub num_clients: i32,
    pub game_config: GameConfig,
    pub ms_until_start: u64,
}

#[mockall::automock]
/// Trait for OpenFront API interactions
pub trait OpenFrontAPI {
    fn get_game_json(&self, game_id: &str) -> impl Future<Output = Result<Value>> + Send;
    fn get_player_data(&self, player_id: &str) -> impl Future<Output = Result<Value>> + Send;
    fn get_lobbies(&self) -> impl Future<Output = Result<PublicLobbiesResponse>> + Send;
}

impl OpenFrontAPI for Config {
    async fn get_game_json(&self, game_id: &str) -> Result<Value> {
        let url = format!("{}/game/{}", self.openfront_api_url, game_id);

        let finished = reqwest::get(url).await?.json::<Value>().await?;

        Ok(finished)
    }

    async fn get_player_data(&self, player_id: &str) -> Result<Value> {
        let url = format!("{}/player/{}", self.openfront_api_url, player_id);

        let player_data = reqwest::get(url).await?.json::<Value>().await?;

        Ok(player_data)
    }

    async fn get_lobbies(&self) -> Result<PublicLobbiesResponse> {
        let mut base = reqwest::Client::new().get(&self.openfront_lobby_url);
        if let Some(ref useragent) = self.useragent {
            base = base.header(reqwest::header::USER_AGENT, useragent);
        }
        if let Some(ref cookie) = self.cookie {
            base = base.header(reqwest::header::COOKIE, cookie);
        }

        let new_games = base
            .send()
            .await?
            .anyhow_error_json::<PublicLobbiesResponse>()
            .await?;

        Ok(new_games)
    }
}

impl<T> OpenFrontAPI for &T
where
    T: OpenFrontAPI + ?Sized,
{
    fn get_game_json(&self, game_id: &str) -> impl Future<Output = Result<Value>> + Send {
        T::get_game_json(self, game_id)
    }

    fn get_lobbies(&self) -> impl Future<Output = Result<PublicLobbiesResponse>> + Send {
        T::get_lobbies(self)
    }

    fn get_player_data(&self, player_id: &str) -> impl Future<Output = Result<Value>> + Send {
        T::get_player_data(self, player_id)
    }
}

impl<T> OpenFrontAPI for Arc<T>
where
    T: OpenFrontAPI + ?Sized,
{
    fn get_game_json(&self, game_id: &str) -> impl Future<Output = Result<Value>> + Send {
        T::get_game_json(self, game_id)
    }

    fn get_lobbies(&self) -> impl Future<Output = Result<PublicLobbiesResponse>> + Send {
        T::get_lobbies(self)
    }

    fn get_player_data(&self, player_id: &str) -> impl Future<Output = Result<Value>> + Send {
        T::get_player_data(self, player_id)
    }
}
