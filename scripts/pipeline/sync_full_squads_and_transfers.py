#!/usr/bin/env python3
"""
scripts/pipeline/sync_full_squads_and_transfers.py
─────────────────────────────────────────────────────────────
Orchestrateur Maître pour l'automatisation complète de la mise à jour
des effectifs, de l'historique SCD2 et de la base de transferts Transfermarkt.
"""

import sys
import os
import subprocess
import time

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def run_step(step_num, title, command):
    print(f"\n▶ [{step_num}/5] {title}...")
    start_t = time.time()
    
    res = subprocess.run(
        command,
        cwd=ROOT_DIR,
        shell=True,
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='replace'
    )
    
    elapsed = time.time() - start_t
    if res.returncode != 0:
        print(f"❌ Échec de l'étape [{step_num}/5] : {title}")
        print("STDERR:\n", res.stderr)
        print("STDOUT:\n", res.stdout)
        sys.exit(1)
    else:
        print(f"✅ Étape [{step_num}/5] validée en {elapsed:.2f}s")
        lines = [l for l in res.stdout.split('\n') if l.strip().startswith('✅') or l.strip().startswith('🎉')]
        for l in lines:
            print(f"   {l.strip()}")

def main():
    print("╔═══════════════════════════════════════════════════════════════════════════╗")
    print("║   AUTOMATED SQUADS & TRANSFERS PIPELINE (TRANSFERMARKT / SCD TYPE 2)      ║")
    print("╚═══════════════════════════════════════════════════════════════════════════╝")
    total_start = time.time()

    # Garantir que le schéma SQLite existe avant toute opération
    import sqlite3
    from scripts.pipeline.ingest_historical_and_live_matches import init_db_schema_if_needed
    db_p = os.path.join(ROOT_DIR, "predictor_v2.db")
    with sqlite3.connect(db_p) as conn:
        init_db_schema_if_needed(conn)

    run_step(
        1,
        "Réconciliation temporelle multi-saisons des effectifs",
        f'"{sys.executable}" scripts/pipeline/sync_transfers_and_deduplicate_rosters.py'
    )

    run_step(
        2,
        "Peuplement et enrichissement de la table fct_player_transfers",
        f'"{sys.executable}" scripts/pipeline/build_transfers_database.py'
    )

    run_step(
        3,
        "Ingestion du Master Squads & Contrats SCD2 dans SQLite",
        f'"{sys.executable}" scripts/pipeline/ingest_master_squads.py'
    )

    run_step(
        4,
        "Compilation des artefacts clients Fast-Layer (transfers & squads unified)",
        f'"{sys.executable}" scripts/pipeline/compile_client_rosters.py'
    )

    run_step(
        5,
        "Reconstruction des bases joueurs statiques (players_static.js, real_players.json)",
        "node scripts/rebuild_all_player_databases_2026_2027.cjs"
    )

    total_elapsed = time.time() - total_start
    print("\n═══════════════════════════════════════════════════════════════════════════")
    print(f"🎉 PIPELINE EFFECTIFS & TRANSFERTS TERMINÉ AVEC SUCCÈS en {total_elapsed:.2f}s !")
    print("═══════════════════════════════════════════════════════════════════════════\n")

if __name__ == "__main__":
    main()
