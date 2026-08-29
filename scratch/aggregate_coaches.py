import os
import glob
import json
import sqlite3
from collections import defaultdict
from datetime import datetime

ROOT_DIR = r"c:\Users\benoi\Documents\Predictor Ultimate"
DB_PATH = os.path.join(ROOT_DIR, "predictor_v2.db")

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Get all teams in dim_teams
cursor.execute("SELECT team_id, name, slug, league_id, logo_url FROM dim_teams;")
teams = cursor.fetchall()
print(f"Loaded {len(teams)} teams from dim_teams.")

# Scan all match files
match_files = glob.glob(os.path.join(ROOT_DIR, "data", "raw", "*", "*", "matches", "*.json"))
print(f"Scanning {len(match_files)} match files...")

coach_records = {} # coach_id -> coach info
coach_team_tenures = defaultdict(lambda: {
    'min_date': '9999-99-99',
    'max_date': '0000-00-00',
    'matches': 0,
    'wins': 0,
    'draws': 0,
    'losses': 0,
    'seasons': set(),
    'coach_info': None,
    'team_name': None,
    'league_id': None
})

for mf in match_files:
    try:
        with open(mf, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        general = data.get('general', {})
        match_time = general.get('matchTimeUTCDate')
        if not match_time:
            continue
        m_date = match_time[:10]
        
        # Determine season from date
        dt = datetime.strptime(m_date, "%Y-%m-%d")
        if dt.month >= 7:
            season = f"{dt.year}-{dt.year+1}"
        else:
            season = f"{dt.year-1}-{dt.year}"
            
        home_score = data.get('header', {}).get('teams', [{}])[0].get('score')
        away_score = data.get('header', {}).get('teams', [{}])[1].get('score') if len(data.get('header', {}).get('teams', [])) > 1 else None

        content = data.get('content', {})
        lineup = content.get('lineup', {})
        
        for side, is_home in [('homeTeam', True), ('awayTeam', False)]:
            team_lineup = lineup.get(side, {})
            coach = team_lineup.get('coach')
            team_name = team_lineup.get('teamName') or general.get(side, {}).get('name')
            
            if coach and team_name:
                c_id = str(coach.get('id'))
                c_name = coach.get('name') or f"{coach.get('firstName', '')} {coach.get('lastName', '')}".strip()
                if not c_name or not c_id:
                    continue
                    
                key = (team_name, c_id)
                tenure = coach_team_tenures[key]
                tenure['coach_info'] = coach
                tenure['team_name'] = team_name
                tenure['seasons'].add(season)
                tenure['matches'] += 1
                
                if m_date < tenure['min_date']:
                    tenure['min_date'] = m_date
                if m_date > tenure['max_date']:
                    tenure['max_date'] = m_date
                    
                if home_score is not None and away_score is not None:
                    team_s = home_score if is_home else away_score
                    opp_s = away_score if is_home else home_score
                    if team_s > opp_s:
                        tenure['wins'] += 1
                    elif team_s == opp_s:
                        tenure['draws'] += 1
                    else:
                        tenure['losses'] += 1
                        
                if c_id not in coach_records:
                    coach_records[c_id] = coach
    except Exception as e:
        pass

print(f"Unique coaches: {len(coach_records)}")
print(f"Unique tenures: {len(coach_team_tenures)}")

# Show some tenures
for (tname, cid), info in list(coach_team_tenures.items())[:15]:
    c = info['coach_info']
    print(f"Coach: {c.get('name')} | Team: {tname} | {info['matches']} m ({info['min_date']} -> {info['max_date']}) | W:{info['wins']} D:{info['draws']} L:{info['losses']} | Sez: {info['seasons']}")

conn.close()
