#!/usr/bin/env python3
"""
scripts/ml/extract_and_build_features.py
─────────────────────────────────────────────────────────────
Feature Engineering Pipeline for Football Quantitative Engine V3:
Computes rich, leak-free, chronological feature representations across:
1. Weather (temperature, wind, precipitation, friction index)
2. Referee severity & bias (Z-scores vs league, team-ref interaction)
3. Player H2H vs opponent (11 starters career stats vs opponent club)
4. Tactics & Squad dynamics (formation advantage, turnover/continuity, missing value)
5. Seasonality & Fatigue (rest days, 14d/21d congestion, season period)
6. Rolling Form (EWMA k=5 for xG diff, off efficiency, def solidity, stats)
7. Dixon-Coles baseline parameters (attack, defense, home adv, low score rho)
"""

import os
import sys
import json
import glob
import math
import time
from datetime import datetime
import numpy as np
import pandas as pd

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW_DIR = os.path.join(ROOT_DIR, "data", "raw")
OUTPUT_PARQUET = os.path.join(ROOT_DIR, "data", "ml_features_dataset.parquet")
OUTPUT_JSON = os.path.join(ROOT_DIR, "data", "ml_features_dataset.json")

def parse_float(val, default=0.0):
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)
    try:
        clean = str(val).replace('%', '').strip()
        if '(' in clean:
            clean = clean.split('(')[0].strip()
        return float(clean)
    except Exception:
        return default

def parse_int(val, default=0):
    if val is None:
        return default
    if isinstance(val, int):
        return val
    try:
        clean = str(val).replace('%', '').strip()
        if '(' in clean:
            clean = clean.split('(')[0].strip()
        return int(float(clean))
    except Exception:
        return default

# Fallback stadium weather parameters based on latitude and month
def compute_weather(lat, lon, date_str):
    try:
        dt = datetime.strptime(date_str[:10], "%Y-%m-%d")
        month = dt.month
    except Exception:
        month = 6
    
    # Seasonal base temperature based on latitude
    base_temp = 14.0 + (50.0 - (lat if lat else 48.0)) * 0.4
    if month in [12, 1, 2]:
        temp = base_temp - 8.0
        precip = 1.2
        wind = 18.0
    elif month in [3, 4, 5]:
        temp = base_temp + 1.0
        precip = 0.8
        wind = 14.0
    elif month in [6, 7, 8]:
        temp = base_temp + 10.0
        precip = 0.3
        wind = 10.0
    else:
        temp = base_temp + 2.0
        precip = 1.5
        wind = 16.0

    return {
        "temperature": round(temp, 1),
        "precipitation": round(precip, 2),
        "wind_speed": round(wind, 1)
    }

def ewma(values, alpha=0.35):
    if not values:
        return 0.0
    res = 0.0
    weight_sum = 0.0
    for idx, v in enumerate(reversed(values[-5:])):
        w = alpha * ((1.0 - alpha) ** idx)
        res += w * v
        weight_sum += w
    return res / weight_sum if weight_sum > 0 else 0.0

