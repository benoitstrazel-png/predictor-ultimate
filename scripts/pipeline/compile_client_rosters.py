#!/usr/bin/env python3
"""
scripts/pipeline/compile_client_rosters.py
─────────────────────────────────────────────────────────────
Compilateur Fast-Layer & Exportateur Production :
Interroge la Source Unique de Vérité SQLite (predictor_v2.db) et produit :
1. src/data/compiled/players_master_registry.json
2. src/data/compiled/squads_unified_scd2.json
3. src/data/compiled/lineups_master.json
4. Synchronisation rétrocompatible de real_players.json, players.json,
   player_positions_tm.json et squads_mercato_scd2.json.
"""

import os
import sys
import json
import sqlite3

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(ROOT_DIR, "predictor_v2.db")
COMPILED_DIR = os.path.join(ROOT_DIR, "src", "data", "compiled")
os.makedirs(COMPILED_DIR, exist_ok=True)

PLAYERS_MASTER_OUT = os.path.join(COMPILED_DIR, "players_master_registry.json")
SQUADS_SCD2_OUT = os.path.join(COMPILED_DIR, "squads_unified_scd2.json")
LINEUPS_MASTER_OUT = os.path.join(COMPILED_DIR, "lineups_master.json")
TRANSFERS_MASTER_OUT = os.path.join(COMPILED_DIR, "transfers_enriched_master.json")
COACHES_MASTER_OUT = os.path.join(COMPILED_DIR, "coaches_master_registry.json")
COACHES_SCD2_OUT = os.path.join(COMPILED_DIR, "coaches_unified_scd2.json")

# Legacy compatibility destinations
REAL_PLAYERS_LEGACY = os.path.join(ROOT_DIR, "src", "data", "real_players.json")
PLAYERS_LEGACY = os.path.join(ROOT_DIR, "src", "data", "players.json")
TM_POSITIONS_LEGACY = os.path.join(ROOT_DIR, "src", "data", "player_positions_tm.json")
MERCATO_LEGACY = os.path.join(ROOT_DIR, "src", "data", "squads_mercato_scd2.json")

print("=" * 75)
print(" 🚀 COMPILATEUR FAST-LAYER : EXPORT DES ARTEFACTS CLIENTS V2")
print("=" * 75)

conn = sqlite3.connect(DB_PATH)

from scripts.pipeline.ingest_historical_and_live_matches import init_db_schema_if_needed
init_db_schema_if_needed(conn)

cursor = conn.cursor()

# 1. Compile Players Master Registry
print("📦 [Compile:1] Génération de players_master_registry.json...")
cursor.execute("""
    SELECT 
        p.player_id, p.tm_id, p.api_sports_id, p.full_name, p.display_name,
        p.short_name, p.primary_position, p.role_category, p.age, p.nationality,
        p.photo_url, t.team_id, t.name as team_name, t.slug as team_slug, t.league_id,
        c.squad_number, c.market_value_formatted, c.is_current, c.valid_from, c.valid_to
    FROM dim_players p
    LEFT JOIN dim_player_contracts_scd2 c ON p.player_id = c.player_id AND c.is_current = 1
    LEFT JOIN dim_teams t ON c.team_id = t.team_id
""")

players_registry = {}
legacy_players_list = []
legacy_real_players_dict = {}
legacy_positions_dict = {}

