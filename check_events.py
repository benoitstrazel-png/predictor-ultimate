import json, sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

with open('src/data/unified_history.json', 'r', encoding='utf-8') as f:
    hist = json.load(f)

for m in hist:
    if m.get('date') == '2026-08-28' and m.get('homeTeam') == 'Lille':
        print(f"=== {m['homeTeam']} {m['score']} {m['awayTeam']} ===")
        print("BUTS & PASSES:")
        for g in m.get('goals', []):
            print(f"  ⚽ {g['time']}' - {g['player']} ({g['team']}) | Assist: {g.get('assist')} | Detail: {g.get('detail')}")
        print("\nREMPLACEMENTS:")
        for s in m.get('substitutions', []):
            print(f"  🔄 {s['time']}' - In: {s['playerIn']} / Out: {s['playerOut']} ({s['team']})")
        print("\nCARTONS:")
        for c in m.get('cards', []):
            print(f"  🟨 {c['time']}' - {c['player']} ({c['team']}) | {c.get('detail')}")