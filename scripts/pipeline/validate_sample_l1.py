#!/usr/bin/env python3
"""
scripts/pipeline/validate_sample_l1.py
─────────────────────────────────────────────────────────────
Validation sur échantillon de 50+ joueurs de Ligue 1 (PSG, Marseille, Angers)
- Scraping TM Squad
- Image download & conversion WebP 150x150
- SQLite dim_players update
- Rapport de couverture & validation de cadrage
"""

import os
import sys
import re
import json
import io
import time
import unicodedata
import sqlite3
import urllib.request
import urllib.parse
from bs4 import BeautifulSoup
from PIL import Image

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(ROOT_DIR, "predictor_v2.db")
ASSETS_DIR = os.path.join(ROOT_DIR, "public", "assets", "players")
DEFAULTS_DIR = os.path.join(ASSETS_DIR, "defaults")

os.makedirs(ASSETS_DIR, exist_ok=True)
os.makedirs(DEFAULTS_DIR, exist_ok=True)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
}

SAMPLE_CLUBS = [
    {'slug': 'psg', 'tm_slug': 'paris-saint-germain', 'tm_id': '583', 'name': 'PSG'},
    {'slug': 'marseille', 'tm_slug': 'olympique-marseille', 'tm_id': '244', 'name': 'Marseille'},
    {'slug': 'angers', 'tm_slug': 'angers-sco', 'tm_id': '1420', 'name': 'Angers'}
]

def normalize_text(text):
    if not text or not isinstance(text, str):
        return ""
    text = unicodedata.normalize('NFD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    text = re.sub(r'[^a-zA-Z0-9\s]', ' ', text)
    return ' '.join(text.lower().split())

def ensure_schema(conn):
    cursor = conn.cursor()
    cols = [c[1] for c in cursor.execute("PRAGMA table_info(dim_players);").fetchall()]
    if "has_local_photo" not in cols:
        cursor.execute("ALTER TABLE dim_players ADD COLUMN has_local_photo BOOLEAN DEFAULT 0;")
    if "photo_source" not in cols:
        cursor.execute("ALTER TABLE dim_players ADD COLUMN photo_source VARCHAR(32) DEFAULT 'DEFAULT_AVATAR';")
    if "photo_updated_at" not in cols:
        cursor.execute("ALTER TABLE dim_players ADD COLUMN photo_updated_at TIMESTAMP;")
    conn.commit()

def scrape_tm_squad(club_slug, verein_id, season='2024'):
    url = f"https://www.transfermarkt.com/{club_slug}/kader/verein/{verein_id}/saison_id/{season}"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=12) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
    
    soup = BeautifulSoup(html, 'html.parser')
    table = soup.find('table', class_='items')
    if not table:
        return []
    
    players = []
    rows = table.find_all('tr', class_=['odd', 'even'])
    for r in rows:
        img_tag = r.find('img', class_='bilderrahmen-fixed')
        if not img_tag:
            img_tag = r.find('img', src=re.compile(r'img\.a\.transfermarkt\.technology/portrait'))
        
        photo_url = None
        if img_tag:
            photo_url = img_tag.get('data-src') or img_tag.get('src')
            if photo_url and 'data:image' in photo_url:
                photo_url = None
        
        player_link = r.find('a', href=re.compile(r'/profil/spieler/(\d+)'))
        if not player_link:
            continue
        
        tm_id_m = re.search(r'/profil/spieler/(\d+)', player_link['href'])
        tm_id = tm_id_m.group(1) if tm_id_m else None
        name = player_link.get_text(strip=True)
        
        num_cell = r.find('div', class_='rn_nummer')
        number = num_cell.get_text(strip=True) if num_cell else None
        
        pos_cells = r.find_all('td', class_='pos')
        pos_detail = pos_cells[0].get_text(strip=True) if pos_cells else None
        
        zentriert = r.find_all('td', class_='zentriert')
        dob = None
        for z in zentriert:
            text = z.get_text(strip=True)
            if re.search(r'[A-Za-z]{3}\s+\d{1,2},\s+\d{4}|\d{1,2}/\d{1,2}/\d{4}|\d{4}', text):
                dob = text
                break
        
        players.append({
            'name': name,
            'norm_name': normalize_text(name),
            'tm_id': tm_id,
            'number': number,
            'position': pos_detail,
            'dob': dob,
            'photo_url': photo_url
        })
    
    return players

