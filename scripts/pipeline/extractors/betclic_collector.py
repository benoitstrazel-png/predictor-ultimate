#!/usr/bin/env python3
"""
scripts/pipeline/extractors/betclic_collector.py
─────────────────────────────────────────────────────────────
Orchestrateur Principal d'Ingestion des Cotes Réelles Betclic.
- Couverture certifiée des 5 grands championnats et Coupes d'Europe
- Résolution 2026-2027 prioritaire
- Normalisation exhaustive des équipes multi-langues et multi-caractères
"""

import os
import sys
import json
import re
import sqlite3
import subprocess
import datetime
from typing import List, Dict, Any, Optional

sys.stdout.reconfigure(encoding='utf-8')

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from scripts.pipeline.validators.odds_quality_gate import validate_odds_record, calculate_margin_metrics

DB_PATH = os.path.join(ROOT_DIR, 'predictor_v2.db')
APP_DATA_PATH = os.path.join(ROOT_DIR, 'src', 'data', 'app_data.json')

TEAM_CANONICAL_MAP = {
    # Ligue 1
    'psg': 'PSG', 'paris sg': 'PSG', 'paris saint germain': 'PSG',
    'marseille': 'Marseille', 'om': 'Marseille', 'olympique de marseille': 'Marseille',
    'lyon': 'Lyon', 'ol': 'Lyon', 'olympique lyonnais': 'Lyon',
    'monaco': 'Monaco', 'as monaco': 'Monaco',
    'lille': 'Lille', 'losc': 'Lille', 'losc lille': 'Lille',
    'lens': 'Lens', 'rc lens': 'Lens',
    'rennes': 'Rennes', 'stade rennais': 'Rennes',
    'nice': 'Nice', 'ogc nice': 'Nice',
    'strasbourg': 'Strasbourg', 'rc strasbourg': 'Strasbourg',
    'brest': 'Brest', 'stade brestois': 'Brest',
    'toulouse': 'Toulouse', 'toulouse fc': 'Toulouse',
    'auxerre': 'Auxerre', 'aj auxerre': 'Auxerre',
    'angers': 'Angers', 'angers sco': 'Angers',
    'le havre': 'Le Havre', 'hac': 'Le Havre',
    'lorient': 'Lorient', 'fc lorient': 'Lorient',
    'troyes': 'Troyes', 'estac': 'Troyes',
    'paris fc': 'Paris FC', 'pfc': 'Paris FC',
    'le mans': 'Le Mans', 'le mans fc': 'Le Mans',

    # Premier League
    'arsenal': 'Arsenal',
    'manchester city': 'Manchester City', 'man city': 'Manchester City', 'man. city': 'Manchester City',
    'liverpool': 'Liverpool',
    'chelsea': 'Chelsea',
    'manchester united': 'Manchester United', 'man united': 'Manchester United', 'man. united': 'Manchester United',
    'tottenham': 'Tottenham', 'tottenham hotspur': 'Tottenham', 'spurs': 'Tottenham',
    'newcastle': 'Newcastle', 'newcastle united': 'Newcastle',
    'brighton': 'Brighton', 'brighton and hove albion': 'Brighton',
    'wolverhampton': 'Wolverhampton', 'wolves': 'Wolverhampton',
    'west ham': 'West Ham', 'west ham united': 'West Ham',
    'brentford': 'Brentford',
    'everton': 'Everton',
    'bournemouth': 'Bournemouth', 'afc bournemouth': 'Bournemouth',
    'fulham': 'Fulham',
    'crystal palace': 'Crystal Palace',
    'nottingham forest': 'Nottingham Forest', 'nottingham': 'Nottingham Forest', 'nottingham fo': 'Nottingham Forest',
    'leicester': 'Leicester City', 'leicester city': 'Leicester City',
    'ipswich': 'Ipswich', 'ipswich town': 'Ipswich',
    'southampton': 'Southampton',
    'coventry': 'Coventry City', 'coventry city': 'Coventry City',
    'hull': 'Hull City', 'hull city': 'Hull City',
    'leeds': 'Leeds', 'leeds united': 'Leeds',
    'sunderland': 'Sunderland',
    'aston villa': 'Aston Villa',

    # La Liga
    'real madrid': 'Real Madrid',
    'barcelona': 'FC Barcelona', 'fc barcelona': 'FC Barcelona', 'barcelone': 'FC Barcelona',
    'atletico madrid': 'Atlético Madrid', 'atlético madrid': 'Atlético Madrid', 'atletico': 'Atlético Madrid',
    'athletic club': 'Athletic Club', 'athletic bilbao': 'Athletic Club', 'bilbao': 'Athletic Club',
    'real sociedad': 'Real Sociedad',
    'villarreal': 'Villarreal', 'villarreal cf': 'Villarreal',
    'betis': 'Betis', 'real betis': 'Betis',
    'sevilla': 'Sevilla', 'seville': 'Sevilla', 'séville': 'Sevilla', 'sevilla fc': 'Sevilla', 'séville fc': 'Sevilla',
    'girona': 'Girona', 'girone': 'Girona',
    'valencia': 'Valencia', 'valence': 'Valencia',
    'celta vigo': 'Celta Vigo', 'celta': 'Celta Vigo',
    'mallorca': 'Mallorca', 'majorque': 'Mallorca',
    'osasuna': 'Osasuna',
    'getafe': 'Getafe',
    'alaves': 'Alavés', 'alavés': 'Alavés',
    'rayo vallecano': 'Rayo Vallecano',
    'las palmas': 'Las Palmas',
    'espanyol': 'Espanyol', 'rcd espanyol': 'Espanyol',
    'leganes': 'Leganés', 'leganés': 'Leganés',
    'valladolid': 'Real Valladolid',
    'levante': 'Levante',
    'malaga': 'Málaga', 'málaga': 'Málaga',
    'deportivo': 'Deportivo A Coruña', 'deportivo a coruna': 'Deportivo A Coruña', 'deportivo a coruña': 'Deportivo A Coruña', 'deportivo la corogne': 'Deportivo A Coruña',
    'elche': 'Elche',
    'racing santander': 'Racing Santander',

    # Serie A
    'inter': 'Inter Milan', 'inter milan': 'Inter Milan',
    'milan': 'AC Milan', 'ac milan': 'AC Milan',
    'juventus': 'Juventus', 'juve': 'Juventus',
    'napoli': 'Napoli', 'naples': 'Napoli',
    'atalanta': 'Atalanta', 'atalanta bergamo': 'Atalanta',
    'roma': 'AS Roma', 'as roma': 'AS Roma',
    'lazio': 'Lazio', 'lazio rome': 'Lazio',
    'bologna': 'Bologna', 'bologne': 'Bologna',
    'fiorentina': 'Fiorentina',
    'torino': 'Torino',
    'genoa': 'Genoa',
    'monza': 'Monza',
    'como': 'Como',
    'parma': 'Parma', 'parme': 'Parma',
    'udinese': 'Udinese',
    'cagliari': 'Cagliari',
    'empoli': 'Empoli',
    'verona': 'Hellas Verona', 'hellas verona': 'Hellas Verona',
    'lecce': 'Lecce',
    'venezia': 'Venezia', 'venise': 'Venezia',
    'frosinone': 'Frosinone',
    'sassuolo': 'Sassuolo',

    # Bundesliga
    'bayern': 'Bayern Munich', 'bayern munich': 'Bayern Munich', 'bayern munchen': 'Bayern Munich', 'fc bayern münchen': 'Bayern Munich',
    'dortmund': 'Borussia Dortmund', 'bvb': 'Borussia Dortmund', 'borussia dortmund': 'Borussia Dortmund',
    'leverkusen': 'Bayer 04 Leverkusen', 'bayer leverkusen': 'Bayer 04 Leverkusen', 'b. leverkusen': 'Bayer 04 Leverkusen',
    'leipzig': 'RB Leipzig', 'rb leipzig': 'RB Leipzig',
    'stuttgart': 'Stuttgart', 'vfb stuttgart': 'Stuttgart',
    'frankfurt': 'Eintracht Frankfurt', 'francfort': 'Eintracht Frankfurt', 'eintracht francfort': 'Eintracht Frankfurt', 'eintracht frankfurt': 'Eintracht Frankfurt',
    'wolfsburg': 'VfL Wolfsburg',
    'freiburg': 'Freiburg', 'sc freiburg': 'Freiburg', 'fribourg': 'Freiburg',
    'heidenheim': '1. FC Heidenheim',
    'augsburg': 'Augsburg', 'fc augsburg': 'Augsburg', 'augsbourg': 'Augsburg',
    'monchengladbach': "B. Monchengladbach", "borussia m'gladbach": "B. Monchengladbach", "b. m'gladbach": "B. Monchengladbach", "b. monchengladbach": "B. Monchengladbach", "borussia monchengladbach": "B. Monchengladbach",
    'union berlin': 'Union Berlin', '1. fc union berlin': 'Union Berlin',
    'mainz': 'Mainz', 'mainz 05': 'Mainz', 'mayence': 'Mainz',
    'bochum': 'VfL Bochum',
    'st. pauli': 'FC St. Pauli', 'st pauli': 'FC St. Pauli',
    'holstein kiel': 'Holstein Kiel', 'kiel': 'Holstein Kiel',
    'hoffenheim': 'Hoffenheim', 'tsg hoffenheim': 'Hoffenheim',
    'cologne': 'FC Koln', 'koln': 'FC Koln', '1. fc koln': 'FC Koln', '1. fc köln': 'FC Koln', 'fc koln': 'FC Koln',
    'elversberg': 'Elversberg',
    'hamburger sv': 'Hambourg SV', 'hambourg': 'Hambourg SV', 'hambourg sv': 'Hambourg SV', 'hamburger': 'Hambourg SV',
    'paderborn': 'Paderborn',
    'werder bremen': 'Werder Bremen', 'werder': 'Werder Bremen', 'bremen': 'Werder Bremen',
    'schalke 04': 'Schalke 04', 'schalke': 'Schalke 04',
}

