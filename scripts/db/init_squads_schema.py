#!/usr/bin/env python3
"""
scripts/db/init_squads_schema.py
─────────────────────────────────────────────────────────────
Initialise le schéma relationnel et dimensionnel complet pour la gestion
des compétitions, équipes, effectifs, contrats (SCD Type 2), matchs,
événements minute par minute, statistiques collectives et feuilles de match
dans SQLite (predictor_v2.db).
"""

import os
import sys
import sqlite3

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(ROOT_DIR, "predictor_v2.db")

print(f"📦 [DB:Init] Connexion à la base de données : {DB_PATH}")

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Enable Foreign Keys & Write-Ahead Logging for high concurrency
cursor.execute("PRAGMA foreign_keys = ON;")
cursor.execute("PRAGMA journal_mode = WAL;")

DDL_SCRIPT = """
-- 1. Référentiel des Compétitions (8 Compétitions Officielles)
CREATE TABLE IF NOT EXISTS dim_competitions (
    competition_id VARCHAR(16) PRIMARY KEY, -- 'FRA-L1', 'ENG-PL', 'EUR-CL', etc.
    name VARCHAR(64) NOT NULL,
    country VARCHAR(32) NOT NULL,
    category VARCHAR(16) NOT NULL,          -- 'DOMESTIC_LEAGUE', 'EUROPEAN_CUP'
    external_source_id INT NOT NULL,        -- ID externe (ex: FotMob / Sofascore)
    flag_emoji VARCHAR(8),
    logo_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Référentiel des Équipes (Master Teams)
CREATE TABLE IF NOT EXISTS dim_teams (
    team_id VARCHAR(32) PRIMARY KEY,
    league_id VARCHAR(16) NOT NULL,
    name VARCHAR(64) NOT NULL,
    short_name VARCHAR(32),
    slug VARCHAR(64) NOT NULL,
    country VARCHAR(32),
    stadium_name VARCHAR(64),
    logo_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Référentiel Unique des Joueurs (Master Players Conforme)
CREATE TABLE IF NOT EXISTS dim_players (
    player_id VARCHAR(64) PRIMARY KEY,
    tm_id VARCHAR(32) UNIQUE,
    api_sports_id INT,
    flashscore_slug VARCHAR(64),
    full_name VARCHAR(128) NOT NULL,
    display_name VARCHAR(64) NOT NULL,
    short_name VARCHAR(32),
    primary_position VARCHAR(16) NOT NULL,
    role_category VARCHAR(4) NOT NULL, -- 'G', 'D', 'M', 'A'
    birth_date DATE,
    age INT,
    nationality VARCHAR(64),
    photo_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Historique des Contrats & Mercato (Dimension SCD Type 2)
CREATE TABLE IF NOT EXISTS dim_player_contracts_scd2 (
    contract_sk VARCHAR(64) PRIMARY KEY,
    player_id VARCHAR(64) NOT NULL REFERENCES dim_players(player_id) ON DELETE CASCADE,
    team_id VARCHAR(32) NOT NULL REFERENCES dim_teams(team_id) ON DELETE CASCADE,
    league_id VARCHAR(16) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    is_current BOOLEAN NOT NULL DEFAULT 1,
    squad_number INT,
    contract_type VARCHAR(16) DEFAULT 'PERMANENT',
    market_value_eur DECIMAL(12, 2),
    market_value_formatted VARCHAR(32),
    joined_date DATE,
    contract_until DATE,
    seasons_covered TEXT, -- JSON Array string e.g. ["2024-2025", "2025-2026", "2026-2027"]
    transfer_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Table de Correspondance des Noms et Identifiants (Entity Resolution Multi-Sources)
CREATE TABLE IF NOT EXISTS dim_player_aliases (
    alias_id VARCHAR(64) PRIMARY KEY,
    player_id VARCHAR(64) NOT NULL REFERENCES dim_players(player_id) ON DELETE CASCADE,
    source_system VARCHAR(32) NOT NULL, -- 'FLASHSCORE', 'BETCLIC', 'API_SPORTS', 'TRANSFERMARKT', 'FOTMOB'
    raw_name VARCHAR(128) NOT NULL,
    normalized_name VARCHAR(128) NOT NULL,
    confidence_score DECIMAL(3, 2) DEFAULT 1.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Table de Faits des Matchs (Master Fixtures & Results)
CREATE TABLE IF NOT EXISTS fact_matches (
    match_id VARCHAR(64) PRIMARY KEY,       -- Ex: 'FOT_4513014' ou 'CERT_FRA-L1_2024-2025_J1_M1'
    competition_id VARCHAR(16) NOT NULL REFERENCES dim_competitions(competition_id),
    season VARCHAR(16) NOT NULL,            -- '2024-2025', '2025-2026', '2026-2027'
    round_label VARCHAR(32),                -- 'Journée 1', 'Quarts de finale'
    gameweek INT,
    match_timestamp_utc TIMESTAMP NOT NULL,
    match_date VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL,            -- 'FINISHED', 'SCHEDULED', 'IN_PLAY', 'POSTPONED'
    home_team_id VARCHAR(32) NOT NULL,
    away_team_id VARCHAR(32) NOT NULL,
    home_team_name VARCHAR(64) NOT NULL,
    away_team_name VARCHAR(64) NOT NULL,
    home_score INT,
    away_score INT,
    home_ht_score INT,
    away_ht_score INT,
    home_xg DECIMAL(4, 2),
    away_xg DECIMAL(4, 2),
    referee_name VARCHAR(64),
    stadium_name VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Table de Faits des Événements Minute par Minute
CREATE TABLE IF NOT EXISTS fact_match_events (
    event_id VARCHAR(64) PRIMARY KEY,
    match_id VARCHAR(64) NOT NULL REFERENCES fact_matches(match_id) ON DELETE CASCADE,
    minute INT NOT NULL,
    added_time INT DEFAULT 0,
    team_id VARCHAR(32),
    team_name VARCHAR(64),
    event_type VARCHAR(24) NOT NULL,        -- 'GOAL', 'OWN_GOAL', 'PENALTY_GOAL', 'YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION', 'VAR_DECISION'
    primary_player_id VARCHAR(64),
    primary_player_name VARCHAR(64) NOT NULL,
    secondary_player_id VARCHAR(64),        -- Passeur ou joueur sortant
    secondary_player_name VARCHAR(64),
    detail_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Table de Faits des Statistiques Collectives de Match
CREATE TABLE IF NOT EXISTS fact_match_team_stats (
    stat_id VARCHAR(64) PRIMARY KEY,
    match_id VARCHAR(64) NOT NULL REFERENCES fact_matches(match_id) ON DELETE CASCADE,
    team_id VARCHAR(32),
    team_name VARCHAR(64) NOT NULL,
    is_home BOOLEAN NOT NULL,
    possession_pct DECIMAL(4, 1),
    expected_goals DECIMAL(4, 2),
    shots_total INT,
    shots_on_target INT,
    shots_off_target INT,
    shots_blocked INT,
    big_chances_total INT,
    big_chances_missed INT,
    corner_kicks INT,
    fouls_committed INT,
    offside_count INT,
    yellow_cards INT,
    red_cards INT,
    accurate_passes INT,
    total_passes INT,
    pass_accuracy_pct DECIMAL(4, 1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Table de Faits des Feuilles de Match & Compositions (Lineups & Player Performance)
CREATE TABLE IF NOT EXISTS fct_match_lineups (
    lineup_sk VARCHAR(64) PRIMARY KEY,
    match_id VARCHAR(64) NOT NULL REFERENCES fact_matches(match_id) ON DELETE CASCADE,
    competition_code VARCHAR(16) NOT NULL,
    season VARCHAR(16) NOT NULL,
    gameweek INT,
    round_label VARCHAR(32),
    team_id VARCHAR(32) NOT NULL,
    opponent_team_id VARCHAR(32),
    is_home BOOLEAN NOT NULL,
    player_id VARCHAR(64),
    player_name_match VARCHAR(64) NOT NULL,
    lineup_type VARCHAR(16) NOT NULL, -- 'STARTER', 'SUBSTITUTE', 'RESERVE'
    pitch_position_code VARCHAR(8), -- 'GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'
    role_category VARCHAR(4) NOT NULL, -- 'G', 'D', 'M', 'A'
    grid_row INT,
    grid_col INT,
    jersey_number INT,
    captain BOOLEAN DEFAULT 0,
    rating DECIMAL(3, 1),
    minutes_played INT DEFAULT 0,
    goals INT DEFAULT 0,
    assists INT DEFAULT 0,
    yellow_card BOOLEAN DEFAULT 0,
    red_card BOOLEAN DEFAULT 0,
    sub_in_minute INT,
    sub_out_minute INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Table des Indisponibilités & Blessures
CREATE TABLE IF NOT EXISTS fct_player_availability (
    availability_id VARCHAR(64) PRIMARY KEY,
    player_id VARCHAR(64) NOT NULL REFERENCES dim_players(player_id) ON DELETE CASCADE,
    team_id VARCHAR(32) NOT NULL REFERENCES dim_teams(team_id) ON DELETE CASCADE,
    recorded_date DATE NOT NULL,
    status VARCHAR(16) NOT NULL, -- 'AVAILABLE', 'INJURED', 'SUSPENDED', 'INTERNATIONAL_DUTY', 'QUESTIONABLE'
    injury_nature VARCHAR(128),
    expected_return_date DATE,
    impact_weight DECIMAL(3, 2) DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index d'optimisation analytique
CREATE INDEX IF NOT EXISTS idx_contracts_player_current ON dim_player_contracts_scd2(player_id, is_current);
CREATE INDEX IF NOT EXISTS idx_contracts_team ON dim_player_contracts_scd2(team_id, is_current);
CREATE INDEX IF NOT EXISTS idx_aliases_norm ON dim_player_aliases(normalized_name, source_system);
CREATE INDEX IF NOT EXISTS idx_matches_comp_season ON fact_matches(competition_id, season);
CREATE INDEX IF NOT EXISTS idx_matches_teams ON fact_matches(home_team_id, away_team_id);
CREATE INDEX IF NOT EXISTS idx_events_match ON fact_match_events(match_id);
CREATE INDEX IF NOT EXISTS idx_events_player ON fact_match_events(primary_player_id);
CREATE INDEX IF NOT EXISTS idx_team_stats_match ON fact_match_team_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_lineups_match ON fct_match_lineups(match_id, team_id);
CREATE INDEX IF NOT EXISTS idx_lineups_player ON fct_match_lineups(player_id);
CREATE INDEX IF NOT EXISTS idx_availability_player ON fct_player_availability(player_id, recorded_date);
"""

