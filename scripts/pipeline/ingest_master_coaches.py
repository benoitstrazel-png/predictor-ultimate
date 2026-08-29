#!/usr/bin/env python3
"""
scripts/pipeline/ingest_master_coaches.py
─────────────────────────────────────────────────────────────
Ingère et normalise l'ensemble des entraîneurs / managers et de leurs mandats
SCD Type 2 dans `dim_coaches` et `dim_coach_contracts_scd2` à partir des archives
de matchs et du référentiel des clubs.
"""

import os
import sys
import glob
import json
import re
import unicodedata
import sqlite3
from collections import defaultdict
from datetime import datetime

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(ROOT_DIR, "predictor_v2.db")

def normalize_text(text):
    if not text or not isinstance(text, str):
        return ""
    text = unicodedata.normalize('NFD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    text = re.sub(r'[^a-zA-Z0-9\s]', ' ', text)
    return ' '.join(text.lower().split())

def slugify(text):
    norm = normalize_text(text)
    return re.sub(r'[\s_]+', '_', norm)

# Dictionnaire des drapeaux et codes pays
COUNTRY_FLAGS = {
    'France': ('🇫🇷', 'FRA'), 'FRA': ('🇫🇷', 'FRA'),
    'Spain': ('🇪🇸', 'ESP'), 'Espagne': ('🇪🇸', 'ESP'), 'ESP': ('🇪🇸', 'ESP'),
    'Italy': ('🇮🇹', 'ITA'), 'Italie': ('🇮🇹', 'ITA'), 'ITA': ('🇮🇹', 'ITA'),
    'Germany': ('🇩🇪', 'GER'), 'Allemagne': ('🇩🇪', 'GER'), 'GER': ('🇩🇪', 'GER'),
    'Portugal': ('🇵🇹', 'POR'), 'POR': ('🇵🇹', 'POR'),
    'Netherlands': ('🇳🇱', 'NED'), 'Pays-Bas': ('🇳🇱', 'NED'), 'NED': ('🇳🇱', 'NED'),
    'England': ('🇬🇧', 'ENG'), 'Angleterre': ('🇬🇧', 'ENG'), 'ENG': ('🇬🇧', 'ENG'),
    'Belgium': ('🇧🇪', 'BEL'), 'Belgique': ('🇧🇪', 'BEL'), 'BEL': ('🇧🇪', 'BEL'),
    'Argentina': ('🇦🇷', 'ARG'), 'Argentine': ('🇦🇷', 'ARG'), 'ARG': ('🇦🇷', 'ARG'),
    'Brazil': ('🇧🇷', 'BRA'), 'Brésil': ('🇧🇷', 'BRA'), 'BRA': ('🇧🇷', 'BRA'),
    'Chile': ('🇨🇱', 'CHI'), 'Chili': ('🇨🇱', 'CHI'), 'CHI': ('🇨🇱', 'CHI'),
    'Uruguay': ('🇺🇾', 'URU'), 'URU': ('🇺🇾', 'URU'),
    'Croatia': ('🇭🇷', 'CRO'), 'Croatie': ('🇭🇷', 'CRO'), 'CRO': ('🇭🇷', 'CRO'),
    'Austria': ('🇦🇹', 'AUT'), 'Autriche': ('🇦🇹', 'AUT'), 'AUT': ('🇦🇹', 'AUT'),
    'Switzerland': ('🇨🇭', 'SUI'), 'Suisse': ('🇨🇭', 'SUI'), 'SUI': ('🇨🇭', 'SUI'),
    'Denmark': ('🇩🇰', 'DEN'), 'Danemark': ('🇩🇰', 'DEN'), 'DEN': ('🇩🇰', 'DEN'),
    'Scotland': ('🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'SCO'), 'Écosse': ('🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'SCO'), 'SCO': ('🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'SCO'),
    'Northern Ireland': ('🇬🇧', 'NIR'), 'Irlande du Nord': ('🇬🇧', 'NIR'), 'NIR': ('🇬🇧', 'NIR'),
    'Senegal': ('🇸🇳', 'SEN'), 'Sénégal': ('🇸🇳', 'SEN'), 'SEN': ('🇸🇳', 'SEN'),
    'Norway': ('🇳🇴', 'NOR'), 'Norvège': ('🇳🇴', 'NOR'), 'NOR': ('🇳🇴', 'NOR'),
    'Sweden': ('🇸🇪', 'SWE'), 'Suède': ('🇸🇪', 'SWE'), 'SWE': ('🇸🇪', 'SWE'),
    'Serbia': ('🇷🇸', 'SRB'), 'Serbie': ('🇷🇸', 'SRB'), 'SRB': ('🇷🇸', 'SRB'),
    'Colombia': ('🇨🇴', 'COL'), 'Colombie': ('🇨🇴', 'COL'), 'COL': ('🇨🇴', 'COL'),
    'Greece': ('🇬🇷', 'GRE'), 'Grèce': ('🇬🇷', 'GRE'), 'GRE': ('🇬🇷', 'GRE'),
    'Czech Republic': ('🇨🇿', 'CZE'), 'Tchéquie': ('🇨🇿', 'CZE'), 'CZE': ('🇨🇿', 'CZE'),
    'Poland': ('🇵🇱', 'POL'), 'Pologne': ('🇵🇱', 'POL'), 'POL': ('🇵🇱', 'POL'),
    'Turkey': ('🇹🇷', 'TUR'), 'Turquie': ('🇹🇷', 'TUR'), 'TUR': ('🇹🇷', 'TUR'),
    'Algeria': ('🇩🇿', 'ALG'), 'Algérie': ('🇩🇿', 'ALG'), 'ALG': ('🇩🇿', 'ALG'),
    'Morocco': ('🇲🇦', 'MAR'), 'Maroc': ('🇲🇦', 'MAR'), 'MAR': ('🇲🇦', 'MAR'),
    'USA': ('🇺🇸', 'USA'), 'United States': ('🇺🇸', 'USA'), 'États-Unis': ('🇺🇸', 'USA')
}

# Formations tactiques types courantes par entraîneur
PREFERRED_FORMATIONS = {
    'Pep Guardiola': '4-3-3',
    'Mikel Arteta': '4-3-3',
    'Luis Enrique': '4-3-3',
    'Carlo Ancelotti': '4-3-1-2',
    'Hansi Flick': '4-2-3-1',
    'Arne Slot': '4-2-3-1',
    'Vincent Kompany': '4-2-3-1',
    'Thiago Motta': '4-2-3-1',
    'Antonio Conte': '3-4-2-1',
    'Simone Inzaghi': '3-5-2',
    'Gian Piero Gasperini': '3-4-1-2',
    'Roberto De Zerbi': '4-2-3-1',
    'Unai Emery': '4-4-2',
    'Xabi Alonso': '3-4-2-1',
    'Ruben Amorim': '3-4-2-1',
    'Massimiliano Allegri': '3-5-2',
    'Jose Mourinho': '4-2-3-1',
    'Bruno Genesio': '4-3-3',
    'Habib Beye': '4-3-3',
    'Michael Carrick': '4-2-3-1',
    'Erik ten Hag': '4-2-3-1',
    'Diego Simeone': '5-3-2'
}

print("=" * 75)
print(" 🚀 INGESTION & CONSOLIDATION DES ENTRAÎNEURS (dim_coaches & SCD2)")
print("=" * 75)

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# 1. Preload Dim Teams
cursor.execute("SELECT team_id, name, slug, league_id, logo_url FROM dim_teams;")
teams_db = {}
for tid, name, slug, league, logo in cursor.fetchall():
    t_obj = {'team_id': tid, 'name': name, 'slug': slug, 'league': league, 'logo': logo}
    teams_db[normalize_text(name)] = t_obj
    teams_db[normalize_text(slug)] = t_obj

def resolve_team(t_name):
    norm = normalize_text(t_name)
    if norm in teams_db:
        return teams_db[norm]
    for k, val in teams_db.items():
        if norm in k or k in norm:
            return val
    # Fallback
    slug = slugify(t_name)
    tid = f"CLUB_{slug.upper()}"
    return {'team_id': tid, 'name': t_name, 'slug': slug, 'league': 'EUROPE', 'logo': f"https://media.api-sports.io/football/teams/{abs(hash(t_name)) % 10000}.png"}

# 2. Scan match files and extract all coach appearances chronologically
match_files = glob.glob(os.path.join(ROOT_DIR, "data", "raw", "*", "*", "matches", "*.json"))
print(f"📄 [Ingest:Coaches] Analyse de {len(match_files)} fichiers de matchs...")

team_matches_map = defaultdict(list)
coaches_catalog = {}

for mf in match_files:
    try:
        with open(mf, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        general = data.get('general', {})
        match_time = general.get('matchTimeUTCDate')
        if not match_time:
            continue
        m_date = match_time[:10]
        
        home_score = data.get('header', {}).get('teams', [{}])[0].get('score')
        away_score = data.get('header', {}).get('teams', [{}])[1].get('score') if len(data.get('header', {}).get('teams', [])) > 1 else None

        lineup = data.get('content', {}).get('lineup', {})
        for side, is_home in [('homeTeam', True), ('awayTeam', False)]:
            team_lineup = lineup.get(side, {})
            coach = team_lineup.get('coach')
            t_name = team_lineup.get('teamName') or general.get(side, {}).get('name')
            
            if coach and t_name:
                c_id = str(coach.get('id'))
                c_name = coach.get('name') or f"{coach.get('firstName', '')} {coach.get('lastName', '')}".strip()
                if not c_name or not c_id:
                    continue
                
                # Register coach in catalog
                if c_id not in coaches_catalog:
                    coaches_catalog[c_id] = {
                        'id': c_id,
                        'name': c_name,
                        'country': coach.get('countryName') or coach.get('countryCode') or 'France',
                        'country_code': coach.get('countryCode') or 'FRA',
                        'age': coach.get('age') or 50,
                        'photo': f"https://images.fotmob.com/image_resources/playerimages/{c_id}.png"
                    }
                
                # Result
                result = 'D'
                if home_score is not None and away_score is not None:
                    team_s = home_score if is_home else away_score
                    opp_s = away_score if is_home else home_score
                    if team_s > opp_s:
                        result = 'W'
                    elif team_s < opp_s:
                        result = 'L'
                
                team_info = resolve_team(t_name)
                team_matches_map[team_info['team_id']].append({
                    'date': m_date,
                    'coach_id': c_id,
                    'coach_name': c_name,
                    'team_info': team_info,
                    'result': result
                })
    except Exception:
        pass

print(f"📊 [Ingest:Coaches] {len(coaches_catalog)} entraîneurs identifiés sur {len(team_matches_map)} équipes.")

# 3. Clean tables
cursor.execute("DELETE FROM dim_coach_contracts_scd2;")
cursor.execute("DELETE FROM dim_coaches;")

# 4. Insert dim_coaches
inserted_coaches = 0
for cid, c in coaches_catalog.items():
    coach_sk = f"cch_{slugify(c['name'])}_{cid}"
    flag, nat_code = COUNTRY_FLAGS.get(c['country'], COUNTRY_FLAGS.get(c['country_code'], ('🌍', c['country_code'])))
    
    # Short name
    parts = c['name'].split()
    short_name = f"{parts[0][0]}. {' '.join(parts[1:])}" if len(parts) > 1 else c['name']
    
    # Formation
    formation = PREFERRED_FORMATIONS.get(c['name'], '4-3-3')
    
    cursor.execute("""
        INSERT OR REPLACE INTO dim_coaches (
            coach_id, fotmob_id, api_sports_id, full_name, display_name,
            short_name, age, nationality, nationality_code, nationality_flag,
            photo_url, preferred_formation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        coach_sk, int(cid) if cid.isdigit() else None, None, c['name'], c['name'],
        short_name, c['age'], c['country'], nat_code, flag,
        c['photo'], formation
    ))
    coaches_catalog[cid]['coach_sk'] = coach_sk
    inserted_coaches += 1

# 5. Build SCD Type 2 Coach Contracts per Team
inserted_contracts = 0

for tid, matches in team_matches_map.items():
    matches.sort(key=lambda x: x['date'])
    if not matches:
        continue
    
    # Group contiguous blocks of same coach (or absorb 1-match interim assistants if needed)
    tenures = []
    curr_cid = None
    curr_start = None
    curr_end = None
    curr_matches = []
    t_info = matches[0]['team_info']
    
    for m in matches:
        cid = m['coach_id']
        if cid != curr_cid:
            if curr_cid is not None:
                tenures.append({
                    'coach_id': curr_cid,
                    'start_date': curr_start,
                    'end_date': curr_end,
                    'matches': list(curr_matches),
                    'team_info': t_info
                })
            curr_cid = cid
            curr_start = m['date']
            curr_end = m['date']
            curr_matches = [m]
        else:
            curr_end = m['date']
            curr_matches.append(m)
            
    if curr_cid is not None:
        tenures.append({
            'coach_id': curr_cid,
            'start_date': curr_start,
            'end_date': curr_end,
            'matches': list(curr_matches),
            'team_info': t_info
        })
    
    # Consolidate tenures: merge back-to-back blocks of same coach if separated by <= 2 interim games
    consolidated = []
    i = 0
    while i < len(tenures):
        t = tenures[i]
        # check if next tenure is 1 match and next-next is same coach
        if i + 2 < len(tenures) and tenures[i+1]['matches'].__len__() <= 2 and tenures[i+2]['coach_id'] == t['coach_id']:
            merged_matches = t['matches'] + tenures[i+1]['matches'] + tenures[i+2]['matches']
            t['end_date'] = tenures[i+2]['end_date']
            t['matches'] = merged_matches
            consolidated.append(t)
            i += 3
        else:
            consolidated.append(t)
            i += 1
            
    # Now create SCD2 records for each tenure
    for idx, tenure in enumerate(consolidated):
        cid = tenure['coach_id']
        c_meta = coaches_catalog.get(cid, {})
        coach_sk = c_meta.get('coach_sk', f"cch_{cid}")
        c_name = c_meta.get('name', 'Entraîneur')
        
        start_d = tenure['start_date']
        end_d = tenure['end_date']
        m_list = tenure['matches']
        m_count = len(m_list)
        
        wins = sum(1 for m in m_list if m['result'] == 'W')
        draws = sum(1 for m in m_list if m['result'] == 'D')
        losses = sum(1 for m in m_list if m['result'] == 'L')
        win_rate = round((wins / m_count) * 100, 1) if m_count > 0 else 0.0
        ppm = round(((3 * wins + draws) / m_count), 2) if m_count > 0 else 0.0
        
        # Determine seasons covered
        seasons_set = set()
        for m in m_list:
            dt = datetime.strptime(m['date'], "%Y-%m-%d")
            s = f"{dt.year}-{dt.year+1}" if dt.month >= 7 else f"{dt.year-1}-{dt.year}"
            seasons_set.add(s)
        seasons_covered_json = json.dumps(sorted(list(seasons_set)))
        
        is_last = (idx == len(consolidated) - 1)
        # If it's the last tenure and max_date is in 2026 -> Active current coach
        if is_last and end_d >= "2026-01-01":
            is_current = 1
            status = 'ACTIVE'
            valid_to = None
            notes = f"Entraîneur en poste ({seasons_covered_json})"
        else:
            is_current = 0
            status = 'DEPARTED'
            valid_to = end_d
            notes = f"Fin de mandat le {end_d} ({m_count} matchs)"
            
        role_title = "Entraîneur Intérimaire" if m_count <= 2 else "Entraîneur Principal"
        contract_sk = f"csk_{slugify(c_name)}_{slugify(t_info['name'])}_{start_d.replace('-', '_')}"
        
        cursor.execute("""
            INSERT OR REPLACE INTO dim_coach_contracts_scd2 (
                contract_sk, coach_id, team_id, team_name, team_logo,
                league_id, valid_from, valid_to, is_current, role_title,
                contract_status, seasons_covered, matches_count, wins,
                draws, losses, win_rate_pct, points_per_match, appointment_notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            contract_sk, coach_sk, t_info['team_id'], t_info['name'], t_info['logo'],
            t_info['league'], start_d, valid_to, is_current, role_title,
            status, seasons_covered_json, m_count, wins,
            draws, losses, win_rate, ppm, notes
        ))
        inserted_contracts += 1

conn.commit()

cursor.execute("SELECT COUNT(*) FROM dim_coaches;")
tot_cch = cursor.fetchone()[0]

cursor.execute("SELECT COUNT(*) FROM dim_coach_contracts_scd2 WHERE is_current = 1;")
tot_curr = cursor.fetchone()[0]

cursor.execute("SELECT COUNT(*) FROM dim_coach_contracts_scd2;")
tot_cntr = cursor.fetchone()[0]

print("=" * 75)
print(f"🎉 SUCCÈS : Normalisation des Entraîneurs terminée avec succès !")
print(f"   ├─ Entraîneurs Maîtres (dim_coaches) : {tot_cch} profils")
print(f"   ├─ Mandats SCD2 (dim_coach_contracts_scd2) : {tot_cntr} contrats historiques")
print(f"   └─ Entraîneurs Actuels en Poste (is_current = 1) : {tot_curr} clubs")
print("=" * 75)

conn.close()
