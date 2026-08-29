import json

data = json.load(open('src/data/unified_history.json', encoding='utf-8'))
print(f"Total Matches in unified_history.json: {len(data)}")

print("\n--- FRA-L1 2025-2026 Round 34 ---")
l1_r34 = [m for m in data if m.get('league') == 'FRA-L1' and m.get('season') == '2025-2026' and '34' in str(m.get('round'))]
print(f"Total matches: {len(l1_r34)}")
for m in l1_r34:
    print(f"  {m.get('homeTeam'):<18} {m.get('score')} {m.get('awayTeam'):<18} | Arbitre: {m.get('referee')} | Buts: {len(m.get('goals', []))}")
    if m.get('homeTeam') == 'Marseille' and m.get('awayTeam') == 'Rennes':
        print(f"    -> Buts OM vs Rennes: {m.get('goals')}")

print("\n--- ENG-PL 2025-2026 Round 38 ---")
pl_r38 = [m for m in data if m.get('league') == 'ENG-PL' and m.get('season') == '2025-2026' and '38' in str(m.get('round'))]
print(f"Total matches: {len(pl_r38)}")
for m in pl_r38:
    print(f"  {m.get('homeTeam'):<18} {m.get('score')} {m.get('awayTeam'):<18} | Arbitre: {m.get('referee')}")

print("\n--- ITA-SA 2025-2026 Round 38 ---")
sa_r38 = [m for m in data if m.get('league') == 'ITA-SA' and m.get('season') == '2025-2026' and '38' in str(m.get('round'))]
print(f"Total matches: {len(sa_r38)}")
for m in sa_r38:
    print(f"  {m.get('homeTeam'):<18} {m.get('score')} {m.get('awayTeam'):<18} | Arbitre: {m.get('referee')}")

print("\n--- GER-BL 2025-2026 Round 34 ---")
bl_r34 = [m for m in data if m.get('league') == 'GER-BL' and m.get('season') == '2025-2026' and '34' in str(m.get('round'))]
print(f"Total matches: {len(bl_r34)}")
for m in bl_r34:
    print(f"  {m.get('homeTeam'):<20} {m.get('score')} {m.get('awayTeam'):<20} | Arbitre: {m.get('referee')}")
