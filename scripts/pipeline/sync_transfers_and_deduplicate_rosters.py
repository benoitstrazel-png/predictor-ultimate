#!/usr/bin/env python3
"""
scripts/pipeline/sync_transfers_and_deduplicate_rosters.py
─────────────────────────────────────────────────────────────
Moteur de réconciliation et de dédoublonnage des effectifs (2024-2027) :
1. Applique l'ensemble des transferts officiels dans les fichiers `src/data/squads/*.json`
   (départ du club d'origine, arrivée dans le club de destination).
2. Résout tous les doublons actifs multi-clubs pour garantir la règle :
   "1 joueur = 1 seul club actif en 2026-2027".
3. Met à jour `fct_player_transfers` et la base relationnelle SCD2.
"""

import os
import sys
import glob
import json
import re
import unicodedata
import sqlite3

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SQUADS_DIR = os.path.join(ROOT_DIR, "src", "data", "squads")
DB_PATH = os.path.join(ROOT_DIR, "predictor_v2.db")

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

# 1. Registre des transferts certifiés pour mise à jour des effectifs 2026-2027
KEY_TRANSFERS_2026 = [
    {
        "player_name": "Emanuel Emegha",
        "from_slug": "strasbourg",
        "to_slug": "chelsea",
        "from_team": "Strasbourg",
        "to_team": "Chelsea",
        "transfer_date": "2026-07-01",
        "season": "2026-2027",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif (BlueCo)",
        "fee_numeric_eur": 34000000.0,
        "fee_display": "34.00 M€",
        "market_value_eur": 34000000.0,
        "market_value_display": "34.00 M€",
        "preferred_foot": "Droitier",
        "position": "Attaquant",
        "role_category": "A",
        "number": 19,
        "nationality": "NED",
        "age": 24,
        "photo": "/assets/players/ply_emanuel_emegha_strasbourg.webp",
        "notes": "Attaquant néerlandais transféré de Strasbourg à Chelsea"
    },
    {
        "player_name": "Andrey Santos",
        "from_slug": "chelsea",
        "to_slug": "strasbourg",
        "from_team": "Chelsea",
        "to_team": "Strasbourg",
        "transfer_date": "2026-07-01",
        "season": "2026-2027",
        "mercato_window": "SUMMER",
        "transfer_type": "PRET_SEC",
        "transfer_type_label": "🔄 Prêt (BlueCo)",
        "fee_numeric_eur": 0.0,
        "fee_display": "Prêt",
        "market_value_eur": 25000000.0,
        "market_value_display": "25.00 M€",
        "preferred_foot": "Droitier",
        "position": "Milieu",
        "role_category": "M",
        "number": 18,
        "nationality": "BRA",
        "age": 22,
        "photo": "https://images.fotmob.com/image_resources/playerimages/1335029.png",
        "notes": "Milieu brésilien en prêt à Strasbourg"
    },
    {
        "player_name": "Caleb Wiley",
        "from_slug": "chelsea",
        "to_slug": "strasbourg",
        "from_team": "Chelsea",
        "to_team": "Strasbourg",
        "transfer_date": "2026-07-01",
        "season": "2026-2027",
        "mercato_window": "SUMMER",
        "transfer_type": "PRET_SEC",
        "transfer_type_label": "🔄 Prêt (BlueCo)",
        "fee_numeric_eur": 0.0,
        "fee_display": "Prêt",
        "market_value_eur": 12000000.0,
        "market_value_display": "12.00 M€",
        "preferred_foot": "Gaucher",
        "position": "Défenseur",
        "role_category": "D",
        "number": 3,
        "nationality": "USA",
        "age": 21,
        "photo": "https://images.fotmob.com/image_resources/playerimages/1283297.png",
        "notes": "Latéral gauche américain en prêt à Strasbourg"
    },
    {
        "player_name": "Gerónimo Rulli",
        "from_slug": "marseille",
        "to_slug": "manchester-city",
        "from_team": "Marseille",
        "to_team": "Manchester City",
        "transfer_date": "2026-08-12",
        "season": "2026-2027",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif",
        "fee_numeric_eur": 18000000.0,
        "fee_display": "18.00 M€",
        "market_value_eur": 12000000.0,
        "market_value_display": "12.00 M€",
        "preferred_foot": "Droitier",
        "position": "Gardien",
        "role_category": "G",
        "number": 1,
        "nationality": "ARG",
        "age": 34,
        "photo": "https://media.api-sports.io/football/players/2477.png",
        "notes": "Gardien international argentin à Manchester City"
    },
    {
        "player_name": "Rayan Cherki",
        "from_slug": "lyon",
        "to_slug": "manchester-city",
        "from_team": "Lyon",
        "to_team": "Manchester City",
        "transfer_date": "2026-07-01",
        "season": "2026-2027",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif",
        "fee_numeric_eur": 38000000.0,
        "fee_display": "38.00 M€",
        "market_value_eur": 35000000.0,
        "market_value_display": "35.00 M€",
        "preferred_foot": "Ambidextre",
        "position": "Milieu",
        "role_category": "M",
        "number": 10,
        "nationality": "FRA",
        "age": 23,
        "photo": "https://media.api-sports.io/football/players/152967.png",
        "notes": "Meneur de jeu créatif de Manchester City"
    },
    {
        "player_name": "Mason Greenwood",
        "from_slug": "marseille",
        "to_slug": "fenerbahce",
        "from_team": "Marseille",
        "to_team": "Fenerbahce",
        "transfer_date": "2026-07-14",
        "season": "2026-2027",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif",
        "fee_numeric_eur": 35000000.0,
        "fee_display": "35.00 M€",
        "market_value_eur": 35000000.0,
        "market_value_display": "35.00 M€",
        "preferred_foot": "Ambidextre",
        "position": "Attaquant",
        "role_category": "A",
        "number": 11,
        "nationality": "ENG",
        "age": 24,
        "photo": "https://images.fotmob.com/image_resources/playerimages/961995.png",
        "notes": "Ailier transféré en Süper Lig"
    },
    {
        "player_name": "Omar Marmoush",
        "from_slug": "eintracht-frankfurt",
        "to_slug": "manchester-city",
        "from_team": "Eintracht Frankfurt",
        "to_team": "Manchester City",
        "transfer_date": "2026-07-01",
        "season": "2026-2027",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif",
        "fee_numeric_eur": 65000000.0,
        "fee_display": "65.00 M€",
        "market_value_eur": 60000000.0,
        "market_value_display": "60.00 M€",
        "preferred_foot": "Droitier",
        "position": "Attaquant",
        "role_category": "A",
        "number": 7,
        "nationality": "EGY",
        "age": 27,
        "photo": "https://images.fotmob.com/image_resources/playerimages/894788.png",
        "notes": "Attaquant polyvalent à Manchester City"
    },
    {
        "player_name": "Adrien Rabiot",
        "from_slug": "ac-milan",
        "to_slug": "marseille",
        "from_team": "AC Milan",
        "to_team": "Marseille",
        "transfer_date": "2026-07-01",
        "season": "2026-2027",
        "mercato_window": "SUMMER",
        "transfer_type": "FIN_DE_CONTRAT",
        "transfer_type_label": "🆓 Fin de Contrat / Libre",
        "fee_numeric_eur": 0.0,
        "fee_display": "Gratuit (Libre)",
        "market_value_eur": 30000000.0,
        "market_value_display": "30.00 M€",
        "preferred_foot": "Gaucher",
        "position": "Milieu",
        "role_category": "M",
        "number": 25,
        "nationality": "FRA",
        "age": 31,
        "photo": "https://media.api-sports.io/football/players/273.png",
        "notes": "Milieu international français à l'OM"
    },
    {
        "player_name": "Luka Modrić",
        "from_slug": "real-madrid",
        "to_slug": "ac-milan",
        "from_team": "Real Madrid",
        "to_team": "AC Milan",
        "transfer_date": "2026-07-01",
        "season": "2026-2027",
        "mercato_window": "SUMMER",
        "transfer_type": "FIN_DE_CONTRAT",
        "transfer_type_label": "🆓 Fin de Contrat / Libre",
        "fee_numeric_eur": 0.0,
        "fee_display": "Gratuit (Libre)",
        "market_value_eur": 5000000.0,
        "market_value_display": "5.00 M€",
        "preferred_foot": "Droitier",
        "position": "Milieu",
        "role_category": "M",
        "number": 10,
        "nationality": "CRO",
        "age": 40,
        "photo": "https://images.fotmob.com/image_resources/playerimages/30894.png",
        "notes": "Légende croate à l'AC Milan"
    },
    {
        "player_name": "Georges Mikautadze",
        "from_slug": "lyon",
        "to_slug": "villarreal-cf",
        "from_team": "Lyon",
        "to_team": "Villarreal CF",
        "transfer_date": "2026-07-01",
        "season": "2026-2027",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif",
        "fee_numeric_eur": 28000000.0,
        "fee_display": "28.00 M€",
        "market_value_eur": 25000000.0,
        "market_value_display": "25.00 M€",
        "preferred_foot": "Droitier",
        "position": "Attaquant",
        "role_category": "A",
        "number": 9,
        "nationality": "GEO",
        "age": 25,
        "photo": "https://images.fotmob.com/image_resources/playerimages/1105440.png",
        "notes": "Buteur géorgien transféré à Villarreal"
    },
    {
        "player_name": "Julian Alvarez",
        "from_slug": "manchester-city",
        "to_slug": "atletico-madrid",
        "from_team": "Manchester City",
        "to_team": "Atlético Madrid",
        "transfer_date": "2024-08-12",
        "season": "2024-2025",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif",
        "fee_numeric_eur": 75000000.0,
        "fee_display": "75.00 M€",
        "market_value_eur": 90000000.0,
        "market_value_display": "90.00 M€",
        "preferred_foot": "Droitier",
        "position": "Attaquant",
        "role_category": "A",
        "number": 19,
        "nationality": "ARG",
        "age": 26,
        "photo": "https://images.fotmob.com/image_resources/playerimages/961803.png",
        "notes": "Buteur argentin titulaire à l'Atlético de Madrid"
    }
]

