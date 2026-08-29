#!/usr/bin/env python3
"""
scripts/db/init_transfers_schema.py
─────────────────────────────────────────────────────────────
Initialise la table de faits enrichie fct_player_transfers dans SQLite (predictor_v2.db)
pour la modélisation analytique des transferts et mouvements de joueurs.
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

print(f"📦 [DB:InitTransfers] Connexion à la base de données : {DB_PATH}")

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

cursor.execute("PRAGMA foreign_keys = ON;")

DDL_SCRIPT = """
-- Table de Faits Enrichie des Transferts & Mouvements de Joueurs
CREATE TABLE IF NOT EXISTS fct_player_transfers (
    transfer_id VARCHAR(64) PRIMARY KEY,
    player_id VARCHAR(64) NOT NULL REFERENCES dim_players(player_id) ON DELETE CASCADE,
    player_name VARCHAR(128) NOT NULL,
    player_display_name VARCHAR(64) NOT NULL,
    player_position VARCHAR(16) NOT NULL,
    player_role VARCHAR(4) NOT NULL,
    player_nationality VARCHAR(64) NOT NULL,
    player_nationality_code VARCHAR(8) NOT NULL,
    player_nationality_flag VARCHAR(8) NOT NULL,
    player_photo_url TEXT,
    from_team_id VARCHAR(32) NOT NULL REFERENCES dim_teams(team_id),
    from_team_name VARCHAR(64) NOT NULL,
    from_team_logo TEXT,
    from_team_league VARCHAR(16),
    to_team_id VARCHAR(32) NOT NULL REFERENCES dim_teams(team_id),
    to_team_name VARCHAR(64) NOT NULL,
    to_team_logo TEXT,
    to_team_league VARCHAR(16),
    transfer_date DATE NOT NULL,
    season VARCHAR(16) NOT NULL, -- '2024-2025', '2025-2026', '2026-2027'
    mercato_window VARCHAR(16) NOT NULL, -- 'SUMMER', 'WINTER'
    transfer_type VARCHAR(32) NOT NULL, -- 'ACHAT_SEC', 'FIN_DE_CONTRAT', 'PRET_AVEC_OA', 'PRET_SEC', 'RETOUR_PRET'
    transfer_type_label VARCHAR(64) NOT NULL,
    fee_numeric_eur DECIMAL(12, 2) NOT NULL,
    fee_display VARCHAR(32) NOT NULL,
    market_value_eur DECIMAL(12, 2) NOT NULL,
    market_value_display VARCHAR(32) NOT NULL,
    fee_value_delta_eur DECIMAL(12, 2),
    age_at_transfer INT NOT NULL,
    preferred_foot VARCHAR(16) DEFAULT 'Droitier',
    transfer_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transfers_season ON fct_player_transfers(season);
CREATE INDEX IF NOT EXISTS idx_transfers_player ON fct_player_transfers(player_id);
CREATE INDEX IF NOT EXISTS idx_transfers_from_team ON fct_player_transfers(from_team_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_team ON fct_player_transfers(to_team_id);
CREATE INDEX IF NOT EXISTS idx_transfers_fee ON fct_player_transfers(fee_numeric_eur DESC);
"""

cursor.executescript(DDL_SCRIPT)
conn.commit()

cursor.execute("SELECT COUNT(*) FROM fct_player_transfers;")
count = cursor.fetchone()[0]
print(f"✅ [DB:InitTransfers] Table fct_player_transfers prête ({count} lignes existantes).")

conn.close()
