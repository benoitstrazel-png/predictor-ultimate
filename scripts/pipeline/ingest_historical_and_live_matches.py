#!/usr/bin/env python3
"""
scripts/pipeline/ingest_historical_and_live_matches.py
─────────────────────────────────────────────────────────────
Orchestrateur Principal d'Ingestion & Backfill Sportif :
- Récupère l'intégralité des calendriers des 8 compétitions (Top 5 + 3 Coupes d'Europe)
- Télécharge en parallèle multi-threads les feuilles de match complètes (xG, compos, stats, événements)
- Stocke les données brutes dans le Data Lake (data/raw/)
- Normalise et insère les enregistrements dans SQLite (predictor_v2.db)

Usage :
  python scripts/pipeline/ingest_historical_and_live_matches.py --sample 5
  python scripts/pipeline/ingest_historical_and_live_matches.py --season 2024-2025
  python scripts/pipeline/ingest_historical_and_live_matches.py --all-seasons
  python scripts/pipeline/ingest_historical_and_live_matches.py --live-only
"""

import os
import sys
import time
import argparse
import sqlite3
from concurrent.futures import ThreadPoolExecutor, as_completed

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)
DB_PATH = os.path.join(ROOT_DIR, "predictor_v2.db")

from scripts.pipeline.extractors.sportsApiClient import SportsApiClient, COMPETITIONS_CONFIG
from scripts.pipeline.transformers.sportsDataNormalizer import normalize_match_payload

ALL_SEASONS = ['2024-2025', '2025-2026', '2026-2027']
ALL_COMPETITIONS = list(COMPETITIONS_CONFIG.keys())

