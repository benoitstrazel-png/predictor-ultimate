#!/usr/bin/env python3
"""
scripts/pipeline/ingest_team_logos.py
─────────────────────────────────────────────────────────────
Pipeline Performant & Robuste de Récupération, Normalisation,
Optimisation et Service des Logos Officiels Haute Définition
(SVG & WebP 512x512 transparents) pour dim_teams et teams_master.
"""

import os
import sys
import re
import json
import io
import time
import sqlite3
import shutil
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from PIL import Image

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(ROOT_DIR, "predictor_v2.db")
PUBLIC_TEAMS_DIR = os.path.join(ROOT_DIR, "public", "assets", "teams")
DIST_TEAMS_DIR = os.path.join(ROOT_DIR, "dist", "assets", "teams")
DEFAULTS_DIR = os.path.join(PUBLIC_TEAMS_DIR, "defaults")
TEAMS_MASTER_FILE = os.path.join(ROOT_DIR, "src", "data", "teams_master.json")

os.makedirs(PUBLIC_TEAMS_DIR, exist_ok=True)
os.makedirs(DIST_TEAMS_DIR, exist_ok=True)
os.makedirs(DEFAULTS_DIR, exist_ok=True)

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 PredictorBot/2.0"

OFFICIAL_CLUB_COLORS = {
    # 🇫🇷 Ligue 1
    'psg': ('#004170', '#DA291C'),
    'marseille': ('#009BD0', '#FFFFFF'),
    'monaco': ('#E41B17', '#FFFFFF'),
    'lyon': ('#002F6C', '#DA291C'),
    'lille': ('#D00027', '#1D253C'),
    'lens': ('#E41B17', '#FFD200'),
    'rennes': ('#E41B17', '#000000'),
    'nice': ('#D00027', '#000000'),
    'strasbourg': ('#0072CE', '#FFFFFF'),
    'toulouse': ('#53267E', '#FFFFFF'),
    'reims': ('#D00027', '#FFFFFF'),
    'brest': ('#E41B17', '#FFFFFF'),
    'montpellier': ('#002B49', '#FF6600'),
    'nantes': ('#FFD200', '#007A33'),
    'auxerre': ('#002F6C', '#FFFFFF'),
    'angers': ('#000000', '#FFFFFF'),
    'saint-etienne': ('#00843D', '#FFFFFF'),
    'le-havre': ('#89BCEB', '#002F6C'),
    'paris-fc': ('#002F6C', '#FFFFFF'),
    'lorient': ('#F37021', '#000000'),
    'metz': ('#800000', '#FFFFFF'),
    'troyes': ('#0055A5', '#FFFFFF'),
    'le-mans': ('#E41B17', '#FFD200'),

    # 🇬🇧 Premier League
    'arsenal': ('#EF0107', '#063672'),
    'aston-villa': ('#670E36', '#95BFE5'),
    'bournemouth': ('#DA291C', '#000000'),
    'brentford': ('#E30613', '#FFFFFF'),
    'brighton': ('#0057B8', '#FFCD00'),
    'chelsea': ('#034694', '#EE242C'),
    'crystal-palace': ('#1B458F', '#C4122E'),
    'everton': ('#003399', '#FFFFFF'),
    'fulham': ('#000000', '#FFFFFF'),
    'ipswich': ('#003399', '#ED1B24'),
    'leicester': ('#003090', '#FDBE11'),
    'liverpool': ('#C8102E', '#00B2A9'),
    'manchester-city': ('#6CABDD', '#1C2C5B'),
    'manchester-united': ('#DA291C', '#FBE122'),
    'newcastle': ('#000000', '#FFFFFF'),
    'nottingham-forest': ('#DD0000', '#FFFFFF'),
    'southampton': ('#D71920', '#130C0E'),
    'tottenham': ('#132257', '#FFFFFF'),
    'west-ham': ('#7A263A', '#1BB1E7'),
    'wolves': ('#FDB913', '#231F20'),
    'burnley': ('#6C1D45', '#99D6EA'),
    'leeds': ('#FFCD00', '#1D428A'),

    # 🇪🇸 La Liga
    'real-madrid': ('#FFFFFF', '#EEB732'),
    'barcelona': ('#004D98', '#A50044'),
    'fc-barcelona': ('#004D98', '#A50044'),
    'atletico-madrid': ('#CB3524', '#272E61'),
    'real-sociedad': ('#0067B1', '#FFFFFF'),
    'athletic-club': ('#EE2524', '#000000'),
    'real-betis': ('#0BB364', '#FFFFFF'),
    'villarreal-cf': ('#FFE600', '#00519E'),
    'valencia-cf': ('#000000', '#EE7526'),
    'sevilla-fc': ('#D4001F', '#FFFFFF'),
    'girona': ('#CD1318', '#FFFFFF'),
    'celta-vigo': ('#8AC3EE', '#DA291C'),
    'osasuna': ('#D00027', '#0A1C2A'),
    'mallorca': ('#E42518', '#000000'),
    'rayo-vallecano': ('#FFFFFF', '#E30613'),
    'alaves': ('#005CA9', '#FFFFFF'),
    'las-palmas': ('#FFE900', '#00629B'),
    'getafe-cf': ('#005BA9', '#DA291C'),
    'espanyol': ('#007FC8', '#FFFFFF'),
    'valladolid': ('#5A2E85', '#FFFFFF'),
    'leganes': ('#005CA9', '#FFFFFF'),

    # 🇮🇹 Serie A
    'inter-milan': ('#010E80', '#000000'),
    'ac-milan': ('#FB090B', '#000000'),
    'juventus': ('#000000', '#FFFFFF'),
    'napoli': ('#12A0D7', '#FFFFFF'),
    'atalanta': ('#1E71B8', '#000000'),
    'as-rome': ('#8E1F2F', '#F0BC42'),
    'lazio': ('#87D8F7', '#FFFFFF'),
    'fiorentina': ('#4F2683', '#FFFFFF'),
    'bologna': ('#1A2C42', '#A31B24'),
    'torino': ('#8A1B29', '#FFFFFF'),
    'monza': ('#E30613', '#FFFFFF'),
    'genoa': ('#9F1B32', '#002D62'),
    'udinese': ('#000000', '#FFFFFF'),
    'parma': ('#FFE000', '#002B49'),
    'cagliari': ('#C8102E', '#00205B'),
    'hellas-verona': ('#002F6C', '#FFD200'),
    'como': ('#003399', '#FFFFFF'),
    'empoli': ('#005BA9', '#FFFFFF'),
    'lecce': ('#E30613', '#FFD200'),
    'venise': ('#F37021', '#007A33'),

    # 🇩🇪 Bundesliga
    'bayern-munich': ('#DC052D', '#0066B2'),
    'bayer-leverkusen': ('#E32221', '#000000'),
    'borussia-dortmund': ('#FDE100', '#000000'),
    'rb-leipzig': ('#DB003F', '#0C2340'),
    'eintracht-frankfurt': ('#E1000F', '#000000'),
    'vfb-stuttgart': ('#E32219', '#FFFFFF'),
    'vfl-wolfsburg': ('#65B32E', '#002F6C'),
    'borussia-monchengladbach': ('#000000', '#00A650'),
    'sc-freiburg': ('#000000', '#DA291C'),
    'tsg-hoffenheim': ('#005CA9', '#FFFFFF'),
    'werder-bremen': ('#1D9053', '#FFFFFF'),
    'augsburg': ('#BA3329', '#006249'),
    'mainz-05': ('#C50014', '#FFFFFF'),
    'union-berlin': ('#EB1923', '#FFD200'),
    'vfl-bochum': ('#005CA9', '#FFFFFF'),
    'fc-st-pauli': ('#532616', '#FFFFFF'),
    'holstein-kiel': ('#003399', '#DA291C'),
    'heidenheim': ('#003399', '#DA291C'),

    # 🇪🇺 Europe
    'ajax': ('#D2122E', '#FFFFFF'),
    'benfica': ('#E41B17', '#FFFFFF'),
    'porto': ('#0038A8', '#FFFFFF'),
    'sporting-cp': ('#008057', '#FFFFFF'),
    'galatasaray': ('#A32638', '#FCB514'),
    'fenerbahce': ('#002D62', '#FFE500'),
    'copenhague': ('#003399', '#FFFFFF'),
    'panathinaikos': ('#007A33', '#FFFFFF'),
}

