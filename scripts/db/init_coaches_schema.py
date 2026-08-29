#!/usr/bin/env python3
"""
scripts/db/init_coaches_schema.py
─────────────────────────────────────────────────────────────
Initialise les tables dédiées aux entraîneurs / managers dans SQLite (predictor_v2.db) :
1. `dim_coaches` : Registre maître des entraîneurs (identité, âge, nationalité, photo, formation).
2. `dim_coach_contracts_scd2` : Mandats et contrats SCD Type 2 (club, valid_from, valid_to, is_current, stats).
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

print(f"📦 [DB:InitCoaches] Connexion à la base de données : {DB_PATH}")

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

cursor.execute("PRAGMA foreign_keys = ON;")

DDL_SCRIPT = """
-- Table Dimensionnelle Maître : dim_coaches
CREATE TABLE IF NOT EXISTS dim_coaches (
    coach_id VARCHAR(64) PRIMARY KEY,          -- Ex: "cch_pep_guardiola_78619"
    fotmob_id INT,
    api_sports_id INT,
    full_name VARCHAR(128) NOT NULL,
    display_name VARCHAR(64) NOT NULL,
    short_name VARCHAR(32) NOT NULL,
    birth_date DATE,
    age INT,
    nationality VARCHAR(64) NOT NULL,
    nationality_code VARCHAR(8) NOT NULL,
    nationality_flag VARCHAR(8) NOT NULL,
    photo_url TEXT,
    preferred_formation VARCHAR(16) DEFAULT '4-3-3',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table SCD Type 2 des Mandats & Contrats d'Entraîneurs : dim_coach_contracts_scd2
CREATE TABLE IF NOT EXISTS dim_coach_contracts_scd2 (
    contract_sk VARCHAR(64) PRIMARY KEY,       -- Ex: "csk_guardiola_mancity_2024_08_18"
    coach_id VARCHAR(64) NOT NULL REFERENCES dim_coaches(coach_id) ON DELETE CASCADE,
    team_id VARCHAR(32) NOT NULL REFERENCES dim_teams(team_id),
    team_name VARCHAR(64) NOT NULL,
    team_logo TEXT,
    league_id VARCHAR(16),
    valid_from DATE NOT NULL,                   -- Date de prise de fonction / 1er match
    valid_to DATE,                              -- Date de départ / fin de mandat (NULL si actif)
    is_current BOOLEAN NOT NULL DEFAULT 0,      -- 1 si entraîneur actuel en poste
    role_title VARCHAR(64) DEFAULT 'Entraîneur Principal',
    contract_status VARCHAR(32) NOT NULL,       -- 'ACTIVE', 'DEPARTED', 'INTERIM'
    seasons_covered TEXT NOT NULL,              -- JSON array: ["2024-2025", "2025-2026", "2026-2027"]
    matches_count INT DEFAULT 0,
    wins INT DEFAULT 0,
    draws INT DEFAULT 0,
    losses INT DEFAULT 0,
    win_rate_pct DECIMAL(5, 2) DEFAULT 0.0,
    points_per_match DECIMAL(4, 2) DEFAULT 0.0,
    appointment_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coaches_name ON dim_coaches(full_name);
CREATE INDEX IF NOT EXISTS idx_coaches_nat ON dim_coaches(nationality);
CREATE INDEX IF NOT EXISTS idx_coach_contracts_coach ON dim_coach_contracts_scd2(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_contracts_team ON dim_coach_contracts_scd2(team_id);
CREATE INDEX IF NOT EXISTS idx_coach_contracts_current ON dim_coach_contracts_scd2(is_current);
"""

cursor.executescript(DDL_SCRIPT)
conn.commit()

cursor.execute("SELECT COUNT(*) FROM dim_coaches;")
count_coaches = cursor.fetchone()[0]

cursor.execute("SELECT COUNT(*) FROM dim_coach_contracts_scd2;")
count_contracts = cursor.fetchone()[0]

print(f"✅ [DB:InitCoaches] Tables prêtes : dim_coaches ({count_coaches} entrées), dim_coach_contracts_scd2 ({count_contracts} entrées).")

conn.close()
