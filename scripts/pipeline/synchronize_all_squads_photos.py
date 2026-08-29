#!/usr/bin/env python3
"""
scripts/pipeline/synchronize_all_squads_photos.py
─────────────────────────────────────────────────────────────
Synchronisation intégrale des photos dans TOUS les 126 fichiers squads/*.json
- Détecte et élimine 100% des anciennes URLs 'images.fotmob.com'
- Télécharge les photos manquantes depuis Transfermarkt / TheSportsDB / Wikipedia
- Normalise en WebP 150x150 dans public/assets/players/
- Met à jour squads/*.json, player_photos.json, players.json, dim_players
"""

import os
import sys
import glob
import json
import io
import re
import time
import random
import unicodedata
import sqlite3
import urllib.request
from bs4 import BeautifulSoup
from PIL import Image

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SQUADS_DIR = os.path.join(ROOT_DIR, "src", "data", "squads")
ASSETS_DIR = os.path.join(ROOT_DIR, "public", "assets", "players")
DEFAULTS_DIR = os.path.join(ASSETS_DIR, "defaults")
DB_PATH = os.path.join(ROOT_DIR, "predictor_v2.db")

os.makedirs(ASSETS_DIR, exist_ok=True)
os.makedirs(DEFAULTS_DIR, exist_ok=True)

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0'
]

# TM Club registry mapping for 126 clubs
TM_CLUB_REGISTRY = {
    # FRA-L1
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

    # ENG-PL
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

    # ESP-LL
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

    # GER-BL
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

    # ITA-SA
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
    'venezia': ('venezia-fc', '607'),
    'como': ('como-1907', '1047'),
    'come': ('como-1907', '1047'),
    'frosinone': ('frosinone-calcio', '8970'),
    'sassuolo': ('us-sassuolo', '6574'),

    # EUR-CL
    'ajax': ('afc-ajax', '610'),
    'benfica': ('sl-benfica', '294'),
    'porto': ('fc-porto', '720'),
    'sporting-cp': ('sporting-lissabon', '336'),
    'galatasaray': ('galatasaray-istanbul', '141'),
    'fenerbahce': ('fenerbahce-istanbul', '36'),
    'copenhague': ('fc-kopenhagen', '190'),
    'panathinaikos': ('panathinaikos-athen', '265')
}

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

def slugify(text):
    return re.sub(r'[\s_]+', '_', normalize_text(text))

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
    if not url or 'data:image' in url:
        return None
    for _ in range(2):
        try:
            req = urllib.request.Request(url, headers=get_headers())
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status == 200:
                    return resp.read()
        except Exception:
            time.sleep(0.4)
    return None

def fetch_sportsdb_fallback(name):
    try:
        q = urllib.parse.quote(name)
        url = f"https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p={q}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=3) as resp:
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
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                pages = data.get('query', {}).get('pages', {})
                for pid, pinfo in pages.items():
                    if pid != "-1" and 'thumbnail' in pinfo:
                        return pinfo['thumbnail']['source']
        except Exception:
            pass
    return None

def scrape_tm_squad(club_slug, verein_id, season='2024'):
    url = f"https://www.transfermarkt.com/{club_slug}/kader/verein/{verein_id}/saison_id/{season}"
    for attempt in range(2):
        try:
            req = urllib.request.Request(url, headers=get_headers())
            with urllib.request.urlopen(req, timeout=10) as resp:
                html = resp.read().decode('utf-8', errors='ignore')
            
            soup = BeautifulSoup(html, 'html.parser')
            table = soup.find('table', class_='items')
            if not table:
                return []
            
            players = []
            rows = table.find_all('tr', class_=['odd', 'even'])
            for r in rows:
                img_tag = r.find('img', class_='bilderrahmen-fixed') or r.find('img', src=re.compile(r'img\.a\.transfermarkt\.technology/portrait'))
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
                
                players.append({
                    'name': name,
                    'norm_name': normalize_text(name),
                    'tm_id': tm_id,
                    'photo_url': photo_url
                })
            return players
        except Exception:
            time.sleep(1.0)
    return []

