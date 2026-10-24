#!/usr/bin/env python3
"""
Mercato & SCD Type 2 Player Transfer Manager (V2 Dimensional Warehouse).
Operates directly on dim_player_contracts_scd2, dim_players, and dim_teams in predictor_v2.db.
Guarantees historical data retention and idempotent player-team transition tracking.
"""

import os
import sys
import json
import sqlite3
import argparse

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
DB_PATH = os.path.join(ROOT_DIR, "predictor_v2.db")

LEGACY_PLAYER_ALIASES = {
    "marmoush_01": "ply_omar_marmoush",
    "omar marmoush": "ply_omar_marmoush",
    "cherki_01": "ply_rayan_cherki",
    "rayan cherki": "ply_rayan_cherki",
    "mbappe_01": "ply_kylian_mbappe",
    "kylian mbappe": "ply_kylian_mbappe",
}

LEGACY_TEAM_ALIASES = {
    "MAN_CITY": "CLUB_MANCHESTER_CITY",
    "MANCHESTER CITY": "CLUB_MANCHESTER_CITY",
    "EINTRACHT": "CLUB_EINTRACHT_FRANKFURT",
    "EINTRACHT FRANKFURT": "CLUB_EINTRACHT_FRANKFURT",
    "LYON": "CLUB_LYON",
    "OLYMPIQUE LYONNAIS": "CLUB_LYON",
    "PSG": "CLUB_PSG",
    "REAL_MADRID": "CLUB_REAL_MADRID",
}

def get_db_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def resolve_player_id(cursor, raw_player: str) -> str:
    if not raw_player:
        return ""
    clean = raw_player.strip()
    if clean.lower() in LEGACY_PLAYER_ALIASES:
        return LEGACY_PLAYER_ALIASES[clean.lower()]
    cursor.execute("SELECT player_id FROM dim_players WHERE player_id = ? OR lower(full_name) = lower(?)", (clean, clean))
    row = cursor.fetchone()
    if row:
        return row["player_id"]
    cursor.execute("SELECT player_id FROM dim_players WHERE lower(full_name) LIKE ?", (f"%{clean.lower()}%",))
    row = cursor.fetchone()
    return row["player_id"] if row else clean

def resolve_team_id(cursor, raw_team: str) -> tuple:
    if not raw_team:
        return ("", "UNKNOWN")
    clean = raw_team.strip()
    mapped = LEGACY_TEAM_ALIASES.get(clean.upper(), clean)
    cursor.execute("SELECT team_id, league_id, name FROM dim_teams WHERE team_id = ? OR lower(name) = lower(?) OR lower(short_name) = lower(?)", (mapped, clean, clean))
    row = cursor.fetchone()
    if row:
        return (row["team_id"], row["league_id"] or "EUR-CL")
    cursor.execute("SELECT team_id, league_id, name FROM dim_teams WHERE lower(name) LIKE ?", (f"%{clean.lower()}%",))
    row = cursor.fetchone()
    if row:
        return (row["team_id"], row["league_id"] or "EUR-CL")
    return (mapped, "EUR-CL")

def register_player(player_id, full_name, primary_position, initial_team_id, join_date="2024-07-01"):
    """
    Ensures a player and their initial team affiliation exist in dim_players / dim_player_contracts_scd2.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    pid = resolve_player_id(cursor, player_id)
    tid, league_id = resolve_team_id(cursor, initial_team_id)

    cursor.execute("SELECT player_id FROM dim_players WHERE player_id = ?", (pid,))
    if not cursor.fetchone():
        role_cat = "A" if primary_position in ("Forward", "ST", "RW", "LW") else "M"
        cursor.execute("""
            INSERT INTO dim_players (player_id, full_name, display_name, short_name, primary_position, role_category)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (pid, full_name, full_name, full_name, primary_position, role_cat))

    cursor.execute("""
        SELECT contract_sk FROM dim_player_contracts_scd2
        WHERE player_id = ?
    """, (pid,))
    if not cursor.fetchone():
        contract_sk = f"cnt_{pid}_{tid}_{join_date.replace('-', '_')}"
        cursor.execute("""
            INSERT INTO dim_player_contracts_scd2 (
                contract_sk, player_id, team_id, league_id, valid_from, valid_to, is_current, seasons_covered
            ) VALUES (?, ?, ?, ?, ?, NULL, 1, ?)
        """, (contract_sk, pid, tid, league_id, join_date, json.dumps(["2026-2027"])))

    conn.commit()
    conn.close()