cursor.executescript(DDL_SCRIPT)

# Seed the 8 Official Competitions
COMPETITIONS_SEED = [
    ('FRA-L1', 'Ligue 1', 'France', 'DOMESTIC_LEAGUE', 53, '🇫🇷', 'https://images.fotmob.com/image_resources/logo/leaguelogo/53.png'),
    ('ENG-PL', 'Premier League', 'Angleterre', 'DOMESTIC_LEAGUE', 47, '🇬🇧', 'https://images.fotmob.com/image_resources/logo/leaguelogo/47.png'),
    ('ESP-LL', 'La Liga', 'Espagne', 'DOMESTIC_LEAGUE', 87, '🇪🇸', 'https://images.fotmob.com/image_resources/logo/leaguelogo/87.png'),
    ('ITA-SA', 'Serie A', 'Italie', 'DOMESTIC_LEAGUE', 55, '🇮🇹', 'https://images.fotmob.com/image_resources/logo/leaguelogo/55.png'),
    ('GER-BL', 'Bundesliga', 'Allemagne', 'DOMESTIC_LEAGUE', 54, '🇩🇪', 'https://images.fotmob.com/image_resources/logo/leaguelogo/54.png'),
    ('EUR-CL', 'Ligue des Champions', 'Europe', 'EUROPEAN_CUP', 42, '🇪🇺', 'https://images.fotmob.com/image_resources/logo/leaguelogo/42.png'),
    ('EUR-EL', 'Ligue Europa', 'Europe', 'EUROPEAN_CUP', 73, '🇪🇺', 'https://images.fotmob.com/image_resources/logo/leaguelogo/73.png'),
    ('EUR-ECL', 'Ligue Conférence', 'Europe', 'EUROPEAN_CUP', 10216, '🇪🇺', 'https://images.fotmob.com/image_resources/logo/leaguelogo/10216.png'),
]

cursor.executemany("""
INSERT OR REPLACE INTO dim_competitions (competition_id, name, country, category, external_source_id, flag_emoji, logo_url)
VALUES (?, ?, ?, ?, ?, ?, ?);
""", COMPETITIONS_SEED)

conn.commit()

# Print summary
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [row[0] for row in cursor.fetchall()]
print(f"✅ [DB:Init] Schéma relationnel initialisé avec succès ! Tables disponibles ({len(tables)}) :")
for tbl in sorted(tables):
    cursor.execute(f"SELECT COUNT(*) FROM {tbl};")
    count = cursor.fetchone()[0]
    print(f"   ├─ {tbl} ({count} lignes)")

conn.close()
