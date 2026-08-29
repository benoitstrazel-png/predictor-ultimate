import os
import glob
import json
import sqlite3

ROOT_DIR = r"c:\Users\benoi\Documents\Predictor Ultimate"
DB_PATH = os.path.join(ROOT_DIR, "predictor_v2.db")

print("--- SQLITE TABLES ---")
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
print([r[0] for r in cursor.fetchall()])

print("\n--- SQUADS JSON SAMPLE ---")
squad_files = glob.glob(os.path.join(ROOT_DIR, "src", "data", "squads", "*.json"))
print(f"Total squad files: {len(squad_files)}")
coaches_in_squads = []
for sf in squad_files[:10]:
    with open(sf, 'r', encoding='utf-8') as f:
        data = json.load(f)
        if 'coach' in data or 'manager' in data or 'entraineur' in data:
            print(f"Found coach in squad {sf}: {data.get('coach') or data.get('manager')}")
        # check keys
        # print(list(data.keys())[:5])

print("\n--- RAW MATCH FILES SAMPLE COACH DATA ---")
match_files = glob.glob(os.path.join(ROOT_DIR, "data", "raw", "*", "*", "matches", "*.json"))
print(f"Total match files: {len(match_files)}")
coaches_found = {}
for mf in match_files[:30]:
    try:
        with open(mf, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # check content.lineup or similar
            content = data.get('content', {})
            lineup = content.get('lineup', {})
            # check homeTeam/awayTeam coach
            for side in ['homeTeam', 'awayTeam']:
                team_data = lineup.get(side, {})
                coach = team_data.get('coach')
                if coach:
                    c_id = coach.get('id')
                    c_name = coach.get('name') or coach.get('usualName') or f"{coach.get('firstName', '')} {coach.get('lastName', '')}"
                    team_name = team_data.get('teamName') or data.get('general', {}).get('homeTeam' if side=='homeTeam' else 'awayTeam', {}).get('name')
                    if c_name and team_name:
                        coaches_found[f"{team_name} - {c_name}"] = coach
    except Exception as e:
        pass

print(f"Sample coaches found from raw matches ({len(coaches_found)}):")
for k in list(coaches_found.keys())[:15]:
    print(" ", k, "->", coaches_found[k])

conn.close()
