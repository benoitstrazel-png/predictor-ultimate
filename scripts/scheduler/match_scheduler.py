#!/usr/bin/env python3
"""
scripts/scheduler/match_scheduler.py
─────────────────────────────────────────────────────────────
Master Scheduler Engine — Automated Match Life-Cycle Orchestrator
Gère les phases Pré-match (T-60 min) et Post-match (T+115 min) avec APScheduler.
"""

import os
import sys
import time
import json
import sqlite3
import datetime
import argparse
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.schedulers.blocking import BlockingScheduler

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from scripts.scheduler.handlers.pre_match_handler import process_pre_match_lineups
from scripts.scheduler.handlers.post_match_handler import process_post_match_consolidation

DB_PATH = os.path.join(ROOT_DIR, 'predictor_v2.db')

def init_scheduler_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS sys_scheduler_jobs (
            job_id VARCHAR(64) PRIMARY KEY,
            match_id VARCHAR(64) NOT NULL,
            phase VARCHAR(32) NOT NULL,
            scheduled_time_utc TIMESTAMP NOT NULL,
            executed_time_utc TIMESTAMP,
            status VARCHAR(16) NOT NULL,
            attempts_count INT DEFAULT 0,
            last_error_message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()
    conn.close()

class MatchSchedulerEngine:
    def __init__(self, mode='background'):
        init_scheduler_db()
        self.scheduler = BlockingScheduler() if mode == 'blocking' else BackgroundScheduler()
        self.is_running = False

    def load_and_schedule_daily_fixtures(self, target_date=None):
        if not target_date:
            target_date = datetime.date.today().isoformat()
        
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        c.execute("""
            SELECT match_id, competition_id, season, home_team_name, away_team_name, 
                   match_timestamp_utc, match_date, status
            FROM fact_matches 
            WHERE match_date = ? AND status = 'SCHEDULED'
            ORDER BY match_timestamp_utc ASC
        """, (target_date,))
        fixtures = c.fetchall()
        conn.close()

        print(f"\n📅 [SCHEDULER] {len(fixtures)} rencontres programmées trouvées pour la date : {target_date}")
        
        for f in fixtures:
            m_id = f['match_id']
            utc_str = f['match_timestamp_utc']
            home = f['home_team_name']
            away = f['away_team_name']
            comp = f['competition_id']
            season = f['season']

            try:
                clean_utc = utc_str.replace('Z', '+00:00') if 'Z' in utc_str else utc_str
                kickoff_dt = datetime.datetime.fromisoformat(clean_utc)
                if kickoff_dt.tzinfo is None:
                    kickoff_dt = kickoff_dt.replace(tzinfo=datetime.timezone.utc)
            except Exception:
                kickoff_dt = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=2)

            t_lineups = kickoff_dt - datetime.timedelta(minutes=60)
            t_post = kickoff_dt + datetime.timedelta(minutes=115)

            job_id_pre = f"job_pre_{m_id}"
            job_id_post = f"job_post_{m_id}"

            print(f"   🕒 [{comp}] {home} vs {away} -> Pré-match @ {t_lineups.strftime('%H:%M')} UTC | Post-match @ {t_post.strftime('%H:%M')} UTC")

            self.scheduler.add_job(
                process_pre_match_lineups,
                'date',
                run_date=t_lineups,
                args=[m_id, comp, season],
                id=job_id_pre,
                replace_existing=True
            )

            self.scheduler.add_job(
                process_post_match_consolidation,
                'date',
                run_date=t_post,
                args=[m_id, comp, season],
                id=job_id_post,
                replace_existing=True
            )

    def start(self):
        print("\n🚀 [SCHEDULER ENGINE] Lancement de la boucle d'orchestration...")
        self.scheduler.start()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Predictor Ultimate Match Scheduler")
    parser.add_argument('--date', type=str, default='2026-08-29', help='Target date for fixtures (YYYY-MM-DD)')
    parser.add_argument('--mode', type=str, default='blocking', choices=['blocking', 'background'])
    args = parser.parse_args()

    engine = MatchSchedulerEngine(mode=args.mode)
    engine.load_and_schedule_daily_fixtures(target_date=args.date)
    if args.mode == 'blocking':
        try:
            engine.start()
        except (KeyboardInterrupt, SystemExit):
            print("\n🛑 Scheduler arrêté par l'utilisateur.")