for row in cursor.fetchall():
    (pid, tm_id, api_id, full_name, disp_name, short_name, pos_code, role_cat,
     age, nat, photo, team_id, team_name, team_slug, league, num, m_val, is_curr, v_from, v_to) = row
    
    t_name = team_name or "Sans Club"
    t_slug = team_slug or "free-agent"
    t_league = league or "FRA-L1"

    player_obj = {
        "player_id": pid,
        "tm_id": tm_id,
        "api_sports_id": api_id,
        "name": full_name,
        "displayName": disp_name,
        "shortName": short_name,
        "position": pos_code,
        "role": role_cat,
        "team": t_name,
        "teamSlug": t_slug,
        "league": t_league,
        "number": num or 0,
        "age": age or 25,
        "nationality": nat or "France",
        "marketValue": m_val or "N/A",
        "photoUrl": photo or "https://media.api-sports.io/football/players/placeholder.png",
        "isCurrent": bool(is_curr),
        "validFrom": v_from,
        "validTo": v_to
    }
    players_registry[pid] = player_obj

    # Legacy players.json format
    legacy_players_list.append({
        "name": full_name,
        "team": t_name,
        "league": t_league,
        "pos": "Gardien" if role_cat == 'G' else "Défenseur" if role_cat == 'D' else "Milieu" if role_cat == 'M' else "Attaquant",
        "number": num or 0,
        "nationality": nat or "France",
        "rating": 7.8 if role_cat == 'G' else 8.0,
        "xG90": 0.15 if role_cat != 'A' else 0.45,
        "xA90": 0.10 if role_cat != 'M' else 0.35,
        "oddScorer": 4.5 if role_cat != 'A' else 2.1,
        "oddAssist": 5.0 if role_cat != 'M' else 2.8,
        "confidence": "90%",
        "photoUrl": photo or "https://media.api-sports.io/football/players/placeholder.png"
    })

    # Legacy real_players.json format
    if t_name not in legacy_real_players_dict:
        legacy_real_players_dict[t_name] = []
    legacy_real_players_dict[t_name].append({
        "name": full_name,
        "position": role_cat,
        "number": num or 0,
        "nationality": nat or "France",
        "rating": 7.8,
        "mj": 1,
        "goals": 0,
        "assists": 0,
        "photoUrl": photo or "https://media.api-sports.io/football/players/placeholder.png"
    })

    # Legacy player_positions_tm.json format
    legacy_positions_dict[full_name] = {
        "main": "Gardien de but" if role_cat == 'G' else "Défenseur central" if role_cat == 'D' else "Milieu central" if role_cat == 'M' else "Attaquant",
        "detail": "Gardien" if role_cat == 'G' else "Défenseur" if role_cat == 'D' else "Milieu" if role_cat == 'M' else "Attaquant"
    }

with open(PLAYERS_MASTER_OUT, 'w', encoding='utf-8') as f:
    json.dump(players_registry, f, ensure_ascii=False, indent=2)

# 2. Compile Unified SCD2 Squads (Multi-Season)
print("📦 [Compile:2] Génération de squads_unified_scd2.json...")
cursor.execute("""
    SELECT 
        c.contract_sk, c.player_id, p.full_name, p.role_category, p.primary_position,
        t.name as club_name, t.slug as club_slug, c.league_id, c.valid_from, c.valid_to,
        c.is_current, c.squad_number, c.market_value_formatted, c.joined_date,
        c.contract_until, c.seasons_covered, c.transfer_note, p.photo_url
    FROM dim_player_contracts_scd2 c
    JOIN dim_players p ON c.player_id = p.player_id
    JOIN dim_teams t ON c.team_id = t.team_id
    ORDER BY t.name, c.is_current DESC, p.full_name
""")

unified_scd2_records = []
legacy_mercato_list = []

for row in cursor.fetchall():
    (c_sk, pid, pname, role_cat, pos_code, club_name, club_slug, league,
     v_from, v_to, is_curr, num, m_val, joined_d, until_d, seasons_raw, note, photo) = row
    
    seasons_list = json.loads(seasons_raw) if seasons_raw else ["2026-2027"]
    
    rec = {
        "contract_id": c_sk,
        "player_id": pid,
        "player_name": pname,
        "position": "Gardien" if role_cat == 'G' else "Défenseur" if role_cat == 'D' else "Milieu" if role_cat == 'M' else "Attaquant",
        "position_code": pos_code,
        "role_category": role_cat,
        "club": club_name,
        "club_slug": club_slug,
        "league": league,
        "valid_from": v_from,
        "valid_to": v_to,
        "is_current": bool(is_curr),
        "number": num or 0,
        "market_value": m_val,
        "seasons": seasons_list,
        "note": note or "",
        "photoUrl": photo or "https://media.api-sports.io/football/players/placeholder.png"
    }
    unified_scd2_records.append(rec)

    # Legacy mercato format
    legacy_mercato_list.append({
        "player_name": pname,
        "position": rec["position"],
        "club": club_name,
        "league": league,
        "valid_from": v_from,
        "valid_to": v_to,
        "is_current": bool(is_curr),
        "seasons": seasons_list,
        "note": note or "",
        "photoUrl": photo
    })

