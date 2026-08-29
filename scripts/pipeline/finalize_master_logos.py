#!/usr/bin/env python3
"""
scripts/pipeline/finalize_master_logos.py
─────────────────────────────────────────────────────────────
Garantit 100% de couverture des logos pour tous les clubs de teams_master.json
et synchronise le répertoire public/assets/teams/ et dist/assets/teams/.
"""

import os
import sys
import re
import json
import sqlite3

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PUBLIC_TEAMS_DIR = os.path.join(ROOT_DIR, "public", "assets", "teams")
DIST_TEAMS_DIR = os.path.join(ROOT_DIR, "dist", "assets", "teams")
TEAMS_MASTER_FILE = os.path.join(ROOT_DIR, "src", "data", "teams_master.json")

os.makedirs(PUBLIC_TEAMS_DIR, exist_ok=True)
os.makedirs(DIST_TEAMS_DIR, exist_ok=True)

def generate_fallback_svg(team_name, primary_color='#002F6C', secondary_color='#FFFFFF'):
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

def main():
    with open(TEAMS_MASTER_FILE, 'r', encoding='utf-8') as f:
        tm = json.load(f)
    
    count_done = 0
    for t in tm['teams']:
        tm_id = t['team_id']
        file_base = tm_id.lower()
        t_name = t.get('canonical_name') or t.get('short_name')
        
        svg_target = os.path.join(PUBLIC_TEAMS_DIR, f"{file_base}.svg")
        webp_target = os.path.join(PUBLIC_TEAMS_DIR, f"{file_base}.webp")
        png_target = os.path.join(PUBLIC_TEAMS_DIR, f"{file_base}.png")
        
        if os.path.exists(svg_target):
            t['local_logo'] = f"/assets/teams/{file_base}.svg"
            count_done += 1
            continue
        if os.path.exists(webp_target):
            t['local_logo'] = f"/assets/teams/{file_base}.webp"
            count_done += 1
            continue
        
        c1 = t.get('primary_color') or '#002F6C'
        c2 = t.get('secondary_color') or '#EAB308'
        f_svg = generate_fallback_svg(t_name, c1, c2)
        with open(svg_target, 'wb') as f:
            f.write(f_svg)
        with open(os.path.join(DIST_TEAMS_DIR, f"{file_base}.svg"), 'wb') as f:
            f.write(f_svg)
        
        t['local_logo'] = f"/assets/teams/{file_base}.svg"
        t['primary_color'] = c1
        t['secondary_color'] = c2
        count_done += 1

    with open(TEAMS_MASTER_FILE, 'w', encoding='utf-8') as f:
        json.dump(tm, f, ensure_ascii=False, indent=2)

    total_public_files = len(os.listdir(PUBLIC_TEAMS_DIR))
    print(f"✅ Couverture 100% : {count_done} / {len(tm['teams'])} clubs dans teams_master.json !")
    print(f"📁 Total assets dans public/assets/teams/ : {total_public_files} fichiers")

if __name__ == "__main__":
    main()
