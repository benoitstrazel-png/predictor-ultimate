#!/usr/bin/env python3
"""
scripts/scheduler/match_scheduler.py
─────────────────────────────────────────────────────────────
Master Scheduler Engine — Automated Match Life-Cycle Orchestrator
Gère les cycles d'actualisation de tous les matchs programmés :
- Phase Pré-match : H-1 (kickoff - 60 min) -> Compositions officielles, inférence ML et cotes Value Bet.
- Phase Post-match : H+1 après le match (kickoff + 150 min, soit coup de sifflet final + 60 min)
  -> Ingestion des résultats, xG, événements, stats détaillées et mise à jour classements.
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

def record_job_start(job_id: str, match_id: str, phase: str, scheduled_time: datetime.datetime):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    sched_iso = scheduled_time.isoformat()
    c.execute("""
        INSERT INTO sys_scheduler_jobs (job_id, match_id, phase, scheduled_time_utc, status, attempts_count, updated_at)
        VALUES (?, ?, ?, ?, 'RUNNING', 1, CURRENT_TIMESTAMP)
        ON CONFLICT(job_id) DO UPDATE SET 
            status = 'RUNNING',
            attempts_count = attempts_count + 1,
            updated_at = CURRENT_TIMESTAMP
    """, (job_id, match_id, phase, sched_iso))
    conn.commit()
    conn.close()

def record_job_completion(job_id: str, success: bool, error_msg: str = None):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    status = 'SUCCESS' if success else 'FAILED'
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    c.execute("""
        UPDATE sys_scheduler_jobs SET
            status = ?,
            executed_time_utc = ?,
            last_error_message = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE job_id = ?
    """, (status, now_iso, error_msg, job_id))
    conn.commit()
    conn.close()

def run_pre_match_task(match_id: str, comp_id: str, season: str, job_id: str, scheduled_dt: datetime.datetime):
    print(f"\n🚀 [SCHEDULER] Lancement du job Pré-match H-1 : {job_id} ({match_id})...")
    record_job_start(job_id, match_id, 'PRE_MATCH', scheduled_dt)
    try:
        res = process_pre_match_lineups(match_id, comp_id, season)
        is_ok = bool(res.get('success', False))
        record_job_completion(job_id, is_ok, res.get('message') if not is_ok else None)
        print(f"✨ [SCHEDULER] Fin du job Pré-match H-1 {job_id} -> Status : {res.get('status')}")
    except Exception as e:
        record_job_completion(job_id, False, str(e))
        print(f"❌ [SCHEDULER] Échec job Pré-match {job_id} : {e}")

def run_post_match_task(match_id: str, comp_id: str, season: str, job_id: str, scheduled_dt: datetime.datetime):
    print(f"\n🏁 [SCHEDULER] Lancement du job Post-match H+1 : {job_id} ({match_id})...")
    record_job_start(job_id, match_id, 'POST_MATCH', scheduled_dt)
    try:
        res = process_post_match_consolidation(match_id, comp_id, season)
        is_ok = bool(res.get('success', False))
        record_job_completion(job_id, is_ok, res.get('message') if not is_ok else None)
        print(f"✨ [SCHEDULER] Fin du job Post-match H+1 {job_id} -> Status : {res.get('status')} | Score: {res.get('score')}")
    except Exception as e:
        record_job_completion(job_id, False, str(e))
        print(f"❌ [SCHEDULER] Échec job Post-match {job_id} : {e}")

class MatchSchedulerEngine:
    def __init__(self, mode='background'):
        init_scheduler_db()
        self.mode = mode
        self.scheduler = BlockingScheduler() if mode == 'blocking' else BackgroundScheduler()
        self.scheduled_jobs_count = 0

    def parse_kickoff_datetime(self, utc_str: str) -> datetime.datetime:
        if not utc_str:
            return datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=2)
        try:
            clean_utc = utc_str.replace('Z', '+00:00') if 'Z' in utc_str else utc_str
            dt = datetime.datetime.fromisoformat(clean_utc)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=datetime.timezone.utc)
            return dt
        except Exception:
            return datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=2)

    def schedule_match_lifecycle(self, match_id: str, comp_id: str, season: str, 
                                 home_team: str, away_team: str, kickoff_dt: datetime.datetime,
                                 dry_run: bool = False):
        """
        Programme les 2 jobs d'actualisation pour un match donné :
        - Pré-match : H-1 avant le match (kickoff - 60m)
        - Post-match : H+1 après la fin du match (kickoff + 150m = 90m match + 60m après match)
        """
        now = datetime.datetime.now(datetime.timezone.utc)
        t_pre = kickoff_dt - datetime.timedelta(minutes=60)
        t_post = kickoff_dt + datetime.timedelta(minutes=150)

        job_id_pre = f"job_pre_{match_id}"
        job_id_post = f"job_post_{match_id}"

        # Consigner dans la base sys_scheduler_jobs
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        for j_id, phase, run_t in [(job_id_pre, 'PRE_MATCH', t_pre), (job_id_post, 'POST_MATCH', t_post)]:
            c.execute("""
                INSERT INTO sys_scheduler_jobs (job_id, match_id, phase, scheduled_time_utc, status, updated_at)
                VALUES (?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP)
                ON CONFLICT(job_id) DO UPDATE SET
                    scheduled_time_utc = excluded.scheduled_time_utc,
                    updated_at = CURRENT_TIMESTAMP
                WHERE status NOT IN ('SUCCESS', 'RUNNING')
            """, (j_id, match_id, phase, run_t.isoformat()))
        conn.commit()
        conn.close()

        if dry_run:
            return

        # Planification APScheduler si l'échéance est dans le futur
        if t_pre > now:
            self.scheduler.add_job(
                run_pre_match_task,
                'date',
                run_date=t_pre,
                args=[match_id, comp_id, season, job_id_pre, t_pre],
                id=job_id_pre,
                replace_existing=True
            )
            self.scheduled_jobs_count += 1

        if t_post > now:
            self.scheduler.add_job(
                run_post_match_task,
                'date',
                run_date=t_post,
                args=[match_id, comp_id, season, job_id_post, t_post],
                id=job_id_post,
                replace_existing=True
            )
            self.scheduled_jobs_count += 1

    def schedule_upcoming_matches(self, limit: int = None, days: int = None, target_date: str = None, dry_run: bool = False):
        """
        Scanne et planifie tous les matchs à venir (statut SCHEDULED).
        """
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()

        query = """
            SELECT match_id, competition_id, season, home_team_name, away_team_name, 
                   match_timestamp_utc, match_date, status
            FROM fact_matches 
            WHERE status = 'SCHEDULED'
        """
        params = []

        if target_date:
            query += " AND match_date = ?"
            params.append(target_date)
        elif days:
            start_date = datetime.date.today().isoformat()
            end_date = (datetime.date.today() + datetime.timedelta(days=days)).isoformat()
            query += " AND match_date >= ? AND match_date <= ?"
            params.extend([start_date, end_date])
        else:
            now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
            query += " AND (match_timestamp_utc >= ? OR match_date >= ?)"
            params.extend([now_str, datetime.date.today().isoformat()])

        query += " ORDER BY match_timestamp_utc ASC"
        if limit:
            query += f" LIMIT {int(limit)}"

        c.execute(query, tuple(params))
        fixtures = c.fetchall()
        conn.close()

        print(f"\n📅 [SCHEDULER] {len(fixtures)} rencontres à venir identifiées pour programmation.")
        print(f"⏰ Configuration : Pré-match = Kickoff - 60 min (H-1) | Post-match = Kickoff + 150 min (H+1 après le match)")

        for f in fixtures:
            m_id = f['match_id']
            utc_str = f['match_timestamp_utc']
            home = f['home_team_name']
            away = f['away_team_name']
            comp = f['competition_id']
            season = f['season']

            kickoff_dt = self.parse_kickoff_datetime(utc_str)
            t_pre = kickoff_dt - datetime.timedelta(minutes=60)
            t_post = kickoff_dt + datetime.timedelta(minutes=150)

            print(f"   🕒 [{comp}] {home} vs {away} (Coup d'envoi {kickoff_dt.strftime('%d/%m %H:%M')} UTC)")
            print(f"      ↳ Actualisation H-1 : {t_pre.strftime('%d/%m %H:%M')} UTC | Actualisation H+1 : {t_post.strftime('%d/%m %H:%M')} UTC")

            self.schedule_match_lifecycle(
                match_id=m_id,
                comp_id=comp,
                season=season,
                home_team=home,
                away_team=away,
                kickoff_dt=kickoff_dt,
                dry_run=dry_run
            )

        print(f"\n✅ Total jobs APScheduler actifs programmés en mémoire : {self.scheduled_jobs_count}")

    def refresh_scheduler_jobs(self):
        """Recherche récurrente des nouveaux matchs programmés."""
        print(f"\n🔄 [{datetime.datetime.now().strftime('%H:%M:%S')}] Scan de synchronisation des matchs à venir...")
        self.schedule_upcoming_matches(limit=100)

    def start(self):
        # Scan récurrent toutes les 60 minutes pour intégrer les nouveaux matchs ou reprogrammations
        self.scheduler.add_job(
            self.refresh_scheduler_jobs,
            'interval',
            hours=1,
            id='job_system_sync_upcoming',
            replace_existing=True
        )
        print("\n🚀 [SCHEDULER ENGINE] Lancement de l'orchestration continue (H-1 et H+1)...")
        self.scheduler.start()

def show_scheduler_status():
    init_scheduler_db()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("""
        SELECT status, phase, COUNT(*) as cnt 
        FROM sys_scheduler_jobs 
        GROUP BY status, phase
        ORDER BY phase, status
    """)
    rows = c.fetchall()
    print("\n📊 [STATUT DES JOBS D'ACTUALISATION DANS SYS_SCHEDULER_JOBS]")
    if not rows:
        print("   Aucun job enregistré pour le moment.")
    for r in rows:
        print(f"   - Phase: {r['phase']} | Statut: {r['status']} : {r['cnt']} jobs")

    c.execute("""
        SELECT j.job_id, j.match_id, j.phase, j.scheduled_time_utc, j.status,
               m.home_team_name, m.away_team_name, m.competition_id
        FROM sys_scheduler_jobs j
        LEFT JOIN fact_matches m ON j.match_id = m.match_id OR ('FOT_' || j.match_id) = m.match_id
        ORDER BY j.scheduled_time_utc ASC
        LIMIT 10
    """)
    next_jobs = c.fetchall()
    if next_jobs:
        print("\n🕒 [10 PROCHAINS JOBS PLANIFIÉS] :")
        for j in next_jobs:
            home = j['home_team_name'] or 'Équipe 1'
            away = j['away_team_name'] or 'Équipe 2'
            print(f"   [{j['scheduled_time_utc']}] {j['job_id']} ({j['phase']}) : {home} vs {away} [{j['status']}]")
    conn.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Predictor Ultimate Master Match Scheduler (H-1 & H+1)")
    parser.add_argument('--all-upcoming', action='store_true', help='Schedule all future upcoming matches in the database')
    parser.add_argument('--date', type=str, default=None, help='Target date for fixtures (YYYY-MM-DD)')
    parser.add_argument('--days', type=int, default=None, help='Number of days ahead to schedule (e.g. 7)')
    parser.add_argument('--limit', type=int, default=None, help='Limit number of matches to schedule')
    parser.add_argument('--mode', type=str, default='blocking', choices=['blocking', 'background'])
    parser.add_argument('--dry-run', action='store_true', help='Only inspect and insert jobs in DB without starting APScheduler')
    parser.add_argument('--status', action='store_true', help='Show scheduled jobs statistics from sys_scheduler_jobs')
    args = parser.parse_args()

    if args.status:
        show_scheduler_status()
        sys.exit(0)

    engine = MatchSchedulerEngine(mode=args.mode)

    if args.date:
        engine.schedule_upcoming_matches(target_date=args.date, dry_run=args.dry_run)
    elif args.days:
        engine.schedule_upcoming_matches(days=args.days, dry_run=args.dry_run)
    else:
        # Par défaut : tous les matchs à venir
        engine.schedule_upcoming_matches(limit=args.limit, dry_run=args.dry_run)

    if args.mode == 'blocking' and not args.dry_run:
        try:
            engine.start()
        except (KeyboardInterrupt, SystemExit):
            print("\n🛑 Scheduler arrêté par l'utilisateur.")