with open(SQUADS_SCD2_OUT, 'w', encoding='utf-8') as f:
    json.dump(unified_scd2_records, f, ensure_ascii=False, indent=2)

# 3. Compile Master Lineups with Grid Coordinates
print("📦 [Compile:3] Génération de lineups_master.json...")
cursor.execute("""
    SELECT 
        l.match_id, l.competition_code, l.season, l.round_label,
        t.name as home_team, opp.name as away_team, l.is_home,
        l.player_id, p.full_name, p.photo_url, l.lineup_type,
        l.pitch_position_code, l.role_category, l.grid_row, l.grid_col,
        l.jersey_number, l.rating
    FROM fct_match_lineups l
    JOIN dim_players p ON l.player_id = p.player_id
    JOIN dim_teams t ON l.team_id = t.team_id
    JOIN dim_teams opp ON l.opponent_team_id = opp.team_id
    ORDER BY l.match_id, l.is_home DESC, l.lineup_type, l.grid_row, l.grid_col
""")

matches_lineups_dict = {}
for row in cursor.fetchall():
    (mid, comp, season, round_lbl, home_t, away_t, is_home,
     pid, pname, photo, l_type, pos_code, role_cat, r_row, r_col, j_num, rating) = row
    
    if mid not in matches_lineups_dict:
        matches_lineups_dict[mid] = {
            "match_id": mid,
            "competition": comp,
            "season": season,
            "round": round_lbl,
            "homeTeam": home_t,
            "awayTeam": away_t,
            "homeStarters": [],
            "homeSubs": [],
            "awayStarters": [],
            "awaySubs": []
        }
    
    player_entry = {
        "player_id": pid,
        "name": pname,
        "pos": role_cat,
        "positionCode": pos_code,
        "grid": {"row": r_row, "col": r_col},
        "number": j_num,
        "rating": float(rating or 7.5),
        "photoUrl": photo or "https://media.api-sports.io/football/players/placeholder.png"
    }

    if is_home:
        if l_type == 'STARTER':
            matches_lineups_dict[mid]["homeStarters"].append(player_entry)
        else:
            matches_lineups_dict[mid]["homeSubs"].append(player_entry)
    else:
        if l_type == 'STARTER':
            matches_lineups_dict[mid]["awayStarters"].append(player_entry)
        else:
            matches_lineups_dict[mid]["awaySubs"].append(player_entry)

compiled_lineups_list = list(matches_lineups_dict.values())
with open(LINEUPS_MASTER_OUT, 'w', encoding='utf-8') as f:
    json.dump(compiled_lineups_list, f, ensure_ascii=False, indent=2)

# 4. Compile Enriched Player Transfers
print("📦 [Compile:4] Génération de transfers_enriched_master.json...")
cursor.execute("""
    SELECT 
        transfer_id, player_id, player_name, player_display_name, player_position,
        player_role, player_nationality, player_nationality_code, player_nationality_flag,
        player_photo_url, from_team_id, from_team_name, from_team_logo, from_team_league,
        to_team_id, to_team_name, to_team_logo, to_team_league, transfer_date,
        season, mercato_window, transfer_type, transfer_type_label, fee_numeric_eur,
        fee_display, market_value_eur, market_value_display, fee_value_delta_eur,
        age_at_transfer, preferred_foot, transfer_notes
    FROM fct_player_transfers
    ORDER BY transfer_date DESC, fee_numeric_eur DESC
""")

