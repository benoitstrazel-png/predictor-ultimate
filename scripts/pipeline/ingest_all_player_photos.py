#!/usr/bin/env python3
"""
scripts/pipeline/ingest_all_player_photos.py
─────────────────────────────────────────────────────────────
Pipeline de Collecte, Normalisation & Liaison des Photos Joueurs (126 clubs)
- Source Primaire : Transfermarkt (Scraping par club, 100% effectifs)
- Source Secondaire : TheSportsDB (Cutouts transparents HD)
- Source Tertiaire : Wikimedia Commons / Wikipedia API
- Fallback Robuste : Avatars vectoriels thématiques par poste (G, D, M, A)
- Normalisation : WebP 150x150 (ratio 1:1, centrage visage, compression 88)
- Stockage : public/assets/players/{player_id}.webp
- Sync Base : SQLite predictor_v2.db (dim_players) + JSON frontend
"""

import os
import sys
import re
import json
import io
import time
import random
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

# 126 Clubs Mapping to Transfermarkt (slug, verein_id)
TM_CLUB_REGISTRY = {
    # FRA-L1 (23 clubs)
    'psg': ('paris-saint-germain', '583'),
    'marseille': ('olympique-marseille', '244'),
    'monaco': ('as-monaco', '162'),
    'lyon': ('olympique-lyon', '1041'),
    'lille': ('losc-lille', '1082'),
    'lens': ('rc-lens', '826'),
    'rennes': ('fc-stade-rennes', '273'),
    'nice': ('ogc-nice', '417'),
    'strasbourg': ('rc-strassburg-alsace', '667'),
    'toulouse': ('fc-toulouse', '415'),
    'reims': ('stade-reims', '1421'),
    'brest': ('stade-brest-29', '3911'),
    'montpellier': ('montpellier-hsc', '969'),
    'nantes': ('fc-nantes', '995'),
    'auxerre': ('aj-auxerre', '290'),
    'angers': ('angers-sco', '1420'),
    'saint-etienne': ('as-saint-etienne', '618'),
    'le-havre': ('ac-le-havre', '738'),
    'paris-fc': ('paris-fc', '3699'),
    'lorient': ('fc-lorient', '1158'),
    'metz': ('fc-metz', '347'),
    'troyes': ('estac-troyes', '1095'),
    'le-mans': ('le-mans-fc', '1164'),

    # ENG-PL (25 clubs)
    'arsenal': ('fc-arsenal', '11'),
    'aston-villa': ('aston-villa', '405'),
    'bournemouth': ('afc-bournemouth', '989'),
    'brentford': ('fc-brentford', '1148'),
    'brighton': ('brighton-amp-hove-albion', '1237'),
    'chelsea': ('fc-chelsea', '631'),
    'crystal-palace': ('crystal-palace', '873'),
    'everton': ('fc-everton', '29'),
    'fulham': ('fc-fulham', '931'),
    'ipswich': ('ipswich-town', '677'),
    'ipswich-town': ('ipswich-town', '677'),
    'leicester': ('leicester-city', '1003'),
    'leicester-city': ('leicester-city', '1003'),
    'liverpool': ('fc-liverpool', '31'),
    'manchester-city': ('manchester-city', '281'),
    'manchester-united': ('manchester-united', '985'),
    'newcastle': ('newcastle-united', '762'),
    'newcastle-united': ('newcastle-united', '762'),
    'nottingham-forest': ('nottingham-forest', '703'),
    'southampton': ('fc-southampton', '180'),
    'tottenham': ('tottenham-hotspur', '148'),
    'tottenham-hotspur': ('tottenham-hotspur', '148'),
    'west-ham': ('west-ham-united', '379'),
    'west-ham-united': ('west-ham-united', '379'),
    'wolves': ('wolverhampton-wanderers', '543'),
    'wolverhampton': ('wolverhampton-wanderers', '543'),
    'burnley': ('fc-burnley', '1132'),
    'coventry': ('coventry-city', '990'),
    'hull-city': ('hull-city', '3008'),
    'leeds': ('leeds-united', '399'),
    'leeds-united': ('leeds-united', '399'),
    'luton': ('luton-town', '1031'),
    'sheffield-united': ('sheffield-united', '350'),
    'sunderland': ('sunderland-afc', '289'),

    # ESP-LL (25 clubs)
    'real-madrid': ('real-madrid', '418'),
    'barcelona': ('fc-barcelona', '131'),
    'fc-barcelona': ('fc-barcelona', '131'),
    'atletico-madrid': ('atletico-madrid', '13'),
    'real-sociedad': ('real-sociedad-san-sebastian', '681'),
    'athletic-club': ('athletic-bilbao', '621'),
    'real-betis': ('real-betis-sevilla', '150'),
    'villarreal-cf': ('fc-villarreal', '1050'),
    'valencia-cf': ('fc-valencia', '1049'),
    'sevilla-fc': ('fc-sevilla', '368'),
    'fc-seville': ('fc-sevilla', '368'),
    'osasuna': ('ca-osasuna', '331'),
    'girona': ('fc-girona', '12321'),
    'celta-vigo': ('celta-vigo', '940'),
    'mallorca': ('rcd-mallorca', '237'),
    'rayo-vallecano': ('rayo-vallecano', '367'),
    'deportivo-alaves': ('deportivo-alaves', '1108'),
    'alaves': ('deportivo-alaves', '1108'),
    'las-palmas': ('ud-las-palmas', '472'),
    'leganes': ('cd-leganes', '1244'),
    'valladolid': ('real-valladolid', '366'),
    'espanyol': ('rcd-espanyol-barcelona', '2336'),
    'getafe-cf': ('getafe-cf', '3709'),
    'almeria': ('ud-almeria', '3302'),
    'cadiz': ('cadiz-cf', '2687'),
    'granada': ('granada-cf', '16795'),
    'elche': ('elche-cf', '1531'),
    'levante': ('ud-levante', '269'),
    'malaga': ('malaga-cf', '1084'),
    'racing-santander': ('racing-santander', '630'),
    'la-corogne': ('deportivo-la-coruna', '897'),

    # GER-BL (23 clubs)
    'bayern-munich': ('fc-bayern-munchen', '27'),
    'bayer-leverkusen': ('bayer-04-leverkusen', '15'),
    'borussia-dortmund': ('borussia-dortmund', '16'),
    'rb-leipzig': ('rb-leipzig', '23826'),
    'eintracht-frankfurt': ('eintracht-frankfurt', '24'),
    'vfb-stuttgart': ('vfb-stuttgart', '79'),
    'vfl-wolfsburg': ('vfl-wolfsburg', '82'),
    'borussia-monchengladbach': ('borussia-monchengladbach', '18'),
    'sc-freiburg': ('sc-freiburg', '60'),
    'tsg-hoffenheim': ('tsg-1899-hoffenheim', '533'),
    'werder-bremen': ('sv-werder-bremen', '86'),
    'augsburg': ('fc-augsburg', '167'),
    'mainz-05': ('1-fsv-mainz-05', '39'),
    'union-berlin': ('1-fc-union-berlin', '89'),
    'vfl-bochum': ('vfl-bochum', '80'),
    'fc-st-pauli': ('fc-st-pauli', '35'),
    'holstein-kiel': ('holstein-kiel', '269'),
    'heidenheim': ('1-fc-heidenheim-1846', '2036'),
    'fc-cologne': ('1-fc-koln', '3'),
    'hambourg-sv': ('hamburger-sv', '41'),
    'schalke-04': ('fc-schalke-04', '33'),
    'sc-paderborn': ('sc-paderborn-07', '127'),
    'sv-elversberg': ('sv-07-elversberg', '2089'),

    # ITA-SA (22 clubs)
    'inter-milan': ('inter-mailand', '46'),
    'ac-milan': ('ac-mailand', '5'),
    'juventus': ('juventus-turin', '506'),
    'napoli': ('ssc-neapel', '6195'),
    'atalanta': ('atalanta-bergamo', '800'),
    'as-rome': ('as-rom', '12'),
    'lazio': ('lazio-rom', '398'),
    'fiorentina': ('ac-florenz', '430'),
    'bologna': ('fc-bologna', '1025'),
    'torino': ('fc-turin', '416'),
    'monza': ('ac-monza', '2919'),
    'genoa': ('genua-cfc', '252'),
    'udinese': ('udinese-calcio', '410'),
    'parma': ('parma-calcio-1913', '130'),
    'cagliari': ('cagliari-calcio', '1390'),
    'hellas-verona': ('hellas-verona', '276'),
    'empoli': ('fc-empoli', '749'),
    'lecce': ('us-lecce', '1005'),
    'venise': ('venezia-fc', '607'),
    'como': ('como-1907', '1047'),
    'come': ('como-1907', '1047'),
    'frosinone': ('frosinone-calcio', '8970'),
    'sassuolo': ('us-sassuolo', '6574'),

    # EUR-CL (8 clubs)
    'ajax': ('afc-ajax', '610'),
    'benfica': ('sl-benfica', '294'),
    'porto': ('fc-porto', '720'),
    'sporting-cp': ('sporting-lissabon', '336'),
    'galatasaray': ('galatasaray-istanbul', '141'),
    'fenerbahce': ('fenerbahce-istanbul', '36'),
    'copenhague': ('fc-kopenhagen', '190'),
    'panathinaikos': ('panathinaikos-athen', '265')
}

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:124.0) Gecko/20100101 Firefox/124.0'
]