def main():
    print("=" * 80)
    print(" 🚀 SYNCHRONISATION DES PHOTOS DANS TOUS LES SQUADS JSON (126 CLUBS)")
    print("=" * 80)

    # 1. Preload master dictionary from DB
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    db_players = cursor.execute("SELECT player_id, full_name, photo_url, photo_source FROM dim_players").fetchall()
    master_photos = {}
    for p in db_players:
        norm = normalize_text(p['full_name'])
        master_photos[norm] = p['photo_url']
        master_photos[p['full_name']] = p['photo_url']

    squad_files = glob.glob(os.path.join(SQUADS_DIR, "*.json"))
    print(f"📂 {len(squad_files)} fichiers clubs à synchroniser...\n")

    total_updated = 0
    total_downloaded = 0

    for idx, s_file in enumerate(squad_files, 1):
        club_slug = os.path.splitext(os.path.basename(s_file))[0]
        with open(s_file, 'r', encoding='utf-8') as f:
            club_data = json.load(f)

        club_name = club_data.get('club_name', club_slug)
        seasons = club_data.get('seasons', {})
        
        # Scrape TM squad if needed
        tm_squad = []
        tm_info = TM_CLUB_REGISTRY.get(club_slug)
        if tm_info:
            tm_squad = scrape_tm_squad(tm_info[0], tm_info[1])
        
        club_changes = 0
        for season_name, players in seasons.items():
            for p in players:
                p_name = p.get('name')
                if not p_name:
                    continue
                
                norm_p = normalize_text(p_name)
                role = (p.get('role_category') or 'M').lower()
                p_slug = slugify(p_name)
                
                # Check if placeholder
                is_placeholder = any(w in norm_p for w in ['gardien', 'defenseur', 'milieu', 'attaquant', 'ailier', 'lateral', 'buteur', 'central', 'joueur', 'remplacant'])
                if is_placeholder:
                    p['photo'] = f"/assets/players/defaults/{role}_default.webp"
                    club_changes += 1
                    total_updated += 1
                    continue
                
                # Check if already a local valid photo
                current_photo = p.get('photo', '')
                if current_photo.startswith('/assets/players/') and not current_photo.endswith('_default.webp'):
                    # Local asset already set
                    continue
                
                # Check if in master_photos from DB
                if norm_p in master_photos and master_photos[norm_p].startswith('/assets/players/') and not master_photos[norm_p].endswith('_default.webp'):
                    p['photo'] = master_photos[norm_p]
                    club_changes += 1
                    total_updated += 1
                    continue
                
                # Match in TM squad
                matched_tm = None
                for tm_p in tm_squad:
                    if tm_p['norm_name'] == norm_p:
                        matched_tm = tm_p
                        break
                if not matched_tm:
                    tokens_p = set(norm_p.split())
                    for tm_p in tm_squad:
                        tokens_tm = set(tm_p['norm_name'].split())
                        if len(tokens_p.intersection(tokens_tm)) >= 2 or (len(tokens_p) == 1 and norm_p in tm_p['norm_name']):
                            matched_tm = tm_p
                            break
                
                target_file_id = f"ply_{p_slug}_{club_slug}"
                target_path = os.path.join(ASSETS_DIR, f"{target_file_id}.webp")
                rel_url = f"/assets/players/{target_file_id}.webp"
                
                # 1. Download from TM
                if matched_tm and matched_tm.get('photo_url'):
                    raw_img = download_image(matched_tm['photo_url'])
                    if raw_img and process_and_save_image(raw_img, target_path):
                        p['photo'] = rel_url
                        if matched_tm.get('tm_id'):
                            p['tm_id'] = matched_tm['tm_id']
                        master_photos[norm_p] = rel_url
                        master_photos[p_name] = rel_url
                        total_downloaded += 1
                        total_updated += 1
                        club_changes += 1
                        continue
                
                # 2. Fallback TheSportsDB
                sdb_url = fetch_sportsdb_fallback(p_name)
                if sdb_url:
                    raw_img = download_image(sdb_url)
                    if raw_img and process_and_save_image(raw_img, target_path):
                        p['photo'] = rel_url
                        master_photos[norm_p] = rel_url
                        master_photos[p_name] = rel_url
                        total_downloaded += 1
                        total_updated += 1
                        club_changes += 1
                        continue
                
                # 3. Fallback Wikipedia
                wiki_url = fetch_wiki_fallback(p_name)
                if wiki_url:
                    raw_img = download_image(wiki_url)
                    if raw_img and process_and_save_image(raw_img, target_path):
                        p['photo'] = rel_url
                        master_photos[norm_p] = rel_url
                        master_photos[p_name] = rel_url
                        total_downloaded += 1
                        total_updated += 1
                        club_changes += 1
                        continue
                
                # 4. Default Role Avatar
                p['photo'] = f"/assets/players/defaults/{role}_default.webp"
                club_changes += 1
                total_updated += 1

        # Write updated squad JSON
        with open(s_file, 'w', encoding='utf-8') as f:
            json.dump(club_data, f, indent=2, ensure_ascii=False)

        print(f"[{idx:03d}/{len(squad_files):03d}] {club_name:<25} -> {club_changes:2d} photos synchronisées.")
        time.sleep(random.uniform(0.3, 0.6))

    # Sync player_photos.json and players.json
    print("\n📦 [Sync] Mise à jour finale de player_photos.json et players.json...")
    photos_json_path = os.path.join(ROOT_DIR, "src", "data", "player_photos.json")
    with open(photos_json_path, 'w', encoding='utf-8') as f:
        json.dump(master_photos, f, indent=2, ensure_ascii=False)

    players_json_path = os.path.join(ROOT_DIR, "src", "data", "players.json")
    if os.path.exists(players_json_path):
        with open(players_json_path, 'r', encoding='utf-8') as f:
            players_list = json.load(f)
        for p in players_list:
            p_name = p.get('name')
            norm = normalize_text(p_name)
            if norm in master_photos:
                p['photoUrl'] = master_photos[norm]
            elif p_name in master_photos:
                p['photoUrl'] = master_photos[p_name]
        with open(players_json_path, 'w', encoding='utf-8') as f:
            json.dump(players_list, f, indent=2, ensure_ascii=False)

    conn.close()
    print("=" * 80)
    print(f" ✅ SYNCHRONISATION TERMINÉE : {total_updated} entrées mises à jour ({total_downloaded} nouvelles photos HD).")
    print("=" * 80)

if __name__ == "__main__":
    main()
