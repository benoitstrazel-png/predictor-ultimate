#!/usr/bin/env python3
"""
scripts/server/odds_api_server.py
─────────────────────────────────────────────────────────────
Micro-service HTTP local (port 5175) pour le rafraîchissement des cotes on-demand
via requête frontend (Fetch/XHR).
- Supporte matchId, homeTeam, awayTeam
- Connecté à `refresh_single_match`
"""

import os
import sys
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

sys.stdout.reconfigure(encoding='utf-8')

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from scripts.pipeline.refresh_single_match_odds import refresh_single_match

class OddsApiHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_POST(self):
        if self.path.startswith('/api/odds/refresh'):
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode('utf-8')) if body else {}
                match_id = data.get('matchId')
                home_team = data.get('homeTeam')
                away_team = data.get('awayTeam')
                odd_h = data.get('oddHome')
                odd_d = data.get('oddDraw')
                odd_a = data.get('oddAway')

                result = refresh_single_match(
                    match_id=match_id,
                    home_team=home_team,
                    away_team=away_team,
                    odd_home=odd_h,
                    odd_draw=odd_d,
                    odd_away=odd_a
                )
                self.send_response(200)
                self._send_cors_headers()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'data': result}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self._send_cors_headers()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'error': str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

def run_server(port=5175):
    server = HTTPServer(('0.0.0.0', port), OddsApiHandler)
    print(f"[ODDS API SERVER] Serveur actif sur http://localhost:{port}/api/odds/refresh")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServeur arrete.")

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5175
    run_server(port)
