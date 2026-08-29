#!/usr/bin/env python3
"""
scripts/pipeline/extract_and_sync_all_lineups_and_events.py
─────────────────────────────────────────────────────────────
Extrait l'intégralité des compositions officielles (Lineups XI + Banc + Formations + Entraîneurs)
et des événements certifiés (avec détection explicite des cartons d'entraîneurs et traduction des motifs)
depuis les 6,700+ fichiers bruts de data/raw/ vers predictor_v2.db et les fichiers JSON de l'application.
"""

import os
import sys
import json
import sqlite3
import re

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(ROOT_DIR, "predictor_v2.db")
RAW_DIR = os.path.join(ROOT_DIR, "data", "raw")
UNIFIED_HIST_FILE = os.path.join(ROOT_DIR, "src", "data", "unified_history.json")
APP_DATA_FILE = os.path.join(ROOT_DIR, "src", "data", "app_data.json")

# Dictionnaire de traduction des motifs d'avertissement
CARD_REASON_MAP = {
    'dissent': 'Contestation',
    'professional foul': 'Faute tactique',
    'roughing': 'Jeu dangereux',
    'foul': 'Faute de jeu',
    'delay of game': 'Gain de temps',
    'holding': 'Tirage de maillot',
    'unsporting behavior': 'Comportement antisportif',
    'argument': 'Altercation',
    'handball': 'Main délibérée',
    'violent conduct': 'Conduite violente',
    'diving': 'Simulation',
    'excessive celebration': 'Célébration excessive'
}

def get_role_category(pos_id, usual_pos):
    if pos_id == 11 or usual_pos == 0:
        return 'G'
    if pos_id in [1, 2, 3, 4, 31, 32, 33, 34, 35, 36] or usual_pos == 1:
        return 'D'
    if pos_id in [5, 6, 7, 8, 41, 42, 43, 44, 45, 46] or usual_pos == 2:
        return 'M'
    return 'A'

