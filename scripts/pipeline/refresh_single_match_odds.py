#!/usr/bin/env python3
"""
scripts/pipeline/refresh_single_match_odds.py
─────────────────────────────────────────────────────────────
Rafraîchissement des cotes réelles à la demande pour un match spécifique.
- Zéro bruit artificiel / Zéro mock mathématique.
- Extraction ciblée en direct sur Betclic si le marché est ouvert.
- Si les cotes ne sont pas encore ouvertes : enregistre le statut 'NOT_OPEN' et betclicOdds: null.
- Recalcule instantanément les probabilités ML et Value Bets sur les cotes réelles certifiées.
"""

import os
import sys
import json
import sqlite3
import argparse
import datetime
from typing import Optional, Dict, Any

sys.stdout.reconfigure(encoding='utf-8')

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from scripts.pipeline.validators.odds_quality_gate import validate_odds_record, calculate_margin_metrics
from scripts.pipeline.extractors.betclic_collector import normalize_team_name, extract_live_betclic_odds

DB_PATH = os.path.join(ROOT_DIR, 'predictor_v2.db')
APP_DATA_PATH = os.path.join(ROOT_DIR, 'src', 'data', 'app_data.json')

def refresh_single_match(
    match_id: Optional[str] = None,
    home_team: Optional[str] = None,
    away_team: Optional[str] = None,
    odd_home: Optional[float] = None,
    odd_draw: Optional[float] = None,
    odd_away: Optional[float] = None
) -> Dict[str, Any]:
    print("[ODDS REFRESH] Recherche de cotes reelles Betclic...")
    now_utc = datetime.datetime.utcnow().isoformat() + 'Z'

    if not os.path.exists(APP_DATA_PATH):
        raise FileNotFoundError("app_data.json introuvable.")

    with open(APP_DATA_PATH, 'r', encoding='utf-8') as f:
        app_data = json.load(f)

    target_match = None
    schedule = app_data.get('fullSchedule', [])

    # Recherche du match cible dans app_data
    if match_id:
        for m in schedule:
            if m.get('id') == match_id or match_id in m.get('id', ''):
                target_match = m
                break

    if not target_match and home_team and away_team:
        norm_h = normalize_team_name(home_team)
        norm_a = normalize_team_name(away_team)
        for m in schedule:
            mh = normalize_team_name(m.get('homeTeam', ''))
            ma = normalize_team_name(m.get('awayTeam', ''))
            if (mh == norm_h and ma == norm_a) or (norm_h in mh and norm_a in ma):
                target_match = m
                break

    if not target_match:
        print(f"Match non trouve dans le calendrier (ID={match_id}, H={home_team}, A={away_team}).")
        return {
            'success': False,
            'status': 'NOT_FOUND',
            'message': 'Match introuvable dans le calendrier.'
        }

    h_name = target_match.get('homeTeam')
    a_name = target_match.get('awayTeam')
    norm_h = normalize_team_name(h_name)
    norm_a = normalize_team_name(a_name)
    found_match_id = target_match.get('id')

    # Si les cotes ne sont pas passees en argument, scrape Betclic en direct
    if odd_home is None or odd_away is None:
        print(f"Interrogation en temps reel de Betclic pour {h_name} vs {a_name}...")
        live_matches = extract_live_betclic_odds()
        matched_live = None
        for lm in live_matches:
            lm_h = normalize_team_name(lm['homeTeam'])
            lm_a = normalize_team_name(lm['awayTeam'])
            if (lm_h == norm_h and lm_a == norm_a) or (norm_h in lm_h and norm_a in lm_a):
                matched_live = lm
                break

        if matched_live:
            odd_home = float(matched_live['odds']['home'])
            odd_draw = float(matched_live['odds']['draw'])
            odd_away = float(matched_live['odds']['away'])
            print(f"Cotes ouvertes trouvees sur Betclic : 1:{odd_home} | N:{odd_draw} | 2:{odd_away}")
        else:
            print("Cotes non encore ouvertes par Betclic pour cette rencontre.")
            target_match['betclicOdds'] = None
            target_match['oddsStatus'] = 'NOT_OPEN'
            target_match['valueBets'] = []
            target_match['lastOddsRefresh'] = now_utc

            with open(APP_DATA_PATH, 'w', encoding='utf-8') as f:
                json.dump(app_data, f, ensure_ascii=False, indent=2)

            return {
                'success': True,
                'matchId': found_match_id,
                'homeTeam': h_name,
                'awayTeam': a_name,
                'betclicOdds': None,
                'oddsStatus': 'NOT_OPEN',
                'message': "Cotes non encore ouvertes par Betclic pour cette rencontre."
            }

    # Validation Quality Gate stricte
    validation = validate_odds_record(norm_h, norm_a, odd_home, odd_draw, odd_away)
    if not validation['is_valid']:
        print(f"[QualityGate] Cotes rejetees : {validation['anomalies']}")
        return {
            'success': False,
            'status': 'REJECTED',
            'anomalies': validation['anomalies']
        }

    # Inférence ML avec les cotes réelles
    from scripts.ml.predict_match_v3 import predict_single_match
    pred = predict_single_match(
        home_team=norm_h,
        away_team=norm_a,
        odd_home=odd_home,
        odd_draw=odd_draw,
        odd_away=odd_away
    )

    # Persistance dans SQLite
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    snap_id = f"snap_{found_match_id}_{int(datetime.datetime.utcnow().timestamp())}"
    cursor.execute("""
        INSERT OR REPLACE INTO fact_odds_snapshots 
        (snapshot_id, match_id, competition_id, bookmaker, market_type, odd_home, odd_draw, odd_away, margin_pct, payout_rate_trj, phase, is_closing_line, is_valid, validation_note, captured_at_utc)
        VALUES (?, ?, ?, 'BETCLIC', '1N2', ?, ?, ?, ?, ?, 'PRE_MATCH_STEP', 0, 1, 'ON_DEMAND_REFRESH', ?)
    """, (snap_id, found_match_id, target_match.get('league', 'FRA-L1'), odd_home, odd_draw, odd_away, validation['margin_pct'], validation['payout_rate_trj'], now_utc))

    cursor.execute("""
        INSERT INTO dim_match_closing_odds 
        (match_id, competition_id, home_team_id, away_team_id, home_team_name, away_team_name, closing_odd_1, closing_odd_n, closing_odd_2, closing_margin_pct, closing_timestamp_utc, odds_status, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
        ON CONFLICT(match_id) DO UPDATE SET
            closing_odd_1 = excluded.closing_odd_1,
            closing_odd_n = excluded.closing_odd_n,
            closing_odd_2 = excluded.closing_odd_2,
            closing_margin_pct = excluded.closing_margin_pct,
            closing_timestamp_utc = excluded.closing_timestamp_utc,
            odds_status = 'ACTIVE',
            updated_at = excluded.updated_at
    """, (found_match_id, target_match.get('league', 'FRA-L1'), f"CLUB_{norm_h.upper().replace(' ', '_')}", f"CLUB_{norm_a.upper().replace(' ', '_')}", norm_h, norm_a, odd_home, odd_draw, odd_away, validation['margin_pct'], now_utc, now_utc))

    conn.commit()
    conn.close()

    # Mise a jour app_data.json
    target_match['betclicOdds'] = {
        'home': odd_home,
        'draw': odd_draw,
        'away': odd_away
    }
    target_match['oddsStatus'] = 'ACTIVE'
    target_match['oddsMarginPct'] = validation['margin_pct']
    target_match['oddsTrjPct'] = validation['payout_rate_trj']
    target_match['probabilities'] = {
        'home': pred['probabilities_1n2']['1_home_win'],
        'draw': pred['probabilities_1n2']['N_draw'],
        'away': pred['probabilities_1n2']['2_away_win']
    }
    target_match['expectedGoals'] = pred['expected_goals']
    target_match['valueBets'] = pred['value_bets_detected']
    target_match['lastOddsRefresh'] = now_utc

    with open(APP_DATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(app_data, f, ensure_ascii=False, indent=2)

    print(f"[ODDS REFRESH] {h_name} vs {a_name} actualise avec succes !")
    print(f"Cotes : 1:{odd_home} | N:{odd_draw} | 2:{odd_away} (Marge: {validation['margin_pct']}%)")
    print(f"Value Bets ({len(pred['value_bets_detected'])}) : {pred['value_bets_detected']}")

    return {
        'success': True,
        'matchId': found_match_id,
        'homeTeam': h_name,
        'awayTeam': a_name,
        'betclicOdds': target_match['betclicOdds'],
        'oddsStatus': 'ACTIVE',
        'oddsMarginPct': validation['margin_pct'],
        'oddsTrjPct': validation['payout_rate_trj'],
        'probabilities': target_match['probabilities'],
        'valueBets': target_match['valueBets'],
        'lastOddsRefresh': now_utc
    }

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--match_id', type=str, default=None)
    parser.add_argument('--home', type=str, default=None)
    parser.add_argument('--away', type=str, default=None)
    parser.add_argument('--odd_home', type=float, default=None)
    parser.add_argument('--odd_draw', type=float, default=None)
    parser.add_argument('--odd_away', type=float, default=None)
    args = parser.parse_args()

    res = refresh_single_match(
        match_id=args.match_id,
        home_team=args.home,
        away_team=args.away,
        odd_home=args.odd_home,
        odd_draw=args.odd_draw,
        odd_away=args.odd_away
    )
    print(json.dumps(res, indent=2, ensure_ascii=False))
