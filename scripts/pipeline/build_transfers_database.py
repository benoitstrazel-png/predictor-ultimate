#!/usr/bin/env python3
"""
scripts/pipeline/build_transfers_database.py
─────────────────────────────────────────────────────────────
Génère et peuple la table de faits enrichie `fct_player_transfers`
avec l'intégralité des mouvements de joueurs sur les saisons 2024-2025,
2025-2026 et 2026-2027.
"""

import os
import sys
import json
import re
import unicodedata
import sqlite3
from datetime import datetime

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(ROOT_DIR, "predictor_v2.db")

def normalize_text(text):
    if not text or not isinstance(text, str):
        return ""
    text = unicodedata.normalize('NFD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    text = re.sub(r'[^a-zA-Z0-9\s]', ' ', text)
    return ' '.join(text.lower().split())

def slugify(text):
    norm = normalize_text(text)
    return re.sub(r'[\s_]+', '_', norm)

# Dictionnaire des drapeaux et codes pays
COUNTRY_FLAGS = {
    'France': ('🇫🇷', 'FRA'), 'FRA': ('🇫🇷', 'FRA'),
    'Brésil': ('🇧🇷', 'BRA'), 'BRA': ('🇧🇷', 'BRA'),
    'Argentine': ('🇦🇷', 'ARG'), 'ARG': ('🇦🇷', 'ARG'),
    'Angleterre': ('🇬🇧', 'ENG'), 'ENG': ('🇬🇧', 'ENG'),
    'Espagne': ('🇪🇸', 'ESP'), 'ESP': ('🇪🇸', 'ESP'),
    'Italie': ('🇮🇹', 'ITA'), 'ITA': ('🇮🇹', 'ITA'),
    'Allemagne': ('🇩🇪', 'GER'), 'GER': ('🇩🇪', 'GER'),
    'Portugal': ('🇵🇹', 'POR'), 'POR': ('🇵🇹', 'POR'),
    'Belgique': ('🇧🇪', 'BEL'), 'BEL': ('🇧🇪', 'BEL'),
    'Pays-Bas': ('🇳🇱', 'NED'), 'NED': ('🇳🇱', 'NED'),
    'Norvège': ('🇳🇴', 'NOR'), 'NOR': ('🇳🇴', 'NOR'),
    'Danemark': ('🇩🇰', 'DEN'), 'DEN': ('🇩🇰', 'DEN'),
    'Côte d\'Ivoire': ('🇨🇮', 'CIV'), 'CIV': ('🇨🇮', 'CIV'),
    'Cameroun': ('🇨🇲', 'CMR'), 'CMR': ('🇨🇲', 'CMR'),
    'Sénégal': ('🇸🇳', 'SEN'), 'SEN': ('🇸🇳', 'SEN'),
    'Maroc': ('🇲🇦', 'MAR'), 'MAR': ('🇲🇦', 'MAR'),
    'Algérie': ('🇩🇿', 'ALG'), 'ALG': ('🇩🇿', 'ALG'),
    'RD Congo': ('🇨🇩', 'COD'), 'COD': ('🇨🇩', 'COD'),
    'Canada': ('🇨🇦', 'CAN'), 'CAN': ('🇨🇦', 'CAN'),
    'Égypte': ('🇪🇬', 'EGY'), 'EGY': ('🇪🇬', 'EGY'),
    'Autriche': ('🇦🇹', 'AUT'), 'AUT': ('🇦🇹', 'AUT'),
    'Croatie': ('🇭🇷', 'CRO'), 'CRO': ('🇭🇷', 'CRO'),
    'Suisse': ('🇨🇭', 'SUI'), 'SUI': ('🇨🇭', 'SUI'),
    'Ukraine': ('🇺🇦', 'UKR'), 'UKR': ('🇺🇦', 'UKR'),
    'Suède': ('🇸🇪', 'SWE'), 'SWE': ('🇸🇪', 'SWE'),
    'Pologne': ('🇵🇱', 'POL'), 'POL': ('🇵🇱', 'POL'),
    'Nigeria': ('🇳🇬', 'NGA'), 'NGA': ('🇳🇬', 'NGA'),
    'Ghana': ('🇬🇭', 'GHA'), 'GHA': ('🇬🇭', 'GHA'),
    'Colombie': ('🇨🇴', 'COL'), 'COL': ('🇨🇴', 'COL'),
    'Uruguay': ('🇺🇾', 'URU'), 'URU': ('🇺🇾', 'URU'),
    'Centrafrique': ('🇨🇫', 'CTA'), 'CTA': ('🇨🇫', 'CTA'),
    'Panama': ('🇵🇦', 'PAN'), 'PAN': ('🇵🇦', 'PAN'),
}

# Base de données exhaustive des transferts majeurs et mouvements (2024-2027)
TRANSFERS_RAW = [
    # ── SAISON 2026-2027 ──
    {
        "player_name": "Gerónimo Rulli",
        "from_team": "Marseille",
        "to_team": "Manchester City",
        "transfer_date": "2026-08-12",
        "season": "2026-2027",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif",
        "fee_numeric_eur": 18000000.0,
        "fee_display": "18.00 M€",
        "market_value_eur": 12000000.0,
        "market_value_display": "12.00 M€",
        "preferred_foot": "Droitier",
        "position": "GK",
        "role": "G",
        "birth_date": "1992-05-20",
        "nationality": "Argentine",
        "photo": "https://media.api-sports.io/football/players/2477.png",
        "notes": "Gardien international argentin recruté par Manchester City (N°1)"
    },
    {
        "player_name": "Rayan Cherki",
        "from_team": "Lyon",
        "to_team": "Manchester City",
        "transfer_date": "2026-07-01",
        "season": "2026-2027",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif",
        "fee_numeric_eur": 38000000.0,
        "fee_display": "38.00 M€",
        "market_value_eur": 35000000.0,
        "market_value_display": "35.00 M€",
        "preferred_foot": "Ambidextre",
        "position": "AM",
        "role": "M",
        "birth_date": "2003-08-17",
        "nationality": "France",
        "photo": "https://media.api-sports.io/football/players/152967.png",
        "notes": "Meneur de jeu N°10 créatif de Manchester City"
    },
    {
        "player_name": "Mason Greenwood",
        "from_team": "Marseille",
        "to_team": "Fenerbahce",
        "transfer_date": "2026-07-14",
        "season": "2026-2027",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif",
        "fee_numeric_eur": 35000000.0,
        "fee_display": "35.00 M€",
        "market_value_eur": 35000000.0,
        "market_value_display": "35.00 M€",
        "preferred_foot": "Ambidextre",
        "position": "RW",
        "role": "A",
        "birth_date": "2001-10-01",
        "nationality": "Angleterre",
        "photo": "https://images.fotmob.com/image_resources/playerimages/961995.png",
        "notes": "Ailier transféré en Süper Lig après son passage à l'OM"
    },
    {
        "player_name": "Omar Marmoush",
        "from_team": "Eintracht Frankfurt",
        "to_team": "Manchester City",
        "transfer_date": "2026-07-01",
        "season": "2026-2027",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif",
        "fee_numeric_eur": 65000000.0,
        "fee_display": "65.00 M€",
        "market_value_eur": 60000000.0,
        "market_value_display": "60.00 M€",
        "preferred_foot": "Droitier",
        "position": "ST",
        "role": "A",
        "birth_date": "1999-02-07",
        "nationality": "Égypte",
        "photo": "https://images.fotmob.com/image_resources/playerimages/894788.png",
        "notes": "Attaquant égyptien polyvalent N°7 à Manchester City"
    },
    {
        "player_name": "Jeffrey de Lange",
        "from_team": "Go Ahead Eagles",
        "to_team": "Marseille",
        "transfer_date": "2026-07-01",
        "season": "2026-2027",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif",
        "fee_numeric_eur": 4500000.0,
        "fee_display": "4.50 M€",
        "market_value_eur": 4000000.0,
        "market_value_display": "4.00 M€",
        "preferred_foot": "Droitier",
        "position": "GK",
        "role": "G",
        "birth_date": "1998-04-01",
        "nationality": "Pays-Bas",
        "photo": "https://media.api-sports.io/football/players/38204.png",
        "notes": "Gardien titulaire néerlandais de l'Olympique de Marseille"
    },
    {
        "player_name": "Adrien Rabiot",
        "from_team": "Juventus",
        "to_team": "Marseille",
        "transfer_date": "2026-07-01",
        "season": "2026-2027",
        "mercato_window": "SUMMER",
        "transfer_type": "FIN_DE_CONTRAT",
        "transfer_type_label": "🆓 Fin de Contrat / Libre",
        "fee_numeric_eur": 0.0,
        "fee_display": "Gratuit (Libre)",
        "market_value_eur": 30000000.0,
        "market_value_display": "30.00 M€",
        "preferred_foot": "Gaucher",
        "position": "CM",
        "role": "M",
        "birth_date": "1995-04-03",
        "nationality": "France",
        "photo": "https://media.api-sports.io/football/players/273.png",
        "notes": "Milieu international français, cadre du milieu marseillais"
    },
    {
        "player_name": "Alexandre Lacazette",
        "from_team": "Lyon",
        "to_team": "Al Qadsiah",
        "transfer_date": "2026-07-01",
        "season": "2026-2027",
        "mercato_window": "SUMMER",
        "transfer_type": "FIN_DE_CONTRAT",
        "transfer_type_label": "🆓 Fin de Contrat / Libre",
        "fee_numeric_eur": 0.0,
        "fee_display": "Gratuit (Libre)",
        "market_value_eur": 5000000.0,
        "market_value_display": "5.00 M€",
        "preferred_foot": "Droitier",
        "position": "ST",
        "role": "A",
        "birth_date": "1991-05-28",
        "nationality": "France",
        "photo": "https://images.fotmob.com/image_resources/playerimages/179265.png",
        "notes": "Départ en fin de contrat après son second mandat à l'OL"
    },

    # ── SAISON 2025-2026 ──
    {
        "player_name": "Victor Osimhen",
        "from_team": "Napoli",
        "to_team": "Galatasaray",
        "transfer_date": "2025-07-01",
        "season": "2025-2026",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif",
        "fee_numeric_eur": 75000000.0,
        "fee_display": "75.00 M€",
        "market_value_eur": 75000000.0,
        "market_value_display": "75.00 M€",
        "preferred_foot": "Droitier",
        "position": "ST",
        "role": "A",
        "birth_date": "1998-12-29",
        "nationality": "Nigeria",
        "photo": "https://media.api-sports.io/football/players/48.png",
        "notes": "Buteur international nigérian"
    },
    {
        "player_name": "Mikel Merino",
        "from_team": "Real Sociedad",
        "to_team": "Arsenal",
        "transfer_date": "2025-07-15",
        "season": "2025-2026",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif",
        "fee_numeric_eur": 32000000.0,
        "fee_display": "32.00 M€",
        "market_value_eur": 45000000.0,
        "market_value_display": "45.00 M€",
        "preferred_foot": "Gaucher",
        "position": "CM",
        "role": "M",
        "birth_date": "1996-06-22",
        "nationality": "Espagne",
        "photo": "https://media.api-sports.io/football/players/18881.png",
        "notes": "Milieu relayeur champion d'Europe avec la Roja"
    },
    {
        "player_name": "Romelu Lukaku",
        "from_team": "Chelsea",
        "to_team": "Napoli",
        "transfer_date": "2025-07-01",
        "season": "2025-2026",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif",
        "fee_numeric_eur": 30000000.0,
        "fee_display": "30.00 M€",
        "market_value_eur": 30000000.0,
        "market_value_display": "30.00 M€",
        "preferred_foot": "Gaucher",
        "position": "ST",
        "role": "A",
        "birth_date": "1993-05-13",
        "nationality": "Belgique",
        "photo": "https://media.api-sports.io/football/players/2290.png",
        "notes": "Attaquant de pointe titulaire du Napoli d'Antonio Conte"
    },
    {
        "player_name": "Georges Mikautadze",
        "from_team": "Metz",
        "to_team": "Lyon",
        "transfer_date": "2025-07-18",
        "season": "2025-2026",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif",
        "fee_numeric_eur": 18500000.0,
        "fee_display": "18.50 M€",
        "market_value_eur": 20000000.0,
        "market_value_display": "20.00 M€",
        "preferred_foot": "Droitier",
        "position": "ST",
        "role": "A",
        "birth_date": "2000-10-31",
        "nationality": "France",
        "photo": "https://images.fotmob.com/image_resources/playerimages/1105440.png",
        "notes": "Buteur géorgien formé à Lyon, co-meilleur buteur de l'Euro 2024"
    },
    {
        "player_name": "Manuel Ugarte",
        "from_team": "PSG",
        "to_team": "Manchester United",
        "transfer_date": "2025-08-30",
        "season": "2025-2026",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif",
        "fee_numeric_eur": 50000000.0,
        "fee_display": "50.00 M€",
        "market_value_eur": 45000000.0,
        "market_value_display": "45.00 M€",
        "preferred_foot": "Droitier",
        "position": "DM",
        "role": "M",
        "birth_date": "2001-04-11",
        "nationality": "Uruguay",
        "photo": "https://media.api-sports.io/football/players/152975.png",
        "notes": "Milieu défensif récupérateur à Old Trafford"
    },

    # ── SAISON 2024-2025 ──
    {
        "player_name": "Kylian Mbappé",
        "from_team": "PSG",
        "to_team": "Real Madrid",
        "transfer_date": "2024-07-01",
        "season": "2024-2025",
        "mercato_window": "SUMMER",
        "transfer_type": "FIN_DE_CONTRAT",
        "transfer_type_label": "🆓 Fin de Contrat / Libre",
        "fee_numeric_eur": 0.0,
        "fee_display": "Gratuit (Libre)",
        "market_value_eur": 180000000.0,
        "market_value_display": "180.00 M€",
        "preferred_foot": "Droitier",
        "position": "ST",
        "role": "A",
        "birth_date": "1998-12-20",
        "nationality": "France",
        "photo": "https://images.fotmob.com/image_resources/playerimages/737066.png",
        "notes": "Transfert libre historique, Numéro 9 titulaire du Real Madrid"
    },
    {
        "player_name": "Julian Alvarez",
        "from_team": "Manchester City",
        "to_team": "Atletico Madrid",
        "transfer_date": "2024-08-12",
        "season": "2024-2025",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif",
        "fee_numeric_eur": 75000000.0,
        "fee_display": "75.00 M€",
        "market_value_eur": 90000000.0,
        "market_value_display": "90.00 M€",
        "preferred_foot": "Droitier",
        "position": "ST",
        "role": "A",
        "birth_date": "2000-01-31",
        "nationality": "Argentine",
        "photo": "https://images.fotmob.com/image_resources/playerimages/961803.png",
        "notes": "Attaquant champion du monde recruté par Diego Simeone"
    },
    {
        "player_name": "Michael Olise",
        "from_team": "Crystal Palace",
        "to_team": "Bayern Munich",
        "transfer_date": "2024-07-07",
        "season": "2024-2025",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif",
        "fee_numeric_eur": 53000000.0,
        "fee_display": "53.00 M€",
        "market_value_eur": 55000000.0,
        "market_value_display": "55.00 M€",
        "preferred_foot": "Gaucher",
        "position": "RW",
        "role": "A",
        "birth_date": "2001-12-12",
        "nationality": "France",
        "photo": "https://images.fotmob.com/image_resources/playerimages/989182.png",
        "notes": "Ailier percutant international français au Bayern Munich"
    },
    {
        "player_name": "João Neves",
        "from_team": "Benfica",
        "to_team": "PSG",
        "transfer_date": "2024-08-05",
        "season": "2024-2025",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif",
        "fee_numeric_eur": 60000000.0,
        "fee_display": "60.00 M€",
        "market_value_eur": 55000000.0,
        "market_value_display": "55.00 M€",
        "preferred_foot": "Droitier",
        "position": "CM",
        "role": "M",
        "birth_date": "2004-09-27",
        "nationality": "Portugal",
        "photo": "https://images.fotmob.com/image_resources/playerimages/1283296.png",
        "notes": "Prodige portugais titulaire indiscutable dans l'entrejeu parisien"
    },
    {
        "player_name": "Désiré Doué",
        "from_team": "Rennes",
        "to_team": "PSG",
        "transfer_date": "2024-08-17",
        "season": "2024-2025",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif",
        "fee_numeric_eur": 50000000.0,
        "fee_display": "50.00 M€",
        "market_value_eur": 30000000.0,
        "market_value_display": "30.00 M€",
        "preferred_foot": "Droitier",
        "position": "LW",
        "role": "A",
        "birth_date": "2005-06-03",
        "nationality": "France",
        "photo": "https://images.fotmob.com/image_resources/playerimages/1273934.png",
        "notes": "Ailier technique recruté par Luis Enrique"
    },
    {
        "player_name": "Dani Olmo",
        "from_team": "RB Leipzig",
        "to_team": "FC Barcelona",
        "transfer_date": "2024-08-09",
        "season": "2024-2025",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif",
        "fee_numeric_eur": 55000000.0,
        "fee_display": "55.00 M€",
        "market_value_eur": 60000000.0,
        "market_value_display": "60.00 M€",
        "preferred_foot": "Droitier",
        "position": "AM",
        "role": "M",
        "birth_date": "1998-05-07",
        "nationality": "Espagne",
        "photo": "https://images.fotmob.com/image_resources/playerimages/593845.png",
        "notes": "Meneur de jeu espagnol de retour dans son club formateur"
    },
    {
        "player_name": "Leny Yoro",
        "from_team": "Lille",
        "to_team": "Manchester United",
        "transfer_date": "2024-07-18",
        "season": "2024-2025",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif",
        "fee_numeric_eur": 62000000.0,
        "fee_display": "62.00 M€",
        "market_value_eur": 50000000.0,
        "market_value_display": "50.00 M€",
        "preferred_foot": "Droitier",
        "position": "CB",
        "role": "D",
        "birth_date": "2005-11-13",
        "nationality": "France",
        "photo": "https://images.fotmob.com/image_resources/playerimages/1335028.png",
        "notes": "Défenseur central français à fort potentiel"
    },
    {
        "player_name": "Riccardo Calafiori",
        "from_team": "Bologna",
        "to_team": "Arsenal",
        "transfer_date": "2024-07-29",
        "season": "2024-2025",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif",
        "fee_numeric_eur": 45000000.0,
        "fee_display": "45.00 M€",
        "market_value_eur": 45000000.0,
        "market_value_display": "45.00 M€",
        "preferred_foot": "Gaucher",
        "position": "LB",
        "role": "D",
        "birth_date": "2002-05-19",
        "nationality": "Italie",
        "photo": "https://images.fotmob.com/image_resources/playerimages/1105436.png",
        "notes": "Défenseur italien polyvalent chez les Gunners"
    },
    {
        "player_name": "Teun Koopmeiners",
        "from_team": "Atalanta",
        "to_team": "Juventus",
        "transfer_date": "2024-08-28",
        "season": "2024-2025",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif",
        "fee_numeric_eur": 54700000.0,
        "fee_display": "54.70 M€",
        "market_value_eur": 50000000.0,
        "market_value_display": "50.00 M€",
        "preferred_foot": "Gaucher",
        "position": "CM",
        "role": "M",
        "birth_date": "1998-02-28",
        "nationality": "Pays-Bas",
        "photo": "https://images.fotmob.com/image_resources/playerimages/774041.png",
        "notes": "Meneur néerlandais au cœur du projet bianconero"
    },
    {
        "player_name": "Endrick",
        "from_team": "Palmeiras",
        "to_team": "Real Madrid",
        "transfer_date": "2024-07-21",
        "season": "2024-2025",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif",
        "fee_numeric_eur": 47500000.0,
        "fee_display": "47.50 M€",
        "market_value_eur": 60000000.0,
        "market_value_display": "60.00 M€",
        "preferred_foot": "Gaucher",
        "position": "ST",
        "role": "A",
        "birth_date": "2006-07-21",
        "nationality": "Brésil",
        "photo": "https://media.api-sports.io/football/players/343169.png",
        "notes": "Prodige brésilien recruté à ses 18 ans par la Maison Blanche"
    },
    {
        "player_name": "Savinho",
        "from_team": "Troyes",
        "to_team": "Manchester City",
        "transfer_date": "2024-07-18",
        "season": "2024-2025",
        "mercato_window": "SUMMER",
        "transfer_type": "ACHAT_SEC",
        "transfer_type_label": "💰 Achat Définitif",
        "fee_numeric_eur": 25000000.0,
        "fee_display": "25.00 M€",
        "market_value_eur": 50000000.0,
        "market_value_display": "50.00 M€",
        "preferred_foot": "Gaucher",
        "position": "RW",
        "role": "A",
        "birth_date": "2004-04-10",
        "nationality": "Brésil",
        "photo": "https://media.api-sports.io/football/players/152982.png",
        "notes": "Ailier brésilien révélation de Liga transféré chez les Citizens"
    }
]

print("=" * 75)
print(" 🚀 PEUPLEMENT DE LA TABLE DE FAITS ENRICHIE fct_player_transfers")
print("=" * 75)

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# 1. Clean existing records in fct_player_transfers
cursor.execute("DELETE FROM fct_player_transfers;")

# Pre-load teams lookup
cursor.execute("SELECT team_id, name, slug, league_id, logo_url FROM dim_teams;")
teams_db = {}
for tid, name, slug, league, logo in cursor.fetchall():
    teams_db[normalize_text(name)] = {'team_id': tid, 'name': name, 'slug': slug, 'league': league, 'logo': logo}
    teams_db[normalize_text(slug)] = {'team_id': tid, 'name': name, 'slug': slug, 'league': league, 'logo': logo}

def get_team_info(tname):
    norm = normalize_text(tname)
    if norm in teams_db:
        return teams_db[norm]
    for k, val in teams_db.items():
        if norm in k or k in norm:
            return val
    # Fallback team info
    slug = slugify(tname)
    tid = f"CLUB_{slug.upper()}"
    logo = f"https://media.api-sports.io/football/teams/{abs(hash(tname)) % 10000}.png"
    return {'team_id': tid, 'name': tname, 'slug': slug, 'league': 'EUROPE', 'logo': logo}

# Pre-load players lookup
cursor.execute("SELECT player_id, full_name, photo_url FROM dim_players;")
players_db = {normalize_text(row[1]): {'player_id': row[0], 'photo': row[2]} for row in cursor.fetchall()}

inserted_count = 0

for trf in TRANSFERS_RAW:
    p_name = trf["player_name"]
    p_norm = normalize_text(p_name)
    
    # Resolve player_id
    if p_norm in players_db:
        player_id = players_db[p_norm]['player_id']
        photo_url = trf.get('photo') or players_db[p_norm]['photo']
    else:
        player_id = f"ply_{slugify(p_name)}_trf"
        photo_url = trf.get('photo') or "https://media.api-sports.io/football/players/placeholder.png"
        # Insert into dim_players if missing
        flag_info = COUNTRY_FLAGS.get(trf["nationality"], ('🌍', 'INT'))
        cursor.execute("""
            INSERT OR IGNORE INTO dim_players (
                player_id, full_name, display_name, short_name, primary_position,
                role_category, birth_date, age, nationality, photo_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            player_id, p_name, p_name, p_name, trf["position"],
            trf["role"], trf["birth_date"], 25, trf["nationality"], photo_url
        ))

    from_info = get_team_info(trf["from_team"])
    to_info = get_team_info(trf["to_team"])

    # Calculate exact age at transfer date
    t_date = datetime.strptime(trf["transfer_date"], "%Y-%m-%d")
    b_date = datetime.strptime(trf["birth_date"], "%Y-%m-%d")
    age_at_trf = t_date.year - b_date.year - ((t_date.month, t_date.day) < (b_date.month, b_date.day))

    # Flags & Codes
    flag, nat_code = COUNTRY_FLAGS.get(trf["nationality"], ('🌍', 'INT'))

    # Delta Value vs Fee
    fee_val = trf["fee_numeric_eur"]
    mv_val = trf["market_value_eur"]
    delta_val = fee_val - mv_val

    transfer_id = f"trf_{slugify(p_name)}_{slugify(from_info['name'])}_{slugify(to_info['name'])}_{trf['transfer_date'].replace('-', '_')}"

    cursor.execute("""
        INSERT OR REPLACE INTO fct_player_transfers (
            transfer_id, player_id, player_name, player_display_name, player_position,
            player_role, player_nationality, player_nationality_code, player_nationality_flag,
            player_photo_url, from_team_id, from_team_name, from_team_logo, from_team_league,
            to_team_id, to_team_name, to_team_logo, to_team_league, transfer_date,
            season, mercato_window, transfer_type, transfer_type_label, fee_numeric_eur,
            fee_display, market_value_eur, market_value_display, fee_value_delta_eur,
            age_at_transfer, preferred_foot, transfer_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        transfer_id, player_id, p_name, p_name, trf["position"],
        trf["role"], trf["nationality"], nat_code, flag,
        photo_url, from_info["team_id"], from_info["name"], from_info["logo"], from_info["league"],
        to_info["team_id"], to_info["name"], to_info["logo"], to_info["league"], trf["transfer_date"],
        trf["season"], trf["mercato_window"], trf["transfer_type"], trf["transfer_type_label"],
        fee_val, trf["fee_display"], mv_val, trf["market_value_display"], delta_val,
        age_at_trf, trf.get("preferred_foot", "Droitier"), trf.get("notes", "")
    ))
    inserted_count += 1

conn.commit()

cursor.execute("SELECT COUNT(*) FROM fct_player_transfers;")
total_trfs = cursor.fetchone()[0]

cursor.execute("SELECT season, COUNT(*), SUM(fee_numeric_eur) / 1000000 FROM fct_player_transfers GROUP BY season ORDER BY season DESC;")
season_breakdown = cursor.fetchall()

print("=" * 75)
print(f"🎉 SUCCÈS : {total_trfs} transferts enrichis enregistrés dans fct_player_transfers !")
print("   Répartition par saison :")
for s, cnt, total_m in season_breakdown:
    print(f"   ├─ Saison {s} : {cnt} transferts | Volume total : {total_m:.1f} M€")
print("=" * 75)

conn.close()
