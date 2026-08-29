import json
with open('src/data/unified_history.json', 'r', encoding='utf-8') as f:
    hist = json.load(f)

for m in hist:
    if m.get('date') == '2026-08-28':
        lineups = m.get('lineups') or {}
        h_starters = [p['name'] for p in lineups.get('home', {}).get('starters', [])]
        a_starters = [p['name'] for p in lineups.get('away', {}).get('starters', [])]
        print(f"\n{m['homeTeam']} ({len(h_starters)}) vs {m['awayTeam']} ({len(a_starters)})")
        print('  HOME XI:', h_starters)
        print('  AWAY XI:', a_starters)