def transfer_player(player_id, new_team_id, transfer_date):
    """
    Executes an idempotent SCD Type 2 transfer in dim_player_contracts_scd2:
    - Closes active affiliation record if different from target team (sets valid_to = transfer_date, is_current = 0).
    - Opens or confirms active affiliation record for target team (sets valid_from = transfer_date, valid_to = NULL, is_current = 1).
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    pid = resolve_player_id(cursor, player_id)
    tid, league_id = resolve_team_id(cursor, new_team_id)

    # Check if already currently active at target team
    cursor.execute("""
        SELECT contract_sk, team_id, valid_from
        FROM dim_player_contracts_scd2
        WHERE player_id = ? AND is_current = 1
    """, (pid,))
    active_rows = cursor.fetchall()

    already_at_target = any(r["team_id"] == tid for r in active_rows)
    if already_at_target and len(active_rows) == 1:
        # Ensure previous historical records before transfer_date have valid_to properly bounded
        cursor.execute("""
            UPDATE dim_player_contracts_scd2
            SET valid_to = COALESCE(valid_to, ?)
            WHERE player_id = ? AND is_current = 0 AND team_id != ? AND valid_to IS NULL
        """, (transfer_date, pid, tid))
        conn.commit()
        conn.close()
        print(f"Mercato SCD2 Success: Player {pid} transferred to team {tid} effective {transfer_date}.")
        return

    # 1. Close current active record(s)
    cursor.execute("""
        UPDATE dim_player_contracts_scd2
        SET valid_to = ?, is_current = 0
        WHERE player_id = ? AND is_current = 1 AND team_id != ?
    """, (transfer_date, pid, tid))

    # 2. Create or activate new contract record
    contract_sk = f"cnt_{pid}_{tid}_2026_2027"
    cursor.execute("""
        INSERT OR REPLACE INTO dim_player_contracts_scd2 (
            contract_sk, player_id, team_id, league_id, valid_from, valid_to, is_current, seasons_covered
        ) VALUES (?, ?, ?, ?, ?, NULL, 1, ?)
    """, (contract_sk, pid, tid, league_id, transfer_date, json.dumps(["2026-2027"])))

    conn.commit()
    conn.close()
    print(f"Mercato SCD2 Success: Player {pid} transferred to team {tid} effective {transfer_date}.")

def get_player_team_at_date(player_id, date_str):
    """
    Retrieves the exact team a player belonged to on a given historical date from dim_player_contracts_scd2.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    pid = resolve_player_id(cursor, player_id)

    cursor.execute("""
        SELECT p.full_name, t.name as team_name, c.team_id, c.valid_from, c.valid_to, c.is_current
        FROM dim_player_contracts_scd2 c
        JOIN dim_players p ON c.player_id = p.player_id
        JOIN dim_teams t ON c.team_id = t.team_id
        WHERE c.player_id = ?
          AND c.valid_from <= ?
          AND (c.valid_to IS NULL OR c.valid_to >= ?)
        ORDER BY c.is_current DESC, c.valid_from DESC
        LIMIT 1
    """, (pid, date_str, date_str))

    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Manage Mercato SCD Type 2 Player Transfers (V2 Warehouse)")
    parser.add_argument("--transfer", action="store_true", help="Execute a player transfer")
    parser.add_argument("--player", type=str, default="marmoush_01", help="Player ID or Full Name")
    parser.add_argument("--to", type=str, default="MAN_CITY", help="Destination Team ID or Name")
    parser.add_argument("--date", type=str, default="2025-07-01", help="Transfer / Check date (YYYY-MM-DD)")
    parser.add_argument("--check", action="store_true", help="Query player team at specified date")
    args, unknown = parser.parse_known_args()

    if args.transfer:
        transfer_player(args.player, args.to, args.date)
    elif args.check:
        res = get_player_team_at_date(args.player, args.date)
        print(f"Player {args.player} at {args.date}: {res['team_name'] if res else 'Unknown'}")
    else:
        before_team = get_player_team_at_date("marmoush_01", "2025-05-01")
        print("Marmoush team on 2025-05-01:", before_team["team_name"] if before_team else "Unknown")
        transfer_player("marmoush_01", "MAN_CITY", "2025-07-01")
        historical_team = get_player_team_at_date("marmoush_01", "2025-05-01")
        print("Marmoush historical team on 2025-05-01 (must stay Eintracht):", historical_team["team_name"] if historical_team else "Unknown")
        current_team = get_player_team_at_date("marmoush_01", "2026-01-01")
        print("Marmoush current team on 2026-01-01 (must be Man City):", current_team["team_name"] if current_team else "Unknown")
