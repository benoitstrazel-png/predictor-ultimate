#!/usr/bin/env python3
"""
Mercato & SCD Type 2 Player Transfer Manager.
Guarantees historical data retention and seamless player-team transition tracking.
"""

import os
import sys
import sqlite3
import uuid
from datetime import datetime

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "predictor_v2.db"))

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def register_player(player_id, full_name, primary_position, initial_team_id, join_date="2024-07-01"):
    """
    Registers a new player and their initial team affiliation.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Insert Master Player
    cursor.execute("""
        INSERT OR IGNORE INTO players (player_id, full_name, primary_position)
        VALUES (?, ?, ?)
    """, (player_id, full_name, primary_position))
    
    # 2. Check existing active history
    cursor.execute("""
        SELECT history_id FROM player_team_history
        WHERE player_id = ? AND is_current = 1
    """, (player_id,))
    existing = cursor.fetchone()
    
    if not existing:
        history_id = f"hist_{uuid.uuid4().hex[:8]}"
        cursor.execute("""
            INSERT INTO player_team_history (history_id, player_id, team_id, valid_from, valid_to, is_current)
            VALUES (?, ?, ?, ?, NULL, 1)
        """, (history_id, player_id, initial_team_id, join_date))
    
    conn.commit()
    conn.close()

def transfer_player(player_id, new_team_id, transfer_date):
    """
    Executes an SCD Type 2 transfer:
    - Closes active affiliation record (sets valid_to = transfer_date, is_current = 0).
    - Opens new affiliation record (sets valid_from = transfer_date, valid_to = NULL, is_current = 1).
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Close current record
    cursor.execute("""
        UPDATE player_team_history
        SET valid_to = ?, is_current = 0
        WHERE player_id = ? AND is_current = 1
    """, (transfer_date, player_id))
    
    # 2. Create new active record
    history_id = f"hist_{uuid.uuid4().hex[:8]}"
    cursor.execute("""
        INSERT INTO player_team_history (history_id, player_id, team_id, valid_from, valid_to, is_current)
        VALUES (?, ?, ?, ?, NULL, 1)
    """, (history_id, player_id, new_team_id, transfer_date))
    
    conn.commit()
    conn.close()
    print(f"Mercato SCD2 Success: Player {player_id} transferred to team {new_team_id} effective {transfer_date}.")

def get_player_team_at_date(player_id, date_str):
    """
    Retrieves the exact team a player belonged to on a given historical date.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT p.full_name, t.name as team_name, h.valid_from, h.valid_to, h.is_current
        FROM player_team_history h
        JOIN players p ON h.player_id = p.player_id
        JOIN teams t ON h.team_id = t.team_id
        WHERE h.player_id = ?
          AND h.valid_from <= ?
          AND (h.valid_to IS NULL OR h.valid_to > ?)
    """, (player_id, date_str, date_str))
    
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

if __name__ == "__main__":
    # Demo / Test Mercato SCD Type 2 with Marmoush & Cherki
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Seed Teams
    cursor.executemany("INSERT OR IGNORE INTO teams (team_id, name, city) VALUES (?, ?, ?)", [
        ("EINTRACHT", "Eintracht Frankfurt", "Frankfurt"),
        ("MAN_CITY", "Manchester City", "Manchester"),
        ("LYON", "Olympique Lyonnais", "Lyon")
    ])
    conn.commit()
    conn.close()
    
    # Register Omar Marmoush at Frankfurt in 2024
    register_player("marmoush_01", "Omar Marmoush", "Forward", "EINTRACHT", "2024-01-01")
    
    # Check team on 2025-05-01 (before transfer)
    before_team = get_player_team_at_date("marmoush_01", "2025-05-01")
    print("Marmoush team on 2025-05-01:", before_team["team_name"])
    
    # Execute Mercato Transfer to Manchester City on 2025-07-01
    transfer_player("marmoush_01", "MAN_CITY", "2025-07-01")
    
    # Check team on 2025-05-01 (historical match verification)
    historical_team = get_player_team_at_date("marmoush_01", "2025-05-01")
    print("Marmoush historical team on 2025-05-01 (must stay Eintracht):", historical_team["team_name"])
    
    # Check team on 2026-01-01 (new match verification)
    current_team = get_player_team_at_date("marmoush_01", "2026-01-01")
    print("Marmoush current team on 2026-01-01 (must be Man City):", current_team["team_name"])
