import os
import glob
import json
import sqlite3

ROOT_DIR = r"c:\Users\benoi\Documents\Predictor Ultimate"
DB_PATH = os.path.join(ROOT_DIR, "predictor_v2.db")

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

print("=== 1. CHECK TRANSFERS VS SCD2 CONTRACTS ===")
cursor.execute("""
    SELECT t.transfer_id, t.player_id, t.player_name, t.from_team_name, t.to_team_name, t.transfer_date, t.season
    FROM fct_player_transfers t
    ORDER BY t.season DESC, t.transfer_date DESC;
""")
transfers = cursor.fetchall()
print(f"Total transfers in fct_player_transfers: {len(transfers)}")

anomalies = []
for trf in transfers:
    trf_id, pid, pname, from_t, to_t, t_date, season = trf
    # Check current contract for this player
    cursor.execute("""
        SELECT c.contract_sk, c.team_id, t.name, c.is_current, c.seasons_covered, c.valid_from, c.valid_to
        FROM dim_player_contracts_scd2 c
        JOIN dim_teams t ON c.team_id = t.team_id
        WHERE c.player_id = ? AND c.is_current = 1;
    """, (pid,))
    curr_contracts = cursor.fetchall()
    print(f"\nTransfer: {pname} from {from_t} -> {to_t} ({season}, date: {t_date})")
    print(f"  Current active contract(s) in SCD2: {curr_contracts}")
    
    # Check if current contract team matches to_team
    if not curr_contracts:
        anomalies.append((pname, from_t, to_t, "NO_ACTIVE_CONTRACT", None))
    else:
        for csk, tid, tname, is_curr, sez, v_from, v_to in curr_contracts:
            if tname.lower() != to_t.lower() and to_t.lower() not in tname.lower() and tname.lower() not in to_t.lower():
                anomalies.append((pname, from_t, to_t, f"STILL_AT_OLD_OR_WRONG_CLUB: {tname}", csk))

print("\n" + "=" * 70)
print(f"ANOMALIES FOUND: {len(anomalies)}")
for a in anomalies:
    print(" ⚠️ ", a)
print("=" * 70)

# Check Chelsea squad specifically
cursor.execute("""
    SELECT p.full_name, c.squad_number, c.market_value_formatted, c.is_current, c.seasons_covered
    FROM dim_player_contracts_scd2 c
    JOIN dim_players p ON c.player_id = p.player_id
    WHERE c.team_id = 'CLUB_CHELSEA' AND c.is_current = 1;
""")
chelsea_players = cursor.fetchall()
print(f"\nTotal active Chelsea players in DB: {len(chelsea_players)}")

# Check Strasbourg squad specifically
cursor.execute("""
    SELECT p.full_name, c.squad_number, c.market_value_formatted, c.is_current, c.seasons_covered
    FROM dim_player_contracts_scd2 c
    JOIN dim_players p ON c.player_id = p.player_id
    WHERE c.team_id = 'CLUB_STRASBOURG' AND c.is_current = 1;
""")
strasbourg_players = cursor.fetchall()
print(f"Total active Strasbourg players in DB: {len(strasbourg_players)}")

conn.close()
