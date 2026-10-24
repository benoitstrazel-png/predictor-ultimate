#!/usr/bin/env python3
"""
Open-Meteo Weather Fetcher for European Football Predictor V2.
Fetches temperature, precipitation, wind speed, and weather codes for match dates and stadium coordinates across 230+ European teams.
Synchronized with src/data/stadiums_master.json.
"""

import sys
import json
import os
import argparse
import urllib.request
import urllib.parse
from datetime import datetime

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
STADIUMS_MASTER_PATH = os.path.join(ROOT_DIR, "src", "data", "stadiums_master.json")

# Fallback stadium geocoordinates for core European clubs
DEFAULT_STADIA = {
    # ── Ligue 1 (France) ──
    "PSG": {"lat": 48.8414, "lon": 2.2530, "city": "Paris", "stadium": "Parc des Princes", "country": "France"},
    "Marseille": {"lat": 43.2698, "lon": 5.3959, "city": "Marseille", "stadium": "Orange Vélodrome", "country": "France"},
    "Lyon": {"lat": 45.7653, "lon": 4.9820, "city": "Décines-Charpieu", "stadium": "Groupama Stadium", "country": "France"},
    "Monaco": {"lat": 43.7276, "lon": 7.4156, "city": "Monaco", "stadium": "Stade Louis II", "country": "Monaco"},
    "Lille": {"lat": 50.6119, "lon": 3.1305, "city": "Villeneuve-d'Ascq", "stadium": "Decathlon Arena", "country": "France"},
    "Nice": {"lat": 43.6702, "lon": 7.1925, "city": "Nice", "stadium": "Allianz Riviera", "country": "France"},
    "Rennes": {"lat": 48.1075, "lon": -1.7029, "city": "Rennes", "stadium": "Roazhon Park", "country": "France"},
    "Lens": {"lat": 50.4328, "lon": 2.8149, "city": "Lens", "stadium": "Stade Bollaert-Delelis", "country": "France"},
    "Strasbourg": {"lat": 48.5599, "lon": 7.7543, "city": "Strasbourg", "stadium": "Stade de la Meinau", "country": "France"},
    "Nantes": {"lat": 47.2560, "lon": -1.5247, "city": "Nantes", "stadium": "Stade de la Beaujoire", "country": "France"},
    "Montpellier": {"lat": 43.6225, "lon": 3.8122, "city": "Montpellier", "stadium": "Stade de la Mosson", "country": "France"},
    "Toulouse": {"lat": 43.5831, "lon": 1.4341, "city": "Toulouse", "stadium": "Stadium de Toulouse", "country": "France"},
    "Brest": {"lat": 48.4036, "lon": -4.4608, "city": "Brest", "stadium": "Stade Francis-Le Blé", "country": "France"},
    "Reims": {"lat": 49.2467, "lon": 4.0253, "city": "Reims", "stadium": "Stade Auguste-Delaune", "country": "France"},
    "Saint-Etienne": {"lat": 45.4608, "lon": 4.3902, "city": "Saint-Étienne", "stadium": "Stade Geoffroy-Guichard", "country": "France"},
    "Angers": {"lat": 47.4600, "lon": -0.5306, "city": "Angers", "stadium": "Stade Raymond Kopa", "country": "France"},
    "Le Havre": {"lat": 49.4986, "lon": 0.1697, "city": "Le Havre", "stadium": "Stade Océane", "country": "France"},
    "Auxerre": {"lat": 47.7867, "lon": 3.5886, "city": "Auxerre", "stadium": "Stade de l'Abbé-Deschamps", "country": "France"},
    # ── Premier League ──
    "Liverpool": {"lat": 53.4308, "lon": -2.9608, "city": "Liverpool", "stadium": "Anfield", "country": "Angleterre"},
    "Manchester City": {"lat": 53.4831, "lon": -2.2004, "city": "Manchester", "stadium": "Etihad Stadium", "country": "Angleterre"},
    "Arsenal": {"lat": 51.5549, "lon": -0.1084, "city": "London", "stadium": "Emirates Stadium", "country": "Angleterre"},
    "Chelsea": {"lat": 51.4817, "lon": -0.1910, "city": "London", "stadium": "Stamford Bridge", "country": "Angleterre"},
    "Manchester United": {"lat": 53.4631, "lon": -2.2913, "city": "Manchester", "stadium": "Old Trafford", "country": "Angleterre"},
    # ── La Liga ──
    "Real Madrid": {"lat": 40.4531, "lon": -3.6883, "city": "Madrid", "stadium": "Santiago Bernabéu", "country": "Espagne"},
    "Barcelona": {"lat": 41.3809, "lon": 2.1228, "city": "Barcelona", "stadium": "Camp Nou / Montjuïc", "country": "Espagne"},
    "Atletico Madrid": {"lat": 40.4362, "lon": -3.5995, "city": "Madrid", "stadium": "Cívitas Metropolitano", "country": "Espagne"},
    # ── Serie A ──
    "Inter": {"lat": 45.4781, "lon": 9.1240, "city": "Milan", "stadium": "San Siro", "country": "Italie"},
    "Juventus": {"lat": 45.1096, "lon": 7.6413, "city": "Turin", "stadium": "Allianz Stadium", "country": "Italie"},
    "Napoli": {"lat": 40.8279, "lon": 14.1930, "city": "Napoli", "stadium": "Stadio Diego Armando Maradona", "country": "Italie"},
    # ── Bundesliga ──
    "Bayern Munich": {"lat": 48.2188, "lon": 11.6247, "city": "Munich", "stadium": "Allianz Arena", "country": "Allemagne"},
    "Borussia Dortmund": {"lat": 51.4926, "lon": 7.4518, "city": "Dortmund", "stadium": "Signal Iduna Park", "country": "Allemagne"},
    "Bayer Leverkusen": {"lat": 51.0383, "lon": 6.9831, "city": "Leverkusen", "stadium": "BayArena", "country": "Allemagne"},
}

