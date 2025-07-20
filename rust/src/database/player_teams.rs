//! We need a lot of parsing logic for the [`PlayerTeams`] enum, including:
//!  - To and from Database (stored as integer, See From<i32>)
//!  - From openfront API (stored as string or integer, See from_str_or_int)

/// Enum representing different player team configurations in a game
/// Normal serde serialization with a tag is used for encoding this type, but there are many
/// different decoding types depending on the source.
#[derive(Debug, Clone, serde::Serialize, JsonSchema)]
#[serde(tag = "group")]
pub enum PlayerTeams {
    /// Free for All, represented by 0 in the database and null from the openfront API
    FFA,
    /// n many teams, represented by a positive integer in the database
    Teams { num_teams: u8 },
    /// parties of size n, represented by a negative integer in the database
    Parties { party_size: u8 },
}

impl PlayerTeams {
    /// The API either returns a string like "Duos", "Trios", "Quads" or an integer representing
    /// the number of teams total. We parse that into either a `Parties`, `Teams`, or "Free for
    /// All" if null.
    pub fn from_str_or_int(s: &StringOrInt) -> Option<Self> {
        if let StringOrInt::String(f) = &s {
            return match f.as_ref() {
                "Duos" => Some(PlayerTeams::Parties { party_size: 2 }),
                "Trios" => Some(PlayerTeams::Parties { party_size: 3 }),
                "Quads" => Some(PlayerTeams::Parties { party_size: 4 }),
                _ => None,
            };
        } else if let StringOrInt::Int(i) = s {
            return Some(PlayerTeams::Teams {
                num_teams: *i as u8,
            });
        }

        None
    }
}

/// Visitor for deserializing PlayerTeams from an integer from the db
struct PlayerTeamsVisitor;

impl<'de> serde::de::Visitor<'de> for PlayerTeamsVisitor {
    type Value = PlayerTeams;

    fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
        formatter.write_str("an integer representing the number of teams or parties")
    }

    fn visit_i32<E>(self, value: i32) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        Ok(PlayerTeams::from(value))
    }
}

impl<'d> serde::Deserialize<'d> for PlayerTeams {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'d>,
    {
        deserializer.deserialize_i32(PlayerTeamsVisitor)
    }
}

impl From<i32> for PlayerTeams {
    fn from(num_teams: i32) -> Self {
        if num_teams == 0 {
            PlayerTeams::FFA
        } else if num_teams < 0 {
            PlayerTeams::Parties {
                party_size: -num_teams as u8,
            }
        } else {
            PlayerTeams::Teams {
                num_teams: num_teams as u8,
            }
        }
    }
}

impl sqlx::Decode<'_, sqlx::Postgres> for PlayerTeams {
    fn decode(
        value: sqlx::postgres::PgValueRef<'_>,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let s: i32 = sqlx::decode::Decode::<sqlx::Postgres>::decode(value)?;
        Ok(PlayerTeams::from(s))
    }
}

/// Convert PlayerTeams to i32 for database storage
impl From<PlayerTeams> for i32 {
    fn from(teams: PlayerTeams) -> Self {
        match teams {
            PlayerTeams::FFA => 0,
            PlayerTeams::Teams { num_teams } => num_teams as _,
            PlayerTeams::Parties { party_size } => -(party_size as i32),
        }
    }
}

/// When printing to console, human readable
impl Display for PlayerTeams {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PlayerTeams::FFA => write!(f, "FFA"),
            PlayerTeams::Teams { num_teams } => write!(f, "{num_teams} Teams"),
            PlayerTeams::Parties { party_size } => write!(f, "Parties of {party_size}"),
        }
    }
}
