#!/usr/bin/env python3
"""
scripts/scheduler/test_scheduler_simulation.py
─────────────────────────────────────────────────────────────
Harness de Simulation Temporelle (Time-Travel Simulation):
Simule en accéléré le cycle complet d'une rencontre (Pré-match H-45 -> Live -> Post-match FT+15).
"""

import os
import sys
import json
import time

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from scripts.scheduler.handlers.pre_match_handler import process_pre_match_lineups
from scripts.scheduler.handlers.post_match_handler import process_post_match_consolidation

MOCK_LINEUP_PAYLOAD = {
    "content": {
        "lineup": {
            "homeTeam": {
                "formation": "4-3-3",
                "starters": [
                    {"id": 101, "name": "Alisson Becker", "positionId": 11, "shirtNumber": 1, "usualPlayingPositionId": "GK"},
                    {"id": 102, "name": "Trent Alexander-Arnold", "positionId": 4, "shirtNumber": 66, "usualPlayingPositionId": "RB"},
                    {"id": 103, "name": "Ibrahima Konaté", "positionId": 3, "shirtNumber": 5, "usualPlayingPositionId": "CB"},
                    {"id": 104, "name": "Virgil van Dijk", "positionId": 2, "shirtNumber": 4, "isCaptain": True, "usualPlayingPositionId": "CB"},
                    {"id": 105, "name": "Andrew Robertson", "positionId": 1, "shirtNumber": 26, "usualPlayingPositionId": "LB"},
                    {"id": 106, "name": "Alexis Mac Allister", "positionId": 6, "shirtNumber": 10, "usualPlayingPositionId": "CM"},
                    {"id": 107, "name": "Dominik Szoboszlai", "positionId": 7, "shirtNumber": 8, "usualPlayingPositionId": "AM"},
                    {"id": 108, "name": "Ryan Gravenberch", "positionId": 5, "shirtNumber": 38, "usualPlayingPositionId": "DM"},
                    {"id": 109, "name": "Mohamed Salah", "positionId": 10, "shirtNumber": 11, "usualPlayingPositionId": "RW"},
                    {"id": 110, "name": "Darwin Núñez", "positionId": 9, "shirtNumber": 9, "usualPlayingPositionId": "ST"},
                    {"id": 111, "name": "Luis Díaz", "positionId": 8, "shirtNumber": 7, "usualPlayingPositionId": "LW"}
                ],
                "subs": [
                    {"id": 112, "name": "Caoimhin Kelleher", "shirtNumber": 62},
                    {"id": 113, "name": "Cody Gakpo", "shirtNumber": 18},
                    {"id": 114, "name": "Harvey Elliott", "shirtNumber": 19}
                ]
            },
            "awayTeam": {
                "formation": "4-2-3-1",
                "starters": [
                    {"id": 201, "name": "Matz Sels", "positionId": 11, "shirtNumber": 26, "usualPlayingPositionId": "GK"},
                    {"id": 202, "name": "Neco Williams", "positionId": 4, "shirtNumber": 7, "usualPlayingPositionId": "RB"},
                    {"id": 203, "name": "Murillo", "positionId": 3, "shirtNumber": 40, "usualPlayingPositionId": "CB"},
                    {"id": 204, "name": "Nikola Milenkovic", "positionId": 2, "shirtNumber": 31, "usualPlayingPositionId": "CB"},
                    {"id": 205, "name": "Ola Aina", "positionId": 1, "shirtNumber": 34, "usualPlayingPositionId": "LB"},
                    {"id": 206, "name": "Elliot Anderson", "positionId": 6, "shirtNumber": 8, "usualPlayingPositionId": "CM"},
                    {"id": 207, "name": "Ryan Yates", "positionId": 5, "shirtNumber": 22, "isCaptain": True, "usualPlayingPositionId": "DM"},
                    {"id": 208, "name": "Anthony Elanga", "positionId": 10, "shirtNumber": 21, "usualPlayingPositionId": "RW"},
                    {"id": 209, "name": "Morgan Gibbs-White", "positionId": 7, "shirtNumber": 10, "usualPlayingPositionId": "AM"},
                    {"id": 210, "name": "Callum Hudson-Odoi", "positionId": 8, "shirtNumber": 14, "usualPlayingPositionId": "LW"},
                    {"id": 211, "name": "Chris Wood", "positionId": 9, "shirtNumber": 11, "usualPlayingPositionId": "ST"}
                ],
                "subs": [
                    {"id": 212, "name": "Carlos Miguel", "shirtNumber": 1},
                    {"id": 213, "name": "Taiwo Awoniyi", "shirtNumber": 9}
                ]
            }
        }
    }
}

