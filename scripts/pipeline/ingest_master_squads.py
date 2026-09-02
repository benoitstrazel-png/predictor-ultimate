#!/usr/bin/env python3
"""
scripts/pipeline/ingest_master_squads.py
─────────────────────────────────────────────────────────────
Ingestion ultra-rapide des 126 clubs, 2 500+ joueurs authentiques et
de l'historique SCD Type 2 (2024-2027) depuis src/data/squads/*.json,
squads_manifest.json et squads_mercato_scd2.json vers SQLite (predictor_v2.db).
"""

import os
import sys
import json
import re
import unicodedata
import sqlite3
from glob import glob

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(ROOT_DIR, "predictor_v2.db")
SQUADS_DIR = os.path.join(ROOT_DIR, "src", "data", "squads")
MANIFEST_FILE = os.path.join(ROOT_DIR, "src", "data", "squads_manifest.json")
MERCATO_SCD2_FILE = os.path.join(ROOT_DIR, "src", "data", "squads_mercato_scd2.json")
REAL_PLAYERS_FILE = os.path.join(ROOT_DIR, "src", "data", "real_players.json")
PLAYERS_FILE = os.path.join(ROOT_DIR, "src", "data", "players.json")

def write_json_atomic(file_path, data):
    tmp_path = file_path + ".tmp"
    with open(tmp_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass
    try:
        os.rename(tmp_path, file_path)
    except Exception:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass

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

def parse_market_value(val_str):
    if not val_str or not isinstance(val_str, str):
        return 0.0
    s = val_str.replace(',', '.').replace(' ', '')
    m_val = 0.0
    try:
        if 'mio' in s or 'm' in s or 'M' in s:
            num = float(re.findall(r'[\d\.]+', s)[0])
            m_val = num * 1_000_000
        elif 'k' in s or 'K' in s or 'mil' in s:
            num = float(re.findall(r'[\d\.]+', s)[0])
            m_val = num * 1_000
        else:
            nums = re.findall(r'[\d\.]+', s)
            if nums:
                m_val = float(nums[0])
    except Exception:
        m_val = 0.0
    return m_val

def map_detailed_position(role_category, pos_detail):
    rc = (role_category or '').upper()
    pd = (pos_detail or '').lower()
    if rc == 'G' or 'gardien' in pd:
        return ('GK', 'G')
    if 'centre' in pd or 'central' in pd:
        if rc == 'D' or 'defen' in pd:
            return ('CB', 'D')
        if rc == 'M' or 'milieu' in pd:
            return ('CM', 'M')
        if rc == 'A' or 'attaquant' in pd:
            return ('ST', 'A')
    if 'gauche' in pd or 'left' in pd:
        if rc == 'D' or 'defen' in pd or 'arriere' in pd:
            return ('LB', 'D')
        if rc == 'M' or 'milieu' in pd:
            return ('LM', 'M')
        if rc == 'A' or 'attaquant' in pd or 'ailier' in pd:
            return ('LW', 'A')
    if 'droit' in pd or 'right' in pd:
        if rc == 'D' or 'defen' in pd or 'arriere' in pd:
            return ('RB', 'D')
        if rc == 'M' or 'milieu' in pd:
            return ('RM', 'M')
        if rc == 'A' or 'attaquant' in pd or 'ailier' in pd:
            return ('RW', 'A')
    if 'defensif' in pd or 'defensive' in pd:
        return ('DM', 'M')
    if 'offensif' in pd or 'attacking' in pd:
        return ('AM', 'M')
    
    # Fallback by role category
    if rc == 'D':
        return ('CB', 'D')
    if rc == 'M':
        return ('CM', 'M')
    if rc == 'A':
        return ('ST', 'A')
    return ('CM', 'M')

def main():
    print("=" * 75, flush=True)
    print(" 🚀 INGESTION DU MASTER SQUADS & MERCATO SCD2 DANS SQLITE", flush=True)
    print("=" * 75, flush=True)

    conn = sqlite3.connect(DB_PATH)
    from scripts.pipeline.ingest_historical_and_live_matches import init_db_schema_if_needed
    init_db_schema_if_needed(conn)
    cursor = conn.cursor()

    # 1. Clean player/contract tables only (PRESERVING dim_teams)
    cursor.execute("DELETE FROM fct_player_availability;")
    cursor.execute("DELETE FROM fct_match_lineups;")
    cursor.execute("DELETE FROM dim_player_aliases;")
    cursor.execute("DELETE FROM dim_player_contracts_scd2;")
    cursor.execute("DELETE FROM dim_players;")
    conn.commit()

    # 2. Ingest All Squad JSON Files (126 clubs)
    squad_files = glob(os.path.join(SQUADS_DIR, "*.json"))
    print(f"📂 [Ingest:Squads] Analyse de {len(squad_files)} fichiers clubs...", flush=True)

    player_master = {}
    contracts_list = []
    aliases_list = []
    real_players_dict = {}
    flat_players_list = []
    player_counter = 1

    # Load Mercato SCD2 File for overrides
    mercato_scd2_data = []
    if os.path.exists(MERCATO_SCD2_FILE):
        with open(MERCATO_SCD2_FILE, 'r', encoding='utf-8') as f:
            raw_mercato = json.load(f)
            # Filter out any placeholder records
            mercato_scd2_data = [
                m for m in raw_mercato 
                if 'Gardien Titulaire' not in m.get('player_name', '') and 'Défenseur Central' not in m.get('player_name', '')
            ]
    print(f"📄 [Ingest:Mercato] {len(mercato_scd2_data)} mouvements SCD2 authentiques chargés.", flush=True)

    for s_file in squad_files:
        with open(s_file, 'r', encoding='utf-8') as f:
            club_data = json.load(f)

        club_name = club_data.get('club_name')
        club_slug = club_data.get('slug')
        league = club_data.get('league')
        team_id = club_data.get('club_id') or f"CLUB_{club_slug.upper().replace('-', '_')}"

        # Ensure team in dim_teams without erasing logo_local_path
        cursor.execute("""
            INSERT OR IGNORE INTO dim_teams (team_id, league_id, name, short_name, slug, country, stadium_name, logo_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (team_id, league, club_name, club_name, club_slug, club_data.get('country'), club_data.get('stadium'), club_data.get('logo')))

        seasons = club_data.get('seasons', {})
        real_players_dict[club_name] = []

        for season_name, players in seasons.items():
            for p in players:
                raw_name = p.get('name')
                if not raw_name:
                    continue

                tm_id = str(p.get('tm_id')) if p.get('tm_id') else None
                p_slug = slugify(raw_name)
                player_id = f"ply_{p_slug}_{tm_id}" if tm_id else f"ply_{p_slug}"

                pos_code, role_cat = map_detailed_position(p.get('role_category'), p.get('position'))
                
                # Upsert into player_master
                if player_id not in player_master:
                    player_master[player_id] = {
                        'player_id': player_id,
                        'tm_id': tm_id,
                        'api_sports_id': None,
                        'flashscore_slug': p_slug,
                        'full_name': raw_name,
                        'display_name': raw_name,
                        'short_name': f"{raw_name.split()[-1]} {raw_name[0]}." if len(raw_name.split()) > 1 else raw_name,
                        'primary_position': pos_code,
                        'role_category': role_cat,
                        'birth_date': p.get('dob'),
                        'age': p.get('age') or 25,
                        'nationality': p.get('nationality') or 'France',
                        'photo_url': p.get('photo')
                    }

                # Contract SCD2
                m_val_eur = parse_market_value(p.get('market_value'))
                joined_d = p.get('joined_date') or ('2024-07-01' if season_name == '2024-2025' else '2025-07-01' if season_name == '2025-2026' else '2026-07-01')
                left_d = p.get('left_date')
                valid_from = joined_d
                valid_to = left_d
                is_current = 1 if (season_name == '2026-2027' and not left_d and p.get('status') != 'TRANSFERRED') else 0
                
                contract_sk = f"cnt_{player_id}_{team_id}_{season_name.replace('-', '_')}"
                
                contracts_list.append({
                    'contract_sk': contract_sk,
                    'player_id': player_id,
                    'team_id': team_id,
                    'league_id': league,
                    'valid_from': valid_from,
                    'valid_to': valid_to,
                    'is_current': is_current,
                    'squad_number': p.get('number') or 0,
                    'contract_type': 'PERMANENT',
                    'market_value_eur': m_val_eur,
                    'market_value_formatted': p.get('market_value'),
                    'joined_date': joined_d,
                    'contract_until': p.get('contract_until'),
                    'seasons_covered': json.dumps([season_name]),
                    'transfer_note': p.get('status')
                })

                # Aliases
                norm_name = normalize_text(raw_name)
                aliases_list.append((f"als_{player_id}_full", player_id, 'TRANSFERMARKT', raw_name, norm_name, 1.0))
                
                parts = raw_name.split()
                if len(parts) > 1:
                    short_flash = f"{parts[-1]} {parts[0][0]}."
                    aliases_list.append((f"als_{player_id}_fs_short", player_id, 'FLASHSCORE', short_flash, normalize_text(short_flash), 0.95))
                    short_rev = f"{parts[0][0]}. {parts[-1]}"
                    aliases_list.append((f"als_{player_id}_fs_rev", player_id, 'FLASHSCORE', short_rev, normalize_text(short_rev), 0.95))

                # Populate real_players and flat_players for 2026-2027
                if season_name == '2026-2027':
                    p_stats = p.get('stats', {})
                    goals = p_stats.get('goals', 0)
                    assists = p_stats.get('assists', 0)
                    apps = p_stats.get('appearances', 10)
                    rating = round(min(9.8, max(7.0, 7.4 + (goals * 0.2) + (assists * 0.15))), 1)
                    
                    real_players_dict[club_name].append({
                        "name": raw_name,
                        "position": role_cat,
                        "number": p.get('number') or 0,
                        "nationality": p.get('nationality') or 'France',
                        "rating": rating,
                        "mj": apps,
                        "goals": goals,
                        "assists": assists,
                        "photoUrl": p.get('photo')
                    })
                    
                    flat_players_list.append({
                        "id": player_counter,
                        "name": raw_name,
                        "team": club_name,
                        "league": league,
                        "pos": p.get('position') or ('Attaquant' if role_cat == 'A' else 'Milieu' if role_cat == 'M' else 'Défenseur' if role_cat == 'D' else 'Gardien'),
                        "rating": rating,
                        "xG90": round(0.45 if role_cat == 'A' else 0.12, 2),
                        "xA90": round(0.30 if role_cat == 'M' else 0.08, 2),
                        "oddScorer": 2.20 if role_cat == 'A' else 4.80,
                        "oddAssister": 2.60 if role_cat == 'M' else 5.50,
                        "confidence": f"{int(min(96, rating * 10))}%",
                        "photoUrl": p.get('photo'),
                        "goals": goals,
                        "assists": assists,
                        "value": p.get('market_value') or '5.0M €'
                    })
                    player_counter += 1

    # 3. Integrate Mercato Overrides with O(1) Lookup
    norm_to_pid = {normalize_text(pdata['full_name']): pid for pid, pdata in player_master.items()}
    
    # Pre-cache dim_teams lookups
    cursor.execute("SELECT slug, lower(name), team_id FROM dim_teams")
    team_rows = cursor.fetchall()
    team_map = {}
    for s, nm, tid in team_rows:
        team_map[s] = tid
        team_map[nm] = tid

    for m in mercato_scd2_data:
        p_name = m.get('player_name')
        if not p_name:
            continue
        p_norm = normalize_text(p_name)
        matched_p_id = norm_to_pid.get(p_norm)
        
        if not matched_p_id:
            p_slug = slugify(p_name)
            matched_p_id = f"ply_{p_slug}_mercato"
            pos_code, role_cat = map_detailed_position(None, m.get('position'))
            player_master[matched_p_id] = {
                'player_id': matched_p_id,
                'tm_id': None,
                'api_sports_id': None,
                'flashscore_slug': p_slug,
                'full_name': p_name,
                'display_name': p_name,
                'short_name': f"{p_name.split()[-1]} {p_name[0]}." if len(p_name.split()) > 1 else p_name,
                'primary_position': pos_code,
                'role_category': role_cat,
                'birth_date': None,
                'age': 25,
                'nationality': 'France',
                'photo_url': m.get('photoUrl')
            }
            norm_to_pid[p_norm] = matched_p_id

        club_name_m = m.get('club', '')
        c_slug = slugify(club_name_m)
        m_team_id = team_map.get(c_slug) or team_map.get(club_name_m.lower()) or f"CLUB_{c_slug.upper()}"

        v_from = m.get('valid_from') or '2024-07-01'
        v_to = m.get('valid_to')
        is_curr = 1 if m.get('is_current') else 0
        m_seasons = m.get('seasons') or []
        
        contract_sk = f"cnt_{matched_p_id}_{m_team_id}_{v_from.replace('-', '_')}"
        contracts_list.append({
            'contract_sk': contract_sk,
            'player_id': matched_p_id,
            'team_id': m_team_id,
            'league_id': m.get('league') or 'FRA-L1',
            'valid_from': v_from,
            'valid_to': v_to,
            'is_current': is_curr,
            'squad_number': 0,
            'contract_type': 'PERMANENT',
            'market_value_eur': 0.0,
            'market_value_formatted': 'N/A',
            'joined_date': v_from,
            'contract_until': v_to,
            'seasons_covered': json.dumps(m_seasons),
            'transfer_note': m.get('note')
        })

    # 4. Insert Master Players
    print(f"📥 [DB:Insert] Écriture de {len(player_master)} joueurs maîtres dans dim_players...", flush=True)
    cursor.executemany("""
        INSERT OR REPLACE INTO dim_players (
            player_id, tm_id, api_sports_id, flashscore_slug, full_name, display_name,
            short_name, primary_position, role_category, birth_date, age, nationality, photo_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [(
        p['player_id'], p['tm_id'], p['api_sports_id'], p['flashscore_slug'],
        p['full_name'], p['display_name'], p['short_name'], p['primary_position'],
        p['role_category'], p['birth_date'], p['age'], p['nationality'], p['photo_url']
    ) for p in player_master.values()])

    # 5. Insert Contracts
    print(f"📥 [DB:Insert] Écriture de {len(contracts_list)} contrats SCD2...", flush=True)
    unique_contracts = {}
    for c in contracts_list:
        unique_contracts[c['contract_sk']] = c

    cursor.executemany("""
        INSERT OR REPLACE INTO dim_player_contracts_scd2 (
            contract_sk, player_id, team_id, league_id, valid_from, valid_to,
            is_current, squad_number, contract_type, market_value_eur,
            market_value_formatted, joined_date, contract_until, seasons_covered, transfer_note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [(
        c['contract_sk'], c['player_id'], c['team_id'], c['league_id'],
        c['valid_from'], c['valid_to'], c['is_current'], c['squad_number'],
        c['contract_type'], c['market_value_eur'], c['market_value_formatted'],
        c['joined_date'], c['contract_until'], c['seasons_covered'], c['transfer_note']
    ) for c in unique_contracts.values()])

    # 6. Insert Aliases
    print(f"📥 [DB:Insert] Écriture de {len(aliases_list)} alias de résolution d'entités...", flush=True)
    unique_aliases = {a[0]: a for a in aliases_list}
    cursor.executemany("""
        INSERT OR REPLACE INTO dim_player_aliases (
            alias_id, player_id, source_system, raw_name, normalized_name, confidence_score
        ) VALUES (?, ?, ?, ?, ?, ?)
    """, list(unique_aliases.values()))

    conn.commit()

    # 7. Update real_players.json and players.json
    write_json_atomic(REAL_PLAYERS_FILE, real_players_dict)
    print(f"✅ src/data/real_players.json synchronisé ({len(real_players_dict)} clubs).", flush=True)

    write_json_atomic(PLAYERS_FILE, flat_players_list)
    print(f"✅ src/data/players.json synchronisé ({len(flat_players_list)} joueurs).", flush=True)

    # 8. Update squads_mercato_scd2.json with cleaned dataset
    write_json_atomic(MERCATO_SCD2_FILE, mercato_scd2_data)
    print(f"✅ src/data/squads_mercato_scd2.json synchronisé ({len(mercato_scd2_data)} mouvements réels).", flush=True)

    # 9. Stats check
    cursor.execute("SELECT COUNT(*) FROM dim_players;")
    total_players = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM dim_player_contracts_scd2 WHERE is_current = 1;")
    active_contracts = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM dim_player_aliases;")
    total_aliases = cursor.fetchone()[0]

    print("=" * 75, flush=True)
    print(f"🎉 SUCCÈS : Base Master Squads synchronisée dans SQLite !", flush=True)
    print(f"   ├─ Joueurs uniques (dim_players) : {total_players}", flush=True)
    print(f"   ├─ Contrats actifs 2026-2027 (is_current = 1) : {active_contracts}", flush=True)
    print(f"   └─ Alias réconciliés (dim_player_aliases) : {total_aliases}", flush=True)
    print("=" * 75, flush=True)

    conn.close()

if __name__ == "__main__":
    main()