def clean_team_str(raw: str) -> str:
    if not raw:
        return ""
    clean = raw.strip().lower()
    clean = re.sub(r'[éèêë]', 'e', clean)
    clean = re.sub(r'[àâä]', 'a', clean)
    clean = re.sub(r'[ôö]', 'o', clean)
    clean = re.sub(r'[îï]', 'i', clean)
    clean = re.sub(r'[ûüù]', 'u', clean)
    clean = re.sub(r'[ç]', 'c', clean)
    clean = re.sub(r'[\'’\-\.\,\(\)]', ' ', clean)
    return re.sub(r'\s+', ' ', clean).strip()

def normalize_team_name(raw_name: str) -> str:
    if not raw_name:
        return ""
    clean = raw_name.strip().lower()
    clean = re.sub(r'[\'’\-\.\,\(\)]', ' ', clean)
    clean = re.sub(r'\s+', ' ', clean).strip()
    
    if clean in TEAM_CANONICAL_MAP:
        return TEAM_CANONICAL_MAP[clean]
    
    clean_no_accent = clean_team_str(raw_name)
    if clean_no_accent in TEAM_CANONICAL_MAP:
        return TEAM_CANONICAL_MAP[clean_no_accent]
        
    return TEAM_CANONICAL_MAP.get(clean, raw_name.strip())