def process_and_save_image(raw_bytes, target_path, size=(150, 150)):
    try:
        img = Image.open(io.BytesIO(raw_bytes))
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        w, h = img.size
        min_dim = min(w, h)
        
        # Crop square centered at top-middle (portrait framing)
        left = (w - min_dim) // 2
        top = int((h - min_dim) * 0.20) if h > w else 0
        top = max(0, min(top, h - min_dim))
        right = left + min_dim
        bottom = top + min_dim
        
        cropped = img.crop((left, top, right, bottom))
        resized = cropped.resize(size, Image.Resampling.LANCZOS)
        
        resized.save(target_path, 'WEBP', quality=88, method=6)
        return True
    except Exception as e:
        print(f"    ❌ Erreur conversion image: {e}")
        return False

def download_image(url):
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=8) as resp:
            if resp.status == 200:
                return resp.read()
    except Exception:
        pass
    return None

def fetch_sportsdb_fallback(name):
    try:
        q = urllib.parse.quote(name)
        url = f"https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p={q}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            players = data.get('player')
            if players:
                p = players[0]
                return p.get('strCutout') or p.get('strThumb')
    except Exception:
        pass
    return None

def fetch_wiki_fallback(name):
    for lang in ['fr', 'en']:
        try:
            q = urllib.parse.quote(name)
            url = f"https://{lang}.wikipedia.org/w/api.php?action=query&titles={q}&prop=pageimages&format=json&pithumbsize=300"
            req = urllib.request.Request(url, headers={'User-Agent': 'PredictorApp/1.0 (benoit@predictor.local)'})
            with urllib.request.urlopen(req, timeout=4) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                pages = data.get('query', {}).get('pages', {})
                for pid, pinfo in pages.items():
                    if pid != "-1" and 'thumbnail' in pinfo:
                        return pinfo['thumbnail']['source']
        except Exception:
            pass
    return None

def update_player_in_db(cursor, player_id, tm_id, photo_url, photo_source):
    # Safely update without failing on tm_id unique constraint
    try:
        if tm_id:
            cursor.execute("""
                UPDATE dim_players 
                SET tm_id = ?, photo_url = ?, has_local_photo = 1, photo_source = ?, photo_updated_at = CURRENT_TIMESTAMP
                WHERE player_id = ?
            """, (tm_id, photo_url, photo_source, player_id))
        else:
            cursor.execute("""
                UPDATE dim_players 
                SET photo_url = ?, has_local_photo = 1, photo_source = ?, photo_updated_at = CURRENT_TIMESTAMP
                WHERE player_id = ?
            """, (photo_url, photo_source, player_id))
    except sqlite3.IntegrityError:
        # If tm_id is already assigned to another duplicate row for this player, update without overriding tm_id
        cursor.execute("""
            UPDATE dim_players 
            SET photo_url = ?, has_local_photo = 1, photo_source = ?, photo_updated_at = CURRENT_TIMESTAMP
            WHERE player_id = ?
        """, (photo_url, photo_source, player_id))

