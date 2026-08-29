import os
import glob
import json
import sqlite3

ROOT_DIR = r"c:\Users\benoi\Documents\Predictor Ultimate"
DB_PATH = os.path.join(ROOT_DIR, "predictor_v2.db")

print("=== 1. CHECK SQUADS FILES ===")
strasbourg_json = os.path.join(ROOT_DIR, "src", "data", "squads", "strasbourg.json")
chelsea_json = os.path.join(ROOT_DIR, "src", "data", "squads", "chelsea.json")

if os.path.exists(strasbourg_json):
    with open(strasbourg_json, 'r', encoding='utf-8') as f:
        data = json.load(f)
        for p in data.get('players', []):
            if 'emegha' in p.get('name', '').lower():
                print(f"Strasbourg file player: {p}")

if os.path.exists(chelsea_json):
    with open(chelsea_json, 'r', encoding='utf-8') as f:
        data = json.load(f)
        for p in data.get('players', []):
            if 'emegha' in p.get('name', '').lower():
                print(f"Chelsea file player: {p}")

print("\n=== 2. CHECK SQLITE DB ===")
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

cursor.execute("SELECT * FROM dim_players WHERE full_name LIKE '%Emegha%' OR display_name LIKE '%Emegha%';")
print("dim_players:", cursor.fetchall())

cursor.execute("""
    SELECT c.*, t.name as team_name 
    FROM dim_player_contracts_scd2 c
    JOIN dim_teams t ON c.team_id = t.team_id
    WHERE c.player_id LIKE '%emegha%' OR c.contract_sk LIKE '%emegha%';
""")
print("dim_player_contracts_scd2:", cursor.fetchall())

print("\n=== 3. CHECK RAW MATCH LINEUPS FOR EMEGHA ===")
# Search match files for Emegha appearances
match_files = glob.glob(os.path.join(ROOT_DIR, "data", "raw", "*", "*", "matches", "*.json"))
appearances = []
for mf in match_files:
    try:
        with open(mf, 'r', encoding='utf-8') as f:
            mdata = json.load(f)
        general = mdata.get('general', {})
        m_date = (general.get('matchTimeUTCDate') or "")[:10]
        lineup = mdata.get('content', {}).get('lineup', {})
        for side in ['homeTeam', 'awayTeam']:
            tname = lineup.get(side, {}).get('teamName') or general.get(side, {}).get('name')
            for p in lineup.get(side, {}).get('starters', []) + lineup.get(side, {}).get('subs', []):
                pname = p.get('name') or p.get('usualName') or ""
                if 'emegha' in pname.lower():
                    appearances.append((m_date, tname, pname, p.get('id'), general.get('leagueName')))
    except Exception:
        pass

appearances.sort(key=lambda x: x[0])
print(f"Found {len(appearances)} match lineup appearances:")
for a in appearances:
    print(" ", a)

conn.close()
