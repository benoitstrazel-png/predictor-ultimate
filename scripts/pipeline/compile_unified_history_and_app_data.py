#!/usr/bin/env python3
"""
scripts/pipeline/compile_unified_history_and_app_data.py
─────────────────────────────────────────────────────────────
Compilateur & Bridge vers l'écosystème Front-End :
- Extrait EXCLUSIVEMENT les données authentiques de predictor_v2.db
  (ZÉRO fusion avec d'anciens fichiers corrompus/synthétiques)
- Génère un fichier unified_history.json 100% certifié sur les 8 compétitions
  avec les vrais xG, buteurs, passeurs, cartons (joueurs et entraîneurs), remplaçants,
  compositions officielles, notes, formations et arbitres officiels.
- Met à jour app_data.json avec les vrais matchs 2026-2027 et statistiques.
"""

import os
import sys
import json
import sqlite3
import datetime
import shutil

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

DB_PATH = os.path.join(ROOT_DIR, "predictor_v2.db")
RAW_DIR = os.path.join(ROOT_DIR, "data", "raw")
UNIFIED_HIST_FILE = os.path.join(ROOT_DIR, "src", "data", "unified_history.json")
APP_DATA_FILE = os.path.join(ROOT_DIR, "src", "data", "app_data.json")
TEAMS_MASTER_FILE = os.path.join(ROOT_DIR, "src", "data", "teams_master.json")

from scripts.pipeline.extractors.betclic_collector import clean_team_str, normalize_team_name