def run_sample_validation():
    print("=" * 70)
    print(" 🚀 VALIDATION ÉCHANTILLON : 50+ JOUEURS LIGUE 1 (PSG, OM, ANGERS)")
    print("=" * 70)
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    ensure_schema(conn)
    cursor = conn.cursor()
    
    total_processed = 0
    total_tm_matched = 0
    total_fallback_matched = 0
    total_default_assigned = 0
    
    for club_info in SAMPLE_CLUBS:
        club_slug = club_info['slug']
        club_name = club_info['name']
        print(f"\n📂 [Club: {club_name}] Scraping Transfermarkt squad ({club_info['tm_slug']} - ID: {club_info['tm_id']})...")
        
        tm_squad = scrape_tm_squad(club_info['tm_slug'], club_info['tm_id'])
        print(f"  -> {len(tm_squad)} joueurs récupérés depuis Transfermarkt.")
        
        db_players = cursor.execute("""
            SELECT p.player_id, p.full_name, p.role_category, p.primary_position
            FROM dim_players p
            JOIN dim_player_contracts_scd2 c ON p.player_id = c.player_id AND c.is_current = 1
            JOIN dim_teams t ON c.team_id = t.team_id
            WHERE t.slug = ? OR t.slug = ?
        """, (club_slug, club_info['slug'])).fetchall()
        
        print(f"  -> {len(db_players)} joueurs enregistrés en base pour {club_name}.")
        
        for db_p in db_players:
            p_id = db_p['player_id']
            full_name = db_p['full_name']
            role = (db_p['role_category'] or 'M').lower()
            norm_db = normalize_text(full_name)
            
            is_placeholder = any(w in norm_db for w in ['gardien', 'defenseur', 'milieu', 'attaquant', 'ailier', 'lateral', 'buteur', 'central', 'joueur', 'remplacant'])
            if is_placeholder:
                default_rel = f"/assets/players/defaults/{role}_default.webp"
                update_player_in_db(cursor, p_id, None, default_rel, 'DEFAULT_AVATAR')
                total_default_assigned += 1
                total_processed += 1
                continue
            
            matched_tm = None
            for tm_p in tm_squad:
                if tm_p['norm_name'] == norm_db:
                    matched_tm = tm_p
                    break
            
            if not matched_tm:
                tokens_db = set(norm_db.split())
                for tm_p in tm_squad:
                    tokens_tm = set(tm_p['norm_name'].split())
                    if len(tokens_db.intersection(tokens_tm)) >= 2 or (len(tokens_db) == 1 and norm_db in tm_p['norm_name']):
                        matched_tm = tm_p
                        break
            
            target_file = os.path.join(ASSETS_DIR, f"{p_id}.webp")
            rel_url = f"/assets/players/{p_id}.webp"
            
            # Option 1: Matched in Transfermarkt squad
            if matched_tm and matched_tm.get('photo_url') and 'portrait' in matched_tm['photo_url']:
                raw_img = download_image(matched_tm['photo_url'])
                if raw_img and process_and_save_image(raw_img, target_file):
                    update_player_in_db(cursor, p_id, matched_tm['tm_id'], rel_url, 'TRANSFERMARKT')
                    total_tm_matched += 1
                    total_processed += 1
                    print(f"  ✅ [TM] {full_name} -> {rel_url} (TM: {matched_tm['tm_id']})")
                    continue
            
            # Option 2: Fallback to TheSportsDB
            sdb_url = fetch_sportsdb_fallback(full_name)
            if sdb_url:
                raw_img = download_image(sdb_url)
                if raw_img and process_and_save_image(raw_img, target_file):
                    update_player_in_db(cursor, p_id, None, rel_url, 'THESPORTSDB')
                    total_fallback_matched += 1
                    total_processed += 1
                    print(f"  ✨ [TheSportsDB] {full_name} -> {rel_url}")
                    continue
            
            # Option 3: Fallback to Wikipedia
            wiki_url = fetch_wiki_fallback(full_name)
            if wiki_url:
                raw_img = download_image(wiki_url)
                if raw_img and process_and_save_image(raw_img, target_file):
                    update_player_in_db(cursor, p_id, None, rel_url, 'WIKIMEDIA')
                    total_fallback_matched += 1
                    total_processed += 1
                    print(f"  🌐 [Wikipedia] {full_name} -> {rel_url}")
                    continue
            
            # Option 4: Assign default position avatar
            default_rel = f"/assets/players/defaults/{role}_default.webp"
            update_player_in_db(cursor, p_id, None, default_rel, 'DEFAULT_AVATAR')
            total_default_assigned += 1
            total_processed += 1
            print(f"  🛡️ [Default Avatar] {full_name} -> {default_rel}")

        time.sleep(1.5)

    conn.commit()
    conn.close()
    
    print("\n" + "=" * 70)
    print(f" 📊 BILAN DE L'ÉCHANTILLON (PSG, MARSEILLE, ANGERS) :")
    print(f"  ├─ Total joueurs traités : {total_processed}")
    print(f"  ├─ Photos réelles TM : {total_tm_matched} ({total_tm_matched/total_processed*100:.1f}%)")
    print(f"  ├─ Photos Fallback (SDB/Wiki) : {total_fallback_matched} ({total_fallback_matched/total_processed*100:.1f}%)")
    print(f"  ├─ Avatars par défaut : {total_default_assigned} ({total_default_assigned/total_processed*100:.1f}%)")
    real_rate = (total_tm_matched + total_fallback_matched) / total_processed * 100
    print(f"  └─ Couverture photos réelles HD : {real_rate:.1f}%")
    print("=" * 70)

if __name__ == "__main__":
    run_sample_validation()
