#!/usr/bin/env python3
"""
scripts/pipeline/extractors/sportsApiClient.py
─────────────────────────────────────────────────────────────
Client HTTP haute performance, résilient et asynchrone/multithreadé pour
l'ingestion des flux sportifs (FotMob / Sofascore).

Fonctionnalités clés :
- Token Bucket Rate Limiter (adaptatif, max 8-10 req/s)
- Exponential backoff avec random jitter
- Cache local déterministe (Data Lake Raw JSON)
- Session persistante Keep-Alive avec retry automatique
- Couverture intégrale des 8 compétitions (Top 5 + Coupes d'Europe)
"""

import os
import sys
import time
import json
import random
import threading
from urllib.parse import quote
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
RAW_DATA_DIR = os.path.join(ROOT_DIR, "data", "raw")

# Configuration des 8 Compétitions Officielles
COMPETITIONS_CONFIG = {
    'FRA-L1': {'name': 'Ligue 1', 'id': 53, 'country': 'FRA', 'flag': '🇫🇷'},
    'ENG-PL': {'name': 'Premier League', 'id': 47, 'country': 'ENG', 'flag': '🇬🇧'},
    'ESP-LL': {'name': 'La Liga', 'id': 87, 'country': 'ESP', 'flag': '🇪🇸'},
    'ITA-SA': {'name': 'Serie A', 'id': 55, 'country': 'ITA', 'flag': '🇮🇹'},
    'GER-BL': {'name': 'Bundesliga', 'id': 54, 'country': 'GER', 'flag': '🇩🇪'},
    'EUR-CL': {'name': 'Champions League', 'id': 42, 'country': 'EUR', 'flag': '🇪🇺'},
    'EUR-EL': {'name': 'Europa League', 'id': 73, 'country': 'EUR', 'flag': '🇪🇺'},
    'EUR-ECL': {'name': 'Conference League', 'id': 10216, 'country': 'EUR', 'flag': '🇪🇺'},
}

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
]

class TokenBucketRateLimiter:
    """Thread-safe Token Bucket Rate Limiter."""
    def __init__(self, rate: float = 8.0, capacity: float = 12.0):
        self.rate = rate
        self.capacity = capacity
        self.tokens = capacity
        self.last_check = time.time()
        self.lock = threading.Lock()

    def acquire(self):
        with self.lock:
            while True:
                now = time.time()
                elapsed = now - self.last_check
                self.last_check = now
                self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
                if self.tokens >= 1.0:
                    self.tokens -= 1.0
                    return
                # Wait for next token
                sleep_time = (1.0 - self.tokens) / self.rate
                time.sleep(max(0.01, sleep_time))

class SportsApiClient:
    """Client API pour l'ingestion sportive avec gestion du cache et résilience."""
    def __init__(self, raw_dir: str = RAW_DATA_DIR, rate_limit: float = 8.0):
        self.raw_dir = raw_dir
        self.rate_limiter = TokenBucketRateLimiter(rate=rate_limit)
        self.session = requests.Session()
        
        # Configure connection pooling & retries
        retries = Retry(
            total=4,
            backoff_factor=1.0,
            status_forcelist=[429, 500, 502, 503, 504],
            raise_on_status=False
        )
        adapter = HTTPAdapter(max_retries=retries, pool_connections=20, pool_maxsize=20)
        self.session.mount('https://', adapter)
        self.session.mount('http://', adapter)

    def _get_headers(self):
        return {
            'User-Agent': random.choice(USER_AGENTS),
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': 'https://www.fotmob.com/',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
        }

    def _request_with_backoff(self, url: str, params: dict = None, max_attempts: int = 4) -> dict:
        """Effectue une requête GET avec rate limiting et exponential backoff."""
        for attempt in range(1, max_attempts + 1):
            self.rate_limiter.acquire()
            try:
                resp = self.session.get(url, params=params, headers=self._get_headers(), timeout=12)
                if resp.status_code == 200:
                    return resp.json()
                elif resp.status_code == 429:
                    jitter = random.uniform(0.5, 2.0)
                    sleep_dur = (2 ** attempt) + jitter
                    print(f"⚠️ [RateLimit:429] Pause de {sleep_dur:.2f}s avant réessai...")
                    time.sleep(sleep_dur)
                elif resp.status_code == 404:
                    return None
                else:
                    print(f"⚠️ [HTTP {resp.status_code}] URL: {url} (Tentative {attempt}/{max_attempts})")
                    time.sleep(1.0 * attempt)
            except Exception as e:
                print(f"⚠️ [RequestError] {e} (Tentative {attempt}/{max_attempts})")
                time.sleep(1.0 * attempt)
        return None

    def get_league_fixtures(self, competition_id: str, season: str = '2024-2025', force_refresh: bool = False) -> list:
        """
        Récupère l'intégralité du calendrier et des matchs d'une ligue pour une saison donnée.
        season format: '2024-2025', '2025-2026', '2026-2027'
        """
        if competition_id not in COMPETITIONS_CONFIG:
            raise ValueError(f"Compétition inconnue: {competition_id}")

        cfg = COMPETITIONS_CONFIG[competition_id]
        fotmob_id = cfg['id']
        fotmob_season = season.replace('-', '/')

        # Chemins de cache
        season_dir = os.path.join(self.raw_dir, season, competition_id)
        os.makedirs(season_dir, exist_ok=True)
        cache_file = os.path.join(season_dir, "fixtures_calendar.json")

        if not force_refresh and os.path.exists(cache_file):
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass

        url = f"https://www.fotmob.com/api/data/leagues?id={fotmob_id}&season={quote(fotmob_season)}"
        data = self._request_with_backoff(url)
        if not data:
            print(f"❌ Impossible de charger les fixtures pour {competition_id} ({season})")
            return []

        all_matches = data.get('fixtures', {}).get('allMatches', [])
        # Sauvegarde dans le cache brut
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(all_matches, f, ensure_ascii=False, indent=2)

        return all_matches

    def get_match_details(self, match_id: int | str, competition_id: str, season: str, force_refresh: bool = False) -> dict:
        """
        Récupère les détails exhaustifs d'un match (stats, xG, compo, événements, notes, arbitre).
        """
        season_dir = os.path.join(self.raw_dir, season, competition_id, "matches")
        os.makedirs(season_dir, exist_ok=True)
        cache_file = os.path.join(season_dir, f"{match_id}.json")

        if not force_refresh and os.path.exists(cache_file):
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    cached = json.load(f)
                    if cached and cached.get('content'):
                        return cached
            except Exception:
                pass

        url = f"https://www.fotmob.com/api/data/matchDetails?matchId={match_id}"
        data = self._request_with_backoff(url)
        if data:
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return data
        return None

if __name__ == "__main__":
    client = SportsApiClient()
    print("🚀 Test SportsApiClient sur Ligue 1 2024-2025...")
    matches = client.get_league_fixtures('FRA-L1', '2024-2025')
    print(f"✅ {len(matches)} matchs récupérés pour FRA-L1 2024-2025.")
    if matches:
        first_id = matches[0].get('id')
        print(f"🔍 Test Match Details pour match #{first_id}...")
        detail = client.get_match_details(first_id, 'FRA-L1', '2024-2025')
        print(f"✅ Match Details keys: {list(detail.keys()) if detail else 'None'}")