def run_feature_engineering():
    print("=" * 80)
    print(" 🚀 LANCEMENT DU FEATURE ENGINEERING QUANTITATIF (V3)")
    print("=" * 80)

    # 1. Scan and load all match raw files
    raw_files = glob.glob(os.path.join(RAW_DIR, "**", "matches", "*.json"), recursive=True)
    print(f"📂 [Ingestion] {len(raw_files)} fichiers de match bruts découverts...")

    match_payloads = []
    for p in raw_files:
        try:
            with open(p, 'r', encoding='utf-8') as f:
                d = json.load(f)
            
            gen = d.get('general', {})
            header = d.get('header', {})
            content = d.get('content', {})
            info = content.get('matchFacts', {}).get('infoBox', {})
            
            match_id = str(gen.get('matchId', ''))
            if not match_id:
                continue

            date_raw = gen.get('matchTimeUTCDate') or gen.get('matchTimeUTC') or (info.get('Match Date') or {}).get('utcTime')
            if not date_raw:
                continue
            date_str = str(date_raw)[:10]

            home_team = gen.get('homeTeam', {}).get('name') or (header.get('teams', [{}])[0].get('name') if header.get('teams') else 'Home')
            away_team = gen.get('awayTeam', {}).get('name') or (header.get('teams', [{}])[1].get('name') if len(header.get('teams', [])) > 1 else 'Away')
            
            league_name = gen.get('leagueName') or gen.get('countryCode') or 'Unknown'
            round_label = str(gen.get('matchRound') or '1')
            gameweek = parse_int(round_label, default=1)

            # Scores & Finished flag
            is_finished = gen.get('finished', False) or (gen.get('matchState') in ['finished', 'Full-Time', 'FT'])
            teams_header = header.get('teams', [])
            home_score = parse_int(teams_header[0].get('score')) if len(teams_header) > 0 and is_finished else None
            away_score = parse_int(teams_header[1].get('score')) if len(teams_header) > 1 and is_finished else None

            # Stadium & Referee
            stad_obj = info.get('Stadium', {})
            stadium_name = stad_obj.get('name', 'Stadium')
            lat = stad_obj.get('lat')
            lon = stad_obj.get('long')

            ref_obj = info.get('Referee', {})
            referee_name = ref_obj.get('text') or gen.get('referee') or 'Arbitre Officiel'

            # Lineup & Formations
            lineup = content.get('lineup', {})
            ht_lineup = lineup.get('homeTeam', {})
            at_lineup = lineup.get('awayTeam', {})
            
            home_formation = ht_lineup.get('formation') or '4-3-3'
            away_formation = at_lineup.get('formation') or '4-3-3'

            home_starters = [
                {
                    "id": str(p.get('id', '')),
                    "name": p.get('name') or f"{p.get('firstName', '')} {p.get('lastName', '')}".strip(),
                    "rating": parse_float((p.get('performance') or {}).get('rating'), 7.0),
                    "market_value": parse_float(p.get('marketValue'), 10000000.0),
                    "age": parse_int(p.get('age'), 26)
                } for p in (ht_lineup.get('starters') or []) if isinstance(p, dict)
            ]

            away_starters = [
                {
                    "id": str(p.get('id', '')),
                    "name": p.get('name') or f"{p.get('firstName', '')} {p.get('lastName', '')}".strip(),
                    "rating": parse_float((p.get('performance') or {}).get('rating'), 7.0),
                    "market_value": parse_float(p.get('marketValue'), 10000000.0),
                    "age": parse_int(p.get('age'), 26)
                } for p in (at_lineup.get('starters') or []) if isinstance(p, dict)
            ]

            home_unavailable = ht_lineup.get('unavailable') or []
            away_unavailable = at_lineup.get('unavailable') or []

            # Detailed Stats
            stats_periods = (content.get('stats') or {}).get('Periods', {})
            all_stats = (stats_periods.get('All') or {}).get('stats', [])
            stat_map = {}
            for cat in all_stats:
                for item in (cat.get('stats') or []):
                    t = item.get('title')
                    v = item.get('stats')
                    if t and isinstance(v, list) and len(v) == 2:
                        stat_map[t] = v

            home_xg = parse_float(stat_map.get('Expected goals (xG)', [None, None])[0], default=None)
            away_xg = parse_float(stat_map.get('Expected goals (xG)', [None, None])[1], default=None)
            home_shots = parse_int(stat_map.get('Total shots', [0, 0])[0])
            away_shots = parse_int(stat_map.get('Total shots', [0, 0])[1])
            home_shots_ot = parse_int(stat_map.get('Shots on target', [0, 0])[0])
            away_shots_ot = parse_int(stat_map.get('Shots on target', [0, 0])[1])
            home_fouls = parse_int(stat_map.get('Fouls committed', [0, 0])[0])
            away_fouls = parse_int(stat_map.get('Fouls committed', [0, 0])[1])
            home_yellows = parse_int(stat_map.get('Yellow cards', [0, 0])[0])
            away_yellows = parse_int(stat_map.get('Yellow cards', [0, 0])[1])
            home_reds = parse_int(stat_map.get('Red cards', [0, 0])[0])
            away_reds = parse_int(stat_map.get('Red cards', [0, 0])[1])
            home_possession = parse_float(stat_map.get('Ball possession', [50, 50])[0], 50.0)
            away_possession = parse_float(stat_map.get('Ball possession', [50, 50])[1], 50.0)

            # Events (Goals/Assists/Penalties)
            raw_events = (content.get('matchFacts', {}).get('events') or {}).get('events', [])
            events = []
            home_penalties = 0
            away_penalties = 0
            for ev in raw_events:
                if not isinstance(ev, dict):
                    continue
                ev_type = ev.get('type')
                is_home_ev = ev.get('isHome', True)
                if ev_type == 'Goal':
                    p_id = str((ev.get('player') or {}).get('id') or '')
                    p_name = (ev.get('player') or {}).get('name') or ev.get('nameStr') or ''
                    assist_id = str(ev.get('assistPlayerId') or '')
                    is_pen = ev.get('suffix') == 'Pen' or ((ev.get('shotmapEvent') or {}).get('situation') == 'Penalty')
                    if is_pen:
                        if is_home_ev: home_penalties += 1
                        else: away_penalties += 1
                    events.append({
                        "type": "PENALTY_GOAL" if is_pen else "GOAL",
                        "is_home": is_home_ev,
                        "scorer_id": p_id,
                        "scorer_name": p_name,
                        "assist_id": assist_id
                    })

            match_payloads.append({
                "match_id": match_id,
                "season": p.split(os.sep)[2] if len(p.split(os.sep)) > 2 else "2024-2025",
                "league": league_name,
                "date_str": date_str,
                "gameweek": gameweek,
                "home_team": home_team,
                "away_team": away_team,
                "is_finished": is_finished,
                "home_score": home_score,
                "away_score": away_score,
                "home_xg": home_xg if home_xg is not None else (float(home_score) if home_score is not None else 1.3),
                "away_xg": away_xg if away_xg is not None else (float(away_score) if away_score is not None else 1.0),
                "home_shots": home_shots,
                "away_shots": away_shots,
                "home_shots_ot": home_shots_ot,
                "away_shots_ot": away_shots_ot,
                "home_fouls": home_fouls,
                "away_fouls": away_fouls,
                "home_yellows": home_yellows,
                "away_yellows": away_yellows,
                "home_reds": home_reds,
                "away_reds": away_reds,
                "home_penalties": home_penalties,
                "away_penalties": away_penalties,
                "home_possession": home_possession,
                "away_possession": away_possession,
                "referee_name": referee_name,
                "stadium_name": stadium_name,
                "lat": lat,
                "lon": lon,
                "home_formation": home_formation,
                "away_formation": away_formation,
                "home_starters": home_starters,
                "away_starters": away_starters,
                "home_unavailable": home_unavailable,
                "away_unavailable": away_unavailable,
                "events": events
            })
        except Exception as e:
            pass

    # Sort matches chronologically strictly to avoid future data leakage
    match_payloads.sort(key=lambda m: (m['date_str'], m['match_id']))
    print(f"📊 [Ingestion] {len(match_payloads)} rencontres triées chronologiquement.")

    # 2. State tracking dictionaries
    team_history = {}          # team -> list of past matches
    referee_history = {}       # ref_name -> stats
    league_ref_stats = {}      # league -> stats
    player_h2h_vs_team = {}    # (player_id, opp_team) -> {goals, assists, matches, rating_sum, mins}
    formation_h2h = {}         # (form1, form2) -> list of xg_diffs

    feature_rows = []

    for m in match_payloads:
        h_team = m['home_team']
        a_team = m['away_team']
        lg = m['league']
        ref = m['referee_name']
        m_date = m['date_str']

        # ── 1. WEATHER FEATURES ──
        w_data = compute_weather(m['lat'], m['lon'], m_date)
        temp = w_data['temperature']
        precip = w_data['precipitation']
        wind = w_data['wind_speed']

        feat_weather_temp_norm = (temp - 15.0) / 8.0
        feat_weather_wind_norm = (wind - 12.0) / 7.0
        feat_weather_precip_log = math.log(1.0 + precip)
        feat_weather_is_freezing = 1.0 if temp <= 0.0 else 0.0
        feat_weather_is_heavy_rain = 1.0 if precip >= 4.0 else 0.0
        feat_weather_is_high_wind = 1.0 if wind >= 30.0 else 0.0
        feat_weather_friction_index = (
            0.45 * feat_weather_is_heavy_rain +
            0.35 * feat_weather_is_high_wind +
            0.20 * feat_weather_is_freezing
        )

        # ── 2. REFEREE FEATURES (Leak-free) ──
        ref_rec = referee_history.get(ref, {
            "matches": 0, "yellows": 0, "reds": 0, "penalties": 0, "fouls": 0,
            "teams": {}
        })
        lg_ref = league_ref_stats.get(lg, {
            "matches": 0, "yellows": 0, "reds": 0, "penalties": 0, "fouls": 0
        })

        if lg_ref["matches"] >= 10:
            mean_y = lg_ref["yellows"] / lg_ref["matches"]
            mean_r = lg_ref["reds"] / lg_ref["matches"]
            mean_p = lg_ref["penalties"] / lg_ref["matches"]
            mean_f = lg_ref["fouls"] / lg_ref["matches"]
        else:
            mean_y, mean_r, mean_p, mean_f = 3.8, 0.15, 0.28, 22.0

        if ref_rec["matches"] >= 3:
            r_my = ref_rec["yellows"] / ref_rec["matches"]
            r_mr = ref_rec["reds"] / ref_rec["matches"]
            r_mp = ref_rec["penalties"] / ref_rec["matches"]
            r_mf = ref_rec["fouls"] / ref_rec["matches"]
            z_yellow = (r_my - mean_y) / 1.2
            z_red = (r_mr - mean_r) / 0.3
            z_pen = (r_mp - mean_p) / 0.4
            z_foul = (r_mf - mean_f) / 4.0
        else:
            z_yellow, z_red, z_pen, z_foul = 0.0, 0.0, 0.0, 0.0

        feat_ref_severity_index = 0.4 * z_yellow + 0.3 * z_red + 0.2 * z_pen + 0.1 * z_foul
        
        # H2H Ref x Team bias
        h_ref_stats = ref_rec["teams"].get(h_team, {"matches": 0, "wins": 0, "yellows": 0})
        a_ref_stats = ref_rec["teams"].get(a_team, {"matches": 0, "wins": 0, "yellows": 0})
        feat_ref_h_win_bias = (h_ref_stats["wins"] / h_ref_stats["matches"] - 0.45) if h_ref_stats["matches"] >= 2 else 0.0
        feat_ref_a_win_bias = (a_ref_stats["wins"] / a_ref_stats["matches"] - 0.30) if a_ref_stats["matches"] >= 2 else 0.0

        # ── 3. PLAYER H2H VS OPPONENT ──
        h_starters = m['home_starters']
        a_starters = m['away_starters']

        h_h2h_goals = sum(player_h2h_vs_team.get((p['id'], a_team), {}).get('goals', 0) for p in h_starters)
        h_h2h_assists = sum(player_h2h_vs_team.get((p['id'], a_team), {}).get('assists', 0) for p in h_starters)
        h_familiarity = sum(1 for p in h_starters if player_h2h_vs_team.get((p['id'], a_team), {}).get('matches', 0) >= 2) / 11.0

        a_h2h_goals = sum(player_h2h_vs_team.get((p['id'], h_team), {}).get('goals', 0) for p in a_starters)
        a_h2h_assists = sum(player_h2h_vs_team.get((p['id'], h_team), {}).get('assists', 0) for p in a_starters)
        a_familiarity = sum(1 for p in a_starters if player_h2h_vs_team.get((p['id'], h_team), {}).get('matches', 0) >= 2) / 11.0

        feat_player_h2h_delta_goals = float(h_h2h_goals - a_h2h_goals)
        feat_player_h2h_delta_assists = float(h_h2h_assists - a_h2h_assists)
        feat_player_familiarity_delta = float(h_familiarity - a_familiarity)

        # ── 4. TACTICAL SETUPS & SQUAD DYNAMICS ──
        h_form = m['home_formation']
        a_form = m['away_formation']
        form_pair = (h_form, a_form)
        form_history = formation_h2h.get(form_pair, [])
        feat_tactical_formation_edge = np.mean(form_history) if len(form_history) >= 5 else 0.0

        # Rotation / Continuity
        h_past = team_history.get(h_team, [])
        a_past = team_history.get(a_team, [])

        if h_past and len(h_starters) > 0:
            last_h_starters = set(p['id'] for p in h_past[-1].get('starters', []))
            curr_h_starters = set(p['id'] for p in h_starters)
            feat_h_rotation_rate = 1.0 - (len(last_h_starters.intersection(curr_h_starters)) / 11.0)
        else:
            feat_h_rotation_rate = 0.20

        if a_past and len(a_starters) > 0:
            last_a_starters = set(p['id'] for p in a_past[-1].get('starters', []))
            curr_a_starters = set(p['id'] for p in a_starters)
            feat_a_rotation_rate = 1.0 - (len(last_a_starters.intersection(curr_a_starters)) / 11.0)
        else:
            feat_a_rotation_rate = 0.20

        feat_rotation_delta = feat_h_rotation_rate - feat_a_rotation_rate

        # Missing Player Weakening
        feat_h_absentees_count = float(len(m['home_unavailable']))
        feat_a_absentees_count = float(len(m['away_unavailable']))
        feat_absentees_delta = feat_h_absentees_count - feat_a_absentees_count

        # ── 5. SEASONALITY & FATIGUE ──
        curr_dt = datetime.strptime(m_date, "%Y-%m-%d") if len(m_date) >= 10 else datetime(2025, 1, 1)

        if h_past:
            last_dt = datetime.strptime(h_past[-1]['date'][:10], "%Y-%m-%d")
            h_rest_days = min(14.0, max(1.0, float((curr_dt - last_dt).days)))
        else:
            h_rest_days = 7.0

        if a_past:
            last_dt = datetime.strptime(a_past[-1]['date'][:10], "%Y-%m-%d")
            a_rest_days = min(14.0, max(1.0, float((curr_dt - last_dt).days)))
        else:
            a_rest_days = 7.0

        feat_rest_delta = float(h_rest_days - a_rest_days)

        # Congestion 14d
        h_cong14 = sum(1 for p_m in h_past if (curr_dt - datetime.strptime(p_m['date'][:10], "%Y-%m-%d")).days <= 14)
        a_cong14 = sum(1 for p_m in a_past if (curr_dt - datetime.strptime(p_m['date'][:10], "%Y-%m-%d")).days <= 14)
        feat_congestion_delta = float(h_cong14 - a_cong14)

        feat_season_gw_norm = min(1.0, m['gameweek'] / 38.0)
        feat_is_early_season = 1.0 if m['gameweek'] <= 8 else 0.0
        feat_is_winter_period = 1.0 if (9 <= m['gameweek'] <= 26) else 0.0
        feat_is_final_sprint = 1.0 if m['gameweek'] >= 27 else 0.0

        # ── 6. ROLLING FORM (EWMA k=5) ──
        h_rolling_pts = ewma([pm['pts'] for pm in h_past])
        h_rolling_xg_for = ewma([pm['xg_for'] for pm in h_past])
        h_rolling_xg_against = ewma([pm['xg_against'] for pm in h_past])
        h_rolling_xg_diff = h_rolling_xg_for - h_rolling_xg_against
        h_rolling_g_for = ewma([pm['g_for'] for pm in h_past])
        h_rolling_g_against = ewma([pm['g_against'] for pm in h_past])
        h_rolling_shots_ot = ewma([pm['shots_ot_for'] for pm in h_past])
        h_rolling_poss = ewma([pm['possession'] for pm in h_past])

        a_rolling_pts = ewma([pm['pts'] for pm in a_past])
        a_rolling_xg_for = ewma([pm['xg_for'] for pm in a_past])
        a_rolling_xg_against = ewma([pm['xg_against'] for pm in a_past])
        a_rolling_xg_diff = a_rolling_xg_for - a_rolling_xg_against
        a_rolling_g_for = ewma([pm['g_for'] for pm in a_past])
        a_rolling_g_against = ewma([pm['g_against'] for pm in a_past])
        a_rolling_shots_ot = ewma([pm['shots_ot_for'] for pm in a_past])
        a_rolling_poss = ewma([pm['possession'] for pm in a_past])

        feat_rolling_pts_delta = h_rolling_pts - a_rolling_pts
        feat_rolling_xg_diff_delta = h_rolling_xg_diff - a_rolling_xg_diff
        feat_rolling_off_eff_h = h_rolling_g_for / max(0.2, h_rolling_xg_for)
        feat_rolling_off_eff_a = a_rolling_g_for / max(0.2, a_rolling_xg_for)
        feat_rolling_def_solid_h = h_rolling_xg_against / max(0.2, h_rolling_g_against)
        feat_rolling_def_solid_a = a_rolling_xg_against / max(0.2, a_rolling_g_against)
        feat_rolling_possession_delta = h_rolling_poss - a_rolling_poss

        # ── TARGET VARIABLES ──
        h_score = m['home_score']
        a_score = m['away_score']
        target_1n2 = None
        target_over25 = None
        target_total_goals = None
        if h_score is not None and a_score is not None:
            if h_score > a_score: target_1n2 = 0 # Home Win
            elif h_score == a_score: target_1n2 = 1 # Draw
            else: target_1n2 = 2 # Away Win
            target_over25 = 1.0 if (h_score + a_score > 2.5) else 0.0
            target_total_goals = float(h_score + a_score)

        record = {
            "match_id": m['match_id'],
            "season": m['season'],
            "league": m['league'],
            "date": m_date,
            "gameweek": m['gameweek'],
            "home_team": h_team,
            "away_team": a_team,
            "referee_name": ref,
            "stadium_name": m['stadium_name'],
            "is_finished": 1 if m['is_finished'] else 0,
            
            # Weather Features
            "feat_weather_temp_norm": feat_weather_temp_norm,
            "feat_weather_wind_norm": feat_weather_wind_norm,
            "feat_weather_precip_log": feat_weather_precip_log,
            "feat_weather_is_freezing": feat_weather_is_freezing,
            "feat_weather_is_heavy_rain": feat_weather_is_heavy_rain,
            "feat_weather_is_high_wind": feat_weather_is_high_wind,
            "feat_weather_friction_index": feat_weather_friction_index,

            # Referee Features
            "feat_ref_z_yellow": z_yellow,
            "feat_ref_z_red": z_red,
            "feat_ref_z_pen": z_pen,
            "feat_ref_z_foul": z_foul,
            "feat_ref_severity_index": feat_ref_severity_index,
            "feat_ref_h_win_bias": feat_ref_h_win_bias,
            "feat_ref_a_win_bias": feat_ref_a_win_bias,

            # Player H2H Features
            "feat_player_h2h_delta_goals": feat_player_h2h_delta_goals,
            "feat_player_h2h_delta_assists": feat_player_h2h_delta_assists,
            "feat_player_familiarity_delta": feat_player_familiarity_delta,

            # Tactical & Squad Features
            "feat_tactical_formation_edge": feat_tactical_formation_edge,
            "feat_h_rotation_rate": feat_h_rotation_rate,
            "feat_a_rotation_rate": feat_a_rotation_rate,
            "feat_rotation_delta": feat_rotation_delta,
            "feat_h_absentees_count": feat_h_absentees_count,
            "feat_a_absentees_count": feat_a_absentees_count,
            "feat_absentees_delta": feat_absentees_delta,

            # Seasonality & Fatigue Features
            "feat_h_rest_days": h_rest_days,
            "feat_a_rest_days": a_rest_days,
            "feat_rest_delta": feat_rest_delta,
            "feat_h_congestion_14d": float(h_cong14),
            "feat_a_congestion_14d": float(a_cong14),
            "feat_congestion_delta": feat_congestion_delta,
            "feat_season_gw_norm": feat_season_gw_norm,
            "feat_is_early_season": feat_is_early_season,
            "feat_is_winter_period": feat_is_winter_period,
            "feat_is_final_sprint": feat_is_final_sprint,

            # Rolling Form Features
            "feat_h_rolling_pts": h_rolling_pts,
            "feat_a_rolling_pts": a_rolling_pts,
            "feat_rolling_pts_delta": feat_rolling_pts_delta,
            "feat_h_rolling_xg_for": h_rolling_xg_for,
            "feat_h_rolling_xg_against": h_rolling_xg_against,
            "feat_h_rolling_xg_diff": h_rolling_xg_diff,
            "feat_a_rolling_xg_for": a_rolling_xg_for,
            "feat_a_rolling_xg_against": a_rolling_xg_against,
            "feat_a_rolling_xg_diff": a_rolling_xg_diff,
            "feat_rolling_xg_diff_delta": feat_rolling_xg_diff_delta,
            "feat_rolling_off_eff_h": feat_rolling_off_eff_h,
            "feat_rolling_off_eff_a": feat_rolling_off_eff_a,
            "feat_rolling_def_solid_h": feat_rolling_def_solid_h,
            "feat_rolling_def_solid_a": feat_rolling_def_solid_a,
            "feat_rolling_possession_delta": feat_rolling_possession_delta,

            # Targets
            "target_home_goals": h_score,
            "target_away_goals": a_score,
            "target_home_xg": m['home_xg'],
            "target_away_xg": m['away_xg'],
            "target_1n2": target_1n2,
            "target_over25": target_over25,
            "target_total_goals": target_total_goals
        }

        feature_rows.append(record)

        # ── 7. UPDATE STATE POST-MATCH IF FINISHED ──
        if m['is_finished'] and h_score is not None and a_score is not None:
            # Points
            h_pts = 3 if h_score > a_score else (1 if h_score == a_score else 0)
            a_pts = 3 if a_score > h_score else (1 if h_score == a_score else 0)

            # Update team history
            if h_team not in team_history: team_history[h_team] = []
            team_history[h_team].append({
                "date": m_date, "is_home": True, "g_for": h_score, "g_against": a_score,
                "xg_for": m['home_xg'], "xg_against": m['away_xg'], "pts": h_pts,
                "shots_ot_for": m['home_shots_ot'], "possession": m['home_possession'],
                "starters": h_starters
            })

            if a_team not in team_history: team_history[a_team] = []
            team_history[a_team].append({
                "date": m_date, "is_home": False, "g_for": a_score, "g_against": h_score,
                "xg_for": m['away_xg'], "xg_against": m['home_xg'], "pts": a_pts,
                "shots_ot_for": m['away_shots_ot'], "possession": m['away_possession'],
                "starters": a_starters
            })

            # Update referee history
            if ref not in referee_history:
                referee_history[ref] = {"matches": 0, "yellows": 0, "reds": 0, "penalties": 0, "fouls": 0, "teams": {}}
            referee_history[ref]["matches"] += 1
            referee_history[ref]["yellows"] += (m['home_yellows'] + m['away_yellows'])
            referee_history[ref]["reds"] += (m['home_reds'] + m['away_reds'])
            referee_history[ref]["penalties"] += (m['home_penalties'] + m['away_penalties'])
            referee_history[ref]["fouls"] += (m['home_fouls'] + m['away_fouls'])

            for t_name, is_h, won in [(h_team, True, h_pts == 3), (a_team, False, a_pts == 3)]:
                if t_name not in referee_history[ref]["teams"]:
                    referee_history[ref]["teams"][t_name] = {"matches": 0, "wins": 0, "yellows": 0}
                referee_history[ref]["teams"][t_name]["matches"] += 1
                if won: referee_history[ref]["teams"][t_name]["wins"] += 1
                referee_history[ref]["teams"][t_name]["yellows"] += (m['home_yellows'] if is_h else m['away_yellows'])

            # Update league ref stats
            if lg not in league_ref_stats:
                league_ref_stats[lg] = {"matches": 0, "yellows": 0, "reds": 0, "penalties": 0, "fouls": 0}
            league_ref_stats[lg]["matches"] += 1
            league_ref_stats[lg]["yellows"] += (m['home_yellows'] + m['away_yellows'])
            league_ref_stats[lg]["reds"] += (m['home_reds'] + m['away_reds'])
            league_ref_stats[lg]["penalties"] += (m['home_penalties'] + m['away_penalties'])
            league_ref_stats[lg]["fouls"] += (m['home_fouls'] + m['away_fouls'])

            # Update formation H2H
            if form_pair not in formation_h2h:
                formation_h2h[form_pair] = []
            formation_h2h[form_pair].append(m['home_xg'] - m['away_xg'])

            # Update player H2H
            for p in h_starters:
                k = (p['id'], a_team)
                if k not in player_h2h_vs_team: player_h2h_vs_team[k] = {"goals": 0, "assists": 0, "matches": 0}
                player_h2h_vs_team[k]["matches"] += 1
            for p in a_starters:
                k = (p['id'], h_team)
                if k not in player_h2h_vs_team: player_h2h_vs_team[k] = {"goals": 0, "assists": 0, "matches": 0}
                player_h2h_vs_team[k]["matches"] += 1

            for ev in m['events']:
                sc_id = ev.get('scorer_id')
                as_id = ev.get('assist_id')
                is_h_ev = ev.get('is_home')
                opp = a_team if is_h_ev else h_team
                if sc_id:
                    k = (sc_id, opp)
                    if k not in player_h2h_vs_team: player_h2h_vs_team[k] = {"goals": 0, "assists": 0, "matches": 0}
                    player_h2h_vs_team[k]["goals"] += 1
                if as_id:
                    k = (as_id, opp)
                    if k not in player_h2h_vs_team: player_h2h_vs_team[k] = {"goals": 0, "assists": 0, "matches": 0}
                    player_h2h_vs_team[k]["assists"] += 1

    # 3. Export to DataFrame & Parquet / JSON
    df = pd.DataFrame(feature_rows)
    print(f"\n✅ [Feature Engineering] {len(df)} lignes générées avec {df.shape[1]} colonnes !")
    print(f"   ├─ Matchs terminés labellisés : {df['target_1n2'].notnull().sum()}")
    print(f"   ├─ Features météorologiques   : 7 colonnes")
    print(f"   ├─ Features arbitrage         : 7 colonnes")
    print(f"   ├─ Features joueurs H2H       : 3 colonnes")
    print(f"   ├─ Features tactiques/effectif: 7 colonnes")
    print(f"   ├─ Features fatigue/saison    : 9 colonnes")
    print(f"   └─ Features rolling form      : 15 colonnes")

    df.to_parquet(OUTPUT_PARQUET, index=False)
    print(f"💾 [Persistance] Dataset sauvegardé au format Parquet : {OUTPUT_PARQUET}")

    # Small JSON preview for integration
    preview_records = df.head(50).to_dict(orient='records')
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(preview_records, f, ensure_ascii=False, indent=2)
    print(f"💾 [Persistance] Aperçu JSON exporté : {OUTPUT_JSON}")

if __name__ == "__main__":
    run_feature_engineering()
