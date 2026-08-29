#!/usr/bin/env python3
"""
scripts/build_comprehensive_teams_master.py
─────────────────────────────────────────────────────────────
Génère le référentiel maître exhaustif des équipes (teams_master.json)
couvrant l'intégralité des 8 compétitions (Top 5 + 3 Coupes d'Europe).
"""

import os
import sys
import json
import re

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEAMS_MASTER_FILE = os.path.join(ROOT_DIR, "src", "data", "teams_master.json")

# Dictionnaire de standardisation des noms courts par ligue
CANONICAL_DISPLAY_NAMES = {
    # 🇫🇷 LIGUE 1
    "Paris Saint-Germain": "PSG", "Paris SG": "PSG", "PSG": "PSG",
    "Olympique de Marseille": "Marseille", "Marseille": "Marseille", "OM": "Marseille",
    "Olympique Lyonnais": "Lyon", "Lyon": "Lyon", "OL": "Lyon",
    "AS Monaco": "Monaco", "Monaco": "Monaco",
    "Lille": "Lille", "LOSC": "Lille", "Lille OSC": "Lille",
    "Lens": "Lens", "RC Lens": "Lens",
    "Rennes": "Rennes", "Stade Rennais": "Rennes", "Stade Rennais FC": "Rennes",
    "Nice": "Nice", "OGC Nice": "Nice",
    "Strasbourg": "Strasbourg", "RC Strasbourg": "Strasbourg", "RC Strasbourg Alsace": "Strasbourg",
    "Toulouse": "Toulouse", "Toulouse FC": "Toulouse",
    "Brest": "Brest", "Stade Brestois 29": "Brest", "Stade Brestois": "Brest",
    "Nantes": "Nantes", "FC Nantes": "Nantes",
    "Montpellier": "Montpellier", "Montpellier HSC": "Montpellier",
    "Angers": "Angers", "Angers SCO": "Angers",
    "Lorient": "Lorient", "FC Lorient": "Lorient",
    "Le Havre": "Le Havre", "Le Havre AC": "Le Havre", "HAC": "Le Havre",
    "Auxerre": "Auxerre", "AJ Auxerre": "Auxerre",
    "Paris FC": "Paris FC", "PFC": "Paris FC",
    "Saint-Étienne": "Saint-Étienne", "Saint-Etienne": "Saint-Étienne", "ASSE": "Saint-Étienne",
    "Reims": "Reims", "Stade de Reims": "Reims",
    "Metz": "Metz", "FC Metz": "Metz",
    "Clermont": "Clermont", "Clermont Foot": "Clermont",
    "Le Mans": "Le Mans", "Red Star": "Red Star",

    # 🇬🇧 PREMIER LEAGUE
    "Arsenal": "Arsenal",
    "Aston Villa": "Aston Villa",
    "AFC Bournemouth": "Bournemouth", "Bournemouth": "Bournemouth",
    "Brentford": "Brentford",
    "Brighton & Hove Albion": "Brighton", "Brighton": "Brighton",
    "Burnley": "Burnley",
    "Chelsea": "Chelsea",
    "Crystal Palace": "Crystal Palace",
    "Everton": "Everton",
    "Fulham": "Fulham",
    "Ipswich Town": "Ipswich", "Ipswich": "Ipswich",
    "Leeds United": "Leeds", "Leeds": "Leeds",
    "Leicester City": "Leicester", "Leicester": "Leicester",
    "Liverpool": "Liverpool",
    "Manchester City": "Manchester City", "Man City": "Manchester City",
    "Manchester United": "Manchester United", "Man United": "Manchester United", "Man Utd": "Manchester United",
    "Newcastle United": "Newcastle", "Newcastle": "Newcastle",
    "Nottingham Forest": "Nottingham Forest", "Nottingham": "Nottingham Forest",
    "Southampton": "Southampton",
    "Sunderland": "Sunderland",
    "Tottenham Hotspur": "Tottenham", "Tottenham": "Tottenham", "Spurs": "Tottenham",
    "West Ham United": "West Ham", "West Ham": "West Ham",
    "Wolverhampton Wanderers": "Wolves", "Wolves": "Wolves", "Wolverhampton": "Wolves",
    "Sheffield United": "Sheffield Utd", "Luton Town": "Luton",

    # 🇪🇸 LA LIGA
    "Athletic Club": "Athletic Club", "Athletic Bilbao": "Athletic Club",
    "Atlético Madrid": "Atlético Madrid", "Atletico Madrid": "Atlético Madrid", "Atl. Madrid": "Atlético Madrid",
    "Barcelona": "FC Barcelona", "FC Barcelona": "FC Barcelona", "Barca": "FC Barcelona",
    "Celta Vigo": "Celta Vigo", "Celta de Vigo": "Celta Vigo",
    "Deportivo Alavés": "Alavés", "Alaves": "Alavés",
    "Espanyol": "Espanyol", "RCD Espanyol": "Espanyol",
    "Getafe": "Getafe", "Getafe CF": "Getafe",
    "Girona": "Girona", "Girona FC": "Girona",
    "Las Palmas": "Las Palmas", "UD Las Palmas": "Las Palmas",
    "Leganés": "Leganés", "Leganes": "Leganés", "CD Leganés": "Leganés",
    "Mallorca": "Mallorca", "RCD Mallorca": "Mallorca",
    "Osasuna": "Osasuna", "CA Osasuna": "Osasuna",
    "Rayo Vallecano": "Rayo Vallecano",
    "Real Betis": "Betis", "Betis": "Betis",
    "Real Madrid": "Real Madrid",
    "Real Sociedad": "Real Sociedad", "Sociedad": "Real Sociedad",
    "Real Valladolid": "Valladolid", "Valladolid": "Valladolid",
    "Sevilla": "Sevilla", "Sevilla FC": "Sevilla",
    "Valencia": "Valencia", "Valencia CF": "Valencia",
    "Villarreal": "Villarreal", "Villarreal CF": "Villarreal",
    "Granada": "Granada", "Cadiz": "Cádiz", "Almeria": "Almería",
    "Levante": "Levante", "Elche": "Elche", "Oviedo": "Real Oviedo", "Racing Santander": "Racing Santander",

    # 🇮🇹 SERIE A
    "AC Milan": "AC Milan", "Milan": "AC Milan",
    "Atalanta": "Atalanta", "Atalanta BC": "Atalanta",
    "Bologna": "Bologna", "Bologna FC": "Bologna",
    "Cagliari": "Cagliari", "Cagliari Calcio": "Cagliari",
    "Como": "Como", "Côme": "Como", "Como 1907": "Como",
    "Cremonese": "Cremonese", "US Cremonese": "Cremonese",
    "Empoli": "Empoli", "Empoli FC": "Empoli",
    "Fiorentina": "Fiorentina", "ACF Fiorentina": "Fiorentina",
    "Genoa": "Genoa", "Genoa CFC": "Genoa",
    "Hellas Verona": "Verona", "Verona": "Verona",
    "Inter": "Inter Milan", "Inter Milan": "Inter Milan", "Internazionale": "Inter Milan", "FC Internazionale Milano": "Inter Milan",
    "Juventus": "Juventus", "Juve": "Juventus",
    "Lazio": "Lazio", "SS Lazio": "Lazio",
    "Lecce": "Lecce", "US Lecce": "Lecce",
    "Monza": "Monza", "AC Monza": "Monza",
    "Napoli": "Napoli", "SSC Napoli": "Napoli",
    "Parma": "Parma", "Parma Calcio": "Parma", "Parma Calcio 1913": "Parma",
    "Pisa": "Pisa", "Pisa SC": "Pisa",
    "Roma": "AS Roma", "AS Roma": "AS Roma",
    "Sassuolo": "Sassuolo", "US Sassuolo": "Sassuolo",
    "Torino": "Torino", "Torino FC": "Torino",
    "Udinese": "Udinese", "Udinese Calcio": "Udinese",
    "Venezia": "Venezia", "Venezia FC": "Venezia",
    "Frosinone": "Frosinone", "Salernitana": "Salernitana", "Spezia": "Spezia", "Palermo": "Palermo", "Sampdoria": "Sampdoria",

    # 🇩🇪 BUNDESLIGA
    "Augsburg": "Augsburg", "FC Augsburg": "Augsburg",
    "Bayer Leverkusen": "Bayer Leverkusen", "Leverkusen": "Bayer Leverkusen",
    "Bayern München": "Bayern Munich", "Bayern Munich": "Bayern Munich", "Bayern": "Bayern Munich", "FC Bayern München": "Bayern Munich",
    "Bochum": "Bochum", "VfL Bochum": "Bochum",
    "Borussia Dortmund": "Borussia Dortmund", "Dortmund": "Borussia Dortmund", "BVB": "Borussia Dortmund",
    "Borussia M'gladbach": "B. Monchengladbach", "Borussia Mönchengladbach": "B. Monchengladbach", "B. Monchengladbach": "B. Monchengladbach", "Gladbach": "B. Monchengladbach",
    "Eintracht Frankfurt": "Eintracht Frankfurt", "Frankfurt": "Eintracht Frankfurt",
    "FC Heidenheim": "Heidenheim", "Heidenheim": "Heidenheim", "1. FC Heidenheim": "Heidenheim",
    "FC Köln": "FC Koln", "FC Koln": "FC Koln", "1. FC Köln": "FC Koln", "Cologne": "FC Koln",
    "Freiburg": "Freiburg", "SC Freiburg": "Freiburg",
    "Hamburger SV": "Hambourg SV", "Hambourg SV": "Hambourg SV", "Hamburg": "Hambourg SV",
    "Hoffenheim": "Hoffenheim", "TSG Hoffenheim": "Hoffenheim", "TSG 1899 Hoffenheim": "Hoffenheim",
    "Holstein Kiel": "Holstein Kiel", "Kiel": "Holstein Kiel",
    "Mainz 05": "Mainz", "Mainz": "Mainz", "1. FSV Mainz 05": "Mainz",
    "RB Leipzig": "RB Leipzig", "Leipzig": "RB Leipzig",
    "St. Pauli": "St. Pauli", "FC St. Pauli": "St. Pauli",
    "Union Berlin": "Union Berlin", "1. FC Union Berlin": "Union Berlin",
    "VfB Stuttgart": "Stuttgart", "Stuttgart": "Stuttgart",
    "VfL Wolfsburg": "Wolfsburg", "Wolfsburg": "Wolfsburg",
    "Werder Bremen": "Werder Bremen", "Bremen": "Werder Bremen", "SV Werder Bremen": "Werder Bremen",
    "Darmstadt 98": "Darmstadt", "Darmstadt": "Darmstadt", "Schalke 04": "Schalke 04", "Hertha BSC": "Hertha Berlin", "Fortuna Dusseldorf": "Fortuna Düsseldorf",
}