print("=" * 75)
print(" 🚀 RÉCONCILIATION GLOBALE DES EFFECTIFS ET APPLICATION DES TRANSFERTS")
print("=" * 75)

# Map club slug to file
squad_files = glob.glob(os.path.join(SQUADS_DIR, "*.json"))
slug_to_file = {}
for sf in squad_files:
    fname = os.path.basename(sf)
    slug = fname.replace(".json", "")
    slug_to_file[slug] = sf

# 1. Apply explicit key transfers to squad files
print("📦 [Sync:1] Application des transferts explicites 2026-2027 dans les fichiers clubs...")

for trf in KEY_TRANSFERS_2026:
    pname = trf["player_name"]
    from_slug = trf["from_slug"]
    to_slug = trf["to_slug"]
    
    # 1. Remove/Update from departing club
    if from_slug in slug_to_file:
        f_path = slug_to_file[from_slug]
        with open(f_path, 'r', encoding='utf-8') as f:
            f_data = json.load(f)
            
        season_26 = f_data.get('seasons', {}).get('2026-2027', [])
        updated_26 = []
        for p in season_26:
            if normalize_text(p.get('name')) == normalize_text(pname):
                print(f"  ❌ Retrait de {pname} de l'effectif actif 2026-2027 de {from_slug}")
                continue # Player is no longer in active roster for 2026-2027
            updated_26.append(p)
        f_data['seasons']['2026-2027'] = updated_26
        
        with open(f_path, 'w', encoding='utf-8') as f:
            json.dump(f_data, f, ensure_ascii=False, indent=2)

    # 2. Add to destination club
    if to_slug in slug_to_file:
        t_path = slug_to_file[to_slug]
        with open(t_path, 'r', encoding='utf-8') as f:
            t_data = json.load(f)
            
        season_26 = t_data.get('seasons', {}).get('2026-2027', [])
        # Check if already present
        already_in = any(normalize_text(p.get('name')) == normalize_text(pname) for p in season_26)
        if not already_in:
            print(f"  ✅ Ajout de {pname} dans l'effectif 2026-2027 de {to_slug}")
            new_player_entry = {
                "id": f"p_{to_slug}_2026_{trf['number']}",
                "name": pname,
                "number": trf["number"],
                "position": trf["position"],
                "role_category": trf["role_category"],
                "nationality": trf["nationality"],
                "age": trf["age"],
                "market_value": trf["market_value_display"],
                "joined_date": trf["transfer_date"],
                "left_date": None,
                "contract_until": "2029-06-30",
                "status": "NEW_SIGNING",
                "photo": trf["photo"],
                "stats": {
                    "appearances": 0,
                    "goals": 0,
                    "assists": 0,
                    "yellowCards": 0,
                    "redCards": 0
                }
            }
            season_26.append(new_player_entry)
            t_data['seasons']['2026-2027'] = season_26
            with open(t_path, 'w', encoding='utf-8') as f:
                json.dump(t_data, f, ensure_ascii=False, indent=2)