def get_headers():
    return {
        'User-Agent': random.choice(USER_AGENTS),
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    }

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

def generate_default_avatars():
    positions = {
        'g': {'label': 'GK', 'accent': (234, 179, 8)},
        'd': {'label': 'DEF', 'accent': (59, 130, 246)},
        'm': {'label': 'MID', 'accent': (16, 185, 129)},
        'a': {'label': 'ATT', 'accent': (239, 68, 68)},
    }
    for role, cfg in positions.items():
        size = (150, 150)
        img = Image.new('RGBA', size, (0, 0, 0, 0))
        from PIL import ImageDraw
        draw = ImageDraw.Draw(img)
        draw.rounded_rectangle([4, 4, 145, 145], radius=24, fill=(15, 23, 42, 255), outline=cfg['accent'], width=3)
        draw.ellipse([55, 30, 95, 70], fill=cfg['accent'])
        draw.chord([30, 75, 120, 155], start=180, end=0, fill=cfg['accent'])
        draw.rounded_rectangle([40, 115, 110, 140], radius=8, fill=(10, 15, 30, 240), outline=cfg['accent'], width=2)
        target = os.path.join(DEFAULTS_DIR, f"{role}_default.webp")
        img.save(target, 'WEBP', quality=90)

def scrape_tm_squad(club_slug, verein_id, season='2024'):
    url = f"https://www.transfermarkt.com/{club_slug}/kader/verein/{verein_id}/saison_id/{season}"
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers=get_headers())
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
        except Exception as e:
            time.sleep(1.0 + attempt * 1.5)
    return []