VERIFIED_WIKIMEDIA_SVGS = {
    'CLUB_MARSEILLE': 'https://upload.wikimedia.org/wikipedia/commons/d/d8/Olympique_Marseille_logo.svg',
    'CLUB_PSG': 'https://upload.wikimedia.org/wikipedia/fr/8/86/Paris_Saint-Germain_Logo.svg',
    'CLUB_MONACO': 'https://upload.wikimedia.org/wikipedia/en/b/ba/AS_Monaco_FC.svg',
    'CLUB_LYON': 'https://upload.wikimedia.org/wikipedia/en/c/c6/Olympique_Lyonnais.svg',
    'CLUB_LILLE': 'https://upload.wikimedia.org/wikipedia/fr/6/62/Logo_LOSC_Lille_2018.svg',
    'CLUB_LENS': 'https://upload.wikimedia.org/wikipedia/en/c/cc/RC_Lens_logo.svg',
    'CLUB_RENNES': 'https://upload.wikimedia.org/wikipedia/en/9/9e/Stade_Rennais_FC.svg',
    'CLUB_NICE': 'https://upload.wikimedia.org/wikipedia/en/2/2e/OGC_Nice_logo.svg',
    'CLUB_STRASBOURG': 'https://upload.wikimedia.org/wikipedia/en/8/80/Racing_Club_de_Strasbourg_Alsace_logo.svg',
    'CLUB_TOULOUSE': 'https://upload.wikimedia.org/wikipedia/en/2/23/Toulouse_FC_logo.svg',
    'CLUB_BREST': 'https://upload.wikimedia.org/wikipedia/en/0/05/Stade_Brestois_29_logo.svg',
    'CLUB_NANTES': 'https://upload.wikimedia.org/wikipedia/commons/5/5c/FC_Nantes_2019_logo.svg',
    'CLUB_MONTPELLIER': 'https://upload.wikimedia.org/wikipedia/commons/9/99/Montpellier_HSC_logo.svg',
    'CLUB_ANGERS': 'https://upload.wikimedia.org/wikipedia/fr/4/4b/Angers_SCO_logo.svg',
    'CLUB_LE_HAVRE': 'https://upload.wikimedia.org/wikipedia/en/7/7c/Le_Havre_AC_logo.svg',
    'CLUB_AUXERRE': 'https://upload.wikimedia.org/wikipedia/fr/4/45/Logo_AJ_Auxerre.svg',
    'CLUB_PARIS_FC': 'https://upload.wikimedia.org/wikipedia/commons/0/08/Paris_Football_Club_%28logo%29.svg',
    'CLUB_LORIENT': 'https://upload.wikimedia.org/wikipedia/en/f/f8/FC_Lorient_logo.svg',
    'CLUB_SAINT_ETIENNE': 'https://upload.wikimedia.org/wikipedia/fr/4/43/Logo_AS_Saint-%C3%89tienne.svg',
    'CLUB_REIMS': 'https://upload.wikimedia.org/wikipedia/fr/0/03/Logo_Stade_de_Reims_2020.svg',
    'CLUB_ARSENAL': 'https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg',
    'CLUB_ASTON_VILLA': 'https://upload.wikimedia.org/wikipedia/en/9/9f/Aston_Villa_logo.svg',
    'CLUB_CHELSEA': 'https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg',
    'CLUB_LIVERPOOL': 'https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg',
    'CLUB_MANCHESTER_CITY': 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg',
    'CLUB_MANCHESTER_UNITED': 'https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg',
    'CLUB_NEWCASTLE': 'https://upload.wikimedia.org/wikipedia/en/5/56/Newcastle_United_Logo.svg',
    'CLUB_TOTTENHAM': 'https://upload.wikimedia.org/wikipedia/en/b/b4/Tottenham_Hotspur.svg',
    'CLUB_WEST_HAM': 'https://upload.wikimedia.org/wikipedia/en/c/c2/West_Ham_United_FC_logo.svg',
    'CLUB_BRIGHTON': 'https://upload.wikimedia.org/wikipedia/en/f/fd/Brighton_%26_Hove_Albion_logo.svg',
    'CLUB_REAL_MADRID': 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg',
    'CLUB_FC_BARCELONA': 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg',
    'CLUB_BARCELONA': 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg',
    'CLUB_REAL_SOCIEDAD': 'https://upload.wikimedia.org/wikipedia/en/f/f1/Real_Sociedad_logo.svg',
    'CLUB_ATHLETIC_CLUB': 'https://upload.wikimedia.org/wikipedia/en/9/98/Club_Athletic_Bilbao_logo.svg',
    'CLUB_REAL_BETIS': 'https://upload.wikimedia.org/wikipedia/en/1/13/Real_betis_logo.svg',
    'CLUB_INTER_MILAN': 'https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Internazionale_Milano_2021.svg',
    'CLUB_AC_MILAN': 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Logo_of_AC_Milan.svg',
    'CLUB_JUVENTUS': 'https://upload.wikimedia.org/wikipedia/commons/a/a8/Juventus_FC_-_Logo_%28Black_silhouette_on_white_background%29.svg',
    'CLUB_NAPOLI': 'https://upload.wikimedia.org/wikipedia/commons/2/2d/SSC_Neapel.svg',
    'CLUB_BAYERN_MUNICH': 'https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg',
    'CLUB_BORUSSIA_DORTMUND': 'https://upload.wikimedia.org/wikipedia/commons/6/67/Borussia_Dortmund_logo.svg',
    'CLUB_BAYER_LEVERKUSEN': 'https://upload.wikimedia.org/wikipedia/en/5/59/Bayer_04_Leverkusen_logo.svg',
    'CLUB_AJAX': 'https://upload.wikimedia.org/wikipedia/en/7/79/Ajax_Amsterdam.svg',
    'CLUB_BENFICA': 'https://upload.wikimedia.org/wikipedia/en/a/a2/SL_Benfica_logo.svg',
    'CLUB_PORTO': 'https://upload.wikimedia.org/wikipedia/en/f/f1/FC_Porto.svg',
    'CLUB_SPORTING_CP': 'https://upload.wikimedia.org/wikipedia/en/e/e1/Sporting_Clube_de_Portugal_%28Logo%29.svg'
}

