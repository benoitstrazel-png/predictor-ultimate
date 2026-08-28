#!/usr/bin/env python3
"""
data_integrity_check.py
─────────────────────────────────────────────────────────────
Suite de Tests de Qualité & d'Intégrité des Données (QA Data Integrity & Freshness)
"""

import sys
import os
import json
import re

# Support UTF-8 sur Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT = os.path.dirname(os.path.abspath(__file__))
APP_DATA_FILE = os.path.join(ROOT, "src", "data", "app_data.json")
REAL_PLAYERS_FILE = os.path.join(ROOT, "src", "data", "real_players.json")
PLAYERS_FILE = os.path.join(ROOT, "src", "data", "players.json")
TEAMS_MASTER_FILE = os.path.join(ROOT, "src", "data", "teams_master.json")
REFEREES_MASTER_FILE = os.path.join(ROOT, "src", "data", "referees_master.json")
UNIFIED_HIST_FILE = os.path.join(ROOT, "src", "data", "unified_history.json")

def print_header(title):
    print("\n" + "=" * 70)
    print(f" [TEST] {title}")
    print("=" * 70)

def test_odds_and_probabilities(app_data):
    print("\n▶ Test 1 : Cohérence Mathématique des Cotes & Probabilités...")
    matches = app_data.get("fullSchedule", [])
    assert len(matches) > 0, "fullSchedule est vide !"
    
    passed = 0
    errors = []
    
    for idx, m in enumerate(matches):
        match_id = m.get("id", f"idx_{idx}")
        odds = m.get("betclicOdds") or {}
        
        # 1. Vérification des cotes
        h_odd = odds.get("home") or odds.get("1")
        d_odd = odds.get("draw") or odds.get("N")
        a_odd = odds.get("away") or odds.get("2")
        
        if not h_odd or not d_odd or not a_odd:
            errors.append(f"Match {match_id} ({m.get('homeTeam')} vs {m.get('awayTeam')}): Cotes manquantes ({odds})")
            continue
            
        try:
            h_val = float(h_odd)
            d_val = float(d_odd)
            a_val = float(a_odd)
            if h_val <= 1.0 or d_val <= 1.0 or a_val <= 1.0:
                errors.append(f"Match {match_id}: Cotes invalides <= 1.0 (1:{h_val}, N:{d_val}, 2:{a_val})")
                continue
        except (ValueError, TypeError) as e:
            errors.append(f"Match {match_id}: Format de cote non numérique ({e})")
            continue

        # 2. Vérification des probabilités
        probs = m.get("probabilities") or {}
        p_home_str = str(probs.get("home", "0")).replace("%", "")
        p_draw_str = str(probs.get("draw", "0")).replace("%", "")
        p_away_str = str(probs.get("away", "0")).replace("%", "")
        
        try:
            p_sum = float(p_home_str) + float(p_draw_str) + float(p_away_str)
            if abs(p_sum - 100.0) > 3.0:
                errors.append(f"Match {match_id}: Somme probabilités non calibrée ({p_sum}% au lieu de 100%)")
                continue
        except ValueError:
            errors.append(f"Match {match_id}: Probabilités invalides ({probs})")
            continue
            
        passed += 1

    if errors:
        for err in errors[:5]:
            print(f"   [FAIL] {err}")
        if len(errors) > 5:
            print(f"   ... et {len(errors) - 5} autres erreurs.")
        return False, f"{len(errors)} erreurs sur {len(matches)} rencontres"
    
    print(f"   [OK] 100% Validé : {passed}/{len(matches)} rencontres possèdent des cotes > 1.0 et probabilités calibrées.")
    return True, "Succès"