STADIA_COORDINATES = dict(DEFAULT_STADIA)
if os.path.exists(STADIUMS_MASTER_PATH):
    try:
        with open(STADIUMS_MASTER_PATH, "r", encoding="utf-8") as f:
            master_data = json.load(f)
            if isinstance(master_data, dict):
                STADIA_COORDINATES.update(master_data)
    except Exception:
        pass

WEATHER_CODES = {
    0: "Clear Sky",
    1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing Rime Fog",
    51: "Light Drizzle", 53: "Moderate Drizzle", 55: "Dense Drizzle",
    61: "Slight Rain", 63: "Moderate Rain", 65: "Heavy Rain",
    71: "Slight Snow", 73: "Moderate Snow", 75: "Heavy Snow",
    80: "Slight Rain Showers", 81: "Moderate Rain Showers", 82: "Violent Rain Showers",
    95: "Thunderstorm"
}

def resolve_stadium(team_name: str):
    """Résout le stade et les coordonnées GPS pour un club."""
    if not team_name:
        return None, True
    
    clean = team_name.strip()
    if clean in STADIA_COORDINATES:
        return STADIA_COORDINATES[clean], False
    
    # Recherche insensible à la casse ou partielle
    lower = clean.lower()
    for key, val in STADIA_COORDINATES.items():
        if key.lower() == lower or key.lower() in lower or lower in key.lower():
            return val, False
            
    # Équipe non référencée : pas de coordonnées GPS simulées arbitraires
    return {
        "lat": None,
        "lon": None,
        "city": clean,
        "stadium": f"Stade de {clean}",
        "country": "Inconnu"
    }, True

def fetch_weather_for_location(lat, lon, date_str):
    """Interroge l'API Open-Meteo pour des coordonnées GPS précises."""
    if lat is None or lon is None:
        return {
            "weather_code": 2,
            "condition": "Partly Cloudy (Estimated)",
            "temp_avg_c": 16.0,
            "temp_max_c": 18.0,
            "temp_min_c": 14.0,
            "precipitation_mm": 0.0,
            "wind_speed_kmh": 12.0,
            "note": "Estimated values (No certified GPS coordinates)"
        }
        
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto&start_date={date_str}&end_date={date_str}"
    
    req = urllib.request.Request(url, headers={'User-Agent': 'FootballPredictor/2.0'})
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            daily = data.get('daily', {})
            weather_code = daily.get('weathercode', [0])[0]
            temp_max = daily.get('temperature_2m_max', [20])[0]
            temp_min = daily.get('temperature_2m_min', [10])[0]
            precip = daily.get('precipitation_sum', [0.0])[0]
            wind = daily.get('windspeed_10m_max', [10.0])[0]
            
            return {
                "weather_code": weather_code,
                "condition": WEATHER_CODES.get(weather_code, "Partly Cloudy"),
                "temp_avg_c": round((temp_max + temp_min) / 2.0, 1),
                "temp_max_c": temp_max,
                "temp_min_c": temp_min,
                "precipitation_mm": precip,
                "wind_speed_kmh": wind
            }
    except Exception as e:
        return {
            "weather_code": 2,
            "condition": "Partly Cloudy",
            "temp_avg_c": 18.5,
            "precipitation_mm": 0.0,
            "wind_speed_kmh": 12.0,
            "error": str(e)
        }

def main():
    parser = argparse.ArgumentParser(description="Fetch match weather data via Open-Meteo for 230+ European stadiums")
    parser.add_argument("--team", type=str, default="PSG", help="Home team name")
    parser.add_argument("--date", type=str, default=datetime.now().strftime("%Y-%m-%d"), help="Match date (YYYY-MM-DD)")
    parser.add_argument("--output", type=str, help="Path to save JSON result")
    
    args = parser.parse_args()
    
    coords, is_unknown = resolve_stadium(args.team)
    weather_info = fetch_weather_for_location(coords["lat"], coords["lon"], args.date)
    
    result = {
        "team": args.team,
        "city": coords["city"],
        "stadium": coords["stadium"],
        "country": coords.get("country", "Inconnu"),
        "date": args.date,
        "is_certified_stadium": not is_unknown,
        "weather": weather_info
    }
    
    output_json = json.dumps(result, indent=2, ensure_ascii=False)
    print(output_json)
    
    if args.output:
        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output_json)

if __name__ == "__main__":
    main()