def process_and_save_image(raw_bytes, target_path, size=(150, 150)):
    try:
        img = Image.open(io.BytesIO(raw_bytes))
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        w, h = img.size
        min_dim = min(w, h)
        
        left = (w - min_dim) // 2
        top = int((h - min_dim) * 0.20) if h > w else 0
        top = max(0, min(top, h - min_dim))
        right = left + min_dim
        bottom = top + min_dim
        
        cropped = img.crop((left, top, right, bottom))
        resized = cropped.resize(size, Image.Resampling.LANCZOS)
        
        resized.save(target_path, 'WEBP', quality=88, method=6)
        return True
    except Exception:
        return False

def download_image(url):
    if not url:
        return None
    for _ in range(2):
        try:
            req = urllib.request.Request(url, headers=get_headers())
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status == 200:
                    return resp.read()
        except Exception:
            time.sleep(0.5)
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
        cursor.execute("""
            UPDATE dim_players 
            SET photo_url = ?, has_local_photo = 1, photo_source = ?, photo_updated_at = CURRENT_TIMESTAMP
            WHERE player_id = ?
        """, (photo_url, photo_source, player_id))

def main():
    print("=" * 80)
    print(" 🚀 LANCEMENT DU PIPELINE GLOBAL DE PHOTOS JOUEURS (126 CLUBS, 2 912 JOUEURS)")
    print("=" * 80)
    
    generate_default_avatars()
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    ensure_schema(conn)
    cursor = conn.cursor()
    
    # 1. Fetch all clubs from dim_teams
    teams = cursor.execute("SELECT team_id, league_id, name, slug FROM dim_teams ORDER BY league_id, name").fetchall()
    print(f"📋 [Teams] {len(teams)} équipes chargées depuis dim_teams.\n")
    
    stats = {
        'total_players': 0,
        'tm_matched': 0,
        'fallback_matched': 0,
        'default_assigned': 0,
        'clubs_processed': 0
    }
    
    # Process each club
    for idx, team in enumerate(teams, 1):
        t_slug = team['slug']
        t_name = team['name']
        t_id = team['team_id']
        t_league = team['league_id']
        
        tm_info = TM_CLUB_REGISTRY.get(t_slug)
        if not tm_info:
            print(f"[{idx}/{len(teams)}] ⚠️ [Skip TM] {t_name} ({t_slug}) non présent dans TM_CLUB_REGISTRY")
            tm_squad = []
        else:
            tm_slug, verein_id = tm_info
            tm_squad = scrape_tm_squad(tm_slug, verein_id)
        
        # Get DB players for this team
        db_players = cursor.execute("""
            SELECT p.player_id, p.full_name, p.role_category, p.primary_position
            FROM dim_players p
            JOIN dim_player_contracts_scd2 c ON p.player_id = c.player_id AND c.is_current = 1
            WHERE c.team_id = ?
        """, (t_id,)).fetchall()
        
        tm_hits = 0
        for db_p in db_players:
            p_id = db_p['player_id']
            full_name = db_p['full_name']
            role = (db_p['role_category'] or 'M').lower()
            norm_db = normalize_text(full_name)
            stats['total_players'] += 1
            
            # Check if placeholder
            is_placeholder = any(w in norm_db for w in ['gardien', 'defenseur', 'milieu', 'attaquant', 'ailier', 'lateral', 'buteur', 'central', 'joueur', 'remplacant'])
            if is_placeholder:
                default_rel = f"/assets/players/defaults/{role}_default.webp"
                update_player_in_db(cursor, p_id, None, default_rel, 'DEFAULT_AVATAR')
                stats['default_assigned'] += 1
                continue
            
            target_file = os.path.join(ASSETS_DIR, f"{p_id}.webp")
            rel_url = f"/assets/players/{p_id}.webp"
            
            # 1. Match in TM Squad
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
            
            if matched_tm and matched_tm.get('photo_url') and 'portrait' in matched_tm['photo_url']:
                raw_img = download_image(matched_tm['photo_url'])
                if raw_img and process_and_save_image(raw_img, target_file):
                    update_player_in_db(cursor, p_id, matched_tm['tm_id'], rel_url, 'TRANSFERMARKT')
                    stats['tm_matched'] += 1
                    tm_hits += 1
                    continue
            
            # 2. Fallback TheSportsDB
            sdb_url = fetch_sportsdb_fallback(full_name)
            if sdb_url:
                raw_img = download_image(sdb_url)
                if raw_img and process_and_save_image(raw_img, target_file):
                    update_player_in_db(cursor, p_id, None, rel_url, 'THESPORTSDB')
                    stats['fallback_matched'] += 1
                    continue
            
            # 3. Fallback Wikipedia
            wiki_url = fetch_wiki_fallback(full_name)
            if wiki_url:
                raw_img = download_image(wiki_url)
                if raw_img and process_and_save_image(raw_img, target_file):
                    update_player_in_db(cursor, p_id, None, rel_url, 'WIKIMEDIA')
                    stats['fallback_matched'] += 1
                    continue
            
            # 4. Default Avatar
            default_rel = f"/assets/players/defaults/{role}_default.webp"
            update_player_in_db(cursor, p_id, None, default_rel, 'DEFAULT_AVATAR')
            stats['default_assigned'] += 1

        stats['clubs_processed'] += 1
        print(f"[{idx:03d}/{len(teams):03d}] [{t_league}] {t_name:<24} : {len(db_players):2d} joueurs (TM hits: {tm_hits:2d})")
        conn.commit()
        time.sleep(random.uniform(0.6, 1.2)) # Gentle rate-limit

    # Handle any remaining players without local photos
    remaining = cursor.execute("""
        SELECT player_id, full_name, role_category 
        FROM dim_players 
        WHERE has_local_photo = 0 OR photo_url LIKE '%fotmob%' OR photo_url LIKE '%api-sports%'
    """).fetchall()
    
    if remaining:
        print(f"\n🔄 [Final Pass] Traitement des {len(remaining)} joueurs restants...")
        for r in remaining:
            p_id = r['player_id']
            full_name = r['full_name']
            role = (r['role_category'] or 'M').lower()
            default_rel = f"/assets/players/defaults/{role}_default.webp"
            update_player_in_db(cursor, p_id, None, default_rel, 'DEFAULT_AVATAR')
            stats['default_assigned'] += 1
        conn.commit()

    # Sync JSON Frontend Files
    print("\n📦 [Sync:JSON] Synchronisation des fichiers JSON frontend...")
    
    # 1. Update src/data/player_photos.json
    all_players = cursor.execute("SELECT player_id, full_name, photo_url FROM dim_players").fetchall()
    photos_dict = {}
    for p in all_players:
        photos_dict[p['full_name']] = p['photo_url']
    
    json_path = os.path.join(ROOT_DIR, "src", "data", "player_photos.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(photos_dict, f, indent=2, ensure_ascii=False)
    print(f"  ✅ src/data/player_photos.json mis à jour ({len(photos_dict)} joueurs).")

    # 2. Update src/data/players.json
    players_json_path = os.path.join(ROOT_DIR, "src", "data", "players.json")
    if os.path.exists(players_json_path):
        with open(players_json_path, 'r', encoding='utf-8') as f:
            players_list = json.load(f)
        for p in players_list:
            p_name = p.get('name')
            if p_name and p_name in photos_dict:
                p['photoUrl'] = photos_dict[p_name]
        with open(players_json_path, 'w', encoding='utf-8') as f:
            json.dump(players_list, f, indent=2, ensure_ascii=False)
        print(f"  ✅ src/data/players.json mis à jour ({len(players_list)} joueurs).")

    conn.close()

    total_real = stats['tm_matched'] + stats['fallback_matched']
    total_all = stats['total_players']
    print("\n" + "=" * 80)
    print(" 📊 BILAN DU DÉPLOIEMENT GLOBAL DES PHOTOS :")
    print(f"  ├─ Clubs traités : {stats['clubs_processed']} / {len(teams)}")
    print(f"  ├─ Total joueurs en base : {total_all}")
    print(f"  ├─ Photos HD Transfermarkt : {stats['tm_matched']} ({stats['tm_matched']/total_all*100:.1f}%)")
    print(f"  ├─ Photos Fallback (TheSportsDB/Wiki) : {stats['fallback_matched']} ({stats['fallback_matched']/total_all*100:.1f}%)")
    print(f"  ├─ Avatars vectoriels par défaut : {stats['default_assigned']} ({stats['default_assigned']/total_all*100:.1f}%)")
    print(f"  └─ Couverture photos réelles HD : {total_real/total_all*100:.1f}%")
    print("=" * 80)

if __name__ == "__main__":
    main()