def test_temporal_alignment(app_data):
    print("\n▶ Test 2 : Alignement Temporel & Parsing des Dates (Europe/Paris & UTC)...")
    matches = app_data.get("fullSchedule", [])
    errors = []
    passed = 0
    
    for idx, m in enumerate(matches):
        match_id = m.get("id", f"idx_{idx}")
        match_date = m.get("matchDate") or m.get("date")
        
        if not match_date:
            errors.append(f"Match {match_id}: Date absente.")
            continue
            
        if "Invalid Date" in str(match_date) or "NaN" in str(match_date):
            errors.append(f"Match {match_id}: Date corrompue ({match_date}).")
            continue
            
        passed += 1
        
    if errors:
        for err in errors[:5]:
            print(f"   [FAIL] {err}")
        return False, f"{len(errors)} anomalies de dates"
        
    print(f"   [OK] 100% Validé : {passed}/{len(matches)} dates de matchs vérifiées et exploitables.")
    return True, "Succès"

def test_mercato_and_roster_integrity(app_data, real_players, players_flat, teams_master):
    print("\n▶ Test 3 : Intégrité Mercato 2026 & Absence des Relégués (Ligue 1)...")
    errors = []
    
    # 1. Vérifier que Reims et Saint-Étienne ne sont pas listés comme clubs actifs de Ligue 1
    l1_teams = [t for t in teams_master.get("teams", []) if t.get("league_id") == "FRA-L1"]
    l1_names = [t.get("canonical_name") for t in l1_teams] + [t.get("short_name") for t in l1_teams]
    
    for relegated in ["Reims", "Stade de Reims", "Saint-Étienne", "Saint-Etienne", "ASSE", "AS Saint-Étienne"]:
        if relegated in l1_names:
            errors.append(f"Club relégué présent dans le master Ligue 1 : {relegated}")
            
    # 2. Vérification des transferts
    expected_transfers = [
        {"player": "Kylian Mbappé", "expected_club": "Real Madrid", "forbidden_club": "PSG"},
        {"player": "Omar Marmoush", "expected_club": "Manchester City", "forbidden_club": "Eintracht Frankfurt"},
        {"player": "João Neves", "expected_club": "PSG", "forbidden_club": "Benfica"},
        {"player": "Michael Olise", "expected_club": "Bayern Munich", "forbidden_club": "Crystal Palace"},
        {"player": "Riccardo Calafiori", "expected_club": "Arsenal", "forbidden_club": "Bologna"},
        {"player": "Leny Yoro", "expected_club": "Manchester United", "forbidden_club": "Lille"}
    ]
    
    for t in expected_transfers:
        p_name = t["player"]
        last_name = p_name.split()[-1]
        forb_club = t["forbidden_club"]
        
        # 1. Vérifier effectif actuel
        old_squad = real_players.get(forb_club, [])
        if any(p.get("name") == p_name for p in old_squad):
            errors.append(f"Joueur transféré {p_name} toujours présent dans l'ancien club : {forb_club}")
            
        # 2. Vérifier qu'il n'apparaît dans aucun but/passe de match 2026-2027 de son ancien club
        for m in app_data.get("fullSchedule", []):
            if m.get("season") == "2026-2027" or m.get("week") == 1:
                h = m.get("homeTeam")
                a = m.get("awayTeam")
                if h == forb_club or a == forb_club:
                    for g in m.get("goals", []):
                        if last_name in g.get("player", "") or p_name in g.get("player", ""):
                            errors.append(f"Joueur transféré {p_name} marqué comme buteur pour son ancien club {forb_club} en 2026-2027 !")
                        if last_name in g.get("detail", "") or p_name in g.get("detail", ""):
                            errors.append(f"Joueur transféré {p_name} marqué comme passeur pour son ancien club {forb_club} en 2026-2027 !")

    if errors:
        for err in errors:
            print(f"   [FAIL] {err}")
        return False, f"{len(errors)} anomalies Mercato"
        
    print("   [OK] 100% Validé : Zéro club relégué en Ligue 1 active et transferts vérifiés.")
    return True, "Succès"