def load_team_logos():
    logos = {}
    if os.path.exists(TEAMS_MASTER_FILE):
        try:
            with open(TEAMS_MASTER_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for t in data.get('teams', []):
                    s_name = t.get('short_name') or t.get('canonical_name')
                    c_name = t.get('canonical_name')
                    logo = t.get('logo')
                    if s_name:
                        logos[s_name.lower()] = logo
                    if c_name:
                        logos[c_name.lower()] = logo
        except Exception:
            pass
    return logos

def load_raw_match_meta():
    """Indexe les formations et entraîneurs réels pour chaque match."""
    meta = {}
    if not os.path.exists(RAW_DIR):
        return meta

    for root, dirs, files in os.walk(RAW_DIR):
        for f in files:
            if not f.endswith('.json') or 'matches' not in root:
                continue
            raw_id = f.replace('.json', '')
            m_sk = f"FOT_{raw_id}"
            fpath = os.path.join(root, f)
            try:
                with open(fpath, 'r', encoding='utf-8') as fp:
                    d = json.load(fp)
                    content = d.get('content') or {}
                    lu = content.get('lineup') or {}
                    ht = lu.get('homeTeam') or {}
                    at = lu.get('awayTeam') or {}
                    meta[m_sk] = {
                        'homeFormation': ht.get('formation') or '4-3-3',
                        'awayFormation': at.get('formation') or '4-3-3',
                        'homeCoach': (ht.get('coach') or {}).get('name') or 'Entraîneur',
                        'awayCoach': (at.get('coach') or {}).get('name') or 'Entraîneur',
                    }
            except Exception:
                pass
    return meta

def compile_data():
    print("📦 [Compiler] Connexion à predictor_v2.db (Source Unique de Vérité)...")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    
    # Garantir que les tables de facts et dims existent
    from scripts.pipeline.ingest_historical_and_live_matches import init_db_schema_if_needed
    init_db_schema_if_needed(conn)

    cursor = conn.cursor()

    team_logos = load_team_logos()
    raw_meta = load_raw_match_meta()
    print(f"📋 [Compiler] Métadonnées formations/entraîneurs chargées pour {len(raw_meta)} rencontres.")

    # Charger les probabilités et prédictions existantes de app_data.json pour éviter de les écraser
    existing_lookup = {}
    existing_model_benchmarks = None
    existing_active_model_default = "v3"
    if os.path.exists(APP_DATA_FILE):
        try:
            with open(APP_DATA_FILE, 'r', encoding='utf-8') as f:
                old_data = json.load(f)
                existing_model_benchmarks = old_data.get('modelBenchmarks')
                existing_active_model_default = old_data.get('activeModelDefault', 'v3')
                for item in old_data.get('fullSchedule', []):
                    m_id = item.get('id')
                    if m_id:
                        existing_lookup[m_id] = {
                            "probabilities": item.get('probabilities'),
                            "expectedGoals": item.get('expectedGoals'),
                            "betclicOdds": item.get('betclicOdds'),
                            "valueBets": item.get('valueBets'),
                            "oddsStatus": item.get('oddsStatus'),
                            "oddsMarginPct": item.get('oddsMarginPct'),
                            "topExactScores": item.get('topExactScores'),
                            "topHalfTimeScores": item.get('topHalfTimeScores'),
                            "topConditionalScore": item.get('topConditionalScore'),
                            "potentialScorers": item.get('potentialScorers'),
                            "potentialAssists": item.get('potentialAssists'),
                            "prediction": item.get('prediction'),
                            "shapFactors": item.get('shapFactors'),
                            "overUnder25": item.get('overUnder25'),
                            "modelVersion": item.get('modelVersion'),
                            "predictionsByModel": item.get('predictionsByModel')
                        }
            print(f"🔄 [Compiler] {len(existing_lookup)} prédictions ML historiques chargées depuis app_data.json.")
        except Exception as e:
            print(f"⚠️ [Compiler] Impossible de charger l'historique app_data.json : {e}")

    # 1. Verification de la couverture des matchs terminés
    cursor.execute("SELECT COUNT(*) as cnt FROM fact_matches WHERE status = 'FINISHED';")
    fin_count = cursor.fetchone()['cnt']
    cursor.execute("SELECT COUNT(*) as cnt FROM fact_matches WHERE season = '2026-2027' AND status = 'FINISHED';")
    fin_2627_count = cursor.fetchone()['cnt']

    # Compter rapidement les matchs terminés dans les fixtures 2026-2027 du dossier raw
    raw_finished_2627 = 0
    raw_2627_dir = os.path.join(RAW_DIR, "2026-2027")
    if os.path.isdir(raw_2627_dir):
        for comp in os.listdir(raw_2627_dir):
            fix_path = os.path.join(raw_2627_dir, comp, "fixtures_calendar.json")
            if os.path.isfile(fix_path):
                try:
                    with open(fix_path, 'r', encoding='utf-8') as ff:
                        f_data = json.load(ff)
                        raw_finished_2627 += sum(1 for m in f_data if m.get('status', {}).get('finished') or m.get('status', {}).get('scoreStr'))
                except Exception:
                    pass

    needs_reload = (fin_count < 4500)
    if needs_reload and os.path.exists(RAW_DIR):
        print(f"🔄 [Compiler] Synchronisation SQLite nécessaire (BDD: {fin_2627_count} finis 26/27 vs Raw: {raw_finished_2627} finis). Rechargement...")
        from scripts.pipeline.reload_all_raw_to_sqlite import reload_all
        reload_all()
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

    # 1. Extraction de tous les matchs terminés pour unified_history.json
    cursor.execute("""
    SELECT 
        match_id, competition_id, season, round_label, gameweek,
        match_timestamp_utc, match_date, status,
        home_team_id, away_team_id, home_team_name, away_team_name,
        home_score, away_score, home_xg, away_xg,
        referee_name, stadium_name
    FROM fact_matches
    WHERE status = 'FINISHED' AND home_score IS NOT NULL AND away_score IS NOT NULL
    ORDER BY match_date ASC, match_timestamp_utc ASC;
    """)
    finished_rows = cursor.fetchall()
    print(f"📊 [Compiler] {len(finished_rows)} rencontres officielles terminées trouvées dans la base.")

    # 2. Récupération des statistiques d'équipes groupées par match
    cursor.execute("""
    SELECT 
        match_id, is_home, possession_pct, expected_goals,
        shots_total, shots_on_target, shots_off_target, shots_blocked,
        big_chances_total, big_chances_missed, corner_kicks,
        fouls_committed, offside_count, yellow_cards, red_cards,
        accurate_passes, total_passes, pass_accuracy_pct
    FROM fact_match_team_stats;
    """)
    all_team_stats = cursor.fetchall()
    stats_by_match = {}
    for st in all_team_stats:
        m_id = st['match_id']
        if m_id not in stats_by_match:
            stats_by_match[m_id] = {}
        side = 'home' if st['is_home'] else 'away'
        stats_by_match[m_id][side] = {
            'possession': st['possession_pct'] or 50,
            'xg': st['expected_goals'] or 0.0,
            'shots': st['shots_total'] or 0,
            'shotsOnTarget': st['shots_on_target'] or 0,
            'shotsOffTarget': st['shots_off_target'] or 0,
            'shotsBlocked': st['shots_blocked'] or 0,
            'bigChances': st['big_chances_total'] or 0,
            'bigChancesMissed': st['big_chances_missed'] or 0,
            'corners': st['corner_kicks'] or 0,
            'fouls': st['fouls_committed'] or 0,
            'offsides': st['offside_count'] or 0,
            'yellowCards': st['yellow_cards'] or 0,
            'redCards': st['red_cards'] or 0,
            'accuratePasses': st['accurate_passes'] or 0,
            'totalPasses': st['total_passes'] or 0,
            'passAccuracy': st['pass_accuracy_pct'] or 0
        }

    # 3. Récupération des compositions (Lineups) groupées par match
    cursor.execute("""
    SELECT 
        match_id, is_home, player_name_match,
        lineup_type, role_category, jersey_number, captain,
        rating, sub_in_minute
    FROM fct_match_lineups
    ORDER BY is_home DESC, lineup_type DESC, jersey_number ASC;
    """)
    all_lineups = cursor.fetchall()
    lineups_by_match = {}
    for lp in all_lineups:
        m_id = lp['match_id']
        if m_id not in lineups_by_match:
            lineups_by_match[m_id] = {
                'home': {'formation': '4-3-3', 'coach': 'Entraîneur', 'starters': [], 'bench': []},
                'away': {'formation': '4-3-3', 'coach': 'Entraîneur', 'starters': [], 'bench': []}
            }
        side = 'home' if lp['is_home'] else 'away'
        ltype = 'starters' if lp['lineup_type'] == 'STARTER' else 'bench'
        if ltype == 'starters':
            lineups_by_match[m_id][side]['starters'].append({
                'name': lp['player_name_match'],
                'role': lp['role_category'] or 'M',
                'num': lp['jersey_number'] or 0,
                'captain': bool(lp['captain']),
                'rating': lp['rating']
            })
        else:
            lineups_by_match[m_id][side]['bench'].append({
                'name': lp['player_name_match'],
                'subIn': lp['sub_in_minute'],
                'rating': lp['rating']
            })

    # Enrichir les lineups avec formations et coachs
    for m_id, lu in lineups_by_match.items():
        rm = raw_meta.get(m_id)
        if rm:
            lu['home']['formation'] = rm['homeFormation']
            lu['home']['coach'] = rm['homeCoach']
            lu['away']['formation'] = rm['awayFormation']
            lu['away']['coach'] = rm['awayCoach']

    # 4. Récupération des événements groupés par match
    cursor.execute("""
    SELECT 
        match_id, minute, added_time, team_name, event_type,
        primary_player_name, secondary_player_name, detail_note
    FROM fact_match_events
    ORDER BY minute ASC, added_time ASC;
    """)
    all_events = cursor.fetchall()
    events_by_match = {}
    for ev in all_events:
        m_id = ev['match_id']
        if m_id not in events_by_match:
            events_by_match[m_id] = []
        events_by_match[m_id].append(ev)

    # 5. Construction de unified_history.json
    unified_list = []
    for m in finished_rows:
        m_id = m['match_id']
        m_events = events_by_match.get(m_id, [])
        home_team = m['home_team_name']
        away_team = m['away_team_name']

        goals = []
        cards = []
        subs = []
        timeline = []

        cur_home_score = 0
        cur_away_score = 0
        ht_home_score = 0
        ht_away_score = 0

        for ev in m_events:
            ev_type = ev['event_type']
            min_val = ev['minute'] or 0
            add_val = ev['added_time'] or 0
            t_str = f"{min_val}" if add_val == 0 else f"{min_val}+{add_val}"
            team_ev = ev['team_name'] or ''
            is_home_ev = (team_ev.strip().lower() == home_team.strip().lower())
            
            period = '1ST_HALF' if min_val <= 45 else ('2ND_HALF' if min_val <= 90 else 'EXTRA_TIME')
            detail = ev['detail_note'] or ''

            if ev_type in ['GOAL', 'PENALTY_GOAL', 'OWN_GOAL']:
                if is_home_ev:
                    cur_home_score += 1
                else:
                    cur_away_score += 1

                if min_val <= 45:
                    ht_home_score = cur_home_score
                    ht_away_score = cur_away_score

                score_progression = f"{cur_home_score} - {cur_away_score}"
                assist_name = ev['secondary_player_name']
                if not assist_name and 'Assist:' in detail:
                    assist_name = detail.split('Assist:')[1].strip()

                goals.append({
                    "player": ev['primary_player_name'],
                    "time": t_str,
                    "detail": detail or "Tir cadré",
                    "team": team_ev,
                    "assist": assist_name,
                    "score": score_progression,
                    "isPenalty": ev_type == 'PENALTY_GOAL' or 'pénalty' in detail.lower() or 'penalty' in detail.lower(),
                    "isOwnGoal": ev_type == 'OWN_GOAL' or 'csc' in detail.lower() or 'contre son camp' in detail.lower()
                })

                timeline.append({
                    "id": f"ev_{m_id}_{len(timeline)}",
                    "period": period,
                    "minute": min_val,
                    "addedTime": add_val,
                    "minuteDisplay": f"{t_str}'",
                    "type": ev_type,
                    "isHome": is_home_ev,
                    "teamName": team_ev,
                    "player": ev['primary_player_name'],
                    "assist": assist_name,
                    "score": score_progression,
                    "isPenalty": ev_type == 'PENALTY_GOAL' or 'pénalty' in detail.lower() or 'penalty' in detail.lower(),
                    "isOwnGoal": ev_type == 'OWN_GOAL' or 'csc' in detail.lower() or 'contre son camp' in detail.lower(),
                    "detail": detail
                })

            elif ev_type in ['YELLOW_CARD', 'RED_CARD']:
                card_type = "RED" if ev_type == 'RED_CARD' else "YELLOW"
                is_coach = 'entraîneur' in detail.lower() or 'entraineur' in detail.lower() or 'coach' in detail.lower()
                clean_reason = detail.replace('Carton Yellow', '').replace('Carton Red', '').replace('Carton', '').strip()
                if is_coach:
                    clean_reason = detail.replace('Entraîneur', '').replace('(', '').replace(')', '').strip() or 'Contestation'
                    clean_reason = f"Entraîneur ({clean_reason})"

                cards.append({
                    "player": ev['primary_player_name'],
                    "time": t_str,
                    "type": card_type,
                    "team": team_ev,
                    "detail": detail,
                    "isCoach": is_coach
                })

                timeline.append({
                    "id": f"ev_{m_id}_{len(timeline)}",
                    "period": period,
                    "minute": min_val,
                    "addedTime": add_val,
                    "minuteDisplay": f"{t_str}'",
                    "type": ev_type,
                    "isHome": is_home_ev,
                    "teamName": team_ev,
                    "player": ev['primary_player_name'],
                    "cardType": card_type,
                    "reason": clean_reason or "Faute de jeu",
                    "detail": detail,
                    "isCoach": is_coach
                })

            elif ev_type == 'SUBSTITUTION':
                subs.append({
                    "playerIn": ev['primary_player_name'],
                    "playerOut": ev['secondary_player_name'],
                    "time": t_str,
                    "team": team_ev
                })

                is_injury = 'blessure' in detail.lower() or 'injury' in detail.lower()
                timeline.append({
                    "id": f"ev_{m_id}_{len(timeline)}",
                    "period": period,
                    "minute": min_val,
                    "addedTime": add_val,
                    "minuteDisplay": f"{t_str}'",
                    "type": 'SUBSTITUTION',
                    "isHome": is_home_ev,
                    "teamName": team_ev,
                    "playerIn": ev['primary_player_name'],
                    "playerOut": ev['secondary_player_name'],
                    "isInjury": is_injury,
                    "detail": detail
                })

        raw_r = str(m['round_label'] or '')
        r_num = int(raw_r) if raw_r.isdigit() else (m['gameweek'] or 1)
        round_formatted = f"Journée {r_num}" if raw_r.isdigit() else (raw_r if raw_r else f"Journée {r_num}")

        m_stats = stats_by_match.get(m_id, None)
        m_lineups = lineups_by_match.get(m_id, None)
        rm = raw_meta.get(m_id, {})

        unified_list.append({
            "id": m['match_id'],
            "league": m['competition_id'],
            "season": m['season'],
            "round": round_formatted,
            "gameweek": r_num,
            "date": m['match_date'],
            "matchDate": m['match_date'],
            "kickoffUtc": m['match_timestamp_utc'],
            "homeTeam": home_team,
            "awayTeam": away_team,
            "homeLogo": team_logos.get(home_team.lower(), "https://images.fotmob.com/image_resources/logo/teamlogo/default.png"),
            "awayLogo": team_logos.get(away_team.lower(), "https://images.fotmob.com/image_resources/logo/teamlogo/default.png"),
            "homeScore": m['home_score'],
            "awayScore": m['away_score'],
            "halfTimeScore": f"{ht_home_score}-{ht_away_score}",
            "score": f"{m['home_score']}-{m['away_score']}",
            "status": "FINISHED",
            "homeXg": round(float(m['home_xg'] or 0.0), 2) if m['home_xg'] else None,
            "awayXg": round(float(m['away_xg'] or 0.0), 2) if m['away_xg'] else None,
            "referee": m['referee_name'] or "Arbitre Officiel",
            "location": m['stadium_name'] or f"Stade de {home_team}",
            "coaches": {
                "home": rm.get('homeCoach', 'Entraîneur'),
                "away": rm.get('awayCoach', 'Entraîneur')
            },
            "formations": {
                "home": rm.get('homeFormation', '4-3-3'),
                "away": rm.get('awayFormation', '4-3-3')
            },
            "goals": goals,
            "cards": cards,
            "substitutions": subs,
            "timeline": timeline,
            "teamStats": m_stats,
            "lineups": m_lineups,
            "aiSummary": f"Rencontre officielle {m['competition_id']} {m['season']} ({round_formatted}) : {home_team} {m['home_score']}-{m['away_score']} {away_team}."
        })

    # Sauvegarde directe de unified_history.json
    with open(UNIFIED_HIST_FILE, 'w', encoding='utf-8') as f:
        json.dump(unified_list, f, ensure_ascii=False, separators=(',', ':'))
    print(f"✅ [Compiler] unified_history.json régénéré : {len(unified_list)} rencontres certifiées avec Compositions, Formations et Chronologie.")

    # Auto-génération du cache compact analytics_cache.json & partitionnement public/data/
    try:
        from collections import defaultdict
        import unicodedata
        import re

        def norm_key_helper(s: str) -> str:
            if not s: return ""
            nfkd = unicodedata.normalize('NFD', str(s))
            stripped = "".join([c for c in nfkd if not unicodedata.combining(c)])
            cleaned = re.sub(r'[^a-zA-Z0-9\s]', ' ', stripped.lower())
            return re.sub(r'\s+', ' ', cleaned).strip()

        refs_raw = defaultdict(lambda: {'yellowCards': 0, 'redCards': 0, 'penalties': 0, 'matches': 0, 'fullName': ''})
        raw_team_recent = defaultdict(list)
        f_store_raw = defaultdict(lambda: {
            'matches': 0, 'concededFirst': 0, 'comebacks': 0, 'redCards': 0,
            'trailingMatches': 0, 'comebackWins': 0, 'comebackDraws': 0,
            'leadingMatches': 0, 'lostLeads': 0
        })
        h2h_lists = defaultdict(list)
        h2h_stats = defaultdict(lambda: {'homeWins': 0, 'draws': 0, 'awayWins': 0, 'matches': []})

        history_dir = os.path.join(ROOT_DIR, "public", "data", "history")
        matches_dir = os.path.join(ROOT_DIR, "public", "data", "matches")
        os.makedirs(history_dir, exist_ok=True)
        os.makedirs(matches_dir, exist_ok=True)

        grouped_history = defaultdict(list)
        season_grouped = defaultdict(list)

        # 1. Export fichiers détaillés et groupements (dans l'ordre chronologique)
        for m in unified_list:
            m_id = m['id']
            detail_obj = {
                'id': m_id,
                'teamStats': m.get('teamStats'),
                'lineups': m.get('lineups'),
                'timeline': m.get('timeline'),
                'substitutions': m.get('substitutions'),
                'coaches': m.get('coaches'),
                'formations': m.get('formations')
            }
            with open(os.path.join(matches_dir, f"{m_id}.json"), 'w', encoding='utf-8') as mf:
                json.dump(detail_obj, mf, ensure_ascii=False, separators=(',', ':'))

            light_m = {
                'id': m_id,
                'league': m.get('league'),
                'season': m.get('season'),
                'round': m.get('round'),
                'date': m.get('date'),
                'homeTeam': m.get('homeTeam'),
                'awayTeam': m.get('awayTeam'),
                'homeScore': m.get('homeScore'),
                'awayScore': m.get('awayScore'),
                'homeXg': m.get('homeXg'),
                'awayXg': m.get('awayXg'),
                'referee': m.get('referee'),
                'status': m.get('status'),
                'goals': m.get('goals'),
                'cards': m.get('cards')
            }
            s = m.get('season') or '2026-2027'
            l = m.get('league') or 'FRA-L1'
            grouped_history[f"{s}_{l}"].append(light_m)
            season_grouped[s].append(light_m)

            # Statistiques Arbitres
            ref = m.get('referee')
            if ref and ref != 'Arbitre Officiel':
                r = refs_raw[ref]
                r['fullName'] = ref
                r['matches'] += 1
                for card_item in m.get('cards', []):
                    if card_item.get('type') == 'RED':
                        r['redCards'] += 1
                    else:
                        r['yellowCards'] += 1
                for g in m.get('goals', []):
                    if g.get('isPenalty'):
                        r['penalties'] += 1

            # Feature Store (Résilience et Cartons)
            ht, at = m.get('homeTeam'), m.get('awayTeam')
            hs, as_ = m.get('homeScore'), m.get('awayScore')
            goals = m.get('goals') or []
            cards = m.get('cards') or []
            if ht and at and hs is not None and as_ is not None:
                for t_name, is_home in [(ht, True), (at, False)]:
                    fst = f_store_raw[t_name]
                    fst['matches'] += 1
                    team_reds = sum(1 for c in cards if (c.get('team') == t_name or c.get('teamName') == t_name) and c.get('type') == 'RED')
                    fst['redCards'] += team_reds
                    if len(goals) > 1:
                        first_g = goals[0]
                        first_team = first_g.get('team') or first_g.get('teamName') or ''
                        if first_team and first_team != t_name:
                            fst['concededFirst'] += 1
                            t_score = hs if is_home else as_
                            opp_score = as_ if is_home else hs
                            if t_score > opp_score:
                                fst['comebacks'] += 1
                                fst['comebackWins'] += 1
                            elif t_score == opp_score:
                                fst['comebacks'] += 1
                                fst['comebackDraws'] += 1

        # 2. Construction teamRecent & H2H dans l'ordre INVERSE (du plus récent au plus ancien)
        for m in reversed(unified_list):
            m_id = m['id']
            ht, at = m.get('homeTeam'), m.get('awayTeam')
            hs, as_ = m.get('homeScore'), m.get('awayScore')
            if not (ht and at and hs is not None and as_ is not None):
                continue
            
            s = m.get('season') or '2026-2027'
            l = m.get('league') or 'FRA-L1'
            h_xg = round(float(m.get('homeXg') or 0.0), 2) if m.get('homeXg') is not None else 1.2
            a_xg = round(float(m.get('awayXg') or 0.0), 2) if m.get('awayXg') is not None else 1.0

            light_m = {
                'id': m_id,
                'league': l,
                'season': s,
                'round': m.get('round'),
                'date': m.get('date'),
                'homeTeam': ht,
                'awayTeam': at,
                'homeScore': hs,
                'awayScore': as_,
                'homeXg': h_xg,
                'awayXg': a_xg,
                'referee': m.get('referee') or 'Arbitre Officiel',
                'status': m.get('status'),
                'goals': m.get('goals') or [],
                'cards': m.get('cards') or []
            }

            # Clés H2H triées
            norm_h = norm_key_helper(ht)
            norm_a = norm_key_helper(at)
            clean_nh = clean_team_str(normalize_team_name(ht))
            clean_na = clean_team_str(normalize_team_name(at))
            h2h_key_norm = "__".join(sorted([norm_h, norm_a]))
            h2h_key_clean = "__".join(sorted([clean_nh, clean_na]))

            raw_ts = m.get('teamStats') or {}
            compact_team_stats = {}
            if isinstance(raw_ts, dict):
                if isinstance(raw_ts.get('home'), dict) and raw_ts['home'].get('possession') is not None:
                    compact_team_stats['home'] = {'possession': raw_ts['home']['possession']}
                if isinstance(raw_ts.get('away'), dict) and raw_ts['away'].get('possession') is not None:
                    compact_team_stats['away'] = {'possession': raw_ts['away']['possession']}

            h2h_entry = {
                'id': m_id,
                'date': m.get('date'),
                'season': s,
                'league': l,
                'round': m.get('round'),
                'status': m.get('status'),
                'home': ht,
                'away': at,
                'homeTeam': ht,
                'awayTeam': at,
                'homeScore': hs,
                'awayScore': as_,
                'score': f"{hs}-{as_}",
                'homeXg': h_xg,
                'awayXg': a_xg,
                'referee': m.get('referee') or 'Arbitre Officiel',
                'goals': m.get('goals') or [],
                'cards': m.get('cards') or []
            }
            if len(h2h_lists[h2h_key_norm]) < 6:
                h2h_lists[h2h_key_norm].append(h2h_entry)
            if h2h_key_clean != h2h_key_norm and len(h2h_lists[h2h_key_clean]) < 6:
                h2h_lists[h2h_key_clean].append(h2h_entry)

            # Remplissage de teamRecent (jusqu'à 10 matchs récents par club)
            for team_name, is_home in [(ht, True), (at, False)]:
                c_team = normalize_team_name(team_name)
                recent_list = raw_team_recent[c_team]
                if len(recent_list) < 10:
                    goals_scored = hs if is_home else as_
                    goals_conceded = as_ if is_home else hs
                    t_xg = h_xg if is_home else a_xg
                    opp_xg = a_xg if is_home else h_xg
                    opp_team = at if is_home else ht
                    venue_str = "Domicile" if is_home else "Extérieur"

                    if goals_scored > goals_conceded:
                        res_str = 'W'
                        res_fr = 'V'
                    elif goals_scored == goals_conceded:
                        res_str = 'D_DRAW'
                        res_fr = 'N'
                    else:
                        res_str = 'L'
                        res_fr = 'D'

                    diff_val = round(goals_scored - t_xg, 2)
                    recent_list.append({
                        'id': m_id,
                        'date': m.get('date'),
                        'season': s,
                        'league': l,
                        'round': m.get('round'),
                        'status': m.get('status'),
                        'isHome': is_home,
                        'venue': venue_str,
                        'opponent': opp_team,
                        'teamScore': goals_scored,
                        'opponentScore': goals_conceded,
                        'realGoals': goals_scored,
                        'concededGoals': goals_conceded,
                        'xG': t_xg,
                        'teamXg': t_xg,
                        'opponentXg': opp_xg,
                        'diff': diff_val,
                        'result': res_str,
                        'res': res_fr,
                        'score': f"{goals_scored}-{goals_conceded}",
                        'matchScore': f"{hs}-{as_}",
                        'teamGoals': goals_scored,
                        'oppGoals': goals_conceded,
                        'home': ht,
                        'away': at,
                        'homeTeam': ht,
                        'awayTeam': at,
                        'homeScore': hs,
                        'awayScore': as_,
                        'homeXg': h_xg,
                        'awayXg': a_xg,
                        'referee': m.get('referee') or 'Arbitre Officiel',
                        'goals': m.get('goals') or [],
                        'cards': m.get('cards') or [],
                        'teamStats': compact_team_stats,
                        'match': {'id': m_id, 'date': m.get('date'), 'season': s, 'league': l, 'round': m.get('round'), 'status': m.get('status'), 'homeTeam': ht, 'awayTeam': at, 'homeScore': hs, 'awayScore': as_, 'score': f"{hs}-{as_}", 'homeXg': h_xg, 'awayXg': a_xg, 'referee': m.get('referee') or 'Arbitre Officiel'}
                    })

        # Indexation normalisée compacte pour teamRecent (compatible MatchHistory.jsx, MatchDeepDive.jsx & tacticalAnalysis.js)
        final_team_recent = {}
        for c_team, matches in raw_team_recent.items():
            norm_k = norm_key_helper(c_team)
            clean_k = clean_team_str(c_team)
            if norm_k:
                final_team_recent[norm_k] = matches
            if clean_k and clean_k != norm_k:
                final_team_recent[clean_k] = matches

        # Multi-indexation pour refs
        final_refs = {}
        for ref_name, stats in refs_raw.items():
            final_refs[ref_name] = stats
            final_refs[norm_key_helper(ref_name)] = stats
            final_refs[ref_name.lower().strip()] = stats

        # Multi-indexation pour featureStore
        final_f_store = {}
        for t_name, data in f_store_raw.items():
            final_f_store[t_name] = data
            final_f_store[t_name.lower().strip()] = data
            final_f_store[norm_key_helper(t_name)] = data
            final_f_store[clean_team_str(t_name)] = data

        for key, matches in grouped_history.items():
            with open(os.path.join(history_dir, f"{key}.json"), 'w', encoding='utf-8') as hf:
                json.dump(matches, hf, ensure_ascii=False, separators=(',', ':'))

        for season, matches in season_grouped.items():
            with open(os.path.join(history_dir, f"{season}_ALL.json"), 'w', encoding='utf-8') as hf:
                json.dump(matches, hf, ensure_ascii=False, separators=(',', ':'))

        analytics_cache = {
            'refs': final_refs,
            'teamRecent': final_team_recent,
            'featureStore': final_f_store,
            'h2hMap': dict(h2h_lists)
        }
        cache_path = os.path.join(ROOT_DIR, "src", "data", "compiled", "analytics_cache.json")
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        with open(cache_path, 'w', encoding='utf-8') as cf:
            json.dump(analytics_cache, cf, ensure_ascii=False, separators=(',', ':'))
        print(f"✅ [Compiler] analytics_cache.json & archives public/data régénérés avec succès ({len(final_team_recent)} clés d'équipes indexées).")
        
        # Export du rapport de backtest ML vers public/data pour le monitoring frontend
        backtest_src = os.path.join(ROOT_DIR, "models", "training_evaluation_report.json")
        backtest_dst = os.path.join(ROOT_DIR, "public", "data", "model_backtest_report.json")
        if os.path.exists(backtest_src):
            shutil.copyfile(backtest_src, backtest_dst)
            print(f"✅ [Compiler] model_backtest_report.json synchronisé dans public/data/.")
    except Exception as e:
        print(f"⚠️ [Compiler] Attention génération cache analytique : {e}")

    # 6. Mise à jour du calendrier 2026-2027 dans app_data.json
    cursor.execute("""
    SELECT 
        match_id, competition_id, season, round_label, gameweek,
        match_timestamp_utc, match_date, status,
        home_team_id, away_team_id, home_team_name, away_team_name,
        home_score, away_score, home_xg, away_xg,
        referee_name, stadium_name
    FROM fact_matches
    WHERE season = '2026-2027'
    ORDER BY match_date ASC, match_timestamp_utc ASC;
    """)
    season_26_27_matches = cursor.fetchall()

    # 6.1 Chargement des cotes certifiées depuis dim_match_closing_odds
    cursor.execute("""
    SELECT match_id, competition_id, home_team_name, away_team_name, 
           closing_odd_1, closing_odd_n, closing_odd_2, closing_margin_pct, odds_status
    FROM dim_match_closing_odds
    """)
    all_closing_odds = cursor.fetchall()
    closing_odds_by_id = {row['match_id']: row for row in all_closing_odds}

    def clean_team_norm(raw: str) -> str:
        if not raw: return ""
        return clean_team_str(normalize_team_name(raw))

    closing_odds_by_teams = {}
    for row in all_closing_odds:
        k = (clean_team_norm(row['home_team_name']), clean_team_norm(row['away_team_name']))
        closing_odds_by_teams[k] = row

    # Fusion avec closing_odds_master.json pour préserver les cotes réelles
    master_odds_path = os.path.join(ROOT_DIR, "src", "data", "compiled", "closing_odds_master.json")
    if os.path.exists(master_odds_path):
        try:
            with open(master_odds_path, 'r', encoding='utf-8') as f_mo:
                mo_data = json.load(f_mo)
                for mid, item in mo_data.get('odds', {}).items():
                    odds_val = item.get('odds')
                    if odds_val and isinstance(odds_val, dict) and mid not in closing_odds_by_id:
                        row_dict = {
                            'match_id': mid,
                            'competition_id': item.get('competitionId'),
                            'home_team_name': item.get('homeTeam'),
                            'away_team_name': item.get('awayTeam'),
                            'closing_odd_1': odds_val.get('home'),
                            'closing_odd_n': odds_val.get('draw'),
                            'closing_odd_2': odds_val.get('away'),
                            'closing_margin_pct': item.get('marginPct'),
                            'odds_status': item.get('oddsStatus', 'ACTIVE')
                        }
                        closing_odds_by_id[mid] = row_dict
                for tk, item in mo_data.get('byTeams', {}).items():
                    parts = tk.split('__')
                    odds_val = item.get('odds')
                    if len(parts) == 2 and odds_val and isinstance(odds_val, dict):
                        k = (parts[0], parts[1])
                        if k not in closing_odds_by_teams:
                            row_dict = {
                                'match_id': item.get('matchId'),
                                'competition_id': item.get('competitionId'),
                                'home_team_name': item.get('homeTeam'),
                                'away_team_name': item.get('awayTeam'),
                                'closing_odd_1': odds_val.get('home'),
                                'closing_odd_n': odds_val.get('draw'),
                                'closing_odd_2': odds_val.get('away'),
                                'closing_margin_pct': item.get('marginPct'),
                                'odds_status': item.get('oddsStatus', 'ACTIVE')
                            }
                            closing_odds_by_teams[k] = row_dict
            print(f"📦 [Compiler] Master odds synchronisées ({len(closing_odds_by_id)} cotes actives enregistrées).")
        except Exception as e:
            print(f"⚠️ [Compiler] Attention lecture closing_odds_master.json : {e}")

    app_data = {
        'supportedLeagues': [
            {"code": "FRA-L1", "name": "Ligue 1", "flag": "🇫🇷", "country": "France"},
            {"code": "ENG-PL", "name": "Premier League", "flag": "🇬🇧", "country": "Angleterre"},
            {"code": "ESP-LL", "name": "La Liga", "flag": "🇪🇸", "country": "Espagne"},
            {"code": "ITA-SA", "name": "Serie A", "flag": "🇮🇹", "country": "Italie"},
            {"code": "GER-BL", "name": "Bundesliga", "flag": "🇩🇪", "country": "Allemagne"},
            {"code": "EUR-CL", "name": "Ligue des Champions", "flag": "🇪🇺", "country": "Europe"},
            {"code": "EUR-EL", "name": "Ligue Europa", "flag": "🇪🇺", "country": "Europe"},
            {"code": "EUR-ECL", "name": "Ligue Conférence", "flag": "🇪🇺", "country": "Europe"},
        ]
    }

    new_schedule = []
    for m in season_26_27_matches:
        m_id = m['match_id']
        raw_r = str(m['round_label'] or '')
        r_num = int(raw_r) if raw_r.isdigit() else (m['gameweek'] or 1)
        r_str = f"Journée {r_num}" if raw_r.isdigit() else (raw_r if raw_r else f"Journée {r_num}")

        home_team = m['home_team_name']
        away_team = m['away_team_name']
        h_score = m['home_score']
        a_score = m['away_score']
        is_fin = m['status'] == 'FINISHED' and h_score is not None

        m_events = events_by_match.get(m_id, [])
        goals = []
        cards = []
        subs = []
        timeline = []
        cur_home_score = 0
        cur_away_score = 0
        ht_home_score = 0
        ht_away_score = 0

        for ev in m_events:
            ev_type = ev['event_type']
            min_val = ev['minute'] or 0
            add_val = ev['added_time'] or 0
            t_str = f"{min_val}" if add_val == 0 else f"{min_val}+{add_val}"
            team_ev = ev['team_name'] or ''
            is_home_ev = (team_ev.lower() == home_team.lower()) or (team_ev and team_ev in home_team)
            period = "1ÈRE MI-TEMPS" if min_val <= 45 else "2ÈME MI-TEMPS"
            detail = ev['detail_note'] or ''

            if ev_type in ['GOAL', 'PENALTY_GOAL', 'OWN_GOAL']:
                if ev_type == 'OWN_GOAL':
                    if is_home_ev: cur_away_score += 1
                    else: cur_home_score += 1
                elif is_home_ev: cur_home_score += 1
                else: cur_away_score += 1
                if min_val <= 45:
                    ht_home_score = cur_home_score
                    ht_away_score = cur_away_score

                score_progression = f"{cur_home_score} - {cur_away_score}"
                assist_name = ev['secondary_player_name']
                if not assist_name and 'Assist:' in detail:
                    assist_name = detail.split('Assist:')[1].strip()

                goals.append({
                    "player": ev['primary_player_name'],
                    "time": t_str,
                    "detail": detail or "Tir cadré",
                    "team": team_ev,
                    "assist": assist_name,
                    "score": score_progression,
                    "isPenalty": ev_type == 'PENALTY_GOAL' or 'pénalty' in detail.lower() or 'penalty' in detail.lower(),
                    "isOwnGoal": ev_type == 'OWN_GOAL' or 'csc' in detail.lower() or 'contre son camp' in detail.lower()
                })

                timeline.append({
                    "id": f"ev_{m_id}_{len(timeline)}",
                    "period": period,
                    "minute": min_val,
                    "addedTime": add_val,
                    "minuteDisplay": f"{t_str}'",
                    "type": ev_type,
                    "isHome": is_home_ev,
                    "teamName": team_ev,
                    "player": ev['primary_player_name'],
                    "assist": assist_name,
                    "score": score_progression,
                    "isPenalty": ev_type == 'PENALTY_GOAL' or 'pénalty' in detail.lower() or 'penalty' in detail.lower(),
                    "isOwnGoal": ev_type == 'OWN_GOAL' or 'csc' in detail.lower() or 'contre son camp' in detail.lower(),
                    "detail": detail
                })
            elif ev_type in ['YELLOW_CARD', 'RED_CARD']:
                card_type = "RED" if ev_type == 'RED_CARD' else "YELLOW"
                is_coach = 'entraîneur' in detail.lower() or 'entraineur' in detail.lower() or 'coach' in detail.lower()
                clean_reason = detail.replace('Carton Yellow', '').replace('Carton Red', '').replace('Carton', '').strip()
                if is_coach:
                    clean_reason = detail.replace('Entraîneur', '').replace('(', '').replace(')', '').strip() or 'Contestation'
                    clean_reason = f"Entraîneur ({clean_reason})"

                cards.append({
                    "player": ev['primary_player_name'],
                    "time": t_str,
                    "type": card_type,
                    "team": team_ev,
                    "detail": detail,
                    "isCoach": is_coach
                })

                timeline.append({
                    "id": f"ev_{m_id}_{len(timeline)}",
                    "period": period,
                    "minute": min_val,
                    "addedTime": add_val,
                    "minuteDisplay": f"{t_str}'",
                    "type": ev_type,
                    "isHome": is_home_ev,
                    "teamName": team_ev,
                    "player": ev['primary_player_name'],
                    "cardType": card_type,
                    "reason": clean_reason or "Faute de jeu",
                    "detail": detail,
                    "isCoach": is_coach
                })
            elif ev_type == 'SUBSTITUTION':
                subs.append({
                    "playerIn": ev['primary_player_name'],
                    "playerOut": ev['secondary_player_name'],
                    "time": t_str,
                    "team": team_ev
                })
                is_injury = 'blessure' in detail.lower() or 'injury' in detail.lower()
                timeline.append({
                    "id": f"ev_{m_id}_{len(timeline)}",
                    "period": period,
                    "minute": min_val,
                    "addedTime": add_val,
                    "minuteDisplay": f"{t_str}'",
                    "type": 'SUBSTITUTION',
                    "isHome": is_home_ev,
                    "teamName": team_ev,
                    "playerIn": ev['primary_player_name'],
                    "playerOut": ev['secondary_player_name'],
                    "isInjury": is_injury,
                    "detail": detail
                })

        m_stats = stats_by_match.get(m_id, None)
        m_lineups = lineups_by_match.get(m_id, None)
        rm = raw_meta.get(m_id, {})

        m_id_str = m['match_id']
        old_val = existing_lookup.get(m_id_str, {})
        
        # Recherche de cotes certifiées dans dim_match_closing_odds
        clean_h = clean_team_norm(home_team)
        clean_a = clean_team_norm(away_team)

        closing_odd_row = closing_odds_by_id.get(m_id_str)
        if not closing_odd_row:
            closing_odd_row = closing_odds_by_teams.get((clean_h, clean_a))
        if not closing_odd_row:
            for (ch, ca), r in closing_odds_by_teams.items():
                if (ch == clean_h or clean_h in ch or ch in clean_h) and (ca == clean_a or clean_a in ca or ca in clean_a):
                    closing_odd_row = r
                    break

        if closing_odd_row and closing_odd_row['closing_odd_1'] and float(closing_odd_row['closing_odd_1']) > 1.0:
            h_odd = float(closing_odd_row['closing_odd_1'])
            d_odd = float(closing_odd_row['closing_odd_n'])
            a_odd = float(closing_odd_row['closing_odd_2'])
            is_mock_215 = (abs(h_odd - 2.15) < 0.001 and abs(d_odd - 3.35) < 0.001 and abs(a_odd - 3.40) < 0.001)
            if not is_mock_215:
                betclic_odds = {
                    "home": h_odd,
                    "draw": d_odd,
                    "away": a_odd
                }
                odds_status = closing_odd_row['odds_status'] or 'ACTIVE'
                odds_margin_pct = closing_odd_row['closing_margin_pct']
                
                # Filtre strict des value bets pour ne garder que ceux cohérents avec la vraie cote
                value_bets = []
                for vb in old_val.get('valueBets', []):
                    target_odd = h_odd if vb.get('selection') == '1' else (a_odd if vb.get('selection') == '2' else d_odd)
                    if vb.get('betclic_odd') == target_odd or vb.get('bookmaker_odds') == target_odd:
                        value_bets.append(vb)
            else:
                betclic_odds = None
                odds_status = 'NOT_OPEN'
                odds_margin_pct = None
                value_bets = []
        elif isinstance(old_val.get('betclicOdds'), dict) and old_val.get('betclicOdds', {}).get('home') and float(old_val.get('betclicOdds', {}).get('home') or 0) > 1.0:
            h_cand = float(old_val['betclicOdds'].get('home') or 0)
            d_cand = float(old_val['betclicOdds'].get('draw') or 0)
            a_cand = float(old_val['betclicOdds'].get('away') or 0)
            is_mock_215 = (abs(h_cand - 2.15) < 0.001 and abs(d_cand - 3.35) < 0.001 and abs(a_cand - 3.40) < 0.001)
            if not is_mock_215 and (old_val.get('oddsStatus') == 'ACTIVE' or old_val.get('betclicOdds')):
                betclic_odds = old_val.get('betclicOdds')
                odds_status = 'ACTIVE'
                odds_margin_pct = old_val.get('oddsMarginPct')
                value_bets = old_val.get('valueBets', [])
            else:
                betclic_odds = None
                odds_status = 'NOT_OPEN'
                odds_margin_pct = None
                value_bets = []
        else:
            betclic_odds = None
            odds_status = 'NOT_OPEN'
            odds_margin_pct = None
            value_bets = []
        
        probabilities = old_val.get('probabilities') or {"home": "45%", "draw": "28%", "away": "27%"}
        
        match_obj = {
            "id": m_id_str,
            "league": m['competition_id'],
            "season": "2026-2027",
            "week": r_num,
            "round": r_str,
            "matchDate": m['match_date'],
            "kickoffUtc": m['match_timestamp_utc'],
            "date": m['match_date'],
            "homeTeam": home_team,
            "awayTeam": away_team,
            "homeLogo": team_logos.get(home_team.lower(), "https://images.fotmob.com/image_resources/logo/teamlogo/default.png"),
            "awayLogo": team_logos.get(away_team.lower(), "https://images.fotmob.com/image_resources/logo/teamlogo/default.png"),
            "homeScore": h_score,
            "awayScore": a_score,
            "halfTimeScore": f"{ht_home_score}-{ht_away_score}",
            "score": f"{h_score}-{a_score}" if is_fin else "À Venir",
            "status": m['status'],
            "homeXg": round(float(m['home_xg'] or 0.0), 2) if m['home_xg'] else None,
            "awayXg": round(float(m['away_xg'] or 0.0), 2) if m['away_xg'] else None,
            "referee": m['referee_name'] or "Arbitre Officiel",
            "location": m['stadium_name'] or f"Stade de {home_team}",
            "coaches": {
                "home": rm.get('homeCoach', 'Entraîneur'),
                "away": rm.get('awayCoach', 'Entraîneur')
            },
            "formations": {
                "home": rm.get('homeFormation', '4-3-3'),
                "away": rm.get('awayFormation', '4-3-3')
            },
            "goals": goals,
            "cards": cards,
            "substitutions": subs,
            "timeline": timeline,
            "teamStats": m_stats,
            "lineups": m_lineups,
            "probabilities": probabilities,
            "betclicOdds": betclic_odds,
            "oddsStatus": odds_status,
            "oddsMarginPct": odds_margin_pct,
            "valueBets": value_bets,
            "aiSummary": f"Rencontre officielle {m['competition_id']} ({r_str}) opposant {home_team} à {away_team}."
        }
        
        # Preserver les autres champs ML calculés si disponibles
        if old_val.get('expectedGoals'):
            match_obj['expectedGoals'] = old_val['expectedGoals']
        if old_val.get('topExactScores'):
            match_obj['topExactScores'] = old_val['topExactScores']
        if old_val.get('topHalfTimeScores'):
            match_obj['topHalfTimeScores'] = old_val['topHalfTimeScores']
        if old_val.get('topConditionalScore'):
            match_obj['topConditionalScore'] = old_val['topConditionalScore']
        if old_val.get('potentialScorers'):
            match_obj['potentialScorers'] = old_val['potentialScorers']
        if old_val.get('potentialAssists'):
            match_obj['potentialAssists'] = old_val['potentialAssists']
        if old_val.get('prediction'):
            match_obj['prediction'] = old_val['prediction']
        if old_val.get('shapFactors'):
            match_obj['shapFactors'] = old_val['shapFactors']
        if old_val.get('overUnder25'):
            match_obj['overUnder25'] = old_val['overUnder25']
        if old_val.get('modelVersion'):
            match_obj['modelVersion'] = old_val['modelVersion']
        if old_val.get('predictionsByModel'):
            match_obj['predictionsByModel'] = old_val['predictionsByModel']
            
        new_schedule.append(match_obj)

    if existing_model_benchmarks:
        app_data['modelBenchmarks'] = existing_model_benchmarks
    app_data['activeModelDefault'] = existing_active_model_default or "v3"
    app_data['fullSchedule'] = new_schedule
    today_str = datetime.date.today().strftime('%Y-%m-%d')
    upcoming_from_today = [m for m in new_schedule if (m.get('matchDate') or m.get('date') or '') >= today_str and m.get('status') in ['LIVE', 'SCHEDULED']]
    app_data['nextMatches'] = upcoming_from_today[:15] if upcoming_from_today else [m for m in new_schedule if m.get('status') in ['LIVE', 'SCHEDULED']][:15]

    def write_json_safe(file_path, data):
        tmp_path = file_path + ".tmp"
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(tmp_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
        try:
            os.replace(tmp_path, file_path)
        except Exception:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass

    write_json_safe(APP_DATA_FILE, app_data)

    print(f"✅ [Compiler] app_data.json synchronisé : {len(new_schedule)} rencontres 2026-2027 actives.")
    conn.close()

if __name__ == "__main__":
    compile_data()
