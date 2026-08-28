#!/usr/bin/env python3
"""
Database Initializer & Migrator for European Football Predictor V2.
Creates all SQL tables including SCD Type 2 Mercato tracking and Friendlies support.
"""

import os
import sys
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "..", "predictor_v2.db")

def init_db(db_path=DB_PATH):
    abs_path = os.path.abspath(db_path)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    conn = sqlite3.connect(abs_path)
    cursor = conn.cursor()
    
    # 1. Base Tables
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS leagues (
            league_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            country TEXT NOT NULL,
            code TEXT NOT NULL,
            is_friendly INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS teams (
            team_id TEXT PRIMARY KEY,
            league_id TEXT REFERENCES leagues(league_id),
            name TEXT NOT NULL,
            short_name TEXT,
            stadium_name TEXT,
            city TEXT,
            logo_url TEXT
        );

        CREATE TABLE IF NOT EXISTS players (
            player_id TEXT PRIMARY KEY,
            full_name TEXT NOT NULL,
            known_name TEXT,
            birth_date TEXT,
            nationality TEXT,
            primary_position TEXT,
            jersey_number INTEGER,
            photo_url TEXT
        );

        CREATE TABLE IF NOT EXISTS player_team_history (
            history_id TEXT PRIMARY KEY,
            player_id TEXT NOT NULL REFERENCES players(player_id),
            team_id TEXT NOT NULL REFERENCES teams(team_id),
            shirt_number INTEGER,
            valid_from TEXT NOT NULL,
            valid_to TEXT,
            is_current INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS matches (
            match_id TEXT PRIMARY KEY,
            league_id TEXT REFERENCES leagues(league_id),
            season TEXT NOT NULL,
            round INTEGER,
            match_date TEXT NOT NULL,
            home_team_id TEXT REFERENCES teams(team_id),
            away_team_id TEXT REFERENCES teams(team_id),
            home_score INTEGER,
            away_score INTEGER,
            status TEXT DEFAULT 'SCHEDULED',
            is_friendly INTEGER DEFAULT 0,
            match_rating REAL DEFAULT 7.0
        );

        CREATE TABLE IF NOT EXISTS match_weather (
            match_id TEXT PRIMARY KEY REFERENCES matches(match_id),
            temperature_c REAL,
            precipitation_mm REAL,
            wind_speed_kmh REAL,
            condition_summary TEXT
        );

        CREATE TABLE IF NOT EXISTS match_odds (
            odd_id TEXT PRIMARY KEY,
            match_id TEXT REFERENCES matches(match_id),
            bookmaker TEXT DEFAULT 'Betclic',
            odd_home REAL NOT NULL,
            odd_draw REAL NOT NULL,
            odd_away REAL NOT NULL,
            scraped_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS predictions (
            prediction_id TEXT PRIMARY KEY,
            match_id TEXT REFERENCES matches(match_id),
            prob_home REAL NOT NULL,
            prob_draw REAL NOT NULL,
            prob_away REAL NOT NULL,
            expected_score_home REAL,
            expected_score_away REAL,
            value_bet_detected INTEGER DEFAULT 0,
            value_side TEXT,
            edge_percentage REAL,
            generated_at TEXT NOT NULL
        );
    """)
    
    # 2. Add columns if missing (Migrations)
    cursor.execute("PRAGMA table_info(leagues)")
    cols = [row[1] for row in cursor.fetchall()]
    if "is_friendly" not in cols:
        cursor.execute("ALTER TABLE leagues ADD COLUMN is_friendly INTEGER DEFAULT 0")
        
    cursor.execute("PRAGMA table_info(matches)")
    mcols = [row[1] for row in cursor.fetchall()]
    if "is_friendly" not in mcols:
        cursor.execute("ALTER TABLE matches ADD COLUMN is_friendly INTEGER DEFAULT 0")
    if "match_rating" not in mcols:
        cursor.execute("ALTER TABLE matches ADD COLUMN match_rating REAL DEFAULT 7.0")
    
    # 3. Seed default leagues including Friendlies
    leagues = [
        ("ENG-PL", "Premier League", "England", "PL", 0),
        ("ESP-LL", "La Liga", "Spain", "LL", 0),
        ("ITA-SA", "Serie A", "Italy", "SA", 0),
        ("GER-BL", "Bundesliga", "Germany", "BL", 0),
        ("FRA-L1", "Ligue 1", "France", "L1", 0),
        ("FRIENDLY-CLUB", "Club Friendlies", "Global", "FRIENDLY", 1),
        ("FRIENDLY-INT", "International Friendlies", "Global", "INT_FRIENDLY", 1)
    ]
    cursor.executemany("INSERT OR IGNORE INTO leagues (league_id, name, country, code, is_friendly) VALUES (?, ?, ?, ?, ?)", leagues)
    
    conn.commit()
    conn.close()
    print(f"Database migration completed at: {abs_path}")

if __name__ == "__main__":
    init_db()
