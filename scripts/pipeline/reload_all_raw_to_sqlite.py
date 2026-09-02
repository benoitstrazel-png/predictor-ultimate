#!/usr/bin/env python3
"""
scripts/pipeline/reload_all_raw_to_sqlite.py
─────────────────────────────────────────────────────────────
Recharge et normalise l'intégralité des données brutes en cache (data/raw/)
vers SQLite (predictor_v2.db) avec la résolution d'entités stricte par championnat.
"""

import os
import sys
import json
import time
import sqlite3

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

DB_PATH = os.path.join(ROOT_DIR, "predictor_v2.db")
RAW_DATA_DIR = os.path.join(ROOT_DIR, "data", "raw")

from scripts.pipeline.transformers.sportsDataNormalizer import normalize_match_payload
from scripts.pipeline.ingest_historical_and_live_matches import persist_normalized_matches

def reload_all():
    print("🔄 [Reloader] Vidage et reconstruction des tables fact_* dans SQLite...")
    conn = sqlite3.connect(DB_PATH)
    from scripts.pipeline.ingest_historical_and_live_matches import init_db_schema_if_needed
    init_db_schema_if_needed(conn)
    c = conn.cursor()
    c.execute("PRAGMA foreign_keys = OFF;")
    c.execute("DELETE FROM fact_matches;")
    c.execute("DELETE FROM fact_match_events;")
    c.execute("DELETE FROM fact_match_team_stats;")
    c.execute("DELETE FROM fct_match_lineups;")
    conn.commit()
    conn.close()

    total_processed = 0
    start_time = time.time()

    # Parcourir chaque saison et compétition dans data/raw/
    for season in sorted(os.listdir(RAW_DATA_DIR)):
        season_path = os.path.join(RAW_DATA_DIR, season)
        if not os.path.isdir(season_path):
            continue

        for comp in sorted(os.listdir(season_path)):
            comp_path = os.path.join(season_path, comp)
            if not os.path.isdir(comp_path):
                continue

            fixtures_file = os.path.join(comp_path, "fixtures_calendar.json")
            if not os.path.exists(fixtures_file):
                continue

            with open(fixtures_file, 'r', encoding='utf-8') as f:
                fixtures = json.load(f)

            matches_dir = os.path.join(comp_path, "matches")
            normalized_batch = []

            for fix in fixtures:
                m_id = fix.get('id')
                if not m_id:
                    continue
                match_file = os.path.join(matches_dir, f"{m_id}.json")
                details = None
                if os.path.exists(match_file):
                    try:
                        with open(match_file, 'r', encoding='utf-8') as mf:
                            details = json.load(mf)
                    except Exception:
                        pass

                norm = normalize_match_payload(fix, details, comp, season)
                if norm:
                    normalized_batch.append(norm)

            # Persistance par ligue/saison
            conn = sqlite3.connect(DB_PATH)
            try:
                persist_normalized_matches(conn, normalized_batch)
            finally:
                conn.close()

            total_processed += len(normalized_batch)
            print(f"   ✅ [{comp:<8} | {season}] {len(normalized_batch)} matchs normalisés et insérés.")

    elapsed = time.time() - start_time
    print(f"\n🎉 [Reloader] {total_processed} matchs rechargés avec succès en {elapsed:.2f}s !")

if __name__ == "__main__":
    reload_all()