def clean_slug(name):
    return re.sub(r'[^a-zA-Z0-9]', '_', name).upper()

def build_teams_master():
    print("🏗️ [MasterTeams] Génération du catalogue maître exhaustif des équipes...")
    
    # 1. Lire tous les fixtures réels dans data/raw
    teams_by_comp = {}
    team_logos = {}
    
    for root, dirs, files in os.walk(os.path.join(ROOT_DIR, "data", "raw")):
        if "fixtures_calendar.json" in files:
            parts = root.split(os.sep)
            comp = parts[-1]
            if comp not in teams_by_comp:
                teams_by_comp[comp] = set()
            try:
                with open(os.path.join(root, "fixtures_calendar.json"), 'r', encoding='utf-8') as f:
                    fixtures = json.load(f)
                    for fix in fixtures:
                        h = fix.get('home')
                        a = fix.get('away')
                        if isinstance(h, dict):
                            h_name = h.get('name')
                            h_id = h.get('id')
                            if h_name:
                                teams_by_comp[comp].add(h_name)
                                if h_id:
                                    team_logos[h_name] = f"https://images.fotmob.com/image_resources/logo/teamlogo/{h_id}.png"
                        if isinstance(a, dict):
                            a_name = a.get('name')
                            a_id = a.get('id')
                            if a_name:
                                teams_by_comp[comp].add(a_name)
                                if a_id:
                                    team_logos[a_name] = f"https://images.fotmob.com/image_resources/logo/teamlogo/{a_id}.png"
            except Exception as e:
                print(f"⚠️ Erreur lecture {root}: {e}")

    master_teams = []
    seen_ids = set()

    # Compétitions actives par équipe (relégués exclus de la ligue 1 active)
    RELEGATED_TEAMS = {
        "Reims": "FRA-L2", "Stade de Reims": "FRA-L2",
        "Saint-Étienne": "FRA-L2", "Saint-Etienne": "FRA-L2", "ASSE": "FRA-L2",
        "Clermont": "FRA-L2", "Clermont Foot": "FRA-L2", "Metz": "FRA-L2", "FC Metz": "FRA-L2", "Le Mans": "FRA-L2",
        "Sheffield United": "ENG-CH", "Luton Town": "ENG-CH", "Burnley": "ENG-CH",
        "Granada": "ESP-L2", "Cadiz": "ESP-L2", "Cádiz": "ESP-L2", "Almeria": "ESP-L2", "Almería": "ESP-L2",
        "Salernitana": "ITA-SB", "Frosinone": "ITA-SB", "Sassuolo": "ITA-SB", "Empoli": "ITA-SB",
        "Darmstadt 98": "GER-BL2", "Darmstadt": "GER-BL2", "Bochum": "GER-BL2", "Holstein Kiel": "GER-BL2"
    }

    for comp, raw_names in teams_by_comp.items():
        prefix = comp.split('-')[0] if '-' in comp else 'EUR'
        country_map = {
            'FRA-L1': 'France', 'ENG-PL': 'Angleterre', 'ESP-LL': 'Espagne',
            'ITA-SA': 'Italie', 'GER-BL': 'Allemagne', 'EUR-CL': 'Europe',
            'EUR-EL': 'Europe', 'EUR-ECL': 'Europe'
        }
        country = country_map.get(comp, 'Europe')

        for raw_name in sorted(list(raw_names)):
            display = CANONICAL_DISPLAY_NAMES.get(raw_name, raw_name)
            slug = clean_slug(display)[:14]
            team_id = f"{prefix}_{slug}"
            
            # Gestion des doublons cross-ligues
            if team_id in seen_ids:
                team_id = f"{prefix}_{slug}_{len(seen_ids)}"
            seen_ids.add(team_id)

            logo = team_logos.get(raw_name) or f"https://images.fotmob.com/image_resources/logo/teamlogo/default.png"
            
            aliases = list(set([
                raw_name, display, raw_name.replace('-', ' '), display.replace('-', ' ')
            ]))

            effective_league = RELEGATED_TEAMS.get(raw_name, RELEGATED_TEAMS.get(display, comp))
            
            master_teams.append({
                "team_id": team_id,
                "canonical_name": raw_name,
                "short_name": display,
                "league_id": effective_league,
                "country": country,
                "logo": logo,
                "aliases": aliases
            })

    output_data = {
        "version": "2026.3",
        "lastUpdated": "2026-08-28T18:00:00Z",
        "totalTeams": len(master_teams),
        "teams": master_teams
    }

    with open(TEAMS_MASTER_FILE, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"✅ [MasterTeams] {len(master_teams)} équipes enregistrées dans teams_master.json !")

if __name__ == "__main__":
    build_teams_master()