def extract_live_betclic_odds() -> List[Dict[str, Any]]:
    script_path = os.path.join(ROOT_DIR, 'scripts', 'pipeline', 'extractors', 'run_puppeteer_extractor.cjs')
    print(f"[BetclicCollector] Lancement du scraping haute performance multi-ligues...")
    try:
        proc = subprocess.run(['node', script_path], capture_output=True, text=True, timeout=90, check=True)
        raw_output = proc.stdout.strip()
        lines = raw_output.split('\n')
        json_line = None
        for l in reversed(lines):
            if l.startswith('[') and l.endswith(']'):
                json_line = l
                break
        if json_line:
            matches = json.loads(json_line)
            print(f"[BetclicCollector] {len(matches)} rencontres Betclic récupérées avec succès.")
            return matches
        else:
            print(f"[BetclicCollector] Aucun JSON trouvé dans la sortie : {raw_output[:200]}")
            return []
    except Exception as e:
        print(f"[BetclicCollector] Erreur d'exécution de l'extracteur : {e}")
        return []

def ingest_betclic_odds_to_database_and_app_data():
    raw_matches = extract_live_betclic_odds()
    now_utc = datetime.datetime.utcnow().isoformat() + 'Z'
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    valid_odds_count = 0
    quarantine_count = 0
    updated_in_app = 0

    with open(APP_DATA_PATH, 'r', encoding='utf-8') as f:
        app_data = json.load(f)

    schedule = app_data.get('fullSchedule', [])
    
    for rm in raw_matches:
        raw_home = rm['homeTeam']
        raw_away = rm['awayTeam']
        norm_home = normalize_team_name(raw_home)
        norm_away = normalize_team_name(raw_away)
        comp_code = rm['competition']
        odds = rm['odds']

        h_odd = float(odds['home'])
        d_odd = float(odds['draw'])
        a_odd = float(odds['away'])

        validation = validate_odds_record(norm_home, norm_away, h_odd, d_odd, a_odd)

        if not validation['is_valid']:
            quarantine_count += 1
            cursor.execute("""
                INSERT INTO sys_odds_quarantine (raw_match_name, competition_id, raw_odds_payload, rejection_reason)
                VALUES (?, ?, ?, ?)
            """, (f"{raw_home} vs {raw_away}", comp_code, json.dumps(odds), '; '.join(validation['anomalies'])))
            continue

        valid_odds_count += 1
        margin_pct = validation['margin_pct']
        payout_trj = validation['payout_rate_trj']

        # Recherche prioritaire dans fact_matches 2026-2027
        clean_nh = clean_team_str(norm_home)
        clean_na = clean_team_str(norm_away)
        
        cursor.execute("""
            SELECT match_id, competition_id, home_team_id, away_team_id, home_team_name, away_team_name 
            FROM fact_matches 
            WHERE season = '2026-2027'
            ORDER BY match_date ASC
        """)
        all_season_matches = cursor.fetchall()
        
        matched_row = None
        for r in all_season_matches:
            r_mid, r_cid, r_hid, r_aid, r_hname, r_aname = r
            cr_h = clean_team_str(r_hname)
            cr_a = clean_team_str(r_aname)
            
            if (cr_h == clean_nh or clean_nh in cr_h or cr_h in clean_nh) and \
               (cr_a == clean_na or clean_na in cr_a or cr_a in clean_na):
                matched_row = r
                break

        if not matched_row:
            cursor.execute("""
                SELECT match_id, competition_id, home_team_id, away_team_id, home_team_name, away_team_name 
                FROM fact_matches 
                WHERE season != '2026-2027'
                ORDER BY season DESC, match_date DESC
            """)
            for r in cursor.fetchall():
                r_mid, r_cid, r_hid, r_aid, r_hname, r_aname = r
                cr_h = clean_team_str(r_hname)
                cr_a = clean_team_str(r_aname)
                if (cr_h == clean_nh or clean_nh in cr_h or cr_h in clean_nh) and \
                   (cr_a == clean_na or clean_na in cr_a or cr_a in clean_na):
                    matched_row = r
                    break

        match_id = matched_row[0] if matched_row else f"betclic_{clean_nh[:3].upper()}_{clean_na[:3].upper()}_{datetime.date.today().strftime('%Y%m%d')}"
        comp_id = matched_row[1] if matched_row else comp_code
        h_id = matched_row[2] if matched_row else f"CLUB_{norm_home.upper().replace(' ', '_')}"
        a_id = matched_row[3] if matched_row else f"CLUB_{norm_away.upper().replace(' ', '_')}"
        db_home_name = matched_row[4] if matched_row else norm_home
        db_away_name = matched_row[5] if matched_row else norm_away

        snap_id = f"snap_{match_id}_{int(datetime.datetime.utcnow().timestamp())}"
        cursor.execute("""
            INSERT OR REPLACE INTO fact_odds_snapshots 
            (snapshot_id, match_id, competition_id, bookmaker, market_type, odd_home, odd_draw, odd_away, margin_pct, payout_rate_trj, phase, is_closing_line, is_valid, validation_note, captured_at_utc)
            VALUES (?, ?, ?, 'BETCLIC', '1N2', ?, ?, ?, ?, ?, 'PRE_MATCH_STEP', 0, 1, 'QUALITY_GATE_CERTIFIED', ?)
        """, (snap_id, match_id, comp_id, h_odd, d_odd, a_odd, margin_pct, payout_trj, now_utc))

        cursor.execute("""
            INSERT INTO dim_match_closing_odds 
            (match_id, competition_id, home_team_id, away_team_id, home_team_name, away_team_name, opening_odd_1, opening_odd_n, opening_odd_2, opening_timestamp_utc, closing_odd_1, closing_odd_n, closing_odd_2, closing_margin_pct, closing_timestamp_utc, odds_status, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
            ON CONFLICT(match_id) DO UPDATE SET
                closing_odd_1 = excluded.closing_odd_1,
                closing_odd_n = excluded.closing_odd_n,
                closing_odd_2 = excluded.closing_odd_2,
                closing_margin_pct = excluded.closing_margin_pct,
                closing_timestamp_utc = excluded.closing_timestamp_utc,
                odds_status = 'ACTIVE',
                updated_at = excluded.updated_at
        """, (match_id, comp_id, h_id, a_id, db_home_name, db_away_name, h_odd, d_odd, a_odd, now_utc, h_odd, d_odd, a_odd, margin_pct, now_utc, now_utc))

        for m in schedule:
            if m.get('id') == match_id:
                m['betclicOdds'] = { 'home': h_odd, 'draw': d_odd, 'away': a_odd }
                m['oddsStatus'] = 'ACTIVE'
                m['oddsMarginPct'] = margin_pct
                m['oddsTrjPct'] = payout_trj
                m['lastOddsRefresh'] = now_utc
                updated_in_app += 1
                break
            else:
                m_h_clean = clean_team_str(m.get('homeTeam', ''))
                m_a_clean = clean_team_str(m.get('awayTeam', ''))
                if (m_h_clean == clean_nh or clean_nh in m_h_clean or m_h_clean in clean_nh) and \
                   (m_a_clean == clean_na or clean_na in m_a_clean or m_a_clean in clean_na):
                    m['betclicOdds'] = { 'home': h_odd, 'draw': d_odd, 'away': a_odd }
                    m['oddsStatus'] = 'ACTIVE'
                    m['oddsMarginPct'] = margin_pct
                    m['oddsTrjPct'] = payout_trj
                    m['lastOddsRefresh'] = now_utc
                    updated_in_app += 1
                    break

    conn.commit()
    conn.close()

    with open(APP_DATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(app_data, f, ensure_ascii=False, indent=2)

    print(f"\n=======================================================")
    print(f" [INGESTION REPORT] Synchronisation Cotes Betclic Réelles")
    print(f"   - Cotes certifiées et insérées en base : {valid_odds_count}")
    print(f"   - Cotes rejetées / mises en quarantaine : {quarantine_count}")
    print(f"   - Matchs mis à jour dans app_data.json   : {updated_in_app}")
    print(f"=======================================================\n")

if __name__ == '__main__':
    ingest_betclic_odds_to_database_and_app_data()