compiled_transfers = []
for row in cursor.fetchall():
    (trf_id, pid, pname, pdisp, pos, role, nat, nat_code, flag,
     photo, f_tid, f_name, f_logo, f_league, t_tid, t_name, t_logo, t_league,
     t_date, season, window, trf_type, trf_type_lbl, fee_num, fee_disp,
     mv_num, mv_disp, delta_num, age_at_trf, foot, notes) = row

    # Format date as JJ/MM/AAAA
    try:
        dt = datetime.strptime(t_date, "%Y-%m-%d")
        t_date_fmt = dt.strftime("%d/%m/%Y")
    except Exception:
        t_date_fmt = t_date

    trf_obj = {
        "transfer_id": trf_id,
        "player_id": pid,
        "player_name": pname,
        "player_display_name": pdisp,
        "player_position": pos,
        "player_role": role,
        "player_nationality": nat,
        "player_nationality_code": nat_code,
        "player_nationality_flag": flag,
        "player_photo_url": photo,
        "from_team_id": f_tid,
        "from_team_name": f_name,
        "from_team_logo": f_logo,
        "from_team_league": f_league,
        "to_team_id": t_tid,
        "to_team_name": t_name,
        "to_team_logo": t_logo,
        "to_team_league": t_league,
        "transfer_date": t_date,
        "transfer_date_formatted": t_date_fmt,
        "season": season,
        "mercato_window": window,
        "mercato_window_label": "Mercato Estival" if window == 'SUMMER' else "Mercato Hivernal",
        "transfer_type": trf_type,
        "transfer_type_label": trf_type_lbl,
        "fee_numeric_eur": float(fee_num or 0),
        "fee_display": fee_disp,
        "market_value_eur": float(mv_num or 0),
        "market_value_display": mv_disp,
        "fee_value_delta_eur": float(delta_num or 0),
        "age_at_transfer": age_at_trf,
        "preferred_foot": foot or "Droitier",
        "transfer_notes": notes or ""
    }
    compiled_transfers.append(trf_obj)

with open(TRANSFERS_MASTER_OUT, 'w', encoding='utf-8') as f:
    json.dump(compiled_transfers, f, ensure_ascii=False, indent=2)

# 5. Compile Coaches Master Registry & SCD2 Contracts
print("📦 [Compile:5] Génération de coaches_master_registry.json & coaches_unified_scd2.json...")
cursor.execute("""
    SELECT 
        coach_id, fotmob_id, api_sports_id, full_name, display_name,
        short_name, birth_date, age, nationality, nationality_code,
        nationality_flag, photo_url, preferred_formation
    FROM dim_coaches
    ORDER BY full_name ASC
""")

coaches_registry = {}
for row in cursor.fetchall():
    (cid, fotmob_id, api_id, fname, dname, sname, bdate, age, nat, ncode, nflag, photo, form) = row
    coaches_registry[cid] = {
        "coach_id": cid,
        "fotmob_id": fotmob_id,
        "api_sports_id": api_id,
        "full_name": fname,
        "display_name": dname,
        "short_name": sname,
        "birth_date": bdate,
        "age": age,
        "nationality": nat,
        "nationality_code": ncode,
        "nationality_flag": nflag,
        "photo_url": photo,
        "preferred_formation": form or "4-3-3"
    }

with open(COACHES_MASTER_OUT, 'w', encoding='utf-8') as f:
    json.dump(coaches_registry, f, ensure_ascii=False, indent=2)

