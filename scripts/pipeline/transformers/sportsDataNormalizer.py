#!/usr/bin/env python3
"""
scripts/pipeline/transformers/sportsDataNormalizer.py
─────────────────────────────────────────────────────────────
Module de normalisation et de transformation des données sportives brutes
vers le modèle dimensionnel et relationnel de Predictor Ultimate.
Intègre une résolution d'entité stricte, partitionnée par championnat.
"""

import os
import sys
import json
import re

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
TEAMS_MASTER_FILE = os.path.join(ROOT_DIR, "src", "data", "teams_master.json")

# Chargement du dictionnaire des noms canoniques
from scripts.build_comprehensive_teams_master import CANONICAL_DISPLAY_NAMES

TEAMS_BY_LEAGUE = {}
GLOBAL_TEAM_LOOKUP = {}

def init_team_lookup():
    global TEAMS_BY_LEAGUE, GLOBAL_TEAM_LOOKUP
    TEAMS_BY_LEAGUE = {}
    GLOBAL_TEAM_LOOKUP = {}
    if os.path.exists(TEAMS_MASTER_FILE):
        try:
            with open(TEAMS_MASTER_FILE, 'r', encoding='utf-8') as f:
                tm_data = json.load(f)
                for t in tm_data.get('teams', []):
                    lg = t.get('league_id', '')
                    tid = t.get('team_id')
                    sname = t.get('short_name') or t.get('canonical_name')
                    cname = t.get('canonical_name')
                    
                    if lg not in TEAMS_BY_LEAGUE:
                        TEAMS_BY_LEAGUE[lg] = {}
                        
                    # Clés d'accès
                    for alias in t.get('aliases', []) + [sname, cname]:
                        if alias:
                            alias_clean = alias.strip().lower()
                            TEAMS_BY_LEAGUE[lg][alias_clean] = (tid, sname)
                            GLOBAL_TEAM_LOOKUP[alias_clean] = (tid, sname)
        except Exception as e:
            print(f"⚠️ [Normalizer] Avertissement chargement teams_master.json : {e}")

init_team_lookup()

def resolve_team_identity(raw_name: str, comp_code: str = '') -> tuple[str, str]:
    """
    Résout le nom canonique et l'ID de l'équipe de façon stricte et étanche par compétition.
    Retourne (team_id, display_name).
    """
    if not raw_name:
        return ("TEAM_UNKNOWN", "Inconnu")
    
    clean = str(raw_name).strip()
    clean_lower = clean.lower()
    
    # 1. Standardisation directe via CANONICAL_DISPLAY_NAMES
    canonical_override = CANONICAL_DISPLAY_NAMES.get(clean) or CANONICAL_DISPLAY_NAMES.get(raw_name)
    display = canonical_override if canonical_override else clean

    # 2. Recherche exacte dans le championnat concerné
    league_dict = TEAMS_BY_LEAGUE.get(comp_code, {})
    if clean_lower in league_dict:
        tid, _ = league_dict[clean_lower]
        return (tid, display)
        
    if display.lower() in league_dict:
        tid, _ = league_dict[display.lower()]
        return (tid, display)

    # 3. Recherche exacte globale
    if clean_lower in GLOBAL_TEAM_LOOKUP:
        tid, _ = GLOBAL_TEAM_LOOKUP[clean_lower]
        return (tid, display)
        
    if display.lower() in GLOBAL_TEAM_LOOKUP:
        tid, _ = GLOBAL_TEAM_LOOKUP[display.lower()]
        return (tid, display)

    # 4. Génération déterministe propre (sans jamais voler l'ID d'une autre équipe)
    slug = re.sub(r'[^a-zA-Z0-9]', '_', display).upper()
    prefix = comp_code.split('-')[0] if '-' in comp_code else 'CLUB'
    generated_id = f"{prefix}_{slug[:12]}"
    return (generated_id, display)

def parse_float_safe(val, default=0.0) -> float:
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

def parse_int_safe(val, default=0) -> int:
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

