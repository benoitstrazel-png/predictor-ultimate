#!/usr/bin/env python3
"""
Database Initializer & Migrator for European Football Predictor V2.
Ensures both the V2 Dimensional Star Schema (dim_*, fact_*, fct_*) with analytical B-Tree indices
and V1 backward-compatibility tables exist in predictor_v2.db without any destructive operations.
"""

import os
import sys
import sqlite3

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
DB_PATH = os.path.join(ROOT_DIR, "predictor_v2.db")

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

def init_db(db_path=DB_PATH):
    abs_path = os.path.abspath(db_path)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    conn = sqlite3.connect(abs_path)
    cursor = conn.cursor()
    cursor.execute("PRAGMA journal_mode = WAL;")

    # 1. Production V2 Dimensional & Fact Warehouse Schema + Analytical B-Tree Indices
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS dim_competitions (
            competition_id VARCHAR(16) PRIMARY KEY,
            name VARCHAR(64) NOT NULL,
            country VARCHAR(32) NOT NULL,
            category VARCHAR(16) NOT NULL,
            external_source_id INT NOT NULL,
            flag_emoji VARCHAR(8),
            logo_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

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

        CREATE TABLE IF NOT EXISTS dim_players (
            player_id VARCHAR(64) PRIMARY KEY,
            tm_id VARCHAR(32) UNIQUE,
            api_sports_id INT,
            flashscore_slug VARCHAR(64),
            full_name VARCHAR(128) NOT NULL,
            display_name VARCHAR(64) NOT NULL,
            short_name VARCHAR(32),
            primary_position VARCHAR(16) NOT NULL,
            role_category VARCHAR(4) NOT NULL,
            birth_date DATE,
            age INT,
            nationality VARCHAR(64),
            photo_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

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
            seasons_covered TEXT,
            transfer_note TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS dim_player_aliases (
            alias_id VARCHAR(64) PRIMARY KEY,
            player_id VARCHAR(64) NOT NULL REFERENCES dim_players(player_id) ON DELETE CASCADE,
            source_system VARCHAR(32) NOT NULL,
            raw_name VARCHAR(128) NOT NULL,
            normalized_name VARCHAR(128) NOT NULL,
            confidence_score DECIMAL(3, 2) DEFAULT 1.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

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
    """)

    # Seed Official Competitions into dim_competitions
    cursor.executemany("""
        INSERT OR REPLACE INTO dim_competitions (
            competition_id, name, country, category, external_source_id, flag_emoji, logo_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    """, COMPETITIONS_SEED)

    conn.commit()
    conn.close()
    print(f"Database initialized & verified successfully at: {abs_path}")

if __name__ == "__main__":
    init_db()