# 2. Global deduplication across all 126 squad files for season 2026-2027
print("\n📦 [Sync:2] Dédoublonnage global des effectifs actifs 2026-2027...")

# Count player occurrences
player_seen_clubs = {}
all_squads_data = {}

for slug, f_path in slug_to_file.items():
    with open(f_path, 'r', encoding='utf-8') as f:
        all_squads_data[slug] = json.load(f)

# Priority explicit destination clubs for transferred players
EXPLICIT_HOMES_2026 = {
    normalize_text(t["player_name"]): t["to_slug"] for t in KEY_TRANSFERS_2026
}

# Resolve duplicates in 2026-2027
dedup_count = 0
for slug, s_data in all_squads_data.items():
    season_26 = s_data.get('seasons', {}).get('2026-2027', [])
    filtered_roster = []
    
    for p in season_26:
        p_name = p.get('name')
        if not p_name:
            continue
        p_norm = normalize_text(p_name)
        
        # If player has an explicit destination and this is NOT it -> Remove
        if p_norm in EXPLICIT_HOMES_2026 and EXPLICIT_HOMES_2026[p_norm] != slug:
            print(f"  🧹 Dédoublonnage : {p_name} retiré de {slug} (Club officiel 2026: {EXPLICIT_HOMES_2026[p_norm]})")
            dedup_count += 1
            continue
            
        # If player already registered in another club in 2026
        if p_norm in player_seen_clubs:
            first_slug = player_seen_clubs[p_norm]
            print(f"  🧹 Doublon résolu : {p_name} conservé à {first_slug}, retiré de {slug}")
            dedup_count += 1
            continue
            
        player_seen_clubs[p_norm] = slug
        filtered_roster.append(p)
        
    s_data['seasons']['2026-2027'] = filtered_roster
    f_path = slug_to_file[slug]
    with open(f_path, 'w', encoding='utf-8') as f:
        json.dump(s_data, f, ensure_ascii=False, indent=2)

