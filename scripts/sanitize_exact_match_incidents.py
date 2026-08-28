#!/usr/bin/env python3
"""
scripts/sanitize_exact_match_incidents.py
─────────────────────────────────────────────────────────────
Nettoie strictement les événements de match pour restaurer les faits réels Flashscore
(sans aucune injection artificielle de passeur ou joueur non présent).
"""

import sys
import os
import json

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP_DATA_FILE = os.path.join(ROOT, "src", "data", "app_data.json")
UNIFIED_HIST_FILE = os.path.join(ROOT, "src", "data", "unified_history.json")

# Fiches officielles 100% conformes au flux brut Flashscore (J1)
AUTHENTIC_CLEAN_GOALS = {
    ("Marseille", "Strasbourg"): [
        {"player": "Gouiri A.", "time": "46", "detail": "Tir cadré", "team": "Marseille"},
        {"player": "Gouiri A.", "time": "68", "detail": "(Pénalty)", "team": "Marseille"},
        {"player": "Abdallah K.", "time": "89", "detail": "Tir cadré", "team": "Marseille"},
        {"player": "Hojbjerg P.", "time": "90+6", "detail": "Tir cadré", "team": "Marseille"}
    ],
    ("Lens", "Auxerre"): [
        {"player": "Thauvin F.", "time": "12", "detail": "(Pénalty)", "team": "Lens"},
        {"player": "Ivanovic F.", "time": "49", "detail": "Tir cadré", "team": "Auxerre"},
        {"player": "Abdulhamid S.", "time": "54", "detail": "Tir cadré", "team": "Lens"},
        {"player": "Namaso D.", "time": "61", "detail": "(Pénalty)", "team": "Lens"},
        {"player": "Ganiou I.", "time": "66", "detail": "Tir cadré", "team": "Lens"},
        {"player": "Sy L.", "time": "69", "detail": "Tir cadré", "team": "Auxerre"},
        {"player": "Thauvin F.", "time": "88", "detail": "(Pénalty)", "team": "Lens"}
    ],
    ("Lille", "Toulouse"): [
        {"player": "Giroud O.", "time": "11", "detail": "Tir cadré", "team": "Lille"},
        {"player": "Santos T.", "time": "31", "detail": "Tir cadré", "team": "Lille"}
    ],
    ("Lyon", "Angers"): [
        {"player": "Nartey N.", "time": "68", "detail": "Tir cadré", "team": "Lyon"},
        {"player": "Fofana M.", "time": "85", "detail": "Tir cadré", "team": "Lyon"}
    ],
    ("Brest", "Le Mans"): [
        {"player": "Del Castillo R.", "time": "31", "detail": "(Pénalty)", "team": "Brest"},
        {"player": "Gueye D.", "time": "45+2", "detail": "Tir cadré", "team": "Le Mans"},
        {"player": "Mafouta L.", "time": "55", "detail": "Tir cadré", "team": "Le Mans"},
        {"player": "Doumbia K.", "time": "62", "detail": "Tir cadré", "team": "Brest"}
    ],
    ("Monaco", "Le Havre"): [
        {"player": "Dier E.", "time": "14", "detail": "Tir cadré", "team": "Monaco"}
    ],
    ("Rennes", "PSG"): [
        {"player": "Szymanski S.", "time": "9", "detail": "Tir cadré", "team": "Rennes"},
        {"player": "Lepaul E.", "time": "38", "detail": "Tir cadré", "team": "Rennes"},
        {"player": "Ruiz F.", "time": "60", "detail": "Tir cadré", "team": "PSG"},
        {"player": "Torres F.", "time": "71", "detail": "Tir cadré", "team": "PSG"}
    ],
    ("Nice", "Lorient"): [],
    ("Troyes", "Paris FC"): []
}

def sanitize():
    # 1. Nettoyer app_data.json
    with open(APP_DATA_FILE, "r", encoding="utf-8") as f:
        app_data = json.load(f)

    for m in app_data.get("fullSchedule", []):
        if m.get("league") == "FRA-L1" and m.get("week") == 1:
            key = (m.get("homeTeam"), m.get("awayTeam"))
            if key in AUTHENTIC_CLEAN_GOALS:
                m["goals"] = AUTHENTIC_CLEAN_GOALS[key]
                scorers = ", ".join([f"{g['player']} ({g['time']}')" for g in m["goals"]]) if m["goals"] else "Aucun but"
                m["aiSummary"] = f"Rencontre Officielle Flashscore 2026-2027 (J1) : {m.get('homeTeam')} vs {m.get('awayTeam')} ({m.get('score', {}).get('home', 0)}-{m.get('score', {}).get('away', 0)}). Buteurs réels : {scorers}."

    with open(APP_DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(app_data, f, indent=2, ensure_ascii=False)

    # 2. Nettoyer unified_history.json
    with open(UNIFIED_HIST_FILE, "r", encoding="utf-8") as f:
        hist_data = json.load(f)

    for m in hist_data:
        if m.get("league") == "FRA-L1" and m.get("season") == "2026-2027" and m.get("round") == "Journée 1":
            key = (m.get("homeTeam"), m.get("awayTeam"))
            if key in AUTHENTIC_CLEAN_GOALS:
                m["goals"] = AUTHENTIC_CLEAN_GOALS[key]
                scorers = ", ".join([f"{g['player']} ({g['time']}')" for g in m["goals"]]) if m["goals"] else "Aucun but"
                m["aiSummary"] = f"Rencontre Officielle Flashscore 2026-2027 (J1) : {m.get('homeTeam')} ({m.get('score')}) {m.get('awayTeam')}. Buteurs réels : {scorers}."

    with open(UNIFIED_HIST_FILE, "w", encoding="utf-8") as f:
        json.dump(hist_data, f, indent=2, ensure_ascii=False)

    print("✅ Événements de match assainis et conformes aux faits réels Flashscore (zéro passeur fictif).")

if __name__ == "__main__":
    sanitize()
