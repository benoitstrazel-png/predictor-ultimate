import os
import sys
import glob
import json
import sqlite3
from collections import defaultdict

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = r"c:\Users\benoi\Documents\Predictor Ultimate"
squad_files = glob.glob(os.path.join(ROOT_DIR, "src", "data", "squads", "*.json"))

print(f"Loaded {len(squad_files)} squad files.")

players_2026 = defaultdict(list)
players_2025 = defaultdict(list)
players_2024 = defaultdict(list)

for sf in squad_files:
    try:
        with open(sf, 'r', encoding='utf-8') as f:
            data = json.load(f)
        c_name = data.get('club_name') or data.get('slug')
        seasons = data.get('seasons', {})
        for p in seasons.get('2026-2027', []):
            pname = p.get('name')
            status = p.get('status')
            if pname:
                players_2026[pname.strip().lower()].append((c_name, status, p))
        for p in seasons.get('2025-2026', []):
            pname = p.get('name')
            status = p.get('status')
            if pname:
                players_2025[pname.strip().lower()].append((c_name, status, p))
        for p in seasons.get('2024-2025', []):
            pname = p.get('name')
            status = p.get('status')
            if pname:
                players_2024[pname.strip().lower()].append((c_name, status, p))
    except Exception as e:
        print(f"Error reading {sf}: {e}")

duplicates_2026 = {k: v for k, v in players_2026.items() if len([x for x in v if x[1] == 'ACTIVE' or not x[1]]) > 1}
print(f"\nDuplicates active in multiple clubs in 2026-2027: {len(duplicates_2026)}")
for k, v in list(duplicates_2026.items())[:30]:
    clubs_str = ", ".join([f"{x[0]} ({x[1]})" for x in v])
    print(f" - {k.title()}: {clubs_str}")

# Check key known transfers from fct_player_transfers against 2026-2027 squads
conn = sqlite3.connect(os.path.join(ROOT_DIR, "predictor_v2.db"))
cursor = conn.cursor()
cursor.execute("SELECT player_name, from_team_name, to_team_name, season, transfer_date FROM fct_player_transfers;")
transfers_list = cursor.fetchall()
conn.close()

print(f"\n--- Checking {len(transfers_list)} known transfers in squads files for 2026-2027 ---")
for pname, from_t, to_t, s, t_date in transfers_list:
    key = pname.strip().lower()
    in_2026 = players_2026.get(key, [])
    clubs_2026 = [x[0] for x in in_2026]
    print(f"Player: {pname} ({from_t} -> {to_t} in {s}) | Clubs in 2026-2027 squads: {clubs_2026}")

