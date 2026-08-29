import os
import sys
import json
import sqlite3

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = r"c:\Users\benoi\Documents\Predictor Ultimate"
DB_PATH = os.path.join(ROOT_DIR, "predictor_v2.db")

print("=== 1. VERIFY STRASBOURG SQUAD 2026-2027 ===")
with open(os.path.join(ROOT_DIR, "src", "data", "squads", "strasbourg.json"), 'r', encoding='utf-8') as f:
    st_data = json.load(f)
st_2026 = st_data.get('seasons', {}).get('2026-2027', [])
emegha_in_strasbourg = [p for p in st_2026 if 'emegha' in p.get('name', '').lower()]
print(f"Emegha in Strasbourg 2026-2027: {emegha_in_strasbourg} (Expected: None)")

print("\n=== 2. VERIFY CHELSEA SQUAD 2026-2027 ===")
with open(os.path.join(ROOT_DIR, "src", "data", "squads", "chelsea.json"), 'r', encoding='utf-8') as f:
    ch_data = json.load(f)
ch_2026 = ch_data.get('seasons', {}).get('2026-2027', [])
emegha_in_chelsea = [p for p in ch_2026 if 'emegha' in p.get('name', '').lower()]
print(f"Emegha in Chelsea 2026-2027: {emegha_in_chelsea} (Expected: 1 active entry)")

print("\n=== 3. VERIFY SCD2 CONTRACTS IN SQLITE ===")
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()
cursor.execute("""
    SELECT c.contract_sk, c.team_id, t.name, c.is_current, c.valid_from, c.valid_to, c.seasons_covered
    FROM dim_player_contracts_scd2 c
    JOIN dim_teams t ON c.team_id = t.team_id
    WHERE c.player_id LIKE '%emegha%' OR c.contract_sk LIKE '%emegha%';
""")
for r in cursor.fetchall():
    print("  Contract:", r)

print("\n=== 4. CHECK IF ANY MULTI-CLUB DUPLICATE ACTIVE PLAYERS REMAIN IN 2026-2027 ===")
import glob
from collections import defaultdict
squad_files = glob.glob(os.path.join(ROOT_DIR, "src", "data", "squads", "*.json"))
players_2026 = defaultdict(list)
for sf in squad_files:
    with open(sf, 'r', encoding='utf-8') as f:
        data = json.load(f)
    c_name = data.get('club_name') or data.get('slug')
    for p in data.get('seasons', {}).get('2026-2027', []):
        pname = p.get('name')
        if pname:
            players_2026[pname.strip().lower()].append(c_name)

dups = {k: v for k, v in players_2026.items() if len(v) > 1}
print(f"Active 2026-2027 duplicate players across clubs: {len(dups)} (Expected: 0)")
if dups:
    for k, v in list(dups.items())[:10]:
        print("  Dup:", k, "->", v)

conn.close()
