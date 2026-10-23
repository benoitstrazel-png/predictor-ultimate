#!/usr/bin/env python3
"""
scripts/server/odds_api_server.py
─────────────────────────────────────────────────────────────
Serveur API Quantitatif Multi-Modèles & RAG Streaming (Port 5175, ThreadingHTTPServer) :
- GET  /api/v1/models/comparison                  : Benchmarks certifiés v1 vs v2 vs v3 (Hit Rate, Brier, LogLoss, ROI)
- GET  /api/v1/matches?model_version=v3           : Flux de matchs avec switch multi-modèles instantané
- GET  /api/v1/matches/<match_id>/rag-brief       : Brief RAG structuré (Signaux faibles, Absences, Arbitre/Météo, Sources)
- GET  /api/v1/matches/<match_id>/rag-stream      : Flux Server-Sent Events (SSE) progressif par bloc avec cache KV/SQLite
- POST /api/odds/refresh                          : Rafraîchissement des cotes Betclic & recalcul Shin Value Bet
"""

import os
import sys
import json
import time
import sqlite3
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from scripts.pipeline.refresh_single_match_odds import refresh_single_match
from scripts.server.rag_structured_service import build_structured_match_brief, get_db_connection

APP_DATA_FILE = os.path.join(ROOT_DIR, "src", "data", "app_data.json")


def load_app_data_cached():
    if not os.path.exists(APP_DATA_FILE):
        return {}
    with open(APP_DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


class QuantApiHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")

    def _send_json(self, status_code: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        # 1. Endpoint Benchmarks Multi-Modèles (v1 vs v2 vs v3)
        if path == "/api/v1/models/comparison":
            try:
                conn = get_db_connection()
                cur = conn.cursor()
                cur.execute(
                    """
                    SELECT f.model_version,
                           r.model_name,
                           r.algorithm_family,
                           COUNT(f.prediction_id) AS total_sealed,
                           SUM(CASE WHEN f.actual_outcome IS NOT NULL THEN 1 ELSE 0 END) AS evaluated_matches,
                           ROUND(AVG(CASE WHEN f.actual_outcome IS NOT NULL THEN f.is_hit * 100.0 END), 2) AS hit_rate_pct,
                           ROUND(AVG(f.brier_score), 4) AS avg_brier,
                           ROUND(AVG(f.log_loss), 4) AS avg_log_loss,
                           ROUND(SUM(COALESCE(f.flat_stake_pnl, 0.0)), 2) AS flat_pnl_u,
                           ROUND(AVG(CASE WHEN f.actual_outcome IS NOT NULL THEN f.flat_stake_pnl * 100.0 END), 2) AS flat_roi_pct
                    FROM fact_model_predictions f
                    JOIN dim_model_registry r ON f.model_version = r.model_version
                    GROUP BY f.model_version, r.model_name, r.algorithm_family
                    ORDER BY f.model_version
                    """
                )
                models = []
                for r in cur.fetchall():
                    models.append(
                        {
                            "modelVersion": r[0],
                            "modelName": r[1],
                            "algorithmFamily": r[2],
                            "totalSealed": r[3],
                            "evaluatedMatches": r[4] or 0,
                            "hitRatePct": r[5] or 0.0,
                            "brierScore": r[6] or 0.0,
                            "logLoss": r[7] or 0.0,
                            "flatPnlUnits": r[8] or 0.0,
                            "flatRoiPct": r[9] or 0.0,
                        }
                    )
                conn.close()
                self._send_json(200, {"success": True, "models": models})
            except Exception as e:
                self._send_json(500, {"success": False, "error": str(e)})
            return

        # 2. Endpoint Brief RAG Structuré (JSON ou SSE Streaming)
        if path.startswith("/api/v1/matches/") and (
            path.endswith("/rag-brief") or path.endswith("/rag-stream")
        ):
            parts = path.strip("/").split("/")
            match_id = parts[3] if len(parts) >= 5 else "UNKNOWN"
            model_ver = (qs.get("model_version") or ["v3"])[0]
            force_ref = (qs.get("refresh") or ["false"])[0].lower() == "true"

            app_data = load_app_data_cached()
            target_match = None
            for m in app_data.get("fullSchedule", []):
                if str(m.get("id")) == str(match_id):
                    target_match = m
                    break
            if not target_match:
                target_match = {"id": match_id, "homeTeam": "Home", "awayTeam": "Away"}

            brief = build_structured_match_brief(
                target_match, model_version=model_ver, force_refresh=force_ref
            )

            if path.endswith("/rag-stream"):
                self.send_response(200)
                self._send_cors_headers()
                self.send_header("Content-Type", "text/event-stream; charset=utf-8")
                self.send_header("Cache-Control", "no-cache")
                self.send_header("Connection", "keep-alive")
                self.end_headers()

                stages = [
                    ("verdict", {"verdictOneLiner": brief["verdictOneLiner"], "cacheHit": brief["cacheHit"]}),
                    ("weak_signals", {"weakSignals": brief["weakSignals"]}),
                    ("absences", {"absencesAlerts": brief["absencesAlerts"]}),
                    ("context", {"contextFactors": brief["contextFactors"]}),
                    ("citations", {"citedSources": brief["citedSources"], "done": True}),
                ]
                for event_name, chunk_data in stages:
                    msg = f"event: {event_name}\ndata: {json.dumps(chunk_data, ensure_ascii=False)}\n\n"
                    self.wfile.write(msg.encode("utf-8"))
                    self.wfile.flush()
                    if not brief.get("cacheHit"):
                        time.sleep(0.06)
                return

            self._send_json(200, {"success": True, "brief": brief})
            return

        self._send_json(404, {"success": False, "error": "Route non trouvée"})

    def do_POST(self):
        if self.path.startswith("/api/odds/refresh"):
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode("utf-8")) if body else {}
                result = refresh_single_match(
                    match_id=data.get("matchId"),
                    home_team=data.get("homeTeam"),
                    away_team=data.get("awayTeam"),
                    odd_home=data.get("oddHome"),
                    odd_draw=data.get("oddDraw"),
                    odd_away=data.get("oddAway"),
                )
                self._send_json(200, {"success": True, "data": result})
            except Exception as e:
                self._send_json(500, {"success": False, "error": str(e)})
        else:
            self._send_json(404, {"success": False, "error": "Not found"})


def run_server(port=5175):
    server = ThreadingHTTPServer(("0.0.0.0", port), QuantApiHandler)
    print(f"⚡ [QUANT & RAG API SERVER] Actif sur http://localhost:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServeur arrêté.")


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5175
    run_server(port)
