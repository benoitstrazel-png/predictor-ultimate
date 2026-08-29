#!/usr/bin/env python3
"""
scripts/db/init_odds_schema.py
─────────────────────────────────────────────────────────────
Initialise les tables relationnelles d'historisation et de suivi des cotes Betclic :
- `fact_odds_snapshots` : Traçabilité temporelle fine des mouvements de marché (SCD2).
- `dim_match_closing_odds` : Vue consolidée 1 ligne / match (Opening, Closing, Drift, Over/Under, BTTS).
- `sys_odds_quarantine` : Isolation des anomalies et cotes corrompues rejetées par les Quality Gates.
"""

import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(ROOT_DIR, 'predictor_v2.db')

def init_odds_schema():
    print(f"[Database] Initialisation du schema des Cotes dans : {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.executescript("""
    -- 1. Table d'historique granulaire (SCD Type 2 / Snapshots temporels)
    CREATE TABLE IF NOT EXISTS fact_odds_snapshots (
        snapshot_id VARCHAR(64) PRIMARY KEY,
        match_id VARCHAR(64) NOT NULL,
        competition_id VARCHAR(16) NOT NULL,
        bookmaker VARCHAR(32) NOT NULL DEFAULT 'BETCLIC',
        market_type VARCHAR(32) NOT NULL DEFAULT '1N2',
        odd_home REAL NOT NULL,
        odd_draw REAL,
        odd_away REAL NOT NULL,
        margin_pct REAL NOT NULL,
        payout_rate_trj REAL NOT NULL,
        phase VARCHAR(24) NOT NULL, -- 'OPENING', 'PRE_MATCH_STEP', 'CLOSING'
        is_closing_line INTEGER NOT NULL DEFAULT 0,
        is_valid INTEGER NOT NULL DEFAULT 1,
        validation_note VARCHAR(128),
        captured_at_utc TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_odds_match_phase ON fact_odds_snapshots(match_id, phase);
    CREATE INDEX IF NOT EXISTS idx_odds_captured_at ON fact_odds_snapshots(captured_at_utc);
    CREATE INDEX IF NOT EXISTS idx_odds_comp ON fact_odds_snapshots(competition_id);

    -- 2. Table consolidee 1 ligne par match
    CREATE TABLE IF NOT EXISTS dim_match_closing_odds (
        match_id VARCHAR(64) PRIMARY KEY,
        competition_id VARCHAR(16) NOT NULL,
        home_team_id VARCHAR(64) NOT NULL,
        away_team_id VARCHAR(64) NOT NULL,
        home_team_name VARCHAR(128),
        away_team_name VARCHAR(128),
        opening_odd_1 REAL,
        opening_odd_n REAL,
        opening_odd_2 REAL,
        opening_timestamp_utc TEXT,
        closing_odd_1 REAL,
        closing_odd_n REAL,
        closing_odd_2 REAL,
        closing_margin_pct REAL,
        drift_home_pct REAL,
        drift_away_pct REAL,
        over_2_5_odd REAL,
        under_2_5_odd REAL,
        btts_yes_odd REAL,
        btts_no_odd REAL,
        closing_timestamp_utc TEXT,
        odds_status VARCHAR(24) DEFAULT 'ACTIVE', -- 'ACTIVE', 'NOT_OPEN', 'SUSPENDED', 'VOID', 'SETTLED'
        updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_closing_comp ON dim_match_closing_odds(competition_id);
    CREATE INDEX IF NOT EXISTS idx_closing_status ON dim_match_closing_odds(odds_status);

    -- 3. Table de mise en quarantaine des cotes aberrantes
    CREATE TABLE IF NOT EXISTS sys_odds_quarantine (
        quarantine_id INTEGER PRIMARY KEY AUTOINCREMENT,
        raw_match_name TEXT,
        competition_id VARCHAR(16),
        raw_odds_payload TEXT,
        rejection_reason TEXT,
        detected_at TEXT NOT NULL DEFAULT (DATETIME('now'))
    );
    """)

    conn.commit()
    conn.close()
    print("[Database] Tables fact_odds_snapshots, dim_match_closing_odds, sys_odds_quarantine creees avec succes.")

if __name__ == '__main__':
    init_odds_schema()