def normalize_match_payload(raw_fixture: dict, raw_details: dict, comp_code: str, season: str) -> dict:
    """
    Transforme un fixture brut + son payload de détails en un dictionnaire complet
    contenant match, événements, statistiques d'équipe et feuilles de match.
    """
    if not raw_fixture:
        return None

    raw_id = raw_fixture.get('id')
    if not raw_id and raw_details:
        raw_id = (raw_details.get('general') or {}).get('matchId')
    match_sk = f"FOT_{raw_id}"
    
    # 1. Méta-données de base (Accès sécurisé)
    general = (raw_details.get('general') or {}) if isinstance(raw_details, dict) else {}
    header = (raw_details.get('header') or {}) if isinstance(raw_details, dict) else {}
    content = (raw_details.get('content') or {}) if isinstance(raw_details, dict) else {}
    match_facts = (content.get('matchFacts') or {}) if isinstance(content, dict) else {}
    info_box = (match_facts.get('infoBox') or {}) if isinstance(match_facts, dict) else {}
    
    raw_home_name = ''
    raw_away_name = ''
    
    if isinstance(raw_fixture.get('home'), dict):
        raw_home_name = raw_fixture.get('home', {}).get('name') or ''
    elif isinstance(raw_fixture.get('home'), str):
        raw_home_name = raw_fixture.get('home')
        
    if isinstance(raw_fixture.get('away'), dict):
        raw_away_name = raw_fixture.get('away', {}).get('name') or ''
    elif isinstance(raw_fixture.get('away'), str):
        raw_away_name = raw_fixture.get('away')
        
    header_teams = header.get('teams') or []
    if not raw_home_name and len(header_teams) > 0 and isinstance(header_teams[0], dict):
        raw_home_name = header_teams[0].get('name', '')
    if not raw_away_name and len(header_teams) > 1 and isinstance(header_teams[1], dict):
        raw_away_name = header_teams[1].get('name', '')
        
    home_tid, home_name = resolve_team_identity(raw_home_name, comp_code)
    away_tid, away_name = resolve_team_identity(raw_away_name, comp_code)
    
    # Status & Date
    status_dict = raw_fixture.get('status') or {}
    is_finished = status_dict.get('finished', False) or general.get('matchState') in ['finished', 'Full-Time', 'FT']
    is_cancelled = status_dict.get('cancelled', False)
    
    if is_finished:
        status_str = 'FINISHED'
    elif is_cancelled:
        status_str = 'CANCELLED'
    elif status_dict.get('started', False):
        status_str = 'IN_PLAY'
    else:
        status_str = 'SCHEDULED'
        
    utc_time = status_dict.get('utcTime') or general.get('matchTimeUTC') or '2025-01-01T20:00:00Z'
    match_date = utc_time.split('T')[0] if 'T' in utc_time else utc_time[:10]
    
    # Round
    tournament_info = info_box.get('Tournament') or {}
    round_label = str(raw_fixture.get('round') or tournament_info.get('roundName') or 'Match')
    gameweek = parse_int_safe(re.sub(r'[^\d]', '', round_label), default=1)
    
    # Scores
    score_str = status_dict.get('scoreStr') or ''
    home_score = None
    away_score = None
    if '-' in score_str:
        parts = score_str.split('-')
        home_score = parse_int_safe(parts[0].strip(), default=0)
        away_score = parse_int_safe(parts[1].strip(), default=0)
    elif len(header_teams) >= 2:
        home_score = parse_int_safe(header_teams[0].get('score'))
        away_score = parse_int_safe(header_teams[1].get('score'))
        
    # Arbitre & Stade
    referee_obj = info_box.get('Referee') or {}
    referee_name = referee_obj.get('text') or general.get('referee') or 'Arbitre Officiel'
    stadium_obj = info_box.get('Stadium') or {}
    stadium_name = stadium_obj.get('name') or (general.get('stadium') or {}).get('name') or f"Stade de {home_name}"
    
    # 2. Statistiques Collectives & xG
    stats_periods = ((content.get('stats') or {}).get('Periods') or {}) if isinstance(content, dict) else {}
    all_stats_cats = (stats_periods.get('All') or {}).get('stats', [])
    
    stat_map = {}
    for cat in all_stats_cats:
        items = cat.get('stats', []) if isinstance(cat, dict) and isinstance(cat.get('stats'), list) else ([cat] if isinstance(cat, dict) else [])
        for item in items:
            if isinstance(item, dict):
                title = item.get('title')
                vals = item.get('stats')
                if title and isinstance(vals, list) and len(vals) == 2:
                    if title not in stat_map or stat_map[title][0] is None:
                        stat_map[title] = vals

    home_xg = parse_float_safe(stat_map.get('Expected goals (xG)', [None, None])[0], default=None)
    away_xg = parse_float_safe(stat_map.get('Expected goals (xG)', [None, None])[1], default=None)
    
    # Objet fact_matches
    match_record = {
        'match_id': match_sk,
        'competition_id': comp_code,
        'season': season,
        'round_label': round_label,
        'gameweek': gameweek,
        'match_timestamp_utc': utc_time,
        'match_date': match_date,
        'status': status_str,
        'home_team_id': home_tid,
        'away_team_id': away_tid,
        'home_team_name': home_name,
        'away_team_name': away_name,
        'home_score': home_score,
        'away_score': away_score,
        'home_ht_score': None,
        'away_ht_score': None,
        'home_xg': home_xg,
        'away_xg': away_xg,
        'referee_name': referee_name,
        'stadium_name': stadium_name
    }
    
    # 3. Statistiques Domicile / Extérieur
    team_stats_records = []
    if stat_map:
        # Home Stats
        team_stats_records.append({
            'stat_id': f"{match_sk}_HOME",
            'match_id': match_sk,
            'team_id': home_tid,
            'team_name': home_name,
            'is_home': True,
            'possession_pct': parse_float_safe(stat_map.get('Ball possession', [50, 50])[0], 50.0),
            'expected_goals': home_xg,
            'shots_total': parse_int_safe(stat_map.get('Total shots', [0, 0])[0]),
            'shots_on_target': parse_int_safe(stat_map.get('Shots on target', [0, 0])[0]),
            'shots_off_target': parse_int_safe(stat_map.get('Shots off target', [0, 0])[0]),
            'shots_blocked': parse_int_safe(stat_map.get('Blocked shots', [0, 0])[0]),
            'big_chances_total': parse_int_safe(stat_map.get('Big chances', [0, 0])[0]),
            'big_chances_missed': parse_int_safe(stat_map.get('Big chances missed', [0, 0])[0]),
            'corner_kicks': parse_int_safe(stat_map.get('Corners', [0, 0])[0]),
            'fouls_committed': parse_int_safe(stat_map.get('Fouls committed', [0, 0])[0]),
            'offside_count': parse_int_safe(stat_map.get('Offsides', [0, 0])[0]),
            'yellow_cards': parse_int_safe(stat_map.get('Yellow cards', [0, 0])[0]),
            'red_cards': parse_int_safe(stat_map.get('Red cards', [0, 0])[0]),
            'accurate_passes': parse_int_safe(stat_map.get('Accurate passes', [0, 0])[0]),
            'total_passes': parse_int_safe(stat_map.get('Passes', [0, 0])[0]),
            'pass_accuracy_pct': parse_float_safe(str(stat_map.get('Accurate passes', ['0', '0'])[0]).split('(')[-1].replace(')', '').replace('%', '') if '(' in str(stat_map.get('Accurate passes', ['0', '0'])[0]) else 0.0)
        })
        # Away Stats
        team_stats_records.append({
            'stat_id': f"{match_sk}_AWAY",
            'match_id': match_sk,
            'team_id': away_tid,
            'team_name': away_name,
            'is_home': False,
            'possession_pct': parse_float_safe(stat_map.get('Ball possession', [50, 50])[1], 50.0),
            'expected_goals': away_xg,
            'shots_total': parse_int_safe(stat_map.get('Total shots', [0, 0])[1]),
            'shots_on_target': parse_int_safe(stat_map.get('Shots on target', [0, 0])[1]),
            'shots_off_target': parse_int_safe(stat_map.get('Shots off target', [0, 0])[1]),
            'shots_blocked': parse_int_safe(stat_map.get('Blocked shots', [0, 0])[1]),
            'big_chances_total': parse_int_safe(stat_map.get('Big chances', [0, 0])[1]),
            'big_chances_missed': parse_int_safe(stat_map.get('Big chances missed', [0, 0])[1]),
            'corner_kicks': parse_int_safe(stat_map.get('Corners', [0, 0])[1]),
            'fouls_committed': parse_int_safe(stat_map.get('Fouls committed', [0, 0])[1]),
            'offside_count': parse_int_safe(stat_map.get('Offsides', [0, 0])[1]),
            'yellow_cards': parse_int_safe(stat_map.get('Yellow cards', [0, 0])[1]),
            'red_cards': parse_int_safe(stat_map.get('Red cards', [0, 0])[1]),
            'accurate_passes': parse_int_safe(stat_map.get('Accurate passes', [0, 0])[1]),
            'total_passes': parse_int_safe(stat_map.get('Passes', [0, 0])[1]),
            'pass_accuracy_pct': parse_float_safe(str(stat_map.get('Accurate passes', ['0', '0'])[1]).split('(')[-1].replace(')', '').replace('%', '') if '(' in str(stat_map.get('Accurate passes', ['0', '0'])[1]) else 0.0)
        })

    # 4. Événements Minute par Minute (Buts, Cartons, Substitutions)
    raw_events = (match_facts.get('events') or {}).get('events', [])
    events_records = []
    
    for idx, ev in enumerate(raw_events):
        if not isinstance(ev, dict):
            continue
        ev_type = ev.get('type')
        min_val = parse_int_safe(ev.get('time'), default=0)
        added_val = parse_int_safe(ev.get('overloadTime'), default=0)
        is_home_ev = ev.get('isHome', True)
        ev_team_id = home_tid if is_home_ev else away_tid
        ev_team_name = home_name if is_home_ev else away_name
        
        if ev_type == 'Goal':
            p_name = (ev.get('player') or {}).get('name') or ev.get('nameStr') or 'Buteur'
            assist_name = ev.get('assistInput') or ev.get('assistStr')
            if assist_name and 'assist by' in str(assist_name).lower():
                assist_name = str(assist_name).replace('assist by', '').strip()
                
            is_pen = ev.get('suffix') == 'Pen' or ((ev.get('shotmapEvent') or {}).get('situation') == 'Penalty')
            is_og = ev.get('ownGoal', False) or ev.get('suffix') == 'OG'
            
            note = "Penalty" if is_pen else ("Contre son camp (CSC)" if is_og else (f"Assist: {assist_name}" if assist_name else "Tir cadré"))
            event_code = 'PENALTY_GOAL' if is_pen else ('OWN_GOAL' if is_og else 'GOAL')
            
            events_records.append({
                'event_id': f"{match_sk}_EV_{idx + 1}",
                'match_id': match_sk,
                'minute': min_val,
                'added_time': added_val,
                'team_id': ev_team_id,
                'team_name': ev_team_name,
                'event_type': event_code,
                'primary_player_id': str((ev.get('player') or {}).get('id') or ''),
                'primary_player_name': p_name,
                'secondary_player_id': str(ev.get('assistPlayerId') or ''),
                'secondary_player_name': assist_name,
                'detail_note': note
            })
        elif ev_type == 'Card':
            p_name = (ev.get('player') or {}).get('name') or ev.get('nameStr') or 'Joueur'
            card_color = ev.get('card', 'Yellow')
            card_code = 'RED_CARD' if 'red' in str(card_color).lower() else 'YELLOW_CARD'
            
            events_records.append({
                'event_id': f"{match_sk}_EV_{idx + 1}",
                'match_id': match_sk,
                'minute': min_val,
                'added_time': added_val,
                'team_id': ev_team_id,
                'team_name': ev_team_name,
                'event_type': card_code,
                'primary_player_id': str((ev.get('player') or {}).get('id') or ''),
                'primary_player_name': p_name,
                'secondary_player_id': None,
                'secondary_player_name': None,
                'detail_note': f"Carton {card_color}"
            })
        elif ev_type == 'Substitution':
            swaps = ev.get('swap') or []
            if len(swaps) >= 2 and isinstance(swaps[0], dict) and isinstance(swaps[1], dict):
                p_in = swaps[0].get('name')
                p_out = swaps[1].get('name')
                events_records.append({
                    'event_id': f"{match_sk}_EV_{idx + 1}",
                    'match_id': match_sk,
                    'minute': min_val,
                    'added_time': added_val,
                    'team_id': ev_team_id,
                    'team_name': ev_team_name,
                    'event_type': 'SUBSTITUTION',
                    'primary_player_id': str(swaps[0].get('id') or ''),
                    'primary_player_name': p_in or 'Remplaçant',
                    'secondary_player_id': str(swaps[1].get('id') or ''),
                    'secondary_player_name': p_out or 'Sortant',
                    'detail_note': f"Entrée: {p_in} / Sortie: {p_out}"
                })

    # 5. Feuilles de Match & Compositions (Lineups)
    lineup_content = (content.get('lineup') or {}) if isinstance(content, dict) else {}
    lineups_records = []
    
    for is_h, team_data, t_id, opp_id in [
        (True, lineup_content.get('homeTeam') or {}, home_tid, away_tid),
        (False, lineup_content.get('awayTeam') or {}, away_tid, home_tid)
    ]:
        starters = team_data.get('starters') or []
        subs = team_data.get('subs') or []
        
        # Starters
        for p in starters:
            if not isinstance(p, dict):
                continue
            perf = p.get('performance') or {}
            pos_id = p.get('positionId', 0)
            role_cat = 'G' if pos_id == 11 else ('D' if pos_id in [1, 2, 3, 4] else ('M' if pos_id in [5, 6, 7, 8] else 'A'))
            p_name = p.get('name') or f"{p.get('firstName', '')} {p.get('lastName', '')}".strip()
            
            lineups_records.append({
                'lineup_sk': f"{match_sk}_{t_id}_{p.get('id')}",
                'match_id': match_sk,
                'competition_code': comp_code,
                'season': season,
                'gameweek': gameweek,
                'round_label': round_label,
                'team_id': t_id,
                'opponent_team_id': opp_id,
                'is_home': is_h,
                'player_id': str(p.get('id') or ''),
                'player_name_match': p_name,
                'lineup_type': 'STARTER',
                'pitch_position_code': p.get('usualPlayingPositionId') or 'POS',
                'role_category': role_cat,
                'grid_row': 1,
                'grid_col': 1,
                'jersey_number': parse_int_safe(p.get('shirtNumber')),
                'captain': bool(p.get('isCaptain', False)),
                'rating': parse_float_safe(perf.get('rating'), default=None),
                'minutes_played': 90,
                'goals': 0,
                'assists': 0,
                'yellow_card': False,
                'red_card': False,
                'sub_in_minute': None,
                'sub_out_minute': None
            })
            
        # Substitutes
        for p in subs:
            if not isinstance(p, dict):
                continue
            perf = p.get('performance') or {}
            p_name = p.get('name') or f"{p.get('firstName', '')} {p.get('lastName', '')}".strip()
            sub_events = perf.get('substitutionEvents') or []
            has_played = len(sub_events) > 0
            sub_in_min = sub_events[0].get('time') if (has_played and isinstance(sub_events[0], dict)) else None
            
            lineups_records.append({
                'lineup_sk': f"{match_sk}_{t_id}_{p.get('id')}",
                'match_id': match_sk,
                'competition_code': comp_code,
                'season': season,
                'gameweek': gameweek,
                'round_label': round_label,
                'team_id': t_id,
                'opponent_team_id': opp_id,
                'is_home': is_h,
                'player_id': str(p.get('id') or ''),
                'player_name_match': p_name,
                'lineup_type': 'SUBSTITUTE',
                'pitch_position_code': 'SUB',
                'role_category': 'M',
                'grid_row': 0,
                'grid_col': 0,
                'jersey_number': parse_int_safe(p.get('shirtNumber')),
                'captain': False,
                'rating': parse_float_safe(perf.get('rating'), default=None),
                'minutes_played': max(0, 90 - sub_in_min) if sub_in_min else 0,
                'goals': 0,
                'assists': 0,
                'yellow_card': False,
                'red_card': False,
                'sub_in_minute': sub_in_min,
                'sub_out_minute': None
            })

    return {
        'match': match_record,
        'team_stats': team_stats_records,
        'events': events_records,
        'lineups': lineups_records
    }