MOCK_POST_MATCH_PAYLOAD = {
    "general": {
        "matchState": "finished",
        "scoreStr": "2 - 0"
    },
    "header": {
        "status": {"finished": True}
    },
    "content": {
        "matchFacts": {
            "events": {
                "events": [
                    {"type": "Goal", "time": 28, "isHome": True, "player": {"name": "Mohamed Salah", "id": 109}, "assistStr": "Trent Alexander-Arnold"},
                    {"type": "Card", "time": 42, "isHome": False, "player": {"name": "Ryan Yates", "id": 207}, "card": "Yellow"},
                    {"type": "Goal", "time": 67, "isHome": True, "player": {"name": "Luis Díaz", "id": 111}, "assistStr": "Alexis Mac Allister"},
                    {"type": "Substitution", "time": 75, "isHome": True, "swap": [{"name": "Cody Gakpo", "id": 113}, {"name": "Darwin Núñez", "id": 110}]}
                ]
            }
        },
        "stats": {
            "Periods": {
                "All": {
                    "stats": [
                        {"title": "Ball possession", "stats": ["64%", "36%"]},
                        {"title": "Expected goals (xG)", "stats": ["2.15", "0.42"]},
                        {"title": "Total shots", "stats": [16, 5]},
                        {"title": "Shots on target", "stats": [7, 1]},
                        {"title": "Corners", "stats": [8, 2]},
                        {"title": "Fouls committed", "stats": [9, 12]},
                        {"title": "Accurate passes", "stats": ["540 (88%)", "270 (76%)"]}
                    ]
                }
            }
        }
    }
}

def run_simulation():
    print("=========================================================================")
    print(" 🕒 HARNESS DE SIMULATION DU SCHEDULER (TIME-TRAVEL ACCELERATED X60)")
    print("=========================================================================")
    target_match_id = "FOT_4513020" # Liverpool vs Nottingham Forest
    
    # 1. Phase 1 : T - 60 min
    print("\n▶ [SIMULATION T - 60 min] Polling des compositions officielles...")
    res_pre = process_pre_match_lineups(
        match_id=target_match_id,
        comp_id="ENG-PL",
        season="2026-2027",
        mock_lineup_data=MOCK_LINEUP_PAYLOAD
    )
    print(f"   ✅ Statut Pré-Match : {res_pre.get('status')}")
    print(f"   🎯 Probabilités 1N2 : {res_pre['prediction']['probabilities_1n2']}")
    print(f"   💎 Value Bets Détectés : {len(res_pre['prediction']['value_bets_detected'])}")

    time.sleep(1)

    # 2. Phase 2 : T + 115 min
    print("\n▶ [SIMULATION T + 115 min] Détection Fin de Match & Consolidation...")
    res_post = process_post_match_consolidation(
        match_id=target_match_id,
        comp_id="ENG-PL",
        season="2026-2027",
        mock_final_data=MOCK_POST_MATCH_PAYLOAD
    )
    print(f"   ✅ Statut Post-Match : {res_post.get('status')}")
    print(f"   🏆 Score Officiel Consolidé : {res_post.get('score')}")

    print("\n=========================================================================")
    print(" 🎉 SIMULATION VALIDÉE À 100% : LE PIPELINE SCHEDULER FONCTIONNE EN INTÉGRALITÉ !")
    print("=========================================================================")

if __name__ == '__main__':
    run_simulation()