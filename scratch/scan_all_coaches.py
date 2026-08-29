import os
import glob
import json
from collections import defaultdict
from datetime import datetime

ROOT_DIR = r"c:\Users\benoi\Documents\Predictor Ultimate"
match_files = glob.glob(os.path.join(ROOT_DIR, "data", "raw", "*", "*", "matches", "*.json"))

print(f"Scanning {len(match_files)} match files for coaches...")

coaches_by_id = {}
team_coach_spans = defaultdict(lambda: {
    'min_date': None,
    'max_date': None,
    'match_count': 0,
    'coach_info': None,
    'team_name': None,
    'seasons': set(),
    'competitions': set()
})

for idx, mf in enumerate(match_files):
    try:
        with open(mf, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        general = data.get('general', {})
        match_date = general.get('matchTimeUTC')
        if not match_date:
            continue
        match_date_str = match_date[:10]
        season = general.get('season') or "2024-2025"
        league = general.get('league') or general.get('leagueName') or "UNKNOWN"

        content = data.get('content', {})
        lineup = content.get('lineup', {})
        
        for side in ['homeTeam', 'awayTeam']:
            team_lineup = lineup.get(side, {})
            coach = team_lineup.get('coach')
            team_info = general.get(side, {})
            team_name = team_lineup.get('teamName') or team_info.get('name')
            
            if coach and team_name:
                c_id = coach.get('id')
                c_name = coach.get('name') or f"{coach.get('firstName', '')} {coach.get('lastName', '')}".strip()
                if not c_name or not c_id:
                    continue
                
                key = (team_name, c_id)
                span = team_coach_spans[key]
                span['coach_info'] = coach
                span['team_name'] = team_name
                span['seasons'].add(season)
                span['competitions'].add(league)
                span['match_count'] += 1
                
                if span['min_date'] is None or match_date_str < span['min_date']:
                    span['min_date'] = match_date_str
                if span['max_date'] is None or match_date_str > span['max_date']:
                    span['max_date'] = match_date_str
                    
                if c_id not in coaches_by_id:
                    coaches_by_id[c_id] = coach
    except Exception as e:
        pass

print(f"Total unique coaches found: {len(coaches_by_id)}")
print(f"Total team-coach tenures found: {len(team_coach_spans)}")

# Let's inspect some tenures
sorted_tenures = sorted(team_coach_spans.items(), key=lambda x: x[1]['match_count'], reverse=True)
print("\nTop 20 tenures by matches coached:")
for (tname, cid), info in sorted_tenures[:20]:
    c_name = info['coach_info'].get('name')
    nat = info['coach_info'].get('countryName')
    age = info['coach_info'].get('age')
    print(f" - {c_name} ({nat}, {age} ans) @ {tname}: {info['match_count']} matchs ({info['min_date']} -> {info['max_date']}), Saisons: {info['seasons']}")