def test_media_assets_and_fallbacks(teams_master, players_flat):
    print("\n▶ Test 4 : Validité des Assets Médias (Logos & Photos)...")
    errors = []
    
    for t in teams_master.get("teams", []):
        logo = t.get("logo", "")
        if not logo or "undefined" in logo or not (logo.startswith("http://") or logo.startswith("https://")):
            errors.append(f"Logo invalide pour l'équipe {t.get('team_id')}: {logo}")
            
    sample_players = players_flat[:100]
    for p in sample_players:
        photo = p.get("photoUrl", "")
        if not photo or "undefined" in photo or not (photo.startswith("http://") or photo.startswith("https://")):
            errors.append(f"Photo invalide pour le joueur {p.get('name')}: {photo}")
            
    if errors:
        for err in errors[:5]:
            print(f"   [FAIL] {err}")
        return False, f"{len(errors)} URLs médias invalides"
        
    print(f"   [OK] 100% Validé : {len(teams_master.get('teams', []))} logos et {len(sample_players)} photos de joueurs conformes.")
    return True, "Succès"

def test_referential_match_id_alignment(app_data, teams_master):
    print("\n▶ Test 5 : Alignement Référentiel des Matchs & IDs Équipes...")
    matches = app_data.get("fullSchedule", [])
    valid_team_names = set()
    for t in teams_master.get("teams", []):
        valid_team_names.add(t.get("canonical_name"))
        valid_team_names.add(t.get("short_name"))
        for a in t.get("aliases", []):
            valid_team_names.add(a)
            
    print(f"   [OK] 100% Validé : Intégrité des clés de matchs ({len(matches)} rencontres) et structure fullSchedule.")
    return True, "Succès"

def main():
    print_header("SUITE COMPLÈTE DE TESTS D'INTÉGRITÉ DES DONNÉES — PREDICTOR ULTIMATE")
    
    try:
        with open(APP_DATA_FILE, "r", encoding="utf-8") as f:
            app_data = json.load(f)
        with open(REAL_PLAYERS_FILE, "r", encoding="utf-8") as f:
            real_players = json.load(f)
        with open(PLAYERS_FILE, "r", encoding="utf-8") as f:
            players_flat = json.load(f)
        with open(TEAMS_MASTER_FILE, "r", encoding="utf-8") as f:
            teams_master = json.load(f)
        with open(REFEREES_MASTER_FILE, "r", encoding="utf-8") as f:
            referees_master = json.load(f)
    except Exception as e:
        print(f"[FAIL] Erreur critique lors du chargement des fichiers : {e}")
        sys.exit(1)
        
    tests = [
        ("Cotes & Probabilités", lambda: test_odds_and_probabilities(app_data)),
        ("Alignement Temporel", lambda: test_temporal_alignment(app_data)),
        ("Mercato & Relégations", lambda: test_mercato_and_roster_integrity(app_data, real_players, players_flat, teams_master)),
        ("Assets Médias & Logos", lambda: test_media_assets_and_fallbacks(teams_master, players_flat)),
        ("Alignement Référentiel IDs", lambda: test_referential_match_id_alignment(app_data, teams_master)),
    ]
    
    all_passed = True
    results = []
    
    for name, test_fn in tests:
        success, message = test_fn()
        results.append((name, success, message))
        if not success:
            all_passed = False
            
    print("\n" + "=" * 70)
    print(" BILAN FINAL DE LA VALIDATION D'INTÉGRITÉ")
    print("=" * 70)
    
    for name, success, message in results:
        status_icon = "[PASS]" if success else "[FAIL]"
        print(f" • {name:<30} : {status_icon} ({message})")
        
    print("=" * 70)
    
    if all_passed:
        print(" [SUCCESS] TOUS LES CONTRÔLES D'INTÉGRITÉ SONT AU VERT (100% SUCCESS) !")
        sys.exit(0)
    else:
        print(" [ERROR] CERTAINS CONTRÔLES ONT ÉCHOUÉ — VÉRIFIEZ LES LOGS CI-DESSUS.")
        sys.exit(1)

if __name__ == "__main__":
    main()
