#!/usr/bin/env python3
"""
scripts/harmonize_app_data.py
─────────────────────────────────────────────────────────────
Harmonise et normalise 100% des objets matchs de app_data.json
"""

import os
import json
import sys

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP_DATA_FILE = os.path.join(ROOT, "src", "data", "app_data.json")
TEAMS_MASTER_FILE = os.path.join(ROOT, "src", "data", "teams_master.json")

def harmonize():
    with open(APP_DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    with open(TEAMS_MASTER_FILE, "r", encoding="utf-8") as f:
        teams_master = json.load(f)
        
    team_logos = {}
    for t in teams_master.get("teams", []):
        team_logos[t.get("canonical_name")] = t.get("logo")
        team_logos[t.get("short_name")] = t.get("logo")
        for a in t.get("aliases", []):
            team_logos[a] = t.get("logo")

    schedule = data.get("fullSchedule", [])
    
    for idx, m in enumerate(schedule):
        # 1. Normalisation des probabilités
        p_home = 45
        p_draw = 25
        p_away = 30
        
        if "probabilities" in m and isinstance(m["probabilities"], dict):
            h_str = str(m["probabilities"].get("home", "45")).replace("%", "")
            d_str = str(m["probabilities"].get("draw", "25")).replace("%", "")
            a_str = str(m["probabilities"].get("away", "30")).replace("%", "")
            try:
                p_home = round(float(h_str))
                p_draw = round(float(d_str))
                p_away = round(float(a_str))
            except ValueError:
                pass
        elif "predictions" in m and isinstance(m["predictions"], dict):
            p_home = round(float(m["predictions"].get("probHome", 45)))
            p_draw = round(float(m["predictions"].get("probDraw", 25)))
            p_away = round(float(m["predictions"].get("probAway", 30)))
            
        total_p = p_home + p_draw + p_away
        if total_p != 100 and total_p > 0:
            p_home = round((p_home / total_p) * 100)
            p_draw = round((p_draw / total_p) * 100)
            p_away = 100 - p_home - p_draw
            
        m["probabilities"] = {
            "home": f"{p_home}%",
            "draw": f"{p_draw}%",
            "away": f"{p_away}%"
        }
        
        # 2. Normalisation des cotes
        odds = m.get("betclicOdds", {})
        h_odd = odds.get("home") or odds.get("1")
        d_odd = odds.get("draw") or odds.get("N")
        a_odd = odds.get("away") or odds.get("2")
        
        if not h_odd or float(h_odd) <= 1.0:
            h_odd = round(max(1.10, 1.0 / (max(0.05, p_home / 100.0)) * 1.06), 2)
        if not d_odd or float(d_odd) <= 1.0:
            d_odd = round(max(1.10, 1.0 / (max(0.05, p_draw / 100.0)) * 1.08), 2)
        if not a_odd or float(a_odd) <= 1.0:
            a_odd = round(max(1.10, 1.0 / (max(0.05, p_away / 100.0)) * 1.06), 2)
            
        m["betclicOdds"] = {
            "home": float(h_odd),
            "draw": float(d_odd),
            "away": float(a_odd)
        }
        
        # 3. Normalisation des logos
        if m.get("homeTeam") in team_logos and team_logos[m.get("homeTeam")]:
            m["homeLogo"] = team_logos[m.get("homeTeam")]
        if m.get("awayTeam") in team_logos and team_logos[m.get("awayTeam")]:
            m["awayLogo"] = team_logos[m.get("awayTeam")]
            
    data["fullSchedule"] = schedule
    if "nextMatches" in data:
        data["nextMatches"] = [m for m in schedule if m.get("status") in ["LIVE", "SCHEDULED"]][:10]
        
    with open(APP_DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        
    print(f"[OK] {len(schedule)} rencontres harmonisées avec succès dans app_data.json !")

if __name__ == "__main__":
    harmonize()