cursor.execute("""
    SELECT 
        csk.contract_sk, csk.coach_id, csk.team_id, csk.team_name, csk.team_logo,
        csk.league_id, csk.valid_from, csk.valid_to, csk.is_current, csk.role_title,
        csk.contract_status, csk.seasons_covered, csk.matches_count, csk.wins,
        csk.draws, csk.losses, csk.win_rate_pct, csk.points_per_match, csk.appointment_notes,
        c.full_name, c.nationality, c.nationality_flag, c.photo_url, c.age, c.preferred_formation
    FROM dim_coach_contracts_scd2 csk
    JOIN dim_coaches c ON csk.coach_id = c.coach_id
    ORDER BY csk.valid_from DESC, csk.matches_count DESC
""")

compiled_coach_contracts = []
for row in cursor.fetchall():
    (csk_id, cid, tid, tname, tlogo, league, vfrom, vto, is_curr, role,
     status, seasons_json, m_cnt, wins, draws, losses, wrate, ppm, notes,
     cname, cnat, cflag, cphoto, cage, cform) = row
    
    try:
        seasons_arr = json.loads(seasons_json)
    except Exception:
        seasons_arr = ["2024-2025"]

    contract_obj = {
        "contract_sk": csk_id,
        "coach_id": cid,
        "coach_name": cname,
        "team_id": tid,
        "team_name": tname,
        "team_logo": tlogo,
        "league_id": league,
        "valid_from": vfrom,
        "valid_to": vto,
        "is_current": bool(is_curr),
        "role_title": role,
        "contract_status": status,
        "seasons_covered": seasons_arr,
        "matches_count": m_cnt,
        "wins": wins,
        "draws": draws,
        "losses": losses,
        "win_rate_pct": float(wrate or 0),
        "points_per_match": float(ppm or 0),
        "appointment_notes": notes,
        "nationality": cnat,
        "nationality_flag": cflag,
        "photo_url": cphoto,
        "age": cage,
        "preferred_formation": cform or "4-3-3"
    }
    compiled_coach_contracts.append(contract_obj)

with open(COACHES_SCD2_OUT, 'w', encoding='utf-8') as f:
    json.dump(compiled_coach_contracts, f, ensure_ascii=False, indent=2)

# 6. Export Legacy Files for 100% Backward Compatibility
print("🔄 [Legacy:Bridge] Écriture des fichiers de rétrocompatibilité...")
with open(REAL_PLAYERS_LEGACY, 'w', encoding='utf-8') as f:
    json.dump(legacy_real_players_dict, f, ensure_ascii=False, indent=2)

with open(PLAYERS_LEGACY, 'w', encoding='utf-8') as f:
    json.dump(legacy_players_list, f, ensure_ascii=False, indent=2)

with open(TM_POSITIONS_LEGACY, 'w', encoding='utf-8') as f:
    json.dump(legacy_positions_dict, f, ensure_ascii=False, indent=2)

with open(MERCATO_LEGACY, 'w', encoding='utf-8') as f:
    json.dump(legacy_mercato_list, f, ensure_ascii=False, indent=2)

print("=" * 75)
print(f"🎉 SUCCÈS : Compilation Fast-Layer V2 terminée avec succès !")
print(f"   ├─ Registre Joueurs : {PLAYERS_MASTER_OUT} ({len(players_registry)} profils)")
print(f"   ├─ Effectifs SCD2 : {SQUADS_SCD2_OUT} ({len(unified_scd2_records)} contrats)")
print(f"   ├─ Compositions : {LINEUPS_MASTER_OUT} ({len(compiled_lineups_list)} matchs)")
print(f"   ├─ Focus Transferts : {TRANSFERS_MASTER_OUT} ({len(compiled_transfers)} mouvements enrichis)")
print(f"   ├─ Registre Entraîneurs : {COACHES_MASTER_OUT} ({len(coaches_registry)} coachs)")
print(f"   ├─ Mandats Entraîneurs SCD2 : {COACHES_SCD2_OUT} ({len(compiled_coach_contracts)} mandats)")
print(f"   └─ Fichiers Legacy synchronisés (real_players.json, players.json, tm_positions)")
print("=" * 75)

conn.close()
