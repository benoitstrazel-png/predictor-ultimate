import json
import glob

files = glob.glob(r"c:\Users\benoi\Documents\Predictor Ultimate\data\raw\*\*\matches\*.json")
with open(files[0], 'r', encoding='utf-8') as f:
    data = json.load(f)

print("General keys:", list(data.get('general', {}).keys()))
print("matchTimeUTC:", data.get('general', {}).get('matchTimeUTC'))
print("matchTimeLocal:", data.get('general', {}).get('matchTimeLocal'))
print("matchDate:", data.get('general', {}).get('matchDate'))
print("utcTime:", data.get('general', {}).get('utcTime'))
print("season:", data.get('general', {}).get('season'))
print("league:", data.get('general', {}).get('leagueName'))
