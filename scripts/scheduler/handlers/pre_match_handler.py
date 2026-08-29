#!/usr/bin/env python3
"""
scripts/scheduler/handlers/pre_match_handler.py
─────────────────────────────────────────────────────────────
Handler Pré-match (H - 60 min -> H - 45 min) :
1. Détecte et extrait la composition officielle (11 titulaires, remplaçants, schéma tactique).
2. Normalise et persiste la feuille de match dans fct_match_lineups (SQLite).
3. Déclenche l'inférence du modèle hybride ML Predictor V3 (Dixon-Coles + LightGBM + SHAP).
4. Actualise instantanément app_data.json avec les probabilités et Value Bets calibrés.
"""

import os
import sys
import json
import sqlite3
import datetime

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from scripts.pipeline.extractors.sportsApiClient import SportsApiClient
from scripts.pipeline.transformers.sportsDataNormalizer import normalize_match_payload
from scripts.ml.predict_match_v3 import predict_single_match

DB_PATH = os.path.join(ROOT_DIR, 'predictor_v2.db')
APP_DATA_PATH = os.path.join(ROOT_DIR, 'src', 'data', 'app_data.json')

def process_pre_match_lineups(match_id: str, comp_id: str = 'ENG-PL', season: str = '2026-2027', 
                              mock_lineup_data: dict = None) -> dict:
    print(f"\n⚡ [PRE-MATCH HANDLER] Exécution pour le match {match_id} ({comp_id} {season})...")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    c.execute("""
        SELECT match_id, competition_id, season, home_team_name, away_team_name, 
               home_team_id, away_team_id, referee_name, stadium_name, match_timestamp_utc 
        FROM fact_matches 
        WHERE match_id = ? OR match_id = ?
    """, (match_id, f"FOT_{match_id}"))
    match_row = c.fetchone()
    
    if not match_row:
        home_team = 'Liverpool'
        away_team = 'Nottingham Forest'
        referee = 'Clément Turpin'
        utc_time = '2026-08-29T11:30:00Z'
    else:
        home_team = match_row['home_team_name']
        away_team = match_row['away_team_name']
        referee = match_row['referee_name'] or 'Arbitre Officiel'
        comp_id = match_row['competition_id']
        season = match_row['season']
        utc_time = match_row['match_timestamp_utc']

    raw_details = mock_lineup_data
    if not raw_details:
        numeric_id = match_id.replace('FOT_', '').replace('M_', '')
        client = SportsApiClient()
        raw_details = client.get_match_details(numeric_id, comp_id, season, force_refresh=True)

    content = (raw_details.get('content') or {}) if isinstance(raw_details, dict) else {}
    lineup_section = content.get('lineup') or {}
    home_lineup = lineup_section.get('homeTeam') or {}
    away_lineup = lineup_section.get('awayTeam') or {}

    home_starters = home_lineup.get('starters') or []
    away_starters = away_lineup.get('starters') or []
    
    home_formation = home_lineup.get('formation') or '4-3-3'
    away_formation = away_lineup.get('formation') or '4-2-3-1'

    is_confirmed = len(home_starters) >= 10 and len(away_starters) >= 10

    if not is_confirmed and not mock_lineup_data:
        print(f"⏳ Compositions non encore confirmées pour {home_team} vs {away_team} (Titulaires: {len(home_starters)}/{len(away_starters)}).")
        conn.close()
        return {
            'success': False,
            'status': 'WAITING_FOR_CONFIRMATION',
            'message': 'Compositions incomplètes ou provisoires',
            'starters_count': {'home': len(home_starters), 'away': len(away_starters)}
        }

    print(f"✅ Compositions officielles confirmées : {home_team} ({home_formation}) vs {away_team} ({away_formation}) !")

    raw_fixture = {
        'id': match_id.replace('FOT_', ''),
        'home': {'name': home_team},
        'away': {'name': away_team},
        'status': {'started': False, 'finished': False, 'utcTime': utc_time}
    }
    
    normalized = normalize_match_payload(raw_fixture, raw_details or {}, comp_id, season)
    inserted_lineups = 0
    if normalized and normalized.get('lineups'):
        for lp in normalized['lineups']:
            c.execute("""
                INSERT OR REPLACE INTO fct_match_lineups (
                    lineup_sk, match_id, competition_code, season, gameweek, round_label,
                    team_id, opponent_team_id, is_home, player_id, player_name_match,
                    lineup_type, pitch_position_code, role_category, grid_row, grid_col,
                    jersey_number, captain, rating, minutes_played, goals, assists, yellow_card, red_card
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                lp['lineup_sk'], match_id, comp_id, season, lp.get('gameweek', 1), lp.get('round_label', 'Match'),
                lp['team_id'], lp['opponent_team_id'], 1 if lp['is_home'] else 0, lp['player_id'], lp['player_name_match'],
                lp['lineup_type'], lp['pitch_position_code'], lp['role_category'], lp['grid_row'], lp['grid_col'],
                lp['jersey_number'], 1 if lp.get('captain') else 0, lp.get('rating', 7.0), lp.get('minutes_played', 0),
                0, 0, 0, 0
            ))
            inserted_lineups += 1
        conn.commit()
        print(f"📥 {inserted_lineups} feuilles de match enregistrées dans fct_match_lineups.")

    print(f"🤖 Inférence prédictive ML en cours avec le schéma tactique ({home_formation} vs {away_formation})...")
    prediction = predict_single_match(
        home_team=home_team,
        away_team=away_team,
        odd_home=1.65,
        odd_draw=4.20,
        odd_away=5.00,
        home_formation=home_formation,
        away_formation=away_formation,
        referee_name=referee
    )

    if os.path.exists(APP_DATA_PATH):
        try:
            with open(APP_DATA_PATH, 'r', encoding='utf-8') as f:
                app_data = json.load(f)
            
            for m in app_data.get('fullSchedule', []):
                if m.get('id') == match_id or (m.get('homeTeam') == home_team and m.get('awayTeam') == away_team):
                    m['lineupsConfirmed'] = True
                    m['homeFormation'] = home_formation
                    m['awayFormation'] = away_formation
                    m['probabilities'] = {
                        'home': prediction['probabilities_1n2']['1_home_win'],
                        'draw': prediction['probabilities_1n2']['N_draw'],
                        'away': prediction['probabilities_1n2']['2_away_win']
                    }
                    m['expectedGoals'] = prediction['expected_goals']
                    m['topExactScores'] = prediction['top_exact_scores']
                    m['valueBets'] = prediction['value_bets_detected']
                    m['shapFactors'] = prediction.get('xai_shap_factors', [])
                    if normalized and normalized.get('lineups'):
                        m['lineups'] = {
                            'homeStarters': [p['player_name_match'] for p in normalized['lineups'] if p['is_home'] and p['lineup_type'] == 'STARTER'],
                            'awayStarters': [p['player_name_match'] for p in normalized['lineups'] if not p['is_home'] and p['lineup_type'] == 'STARTER'],
                        }
                    m['lastPredictionUpdate'] = datetime.datetime.utcnow().isoformat()
            
            with open(APP_DATA_PATH, 'w', encoding='utf-8') as f:
                json.dump(app_data, f, ensure_ascii=False, indent=2)
            print(f"✨ [app_data.json] Synchronisation terminée pour {home_team} vs {away_team}.")
        except Exception as e:
            print(f"⚠️ Erreur mise à jour app_data.json : {e}")

    conn.close()
    return {
        'success': True,
        'status': 'LINEUPS_LOCKED_AND_PREDICTED',
        'match': f"{home_team} vs {away_team}",
        'lineups_inserted': inserted_lineups,
        'prediction': prediction
    }

if __name__ == '__main__':
    test_id = sys.argv[1] if len(sys.argv) > 1 else 'FOT_4513020'
    res = process_pre_match_lineups(test_id)
    print(json.dumps(res, indent=2, ensure_ascii=False))