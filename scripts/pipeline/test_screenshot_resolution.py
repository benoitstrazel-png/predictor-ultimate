#!/usr/bin/env python3
import json
import os
import sys
import unicodedata

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

def normalize_key(str_val):
    if not str_val:
        return ''
    return ''.join(
        c for c in unicodedata.normalize('NFD', str_val)
        if unicodedata.category(c) != 'Mn'
    ).lower().replace('-', ' ').strip()

with open('src/data/teams_master.json', 'r', encoding='utf-8') as f:
    tm = json.load(f)

lookup = {}
for t in tm['teams']:
    for k in [t['team_id'], t['canonical_name'], t['short_name'], t.get('slug', '')] + t.get('aliases', []):
        if k:
            lookup[normalize_key(k)] = t
            lookup[normalize_key(k).replace(' ', '')] = t

# Dynamic manual aliases targeting canonical names directly
manual_canonical = {
    # Espagne
    'deportivo': 'Deportivo A Coruña',
    'depor': 'Deportivo A Coruña',
    'la corogne': 'Deportivo A Coruña',
    'la coruna': 'Deportivo A Coruña',
    'deportivo la coruna': 'Deportivo A Coruña',
    'rc celta': 'Celta Vigo',
    'celta': 'Celta Vigo',
    'alaves': 'Deportivo Alavés',
    'deportivo alaves': 'Deportivo Alavés',
    'malaga': 'Málaga',
    'betis': 'Real Betis',
    'atletico': 'Atlético Madrid',
    'atleti': 'Atlético Madrid',
    'atletico madrid': 'Atlético Madrid',
    'racing': 'Racing Santander',
    'la real': 'Real Sociedad',
    'athletic bilbao': 'Athletic Club',
    'bilbao': 'Athletic Club',
    'fc seville': 'Sevilla',
    'fc séville': 'Sevilla',
    'seville': 'Sevilla',

    # France
    'psg': 'Paris Saint-Germain',
    'paris sg': 'Paris Saint-Germain',
    'st etienne': 'Saint-Étienne',
    'saint etienne': 'Saint-Étienne',
    'asse': 'Saint-Étienne',
    'ol': 'Lyon',
    'om': 'Marseille',
    'le havre ac': 'Le Havre',
    'hac': 'Le Havre',
    'paris fc': 'Paris FC',
    'pfc': 'Paris FC',
    'le mans': 'Le Mans',

    # Italie
    'as rome': 'Roma',
    'rome': 'Roma',
    'come': 'Como',
    'côme': 'Como',
    'venise': 'Venezia',
    'inter milan': 'Inter',
    'ac milan': 'Milan',
    'juve': 'Juventus',

    # Angleterre & Allemagne
    'wolves': 'Wolverhampton Wanderers',
    'wolverhampton': 'Wolverhampton Wanderers',
    'coventry': 'Coventry City',
    'fc cologne': '1. FC Köln',
    'cologne': '1. FC Köln',
    'tsg hoffenheim': 'Hoffenheim',
    'sv elversberg': 'Elversberg',
    'bayern munich': 'Bayern München',
    'eintracht francfort': 'Eintracht Frankfurt',
    'hambourg': 'Hamburger SV',
    'mayence': 'Mainz 05',

    # Portugal, Danemark, Turquie, Grèce
    'porto': 'FC Porto',
    'sporting lisbonne': 'Sporting CP',
    'sporting portugal': 'Sporting CP',
    'benfica lisbonne': 'Benfica',
    'copenhague': 'FC København',
    'panathinaikos': 'Panathinaikos',
    'galatasaray': 'Galatasaray',
    'fenerbahce': 'Fenerbahçe'
}
for alias, c_name in manual_canonical.items():
    t_obj = next((t for t in tm['teams'] if normalize_key(t['canonical_name']) == normalize_key(c_name) or normalize_key(t['short_name']) == normalize_key(c_name)), None)
    if t_obj:
        lookup[normalize_key(alias)] = t_obj
        lookup[normalize_key(alias).replace(' ', '')] = t_obj

l1_matches = [
    ('Lille', 'PSG'),
    ('Strasbourg', 'Lens'),
    ('Auxerre', 'Angers'),
    ('Brest', 'Toulouse'),
    ('Lorient', 'Troyes'),
    ('Lyon', 'Le Havre'),
    ('Paris FC', 'Nice'),
    ('Rennes', 'Le Mans'),
    ('Monaco', 'Marseille')
]

print("=== VALIDATION DE TOUS LES MATCHS LIGUE 1 (CAPTURE UTILISATEUR) ===")
all_ok = True
for home, away in l1_matches:
    h_res = lookup.get(normalize_key(home)) or lookup.get(normalize_key(home).replace(' ', ''))
    a_res = lookup.get(normalize_key(away)) or lookup.get(normalize_key(away).replace(' ', ''))
    
    h_file = os.path.join('public', h_res['local_logo'].lstrip('/')) if h_res else ''
    a_file = os.path.join('public', a_res['local_logo'].lstrip('/')) if a_res else ''
    
    h_ok = h_res and os.path.exists(h_file) and os.path.getsize(h_file) > 0
    a_ok = a_res and os.path.exists(a_file) and os.path.getsize(a_file) > 0
    
    if not (h_ok and a_ok):
        all_ok = False
        
    h_status = "OK" if h_ok else "FAIL"
    a_status = "OK" if a_ok else "FAIL"
    h_cname = h_res["canonical_name"] if h_res else "NOT FOUND"
    a_cname = a_res["canonical_name"] if a_res else "NOT FOUND"
    h_logo = h_res["local_logo"] if h_res else "-"
    a_logo = a_res["local_logo"] if a_res else "-"
    
    h_sz = os.path.getsize(h_file) if h_ok else 0
    a_sz = os.path.getsize(a_file) if a_ok else 0
    
    print(f"Match: {home:12} vs {away:12}")
    print(f"  Home: [{h_status}] {home:12} -> {h_cname:20} ({h_logo}) - {h_sz} B")
    print(f"  Away: [{a_status}] {away:12} -> {a_cname:20} ({a_logo}) - {a_sz} B")

if all_ok:
    print("\n🎉 100% DES 18 CLUBS LIGUE 1 SONT VALIDES AVEC DES ASSETS HD EXISTANTS !")