def extract_dominant_colors(image_bytes):
    try:
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
        small = img.resize((32, 32), Image.Resampling.NEAREST)
        quant = small.convert('RGB').quantize(colors=6)
        pal = quant.getpalette()[:18]
        
        c1 = f"#{pal[0]:02X}{pal[1]:02X}{pal[2]:02X}"
        c2 = f"#{pal[3]:02X}{pal[4]:02X}{pal[5]:02X}" if len(pal) >= 6 else "#FFFFFF"
        return c1, c2
    except Exception:
        return '#002F6C', '#FFFFFF'

def generate_fallback_svg(team_name, primary_color='#004170', secondary_color='#DA291C'):
    initials = "".join([w[0] for w in team_name.replace('-', ' ').split() if w])[:3].upper()
    if not initials:
        initials = "FC"
    
    clean_id = re.sub(r'[^a-zA-Z0-9]', '', initials)
    svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="grad_{clean_id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:{primary_color};stop-opacity:1" />
      <stop offset="100%" style="stop-color:{secondary_color};stop-opacity:1" />
    </linearGradient>
    <filter id="shadow_{clean_id}" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
  </defs>
  <path d="M256,24 C370,24 440,64 440,160 C440,320 320,448 256,488 C192,448 72,320 72,160 C72,64 142,24 256,24 Z" 
        fill="url(#grad_{clean_id})" stroke="#FFFFFF" stroke-width="12" filter="url(#shadow_{clean_id})" />
  <path d="M256,48 C350,48 416,84 416,160 C416,304 308,420 256,456 C204,420 96,304 96,160 C96,84 162,48 256,48 Z" 
        fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="6" />
  <text x="256" y="275" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
        font-size="{150 if len(initials) <= 2 else 115}" font-weight="900" fill="#FFFFFF" text-anchor="middle" 
        alignment-baseline="middle" letter-spacing="4" style="text-shadow: 0 4px 12px rgba(0,0,0,0.6);">{initials}</text>