def init_db_schema_if_needed(conn):
    """Garantit que toutes les tables nécessaires existent dans SQLite."""
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS dim_competitions (
        competition_id VARCHAR(16) PRIMARY KEY,
        name VARCHAR(64) NOT NULL,
        country VARCHAR(32) NOT NULL,
        category VARCHAR(16) NOT NULL,
        external_source_id INT NOT NULL,
        flag_emoji VARCHAR(8),
        logo_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dim_teams (
        team_id VARCHAR(32) PRIMARY KEY,
        league_id VARCHAR(16) NOT NULL,
        name VARCHAR(64) NOT NULL,
        short_name VARCHAR(32),
        slug VARCHAR(64) NOT NULL,
        country VARCHAR(32),
        stadium_name VARCHAR(64),
        logo_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dim_players (
        player_id VARCHAR(64) PRIMARY KEY,
        tm_id VARCHAR(32) UNIQUE,
        api_sports_id INT,
        flashscore_slug VARCHAR(64),
        full_name VARCHAR(128) NOT NULL,
        display_name VARCHAR(64) NOT NULL,
        short_name VARCHAR(32),
        primary_position VARCHAR(16) NOT NULL,
        role_category VARCHAR(4) NOT NULL,
        birth_date DATE,
        age INT,
        nationality VARCHAR(64),
        photo_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dim_player_contracts_scd2 (
        contract_sk VARCHAR(64) PRIMARY KEY,
        player_id VARCHAR(64) NOT NULL REFERENCES dim_players(player_id) ON DELETE CASCADE,
        team_id VARCHAR(32) NOT NULL REFERENCES dim_teams(team_id) ON DELETE CASCADE,
        league_id VARCHAR(16) NOT NULL,
        valid_from DATE NOT NULL,
        valid_to DATE,
        is_current BOOLEAN NOT NULL DEFAULT 1,
        squad_number INT,
        contract_type VARCHAR(16) DEFAULT 'PERMANENT',
        market_value_eur DECIMAL(12, 2),
        market_value_formatted VARCHAR(32),
        joined_date DATE,
        contract_until DATE,
        seasons_covered TEXT,
        transfer_note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dim_player_aliases (
        alias_id VARCHAR(64) PRIMARY KEY,
        player_id VARCHAR(64) NOT NULL REFERENCES dim_players(player_id) ON DELETE CASCADE,
        source_system VARCHAR(32) NOT NULL,
        raw_name VARCHAR(128) NOT NULL,
        normalized_name VARCHAR(128) NOT NULL,
        confidence_score DECIMAL(3, 2) DEFAULT 1.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fact_matches (
        match_id VARCHAR(64) PRIMARY KEY,
        competition_id VARCHAR(16) NOT NULL,
        season VARCHAR(16) NOT NULL,
        round_label VARCHAR(32),
        gameweek INT,
        match_timestamp_utc TIMESTAMP NOT NULL,
        match_date VARCHAR(16) NOT NULL,
        status VARCHAR(16) NOT NULL,
        home_team_id VARCHAR(32) NOT NULL,
        away_team_id VARCHAR(32) NOT NULL,
        home_team_name VARCHAR(64) NOT NULL,
        away_team_name VARCHAR(64) NOT NULL,
        home_score INT,
        away_score INT,
        home_ht_score INT,
        away_ht_score INT,
        home_xg DECIMAL(4, 2),
        away_xg DECIMAL(4, 2),
        referee_name VARCHAR(64),
        stadium_name VARCHAR(64),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fact_match_events (
        event_id VARCHAR(64) PRIMARY KEY,
        match_id VARCHAR(64) NOT NULL REFERENCES fact_matches(match_id) ON DELETE CASCADE,
        minute INT NOT NULL,
        added_time INT DEFAULT 0,
        team_id VARCHAR(32),
        team_name VARCHAR(64),
        event_type VARCHAR(24) NOT NULL,
        primary_player_id VARCHAR(64),
        primary_player_name VARCHAR(64) NOT NULL,
        secondary_player_id VARCHAR(64),
        secondary_player_name VARCHAR(64),
        detail_note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fact_match_team_stats (
        stat_id VARCHAR(64) PRIMARY KEY,
        match_id VARCHAR(64) NOT NULL REFERENCES fact_matches(match_id) ON DELETE CASCADE,
        team_id VARCHAR(32),
        team_name VARCHAR(64) NOT NULL,
        is_home BOOLEAN NOT NULL,
        possession_pct DECIMAL(4, 1),
        expected_goals DECIMAL(4, 2),
        shots_total INT,
        shots_on_target INT,
        shots_off_target INT,
        shots_blocked INT,
        big_chances_total INT,
        big_chances_missed INT,
        corner_kicks INT,
        fouls_committed INT,
        offside_count INT,
        yellow_cards INT,
        red_cards INT,
        accurate_passes INT,
        total_passes INT,
        pass_accuracy_pct DECIMAL(4, 1),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fct_match_lineups (
        lineup_sk VARCHAR(64) PRIMARY KEY,
        match_id VARCHAR(64) NOT NULL REFERENCES fact_matches(match_id) ON DELETE CASCADE,
        competition_code VARCHAR(16) NOT NULL,
        season VARCHAR(16) NOT NULL,
        gameweek INT,
        round_label VARCHAR(32),
        team_id VARCHAR(32) NOT NULL,
        opponent_team_id VARCHAR(32),
        is_home BOOLEAN NOT NULL,
        player_id VARCHAR(64),
        player_name_match VARCHAR(64) NOT NULL,
        lineup_type VARCHAR(16) NOT NULL,
        pitch_position_code VARCHAR(8),
        role_category VARCHAR(4) NOT NULL,
        grid_row INT,
        grid_col INT,
        jersey_number INT,
        captain BOOLEAN DEFAULT 0,
        rating DECIMAL(3, 1),
        minutes_played INT DEFAULT 0,
        goals INT DEFAULT 0,
        assists INT DEFAULT 0,
        yellow_card BOOLEAN DEFAULT 0,
        red_card BOOLEAN DEFAULT 0,
        sub_in_minute INT,
        sub_out_minute INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dim_match_closing_odds (
        match_id VARCHAR(64) PRIMARY KEY,
        competition_id VARCHAR(16) NOT NULL,
        home_team_id VARCHAR(64) NOT NULL,
        away_team_id VARCHAR(64) NOT NULL,
        home_team_name VARCHAR(128),
        away_team_name VARCHAR(128),
        opening_odd_1 REAL,
        opening_odd_n REAL,
        opening_odd_2 REAL,
        opening_timestamp_utc TEXT,
        closing_odd_1 REAL,
        closing_odd_n REAL,
        closing_odd_2 REAL,
        closing_margin_pct REAL,
        drift_home_pct REAL,
        drift_away_pct REAL,
        over_2_5_odd REAL,
        under_2_5_odd REAL,
        btts_yes_odd REAL,
        btts_no_odd REAL,
        closing_timestamp_utc TEXT,
        odds_status VARCHAR(24) DEFAULT 'ACTIVE',
        updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
    );

    CREATE TABLE IF NOT EXISTS dim_coaches (
        coach_id VARCHAR(64) PRIMARY KEY,
        fotmob_id INT,
        api_sports_id INT,
        full_name VARCHAR(128) NOT NULL,
        display_name VARCHAR(64) NOT NULL,
        short_name VARCHAR(32) NOT NULL,
        birth_date DATE,
        age INT,
        nationality VARCHAR(64) NOT NULL,
        nationality_code VARCHAR(8) NOT NULL,
        nationality_flag VARCHAR(8) NOT NULL,
        photo_url TEXT,
        preferred_formation VARCHAR(16) DEFAULT '4-3-3',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dim_coach_contracts_scd2 (
        contract_sk VARCHAR(64) PRIMARY KEY,
        coach_id VARCHAR(64) NOT NULL REFERENCES dim_coaches(coach_id) ON DELETE CASCADE,
        team_id VARCHAR(32) NOT NULL,
        team_name VARCHAR(64) NOT NULL,
        team_logo TEXT,
        league_id VARCHAR(16),
        valid_from DATE NOT NULL,
        valid_to DATE,
        is_current BOOLEAN NOT NULL DEFAULT 0,
        role_title VARCHAR(64) DEFAULT 'Entraîneur Principal',
        contract_status VARCHAR(32) NOT NULL,
        seasons_covered TEXT NOT NULL,
        matches_count INT DEFAULT 0,
        wins INT DEFAULT 0,
        draws INT DEFAULT 0,
        losses INT DEFAULT 0,
        win_rate_pct DECIMAL(5, 2) DEFAULT 0.0,
        points_per_match DECIMAL(4, 2) DEFAULT 0.0,
        appointment_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fct_player_transfers (
        transfer_id VARCHAR(64) PRIMARY KEY,
        player_id VARCHAR(64) NOT NULL,
        player_name VARCHAR(128) NOT NULL,
        player_display_name VARCHAR(64) NOT NULL,
        player_position VARCHAR(16) NOT NULL,
        player_role VARCHAR(4) NOT NULL,
        player_nationality VARCHAR(64) NOT NULL,
        player_nationality_code VARCHAR(8) NOT NULL,
        player_nationality_flag VARCHAR(8) NOT NULL,
        player_photo_url TEXT,
        from_team_id VARCHAR(32) NOT NULL,
        from_team_name VARCHAR(64) NOT NULL,
        from_team_logo TEXT,
        from_team_league VARCHAR(16),
        to_team_id VARCHAR(32) NOT NULL,
        to_team_name VARCHAR(64) NOT NULL,
        to_team_logo TEXT,
        to_team_league VARCHAR(16),
        transfer_date DATE NOT NULL,
        season VARCHAR(16) NOT NULL,
        mercato_window VARCHAR(16) NOT NULL,
        transfer_type VARCHAR(32) NOT NULL,
        transfer_type_label VARCHAR(64) NOT NULL,
        fee_numeric_eur DECIMAL(12, 2) NOT NULL,
        fee_display VARCHAR(32) NOT NULL,
        market_value_eur DECIMAL(12, 2) NOT NULL,
        market_value_display VARCHAR(32) NOT NULL,
        fee_value_delta_eur DECIMAL(12, 2),
        age_at_transfer INT NOT NULL,
        preferred_foot VARCHAR(16) DEFAULT 'Droitier',
        transfer_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    conn.commit()

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.execute("PRAGMA foreign_keys = OFF;") # Désactivé pendant le bulk insert pour perf
    conn.execute("PRAGMA journal_mode = WAL;")
    init_db_schema_if_needed(conn)
    return conn

def persist_normalized_matches(conn, normalized_batch):
    """Insère ou met à jour en lot dans SQLite."""
    cursor = conn.cursor()
    
    matches_data = []
    team_stats_data = []
    events_data = []
    lineups_data = []
    
    for item in normalized_batch:
        if not item:
            continue
        m = item['match']
        matches_data.append((
            m['match_id'], m['competition_id'], m['season'], m['round_label'], m['gameweek'],
            m['match_timestamp_utc'], m['match_date'], m['status'], m['home_team_id'], m['away_team_id'],
            m['home_team_name'], m['away_team_name'], m['home_score'], m['away_score'],
            m['home_ht_score'], m['away_ht_score'], m['home_xg'], m['away_xg'],
            m['referee_name'], m['stadium_name']
        ))
        for ts in item['team_stats']:
            team_stats_data.append((
                ts['stat_id'], ts['match_id'], ts['team_id'], ts['team_name'], 1 if ts['is_home'] else 0,
                ts['possession_pct'], ts['expected_goals'], ts['shots_total'], ts['shots_on_target'],
                ts['shots_off_target'], ts['shots_blocked'], ts['big_chances_total'], ts['big_chances_missed'],
                ts['corner_kicks'], ts['fouls_committed'], ts['offside_count'], ts['yellow_cards'],
                ts['red_cards'], ts['accurate_passes'], ts['total_passes'], ts['pass_accuracy_pct']
            ))
        for ev in item['events']:
            events_data.append((
                ev['event_id'], ev['match_id'], ev['minute'], ev['added_time'],
                ev['team_id'], ev['team_name'], ev['event_type'], ev['primary_player_id'],
                ev['primary_player_name'], ev['secondary_player_id'], ev['secondary_player_name'],
                ev['detail_note']
            ))
        for lp in item['lineups']:
            lineups_data.append((
                lp['lineup_sk'], lp['match_id'], lp['competition_code'], lp['season'],
                lp['gameweek'], lp['round_label'], lp['team_id'], lp['opponent_team_id'],
                1 if lp['is_home'] else 0, lp['player_id'], lp['player_name_match'],
                lp['lineup_type'], lp['pitch_position_code'], lp['role_category'],
                lp['grid_row'], lp['grid_col'], lp['jersey_number'], 1 if lp['captain'] else 0,
                lp['rating'], lp['minutes_played'], lp['goals'], lp['assists'],
                1 if lp['yellow_card'] else 0, 1 if lp['red_card'] else 0,
                lp['sub_in_minute'], lp['sub_out_minute']
            ))

    if matches_data:
        cursor.executemany("""
        INSERT OR REPLACE INTO fact_matches (
            match_id, competition_id, season, round_label, gameweek, match_timestamp_utc,
            match_date, status, home_team_id, away_team_id, home_team_name, away_team_name,
            home_score, away_score, home_ht_score, away_ht_score, home_xg, away_xg,
            referee_name, stadium_name, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
        """, matches_data)

    if team_stats_data:
        cursor.executemany("""
        INSERT OR REPLACE INTO fact_match_team_stats (
            stat_id, match_id, team_id, team_name, is_home, possession_pct, expected_goals,
            shots_total, shots_on_target, shots_off_target, shots_blocked, big_chances_total,
            big_chances_missed, corner_kicks, fouls_committed, offside_count, yellow_cards,
            red_cards, accurate_passes, total_passes, pass_accuracy_pct
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, team_stats_data)

    if events_data:
        cursor.executemany("""
        INSERT OR REPLACE INTO fact_match_events (
            event_id, match_id, minute, added_time, team_id, team_name, event_type,
            primary_player_id, primary_player_name, secondary_player_id, secondary_player_name,
            detail_note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, events_data)

    if lineups_data:
        cursor.executemany("""
        INSERT OR REPLACE INTO fct_match_lineups (
            lineup_sk, match_id, competition_code, season, gameweek, round_label,
            team_id, opponent_team_id, is_home, player_id, player_name_match,
            lineup_type, pitch_position_code, role_category, grid_row, grid_col,
            jersey_number, captain, rating, minutes_played, goals, assists,
            yellow_card, red_card, sub_in_minute, sub_out_minute
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, lineups_data)

    conn.commit()

def process_competition_season(client: SportsApiClient, comp_code: str, season: str, workers: int = 10, sample: int = None, force_refresh: bool = False):
    """Télécharge et ingère tous les matchs d'une compétition pour une saison."""
    print(f"\n🏆 Ingestion [{comp_code}] — Saison {season}...")
    fixtures = client.get_league_fixtures(comp_code, season, force_refresh=force_refresh)
    if not fixtures:
        print(f"   ⚠️ Aucune rencontre trouvée pour {comp_code} ({season})")
        return 0

    if sample and sample > 0:
        fixtures = fixtures[:sample]

    print(f"   📋 {len(fixtures)} rencontres au calendrier. Téléchargement des détails ({workers} threads)...")
    
    # Filtrer les matchs terminés ou programmés
    match_tasks = []
    for fix in fixtures:
        m_id = fix.get('id')
        if m_id:
            match_tasks.append((fix, m_id))

    normalized_results = []
    start_time = time.time()
    
    def fetch_and_normalize(fix, m_id):
        is_finished = fix.get('status', {}).get('finished', False)
        # Pour les matchs non finis, on peut quand même récupérer les compos/arbitre
        det = client.get_match_details(m_id, comp_code, season, force_refresh=force_refresh)
        return normalize_match_payload(fix, det, comp_code, season)

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(fetch_and_normalize, fix, m_id): m_id for fix, m_id in match_tasks}
        completed_count = 0
        total_tasks = len(futures)
        
        for future in as_completed(futures):
            completed_count += 1
            try:
                norm_res = future.result()
                if norm_res:
                    normalized_results.append(norm_res)
            except Exception as e:
                print(f"   ⚠️ Erreur match {futures[future]}: {e}")
                
            if completed_count % 50 == 0 or completed_count == total_tasks:
                pct = int((completed_count / total_tasks) * 100)
                dur = time.time() - start_time
                speed = completed_count / max(0.1, dur)
                print(f"   ⏳ Progression : {completed_count}/{total_tasks} ({pct}%) — {speed:.1f} matchs/s")

    # Persistance SQLite
    conn = get_db_connection()
    try:
        persist_normalized_matches(conn, normalized_results)
    finally:
        conn.close()

    elapsed = time.time() - start_time
    print(f"   ✅ Terminé pour {comp_code} {season} : {len(normalized_results)} matchs persistés en {elapsed:.1f}s.")
    return len(normalized_results)

def main():
    parser = argparse.ArgumentParser(description="Pipeline d'Ingestion Sportif — 8 Compétitions & 3 Saisons")
    parser.add_argument('--season', type=str, choices=ALL_SEASONS + ['all'], default='all', help="Saison cible")
    parser.add_argument('--competition', type=str, choices=ALL_COMPETITIONS + ['all'], default='all', help="Compétition cible")
    parser.add_argument('--workers', type=int, default=10, help="Nombre de threads simultanés (défaut: 10)")
    parser.add_argument('--sample', type=int, default=None, help="Échantillon de matchs par ligue (pour test rapide)")
    parser.add_argument('--force-refresh', action='store_true', help="Ignore le cache et force le retéléchargement")
    parser.add_argument('--live-only', action='store_true', help="Ingère uniquement la saison en cours (2026-2027)")

    args = parser.parse_args()

    seasons_to_run = ['2026-2027'] if args.live_only else (ALL_SEASONS if args.season == 'all' else [args.season])
    comps_to_run = ALL_COMPETITIONS if args.competition == 'all' else [args.competition]

    print("╔═══════════════════════════════════════════════════════════════════════════╗")
    print("║     PREDICTOR ULTIMATE — MASTER DATA INGESTION ENGINE (8 LEAGUES / 3S)    ║")
    print("╚═══════════════════════════════════════════════════════════════════════════╝")
    print(f"📅 Saisons      : {', '.join(seasons_to_run)}")
    print(f"🏆 Compétitions : {len(comps_to_run)} actives ({', '.join(comps_to_run)})")
    print(f"⚡ Concurrency  : {args.workers} workers")
    if args.sample:
        print(f"🧪 Mode Test    : Échantillon limité à {args.sample} matchs par ligue")

    client = SportsApiClient(rate_limit=10.0)
    total_ingested = 0
    overall_start = time.time()

    for season in seasons_to_run:
        for comp in comps_to_run:
            count = process_competition_season(
                client=client,
                comp_code=comp,
                season=season,
                workers=args.workers,
                sample=args.sample,
                force_refresh=args.force_refresh
            )
            total_ingested += count

    total_time = time.time() - overall_start
    print("\n═══════════════════════════════════════════════════════════════════════════")
    print(f"🎉 INGESTION GLOBALE TERMINÉE AVEC SUCCÈS !")
    print(f"   📊 Total Matchs Ingestés : {total_ingested}")
    print(f"   ⏱️ Durée Totale           : {total_time:.1f}s ({total_time / 60:.2f} min)")
    print(f"   ⚡ Débit Global Effectif : {total_ingested / max(0.1, total_time):.1f} matchs/s")
    print("═══════════════════════════════════════════════════════════════════════════\n")

if __name__ == "__main__":
    main()
