#!/usr/bin/env python3
"""
scripts/db/init_betclic_markets_schema.py
─────────────────────────────────────────────────────────────
Initialise la table des marchés et cotes exhaustives Betclic pour chaque match.
Taxonomie conforme à l'organisation officielle Betclic :
- RESULTS : Résultats (1N2, Double chance, DNB, Écarts de buts)
- TOP : Le Top (Sélections vedettes de la rencontre)
- GOALS : Buts (Paliers Over/Under, BTTS, Totaux par équipe)
- EXACT_SCORE : Score exact (Matrice complète de scores)
- PLAYERS : Buteurs & Joueurs (Buteurs, Doublés, Passeurs, SuperSub certifié)
- HALFTIME : Mi-temps (Résultats et buts 1ère/2ème mi-temps)
- STATS : Stats équipes & joueurs (Tirs, Cadrés, Fautes, Corners, Cartons)
- SPECIALS : ⚡ Spéciaux & Fast (Tranches de 15 minutes, combos Betclic)
"""

import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(ROOT_DIR, 'predictor_v2.db')

def init_betclic_markets_schema():
    print(f"[Database] Initialisation du schema des Marches Betclic dans : {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS match_betclic_markets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id VARCHAR(64) NOT NULL,
        betclic_match_id VARCHAR(64),
        category_code VARCHAR(32) NOT NULL,
        category_label VARCHAR(64) NOT NULL,
        market_id VARCHAR(64) NOT NULL,
        market_name VARCHAR(128) NOT NULL,
        selection_id VARCHAR(64) NOT NULL,
        selection_key VARCHAR(64) NOT NULL,
        selection_label VARCHAR(128) NOT NULL,
        odds REAL NOT NULL,
        is_live INTEGER NOT NULL DEFAULT 0,
        is_supersub INTEGER NOT NULL DEFAULT 0,
        player_id VARCHAR(64),
        player_name_canonical VARCHAR(128),
        display_order INTEGER NOT NULL DEFAULT 0,
        scraped_at_utc TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
        CONSTRAINT uq_match_market_sel UNIQUE (match_id, market_id, selection_id)
    );

    CREATE INDEX IF NOT EXISTS idx_betclic_match_cat ON match_betclic_markets(match_id, category_code);
    CREATE INDEX IF NOT EXISTS idx_betclic_market_name ON match_betclic_markets(market_name);
    CREATE INDEX IF NOT EXISTS idx_betclic_player ON match_betclic_markets(player_id);
    CREATE INDEX IF NOT EXISTS idx_betclic_scraped ON match_betclic_markets(scraped_at_utc);
    """)

    conn.commit()
    conn.close()
    print("[Database] Schema 'match_betclic_markets' initialise avec succes.")

if __name__ == '__main__':
    init_betclic_markets_schema()
