#!/usr/bin/env python3
"""
Open-Meteo Weather Fetcher for European Football Predictor V2.
Fetches temperature, precipitation, wind speed, and weather codes for match dates and stadium coordinates across 89 teams.
"""

import sys
import json
import os
import argparse
import urllib.request
import urllib.parse
from datetime import datetime

# Stadium geocoordinates for 89 teams across 5 Top European Leagues
STADIA_COORDINATES = {
    # ── Ligue 1 (France) ──
    "PSG": {"lat": 48.8414, "lon": 2.2530, "city": "Paris", "stadium": "Parc des Princes"},
    "Marseille": {"lat": 43.2698, "lon": 5.3959, "city": "Marseille", "stadium": "Orange Vélodrome"},
    "Lyon": {"lat": 45.7653, "lon": 4.9820, "city": "Décines-Charpieu", "stadium": "Groupama Stadium"},
    "Monaco": {"lat": 43.7276, "lon": 7.4156, "city": "Monaco", "stadium": "Stade Louis II"},
    "Lille": {"lat": 50.6119, "lon": 3.1305, "city": "Villeneuve-d'Ascq", "stadium": "Decathlon Arena"},
    "Nice": {"lat": 43.6702, "lon": 7.1925, "city": "Nice", "stadium": "Allianz Riviera"},
    "Rennes": {"lat": 48.1075, "lon": -1.7029, "city": "Rennes", "stadium": "Roazhon Park"},
    "Lens": {"lat": 50.4328, "lon": 2.8149, "city": "Lens", "stadium": "Stade Bollaert-Delelis"},
    "Strasbourg": {"lat": 48.5599, "lon": 7.7543, "city": "Strasbourg", "stadium": "Stade de la Meinau"},
    "Nantes": {"lat": 47.2560, "lon": -1.5247, "city": "Nantes", "stadium": "Stade de la Beaujoire"},
    "Montpellier": {"lat": 43.6225, "lon": 3.8122, "city": "Montpellier", "stadium": "Stade de la Mosson"},
    "Toulouse": {"lat": 43.5831, "lon": 1.4341, "city": "Toulouse", "stadium": "Stadium de Toulouse"},
    "Brest": {"lat": 48.4036, "lon": -4.4608, "city": "Brest", "stadium": "Stade Francis-Le Blé"},
    "Reims": {"lat": 49.2467, "lon": 4.0253, "city": "Reims", "stadium": "Stade Auguste-Delaune"},
    "Saint-Etienne": {"lat": 45.4608, "lon": 4.3902, "city": "Saint-Étienne", "stadium": "Stade Geoffroy-Guichard"},
    "Angers": {"lat": 47.4600, "lon": -0.5306, "city": "Angers", "stadium": "Stade Raymond Kopa"},
    "Le Havre": {"lat": 49.4986, "lon": 0.1697, "city": "Le Havre", "stadium": "Stade Océane"},
    "Auxerre": {"lat": 47.7867, "lon": 3.5886, "city": "Auxerre", "stadium": "Stade de l'Abbé-Deschamps"},

    # ── Premier League (England) ──
    "Manchester City": {"lat": 53.4831, "lon": -2.2004, "city": "Manchester", "stadium": "Etihad Stadium"},
    "Arsenal": {"lat": 51.5549, "lon": -0.1084, "city": "London", "stadium": "Emirates Stadium"},
    "Liverpool": {"lat": 53.4308, "lon": -2.9608, "city": "Liverpool", "stadium": "Anfield"},
    "Chelsea": {"lat": 51.4817, "lon": -0.1910, "city": "London", "stadium": "Stamford Bridge"},
    "Manchester United": {"lat": 53.4631, "lon": -2.2913, "city": "Manchester", "stadium": "Old Trafford"},
    "Tottenham Hotspur": {"lat": 51.6043, "lon": -0.0664, "city": "London", "stadium": "Tottenham Hotspur Stadium"},
    "Newcastle United": {"lat": 54.9756, "lon": -1.6217, "city": "Newcastle", "stadium": "St James' Park"},
    "Aston Villa": {"lat": 52.5092, "lon": -1.8847, "city": "Birmingham", "stadium": "Villa Park"},
    "Brighton": {"lat": 50.8618, "lon": -0.0837, "city": "Brighton", "stadium": "Amex Stadium"},
    "West Ham United": {"lat": 51.5387, "lon": -0.0166, "city": "London", "stadium": "London Stadium"},
    "Everton": {"lat": 53.4389, "lon": -2.9664, "city": "Liverpool", "stadium": "Goodison Park"},
    "Brentford": {"lat": 51.4908, "lon": -0.2886, "city": "London", "stadium": "Gtech Community Stadium"},
    "Wolverhampton": {"lat": 52.5902, "lon": -2.1304, "city": "Wolverhampton", "stadium": "Molineux Stadium"},
    "Crystal Palace": {"lat": 51.3983, "lon": -0.0856, "city": "London", "stadium": "Selhurst Park"},
    "Fulham": {"lat": 51.4749, "lon": -0.2217, "city": "London", "stadium": "Craven Cottage"},
    "Nottingham Forest": {"lat": 52.9400, "lon": -1.1328, "city": "Nottingham", "stadium": "City Ground"},
    "Leicester City": {"lat": 52.6203, "lon": -1.1422, "city": "Leicester", "stadium": "King Power Stadium"},
    "Bournemouth": {"lat": 50.7352, "lon": -1.8383, "city": "Bournemouth", "stadium": "Vitality Stadium"},
    "Southampton": {"lat": 50.9058, "lon": -1.3911, "city": "Southampton", "stadium": "St Mary's Stadium"},
    "Ipswich Town": {"lat": 52.0548, "lon": 1.1448, "city": "Ipswich", "stadium": "Portman Road"},

    # ── La Liga (Spain) ──
    "Real Madrid": {"lat": 40.4531, "lon": -3.6883, "city": "Madrid", "stadium": "Santiago Bernabéu"},
    "FC Barcelona": {"lat": 41.3809, "lon": 2.1228, "city": "Barcelona", "stadium": "Camp Nou / Montjuïc"},
    "Atlético Madrid": {"lat": 40.4362, "lon": -3.5995, "city": "Madrid", "stadium": "Cívitas Metropolitano"},
    "Sevilla FC": {"lat": 37.3840, "lon": -5.9705, "city": "Seville", "stadium": "Ramón Sánchez-Pizjuán"},
    "Real Betis": {"lat": 37.3565, "lon": -5.9817, "city": "Seville", "stadium": "Benito Villamarín"},
    "Valencia CF": {"lat": 39.4746, "lon": -0.3582, "city": "Valencia", "stadium": "Mestalla"},
    "Athletic Club": {"lat": 43.2642, "lon": -2.9494, "city": "Bilbao", "stadium": "San Mamés"},
    "Real Sociedad": {"lat": 43.3014, "lon": -1.9736, "city": "San Sebastián", "stadium": "Reale Arena"},
    "Villarreal CF": {"lat": 39.9442, "lon": -0.1036, "city": "Villarreal", "stadium": "Estadio de la Cerámica"},
    "Getafe CF": {"lat": 40.3256, "lon": -3.7148, "city": "Getafe", "stadium": "Coliseum"},
    "Celta Vigo": {"lat": 42.2119, "lon": -8.7397, "city": "Vigo", "stadium": "Abanca-Balaídos"},
    "Osasuna": {"lat": 42.7967, "lon": -1.6369, "city": "Pamplona", "stadium": "El Sadar"},
    "Girona": {"lat": 41.9614, "lon": 2.8184, "city": "Girona", "stadium": "Montilivi"},
    "Las Palmas": {"lat": 28.1003, "lon": -15.4568, "city": "Las Palmas", "stadium": "Estadio Gran Canaria"},
    "Deportivo Alavés": {"lat": 42.8371, "lon": -2.6881, "city": "Vitoria-Gasteiz", "stadium": "Mendizorrotza"},
    "Rayo Vallecano": {"lat": 40.3919, "lon": -3.6587, "city": "Madrid", "stadium": "Estadio de Vallecas"},
    "Mallorca": {"lat": 39.5900, "lon": 2.6300, "city": "Palma", "stadium": "Estadi Mallorca Son Moix"},
    "Espanyol": {"lat": 41.3478, "lon": 2.0756, "city": "Cornellà de Llobregat", "stadium": "RCDE Stadium"},

    # ── Serie A (Italy) ──
    "Inter Milan": {"lat": 45.4781, "lon": 9.1240, "city": "Milan", "stadium": "San Siro"},
    "AC Milan": {"lat": 45.4781, "lon": 9.1240, "city": "Milan", "stadium": "San Siro"},
    "Juventus": {"lat": 45.1096, "lon": 7.6413, "city": "Turin", "stadium": "Allianz Stadium"},
    "Napoli": {"lat": 40.8279, "lon": 14.1930, "city": "Naples", "stadium": "Stadio Diego Armando Maradona"},
    "AS Roma": {"lat": 41.9341, "lon": 12.4547, "city": "Rome", "stadium": "Stadio Olimpico"},
    "Lazio": {"lat": 41.9341, "lon": 12.4547, "city": "Rome", "stadium": "Stadio Olimpico"},
    "Atalanta": {"lat": 45.7092, "lon": 9.6808, "city": "Bergamo", "stadium": "Gewiss Stadium"},
    "Fiorentina": {"lat": 43.7808, "lon": 11.2822, "city": "Florence", "stadium": "Stadio Artemio Franchi"},
    "Torino": {"lat": 45.0422, "lon": 7.6500, "city": "Turin", "stadium": "Stadio Olimpico Grande Torino"},
    "Bologna": {"lat": 44.4925, "lon": 11.3097, "city": "Bologna", "stadium": "Stadio Renato Dall'Ara"},
    "Udinese": {"lat": 46.0817, "lon": 13.2003, "city": "Udine", "stadium": "Bluenergy Stadium"},
    "Genoa": {"lat": 44.4164, "lon": 8.9525, "city": "Genoa", "stadium": "Stadio Luigi Ferraris"},
    "Monza": {"lat": 45.5842, "lon": 9.2986, "city": "Monza", "stadium": "U-Power Stadium"},
    "Lecce": {"lat": 40.3547, "lon": 18.1925, "city": "Lecce", "stadium": "Stadio Via del Mare"},
    "Hellas Verona": {"lat": 45.4353, "lon": 10.9686, "city": "Verona", "stadium": "Stadio Marcantonio Bentegodi"},
    "Cagliari": {"lat": 39.1989, "lon": 9.1367, "city": "Cagliari", "stadium": "Unipol Domus"},
    "Empoli": {"lat": 43.7264, "lon": 10.9556, "city": "Empoli", "stadium": "Stadio Carlo Castellani"},
    "Parma": {"lat": 44.7947, "lon": 10.3383, "city": "Parma", "stadium": "Stadio Ennio Tardini"},

    # ── Bundesliga (Germany) ──
    "Bayern Munich": {"lat": 48.2188, "lon": 11.6247, "city": "Munich", "stadium": "Allianz Arena"},
    "Borussia Dortmund": {"lat": 51.4926, "lon": 7.4518, "city": "Dortmund", "stadium": "Signal Iduna Park"},
    "RB Leipzig": {"lat": 51.3458, "lon": 12.3483, "city": "Leipzig", "stadium": "Red Bull Arena"},
    "Bayer Leverkusen": {"lat": 51.0383, "lon": 6.9831, "city": "Leverkusen", "stadium": "BayArena"},
    "Eintracht Frankfurt": {"lat": 50.0686, "lon": 8.6455, "city": "Frankfurt", "stadium": "Deutsche Bank Park"},
    "VfL Wolfsburg": {"lat": 52.4325, "lon": 10.8039, "city": "Wolfsburg", "stadium": "Volkswagen Arena"},
    "Borussia Mönchengladbach": {"lat": 51.1747, "lon": 6.3856, "city": "Mönchengladbach", "stadium": "BORUSSIA-PARK"},
    "Union Berlin": {"lat": 52.4572, "lon": 13.5681, "city": "Berlin", "stadium": "Stadion An der Alten Försterei"},
    "SC Freiburg": {"lat": 47.9889, "lon": 7.8933, "city": "Freiburg", "stadium": "Europa-Park Stadion"},
    "Hoffenheim": {"lat": 49.2389, "lon": 8.8886, "city": "Sinsheim", "stadium": "PreZero Arena"},
    "Mainz 05": {"lat": 49.9842, "lon": 8.2242, "city": "Mainz", "stadium": "MEWA ARENA"},
    "Augsburg": {"lat": 48.3228, "lon": 10.8864, "city": "Augsburg", "stadium": "WWK ARENA"},
    "Werder Bremen": {"lat": 53.0664, "lon": 8.8375, "city": "Bremen", "stadium": "Weserstadion"},
    "VfL Bochum": {"lat": 51.4900, "lon": 7.2364, "city": "Bochum", "stadium": "Vonovia Ruhrstadion"},
    "Heidenheim": {"lat": 48.6686, "lon": 10.1394, "city": "Heidenheim", "stadium": "Voith-Arena"},
    "Stuttgart": {"lat": 48.7922, "lon": 9.2322, "city": "Stuttgart", "stadium": "MHPArena"},
    "FC St. Pauli": {"lat": 53.5544, "lon": 9.9678, "city": "Hamburg", "stadium": "Millerntor-Stadion"},
    "Holstein Kiel": {"lat": 54.3486, "lon": 10.1219, "city": "Kiel", "stadium": "Holstein-Stadion"}
}

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

def fetch_weather_for_location(lat, lon, date_str):
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto&start_date={date_str}&end_date={date_str}"
    
    req = urllib.request.Request(url, headers={'User-Agent': 'FootballPredictor/2.0'})
    try:
        with urllib.request.urlopen(req) as response:
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
    parser = argparse.ArgumentParser(description="Fetch match weather data via Open-Meteo for 89 European stadiums")
    parser.add_argument("--team", type=str, default="PSG", help="Home team name")
    parser.add_argument("--date", type=str, default=datetime.now().strftime("%Y-%m-%d"), help="Match date (YYYY-MM-DD)")
    parser.add_argument("--output", type=str, help="Path to save JSON result")
    
    args = parser.parse_args()
    
    coords = STADIA_COORDINATES.get(args.team, {"lat": 48.8566, "lon": 2.3522, "city": "Paris", "stadium": "National Stadium"})
    weather_info = fetch_weather_for_location(coords["lat"], coords["lon"], args.date)
    
    result = {
        "team": args.team,
        "city": coords["city"],
        "stadium": coords["stadium"],
        "date": args.date,
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
