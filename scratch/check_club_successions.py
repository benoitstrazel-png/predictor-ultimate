import os
import glob
import json
import sqlite3

ROOT_DIR = r"c:\Users\benoi\Documents\Predictor Ultimate"
DB_PATH = os.path.join(ROOT_DIR, "predictor_v2.db")

match_files = glob.glob(os.path.join(ROOT_DIR, "data", "raw", "*", "*", "matches", "*.json"))

clubs_to_check = ["Manchester United", "Marseille", "Paris Saint-Germain", "Real Madrid", "Barcelona", "Bayern München", "Juventus", "Milan", "Roma", "Chelsea"]

club_coaches = {c: [] for c in clubs_to_check}

for mf in match_files:
    try:
        with open(mf, 'r', encoding='utf-8') as f:
            data = json.load(f)
        general = data.get('general', {})
        m_date = (general.get('matchTimeUTCDate') or "")[:10]
        if not m_date:
            continue
        lineup = data.get('content', {}).get('lineup', {})
        for side in ['homeTeam', 'awayTeam']:
            t_name = lineup.get(side, {}).get('teamName') or general.get(side, {}).get('name')
            coach = lineup.get(side, {}).get('coach')
            if coach and t_name:
                for c in clubs_to_check:
                    if c.lower() in t_name.lower() or t_name.lower() in c.lower():
                        c_name = coach.get('name')
                        c_id = coach.get('id')
                        club_coaches[c].append((m_date, c_name, c_id, coach.get('countryName'), coach.get('age')))
    except Exception:
        pass

for c, list_matches in club_coaches.items():
    print(f"\n=== {c} ({len(list_matches)} match records) ===")
    list_matches.sort(key=lambda x: x[0])
    # group contiguous dates by coach
    tenures = []
    curr_coach = None
    curr_start = None
    curr_end = None
    curr_count = 0
    c_meta = None
    for d, name, cid, country, age in list_matches:
        if name != curr_coach:
            if curr_coach:
                tenures.append((curr_coach, curr_start, curr_end, curr_count, c_meta))
            curr_coach = name
            curr_start = d
            curr_end = d
            curr_count = 1
            c_meta = (country, age, cid)
        else:
            curr_end = d
            curr_count += 1
    if curr_coach:
        tenures.append((curr_coach, curr_start, curr_end, curr_count, c_meta))
        
    for name, start, end, count, meta in tenures:
        print(f"  -> {name} ({meta[0]}, {meta[1]} ans, ID: {meta[2]}): {count} matchs du {start} au {end}")
