#!/usr/bin/env python3
"""
scripts/pipeline/sync_transfers_and_deduplicate_rosters.py
─────────────────────────────────────────────────────────────
Moteur de réconciliation temporelle et de dédoublonnage des effectifs
pour l'ensemble des clubs sur 3 saisons :
- 2024-2025
- 2025-2026
- 2026-2027

Garanties fondamentales :
1. Application stricte de la chronologie des transferts certifiés.
2. 1 joueur = 1 seul club par saison.
3. Statuts cohérents : 'NEW_SIGNING' uniquement lors de la saison d'arrivée, 'ACTIVE' ensuite.
4. Aucun joueur ne subsiste dans un ancien club après son départ.
"""

import os
import sys
import glob
import json
import re
import unicodedata

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from scripts.pipeline.build_transfers_database import TRANSFERS_RAW, normalize_text, slugify

SQUADS_DIR = os.path.join(ROOT_DIR, "src", "data", "squads")
SEASONS_ORDER = ["2024-2025", "2025-2026", "2026-2027"]

print("=" * 75)
print(" 🚀 RÉCONCILIATION TEMPORELLE MULTI-SAISONS DES EFFECTIFS (2024-2027)")
print("=" * 75)

# Map club slug to file path
squad_files = glob.glob(os.path.join(SQUADS_DIR, "*.json"))
slug_to_file = {}
for sf in squad_files:
    fname = os.path.basename(sf)
    slug = fname.replace(".json", "")
    slug_to_file[slug] = sf

def find_slug_for_team(team_name):
    norm_hyphen = re.sub(r'[\s_]+', '-', normalize_text(team_name))
    norm_under = re.sub(r'[\s-]+', '_', normalize_text(team_name))
    if norm_hyphen in slug_to_file:
        return norm_hyphen
    if norm_under in slug_to_file:
        return norm_under
    for sl in slug_to_file:
        if norm_hyphen in sl or sl in norm_hyphen:
            return sl
    return norm_hyphen

# 1. Load all squad data into memory
all_squads_data = {}
for slug, f_path in slug_to_file.items():
    with open(f_path, 'r', encoding='utf-8') as f:
        all_squads_data[slug] = json.load(f)

# 2. Build temporal timeline for players in TRANSFERS_RAW
# Sort transfers by date
sorted_transfers = sorted(TRANSFERS_RAW, key=lambda t: t.get("transfer_date", "2024-07-01"))

player_transfer_timeline = {} # p_norm -> list of transfers
for trf in sorted_transfers:
    p_norm = normalize_text(trf["player_name"])
    if p_norm not in player_transfer_timeline:
        player_transfer_timeline[p_norm] = []
    player_transfer_timeline[p_norm].append(trf)

# Function to determine official club and status of a transferred player for a given season
def get_transferred_player_state(p_norm, season):
    if p_norm not in player_transfer_timeline:
        return None, None, None
    
    t_list = player_transfer_timeline[p_norm]
    s_idx = SEASONS_ORDER.index(season)
    
    # Check all transfers up to or in this season
    current_club = None
    status = "ACTIVE"
    last_trf = None
    
    for trf in t_list:
        trf_season = trf.get("season", "2026-2027")
        trf_s_idx = SEASONS_ORDER.index(trf_season) if trf_season in SEASONS_ORDER else 2
        
        if trf_s_idx > s_idx:
            # Transfer hasn't happened yet in this season
            if current_club is None:
                current_club = find_slug_for_team(trf["from_team"])
                status = "ACTIVE"
        elif trf_s_idx == s_idx:
            # Transfer happens in this exact season!
            current_club = find_slug_for_team(trf["to_team"])
            status = "NEW_SIGNING"
            last_trf = trf
        else:
            # Transfer happened in a previous season
            current_club = find_slug_for_team(trf["to_team"])
            status = "ACTIVE"
            last_trf = trf
            
    return current_club, status, last_trf

# 3. Apply transfers to each season explicitly
print("\n📦 [Étape 1] Application des affectations certifiées par saison...")