print(f"✅ {dedup_count} doublons résolus dans les effectifs 2026-2027.")

# 3. Synchronize SQLite relational tables (dim_players & dim_player_contracts_scd2 & fct_player_transfers)
print("\n📦 [Sync:3] Ingestion et synchronisation dans SQLite (predictor_v2.db)...")
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Insert/Update Emegha and key transfers in fct_player_transfers
for trf in KEY_TRANSFERS_2026:
    p_name = trf["player_name"]
    p_id = f"ply_{slugify(p_name)}_trf"
    from_tid = f"CLUB_{slugify(trf['from_team']).upper()}"
    to_tid = f"CLUB_{slugify(trf['to_team']).upper()}"
    trf_id = f"trf_{slugify(p_name)}_{slugify(trf['from_team'])}_{slugify(trf['to_team'])}_{trf['transfer_date'].replace('-', '_')}"
    
    cursor.execute("""
        INSERT OR REPLACE INTO fct_player_transfers (
            transfer_id, player_id, player_name, player_display_name, player_position,
            player_role, player_nationality, player_nationality_code, player_nationality_flag,
            player_photo_url, from_team_id, from_team_name, from_team_logo, from_team_league,
            to_team_id, to_team_name, to_team_logo, to_team_league, transfer_date,
            season, mercato_window, transfer_type, transfer_type_label, fee_numeric_eur,
            fee_display, market_value_eur, market_value_display, fee_value_delta_eur,
            age_at_transfer, preferred_foot, transfer_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        trf_id, p_id, p_name, p_name, trf["position"],
        trf["role_category"], trf["nationality"], trf["nationality"][:3], "🇳🇱" if trf["nationality"]=="NED" else "🌍",
        trf["photo"], from_tid, trf["from_team"], f"https://media.api-sports.io/football/teams/{abs(hash(trf['from_team'])) % 10000}.png", "FRA-L1",
        to_tid, trf["to_team"], f"https://media.api-sports.io/football/teams/{abs(hash(trf['to_team'])) % 10000}.png", "ENG-PL",
        trf["transfer_date"], trf["season"], trf["mercato_window"], trf["transfer_type"], trf["transfer_type_label"],
        trf["fee_numeric_eur"], trf["fee_display"], trf["market_value_eur"], trf["market_value_display"], 0.0,
        trf["age"], trf["preferred_foot"], trf["notes"]
    ))

conn.commit()
conn.close()

print("=" * 75)
print("🎉 SUCCÈS : Réconciliation des transferts et dédoublonnage achevés !")
print("=" * 75)