</svg>"""
    return svg_content.encode('utf-8')

def download_asset(url):
    if not url:
        return None
    try:
        r = requests.get(url, headers={'User-Agent': USER_AGENT}, timeout=2.5)
        if r.status_code == 200 and len(r.content) > 50:
            return r.content
    except Exception:
        pass
    return None

def process_and_save_raster(raw_bytes, target_webp_path, target_png_path, size=(512, 512)):
    try:
        img = Image.open(io.BytesIO(raw_bytes))
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
        
        w, h = img.size
        target_w, target_h = size
        padding = int(target_w * 0.04)
        max_inner_w = target_w - (padding * 2)
        max_inner_h = target_h - (padding * 2)
        
        ratio = min(max_inner_w / w, max_inner_h / h)
        new_w = max(1, int(w * ratio))
        new_h = max(1, int(h * ratio))
        
        resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        canvas = Image.new('RGBA', size, (0, 0, 0, 0))
        offset_x = (target_w - new_w) // 2
        offset_y = (target_h - new_h) // 2
        canvas.paste(resized, (offset_x, offset_y), resized)
        
        canvas.save(target_webp_path, 'WEBP', quality=92, method=6)
        canvas.save(target_png_path, 'PNG', optimize=True)
        return True
    except Exception:
        return False

def ensure_db_schema(conn):
    cursor = conn.cursor()
    cols = [c[1] for c in cursor.execute("PRAGMA table_info(dim_teams);").fetchall()]
    
    if "logo_local_path" not in cols:
        cursor.execute("ALTER TABLE dim_teams ADD COLUMN logo_local_path VARCHAR(128);")
    if "has_local_logo" not in cols:
        cursor.execute("ALTER TABLE dim_teams ADD COLUMN has_local_logo BOOLEAN DEFAULT 0;")
    if "primary_color" not in cols:
        cursor.execute("ALTER TABLE dim_teams ADD COLUMN primary_color VARCHAR(16);")
    if "secondary_color" not in cols:
        cursor.execute("ALTER TABLE dim_teams ADD COLUMN secondary_color VARCHAR(16);")
    if "logo_format" not in cols:
        cursor.execute("ALTER TABLE dim_teams ADD COLUMN logo_format VARCHAR(8) DEFAULT 'SVG';")
    if "logo_updated_at" not in cols:
        cursor.execute("ALTER TABLE dim_teams ADD COLUMN logo_updated_at TIMESTAMP;")
    
    conn.commit()

def process_single_team(team, master_dict):
    t_id = team['team_id']
    t_name = team['name']
    t_slug = team['slug']
    t_league = team['league_id']
    
    file_base = t_id.lower()
    svg_target = os.path.join(PUBLIC_TEAMS_DIR, f"{file_base}.svg")
    webp_target = os.path.join(PUBLIC_TEAMS_DIR, f"{file_base}.webp")
    png_target = os.path.join(PUBLIC_TEAMS_DIR, f"{file_base}.png")
    
    dist_svg = os.path.join(DIST_TEAMS_DIR, f"{file_base}.svg")
    dist_webp = os.path.join(DIST_TEAMS_DIR, f"{file_base}.webp")
    dist_png = os.path.join(DIST_TEAMS_DIR, f"{file_base}.png")
    
    c_primary, c_secondary = OFFICIAL_CLUB_COLORS.get(t_slug, ('#002F6C', '#FFFFFF'))
    
    has_svg = os.path.exists(svg_target)
    has_raster = os.path.exists(webp_target)
    
    if not has_svg and not has_raster:
        svg_url = VERIFIED_WIKIMEDIA_SVGS.get(t_id)
        svg_data = None
        if svg_url:
            svg_data = download_asset(svg_url)
        
        fotmob_id = None
        for tm_t in master_dict.values():
            if tm_t.get('canonical_name') == t_name or tm_t.get('short_name') == t_name or t_slug in [a.lower() for a in tm_t.get('aliases', [])]:
                logo_url_tm = tm_t.get('logo', '')
                f_match = re.search(r'/teamlogo/(\d+)\.png', logo_url_tm)
                if f_match:
                    fotmob_id = f_match.group(1)
                    break
        
        raster_data = None
        if fotmob_id:
            fotmob_url = f"https://images.fotmob.com/image_resources/logo/teamlogo/{fotmob_id}.png"
            raster_data = download_asset(fotmob_url)
        
        if svg_data and (b'<svg' in svg_data or b'<?xml' in svg_data):
            with open(svg_target, 'wb') as f:
                f.write(svg_data)
            with open(dist_svg, 'wb') as f:
                f.write(svg_data)
            has_svg = True
        
        if raster_data:
            if process_and_save_raster(raster_data, webp_target, png_target):
                shutil.copy2(webp_target, dist_webp)
                shutil.copy2(png_target, dist_png)
                has_raster = True
                if t_slug not in OFFICIAL_CLUB_COLORS:
                    c1, c2 = extract_dominant_colors(raster_data)
                    c_primary, c_secondary = c1, c2
        
        if not has_svg and not has_raster:
            fallback_svg_bytes = generate_fallback_svg(t_name, c_primary, c_secondary)
            with open(svg_target, 'wb') as f:
                f.write(fallback_svg_bytes)
            with open(dist_svg, 'wb') as f:
                f.write(fallback_svg_bytes)
            has_svg = True
    
    if t_slug and t_slug != file_base:
        slug_svg = os.path.join(PUBLIC_TEAMS_DIR, f"{t_slug}.svg")
        slug_webp = os.path.join(PUBLIC_TEAMS_DIR, f"{t_slug}.webp")
        if has_svg and os.path.exists(svg_target):
            shutil.copy2(svg_target, slug_svg)
            shutil.copy2(svg_target, os.path.join(DIST_TEAMS_DIR, f"{t_slug}.svg"))
        if has_raster and os.path.exists(webp_target):
            shutil.copy2(webp_target, slug_webp)
            shutil.copy2(webp_target, os.path.join(DIST_TEAMS_DIR, f"{t_slug}.webp"))
    
    local_rel_path = f"/assets/teams/{file_base}.svg" if has_svg else f"/assets/teams/{file_base}.webp"
    logo_fmt = "SVG" if has_svg else "WEBP"
    
    return {
        'team_id': t_id,
        'name': t_name,
        'league': t_league,
        'local_rel_path': local_rel_path,
        'primary_color': c_primary,
        'secondary_color': c_secondary,
        'logo_format': logo_fmt
    }

def process_master_team(item):
    tm_id, tm_data = item
    file_base = tm_id.lower()
    svg_target = os.path.join(PUBLIC_TEAMS_DIR, f"{file_base}.svg")
    webp_target = os.path.join(PUBLIC_TEAMS_DIR, f"{file_base}.webp")
    png_target = os.path.join(PUBLIC_TEAMS_DIR, f"{file_base}.png")
    
    if os.path.exists(svg_target):
        tm_data['local_logo'] = f"/assets/teams/{file_base}.svg"
        return tm_data
    if os.path.exists(webp_target):
        tm_data['local_logo'] = f"/assets/teams/{file_base}.webp"
        return tm_data
    
    raw_logo = tm_data.get('logo', '')
    r_data = download_asset(raw_logo)
    t_name = tm_data.get('canonical_name') or tm_data.get('short_name')
    
    c_prim, c_sec = ('#002F6C', '#FFFFFF')
    has_raster = False
    if r_data:
        if process_and_save_raster(r_data, webp_target, png_target):
            has_raster = True
            c_prim, c_sec = extract_dominant_colors(r_data)
            shutil.copy2(webp_target, os.path.join(DIST_TEAMS_DIR, f"{file_base}.webp"))
            shutil.copy2(png_target, os.path.join(DIST_TEAMS_DIR, f"{file_base}.png"))
    
    if not has_raster:
        f_svg = generate_fallback_svg(t_name, c_prim, c_sec)
        with open(svg_target, 'wb') as f:
            f.write(f_svg)
        with open(os.path.join(DIST_TEAMS_DIR, f"{file_base}.svg"), 'wb') as f:
            f.write(f_svg)
        tm_data['local_logo'] = f"/assets/teams/{file_base}.svg"
    else:
        tm_data['local_logo'] = f"/assets/teams/{file_base}.webp"
    
    tm_data['primary_color'] = c_prim
    tm_data['secondary_color'] = c_sec
    return tm_data

def run_ingestion():
    print("=" * 80, flush=True)
    print(" 🚀 INGESTION DES LOGOS OFFICIELS HD (126 + 354 CLUBS)", flush=True)
    print("=" * 80, flush=True)
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    ensure_db_schema(conn)
    cursor = conn.cursor()
    
    db_teams = cursor.execute("SELECT team_id, league_id, name, short_name, slug, logo_url FROM dim_teams ORDER BY league_id, name").fetchall()
    print(f"📋 [Base] {len(db_teams)} clubs chargés depuis dim_teams.", flush=True)
    
    with open(TEAMS_MASTER_FILE, 'r', encoding='utf-8') as f:
        teams_master = json.load(f)
    
    master_dict = {t['team_id']: t for t in teams_master.get('teams', [])}
    
    print(f"⚡ Traitement des 126 clubs de dim_teams (6 workers)...", flush=True)
    results = []
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(process_single_team, dict(team), master_dict): team['team_id'] for team in db_teams}
        for fut in as_completed(futures):
            try:
                res = fut.result()
                results.append(res)
            except Exception as e:
                print(f"⚠️ Erreur: {e}", flush=True)
    
    for res in results:
        cursor.execute("""
            UPDATE dim_teams 
            SET logo_local_path = ?, has_local_logo = 1, primary_color = ?, secondary_color = ?, logo_format = ?, logo_updated_at = CURRENT_TIMESTAMP
            WHERE team_id = ?
        """, (res['local_rel_path'], res['primary_color'], res['secondary_color'], res['logo_format'], res['team_id']))
    
    conn.commit()
    print(f"✅ {len(results)} clubs de dim_teams mis à jour dans SQLite.", flush=True)
    
    print("\n⚡ Traitement des clubs additionnels du catalogue maître (6 workers)...", flush=True)
    master_items = list(master_dict.items())
    processed_master = []
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(process_master_team, item): item[0] for item in master_items}
        for fut in as_completed(futures):
            try:
                processed_master.append(fut.result())
            except Exception as e:
                print(f"⚠️ Erreur master: {e}", flush=True)
    
    teams_master['teams'] = processed_master
    with open(TEAMS_MASTER_FILE, 'w', encoding='utf-8') as f:
        json.dump(teams_master, f, ensure_ascii=False, indent=2)
    print(f"✅ src/data/teams_master.json synchronisé ({len(processed_master)} clubs).", flush=True)
    
    conn.close()
    
    total_assets = len(os.listdir(PUBLIC_TEAMS_DIR))
    print("\n" + "=" * 80, flush=True)
    print(" 🎉 BILAN DE L'INGESTION DES LOGOS OFFICIELS HD :", flush=True)
    print(f"  ├─ Clubs dim_teams traités : {len(db_teams)}", flush=True)
    print(f"  ├─ Total clubs catalogue maître : {len(processed_master)}", flush=True)
    print(f"  └─ Total assets créés dans public/assets/teams/ : {total_assets} fichiers", flush=True)
    print("=" * 80, flush=True)

if __name__ == "__main__":
    run_ingestion()