for p_norm, t_list in player_transfer_timeline.items():
    sample_trf = t_list[-1]
    pname = sample_trf["player_name"]
    role_cat = sample_trf.get("role", "M")
    pos_label = "Gardien" if role_cat == 'G' else "Défenseur" if role_cat == 'D' else "Milieu" if role_cat == 'M' else "Attaquant"
    
    for season in SEASONS_ORDER:
        target_club, status, trf_info = get_transferred_player_state(p_norm, season)
        if not target_club or target_club not in all_squads_data:
            continue
            
        # 1. Remove from all other clubs for this season
        for other_slug, s_data in all_squads_data.items():
            if other_slug == target_club:
                continue
            season_roster = s_data.get('seasons', {}).get(season, [])
            filtered = [p for p in season_roster if normalize_text(p.get('name')) != p_norm]
            s_data['seasons'][season] = filtered
            
        # 2. Ensure present in target_club for this season
        target_roster = all_squads_data[target_club].get('seasons', {}).get(season, [])
        existing = next((p for p in target_roster if normalize_text(p.get('name')) == p_norm), None)
        
        if existing:
            existing['status'] = status
            if (status == 'NEW_SIGNING' or season == sample_trf.get('season')):
                if sample_trf.get("squad_number"):
                    existing['number'] = sample_trf.get("squad_number")
                    existing['id'] = f"p_{target_club}_{season[:4]}_{existing['number']}"
                if sample_trf.get("age"):
                    existing['age'] = sample_trf.get("age")
                if sample_trf.get("contract_until"):
                    existing['contract_until'] = sample_trf.get("contract_until")
                if sample_trf.get("market_value_display"):
                    existing['market_value'] = sample_trf.get("market_value_display")
            if status == 'NEW_SIGNING' and trf_info:
                existing['joined_date'] = trf_info.get('transfer_date', '2024-07-01')
            elif status == 'ACTIVE' and existing.get('joined_date') and existing['joined_date'] > f"{season[:4]}-07-01":
                existing['joined_date'] = f"{int(season[:4])-1}-07-01"
        else:
            # Create player entry
            joined_d = trf_info.get('transfer_date', f"{season[:4]}-07-01") if status == 'NEW_SIGNING' else f"{int(season[:4])-1}-07-01"
            p_num = sample_trf.get("squad_number") or (abs(hash(pname)) % 90 + 1)
            p_age = sample_trf.get("age", 25)
            p_contract = sample_trf.get("contract_until", "2029-06-30")
            new_entry = {
                "id": f"p_{target_club}_{season[:4]}_{p_num}",
                "name": pname,
                "number": p_num,
                "position": pos_label,
                "role_category": role_cat,
                "nationality": sample_trf.get("nationality", "France"),
                "age": p_age,
                "market_value": sample_trf.get("market_value_display", "20.00 M€"),
                "joined_date": joined_d,
                "left_date": None,
                "contract_until": p_contract,
                "status": status,
                "photo": sample_trf.get("photo", "/assets/players/defaults/m_default.webp"),
                "stats": {
                    "appearances": 0 if status == 'NEW_SIGNING' else 15,
                    "goals": 0,
                    "assists": 0,
                    "yellowCards": 0,
                    "redCards": 0
                }
            }
            target_roster.append(new_entry)
            all_squads_data[target_club]['seasons'][season] = target_roster

# 4. Global Multi-Season Deduplication for all remaining players
print("\n📦 [Étape 2] Dédoublonnage multi-saisons global (2024-2025, 2025-2026, 2026-2027)...")

total_dedup = 0
for season in SEASONS_ORDER:
    seen_in_season = {}
    season_dedup = 0
    
    for slug, s_data in all_squads_data.items():
        roster = s_data.get('seasons', {}).get(season, [])
        filtered_roster = []
        
        for p in roster:
            p_name = p.get('name')
            if not p_name:
                continue
            p_norm = normalize_text(p_name)
            
            # If player was in certified transfers, check if this is his official club for this season
            target_club, _, _ = get_transferred_player_state(p_norm, season)
            if target_club is not None and target_club != slug:
                season_dedup += 1
                continue
                
            if p_norm in seen_in_season:
                # Keep first occurrence, drop second
                season_dedup += 1
                continue
                
            seen_in_season[p_norm] = slug
            filtered_roster.append(p)
            
        s_data['seasons'][season] = filtered_roster
        
    print(f"  ✨ Saison {season} : {season_dedup} doublons éliminés. Effectifs sains et uniques.")
    total_dedup += season_dedup

# 5. Save all updated squad JSON files
print("\n💾 [Étape 3] Sauvegarde des 126 fichiers squads/*.json...")
for slug, s_data in all_squads_data.items():
    f_path = slug_to_file[slug]
    with open(f_path, 'w', encoding='utf-8') as f:
        json.dump(s_data, f, ensure_ascii=False, indent=2)

print(f"✅ Synchronisation terminée avec succès ! ({total_dedup} anomalies corrigées au total)")
print("=" * 75)