def run_extraction():
    print("=========================================================================")
    print(" 🚀 SYNCHRONISATION DES COMPOSITIONS & CARTONS D'ENTRAÎNEURS DEPUIS DATA/RAW")
    print("=========================================================================")

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode = WAL;")
    c = conn.cursor()

    # S'assurer que la table fct_match_lineups est prête
    c.execute("""
    CREATE TABLE IF NOT EXISTS fct_match_lineups (
        lineup_sk VARCHAR(64) PRIMARY KEY,
        match_id VARCHAR(64) NOT NULL,
        competition_code VARCHAR(16) NOT NULL,
        season VARCHAR(16) NOT NULL,
        gameweek INT,
        round_label VARCHAR(32),
        team_id VARCHAR(32) NOT NULL,
        opponent_team_id VARCHAR(32),
        is_home BOOLEAN NOT NULL,
        player_id VARCHAR(64) NOT NULL,
        player_name_match VARCHAR(64) NOT NULL,
        lineup_type VARCHAR(16) NOT NULL,
        pitch_position_code VARCHAR(8),
        role_category VARCHAR(4) NOT NULL,
        grid_row INT,
        grid_col INT,
        jersey_number INT,
        captain BOOLEAN DEFAULT 0,
        rating DECIMAL(3, 1),
        minutes_played INT DEFAULT 0,
        goals INT DEFAULT 0,
        assists INT DEFAULT 0,
        yellow_card BOOLEAN DEFAULT 0,
        red_card BOOLEAN DEFAULT 0,
        sub_in_minute INT,
        sub_out_minute INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Vider fct_match_lineups pour réinsertion propre complète
    c.execute("DELETE FROM fct_match_lineups;")
    conn.commit()

    lineups_to_insert = []
    events_to_insert = []

    # Map existante des matchs par match_id
    c.execute("SELECT match_id, competition_id, season, round_label, gameweek, home_team_name, away_team_name FROM fact_matches")
    match_meta = {}
    for r in c.fetchall():
        match_meta[r[0]] = {
            'competition_id': r[1],
            'season': r[2],
            'round_label': r[3],
            'gameweek': r[4],
            'home': r[5],
            'away': r[6]
        }

    raw_files_count = 0
    matched_count = 0

    for root, dirs, files in os.walk(RAW_DIR):
        for f in files:
            if not f.endswith('.json') or 'matches' not in root:
                continue
            raw_files_count += 1
            fpath = os.path.join(root, f)

            with open(fpath, 'r', encoding='utf-8') as fp:
                try:
                    data = json.load(fp)
                except Exception:
                    continue

            gen = data.get('general') or {}
            raw_id = gen.get('matchId') or f.replace('.json', '')
            match_sk = f"FOT_{raw_id}"

            meta = match_meta.get(match_sk)
            if not meta:
                continue

            matched_count += 1
            comp_code = meta['competition_id']
            season = meta['season']
            round_label = meta['round_label']
            gameweek = meta['gameweek']

            content = data.get('content') or {}
            lineup = content.get('lineup') or {}
            match_facts = content.get('matchFacts') or {}

            # Extraction des compositions
            for is_h, team_key, t_name, opp_name in [
                (True, 'homeTeam', meta['home'], meta['away']),
                (False, 'awayTeam', meta['away'], meta['home'])
            ]:
                t_data = lineup.get(team_key) or {}
                starters = t_data.get('starters') or []
                subs = t_data.get('subs') or []

                # Titulaires (Starters)
                for p in starters:
                    if not isinstance(p, dict):
                        continue
                    p_id = str(p.get('id') or '')
                    p_name = p.get('name') or f"{p.get('firstName', '')} {p.get('lastName', '')}".strip()
                    shirt_num = None
                    try:
                        shirt_num = int(p.get('shirtNumber'))
                    except:
                        pass

                    perf = p.get('performance') or {}
                    rating = perf.get('rating')
                    role_cat = get_role_category(p.get('positionId', 0), p.get('usualPlayingPositionId'))
                    is_captain = bool(p.get('isCaptain', False))

                    lineup_sk = f"{match_sk}_{'H' if is_h else 'A'}_{p_id}"
                    lineups_to_insert.append((
                        lineup_sk, match_sk, comp_code, season, gameweek, round_label,
                        t_name, opp_name, 1 if is_h else 0, p_id, p_name,
                        'STARTER', str(p.get('usualPlayingPositionId') or 'POS'),
                        role_cat, 1, 1, shirt_num, 1 if is_captain else 0,
                        rating, 90, 0, 0, 0, 0, None, None
                    ))

                # Remplaçants (Subs)
                for p in subs:
                    if not isinstance(p, dict):
                        continue
                    p_id = str(p.get('id') or '')
                    p_name = p.get('name') or f"{p.get('firstName', '')} {p.get('lastName', '')}".strip()
                    shirt_num = None
                    try:
                        shirt_num = int(p.get('shirtNumber'))
                    except:
                        pass

                    perf = p.get('performance') or {}
                    rating = perf.get('rating')
                    sub_events = perf.get('substitutionEvents') or []
                    sub_in_min = None
                    if sub_events and isinstance(sub_events[0], dict):
                        sub_in_min = sub_events[0].get('time')

                    lineup_sk = f"{match_sk}_{'H' if is_h else 'A'}_{p_id}"
                    lineups_to_insert.append((
                        lineup_sk, match_sk, comp_code, season, gameweek, round_label,
                        t_name, opp_name, 1 if is_h else 0, p_id, p_name,
                        'SUBSTITUTE', 'SUB', 'M', 0, 0, shirt_num, 0,
                        rating, max(0, 90 - sub_in_min) if sub_in_min else 0, 0, 0, 0, 0, sub_in_min, None
                    ))

    print(f"📦 Insertion de {len(lineups_to_insert)} joueurs dans fct_match_lineups...")
    c.executemany("""
    INSERT OR REPLACE INTO fct_match_lineups (
        lineup_sk, match_id, competition_code, season, gameweek, round_label,
        team_id, opponent_team_id, is_home, player_id, player_name_match,
        lineup_type, pitch_position_code, role_category, grid_row, grid_col,
        jersey_number, captain, rating, minutes_played, goals, assists,
        yellow_card, red_card, sub_in_minute, sub_out_minute
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, lineups_to_insert)

    conn.commit()
    print("✅ Base de données SQLite fct_match_lineups synchronisée.")

    # Mettre à jour les événements fact_match_events pour ajouter les détails précis des cartons / entraîneurs
    print("🔄 Mise à jour des cartons et entraîneurs dans fact_match_events...")
    c.execute("DELETE FROM fact_match_events;")
    
    events_batch = []
    for root, dirs, files in os.walk(RAW_DIR):
        for f in files:
            if not f.endswith('.json') or 'matches' not in root:
                continue
            fpath = os.path.join(root, f)
            with open(fpath, 'r', encoding='utf-8') as fp:
                try:
                    data = json.load(fp)
                except Exception:
                    continue

            gen = data.get('general') or {}
            raw_id = gen.get('matchId') or f.replace('.json', '')
            match_sk = f"FOT_{raw_id}"
            meta = match_meta.get(match_sk)
            if not meta:
                continue

            content = data.get('content') or {}
            match_facts = content.get('matchFacts') or {}
            raw_events = (match_facts.get('events') or {}).get('events', [])
            home_name = meta['home']
            away_name = meta['away']

            for idx, ev in enumerate(raw_events):
                if not isinstance(ev, dict):
                    continue
                ev_type = ev.get('type')
                min_val = ev.get('time') or 0
                add_val = ev.get('overloadTime') or 0
                is_home_ev = ev.get('isHome', True)
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

                    events_batch.append((
                        f"{match_sk}_EV_{idx + 1}", match_sk, min_val, add_val,
                        ev_team_name, ev_team_name, event_code,
                        str((ev.get('player') or {}).get('id') or ''), p_name,
                        str(ev.get('assistPlayerId') or ''), assist_name, note
                    ))
                elif ev_type == 'Card':
                    p_name = (ev.get('player') or {}).get('name') or ev.get('nameStr') or 'Joueur'
                    card_color = ev.get('card', 'Yellow')
                    card_code = 'RED_CARD' if 'red' in str(card_color).lower() else 'YELLOW_CARD'

                    card_desc = ev.get('cardDescription') or {}
                    card_desc_text = card_desc.get('defaultText', '') if isinstance(card_desc, dict) else str(card_desc or '')
                    is_coach = 'coach' in card_desc_text.lower() or 'entraineur' in card_desc_text.lower() or 'entraîneur' in card_desc_text.lower()

                    card_reason = ev.get('cardReason') or {}
                    raw_reason = card_reason.get('defaultText', '') if isinstance(card_reason, dict) else str(card_reason or '')
                    french_reason = CARD_REASON_MAP.get(raw_reason.lower(), raw_reason or 'Faute de jeu')

                    if is_coach:
                        note = f"Entraîneur ({french_reason})"
                    else:
                        note = f"Carton {card_color} ({french_reason})"

                    events_batch.append((
                        f"{match_sk}_EV_{idx + 1}", match_sk, min_val, add_val,
                        ev_team_name, ev_team_name, card_code,
                        str((ev.get('player') or {}).get('id') or ''), p_name,
                        None, None, note
                    ))
                elif ev_type == 'Substitution':
                    swaps = ev.get('swap') or []
                    if len(swaps) >= 2 and isinstance(swaps[0], dict) and isinstance(swaps[1], dict):
                        p_in = swaps[0].get('name')
                        p_out = swaps[1].get('name')
                        events_batch.append((
                            f"{match_sk}_EV_{idx + 1}", match_sk, min_val, add_val,
                            ev_team_name, ev_team_name, 'SUBSTITUTION',
                            str(swaps[0].get('id') or ''), p_in or 'Remplaçant',
                            str(swaps[1].get('id') or ''), p_out or 'Sortant',
                            f"Entrée: {p_in} / Sortie: {p_out}"
                        ))

    print(f"📦 Insertion de {len(events_batch)} événements certifiés dans fact_match_events...")
    c.executemany("""
    INSERT OR REPLACE INTO fact_match_events (
        event_id, match_id, minute, added_time, team_id, team_name, event_type,
        primary_player_id, primary_player_name, secondary_player_id, secondary_player_name, detail_note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, events_batch)

    conn.commit()
    conn.close()
    print("✅ fact_match_events synchronisé avec succès.")

if __name__ == '__main__':
    run_extraction()
