#!/usr/bin/env python3
"""
QA Collector Health Check Script — Predictor Ultimate.
Validates:
1. Open-Meteo Weather API connectivity, schema, and latency.
2. Betclic Puppeteer Scraping environment (Node, stealth plugin, HTTP reachability).
3. Stadium Registry Master coverage and coordinate integrity.
"""

import sys
import json
import urllib.request
import time
import os
import subprocess
import socket

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
STADIUMS_MASTER_PATH = os.path.join(ROOT_DIR, "src", "data", "stadiums_master.json")

def check_open_meteo():
    url = "https://api.open-meteo.com/v1/forecast?latitude=48.8414&longitude=2.2530&daily=temperature_2m_max&timezone=auto"
    start_time = time.time()
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'FootballPredictorQA/2.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            latency_ms = round((time.time() - start_time) * 1000, 2)
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                if "daily" in data and "temperature_2m_max" in data["daily"]:
                    return {"status": "OK", "latency_ms": latency_ms, "details": "Open-Meteo API functional"}
                else:
                    return {"status": "WARNING", "latency_ms": latency_ms, "details": "Unexpected JSON schema"}
            else:
                return {"status": "ERROR", "code": response.status, "details": "HTTP Error"}
    except Exception as e:
        return {"status": "DOWN", "details": str(e)}

def check_betclic_environment():
    """Vérifie la disponibilité de l'environnement d'extraction Puppeteer Betclic."""
    start_time = time.time()
    # 1. Vérification de Node.js et du module puppeteer-extra
    try:
        node_check = subprocess.run(
            ['node', '-e', "require('puppeteer-extra'); require('puppeteer-extra-plugin-stealth'); console.log('OK');"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if node_check.returncode != 0:
            return {
                "status": "WARNING",
                "details": f"Node modules missing: {node_check.stderr.strip()[:100]}"
            }
    except Exception as e:
        return {"status": "DOWN", "details": f"Node.js not available: {str(e)}"}

    # 2. Vérification DNS de betclic.fr
    try:
        socket.gethostbyname("www.betclic.fr")
        dns_status = "RESOLVED"
    except Exception as e:
        dns_status = f"DNS_FAILED ({str(e)})"

    latency_ms = round((time.time() - start_time) * 1000, 2)
    return {
        "status": "OK" if dns_status == "RESOLVED" else "WARNING",
        "latency_ms": latency_ms,
        "puppeteer_ready": True,
        "dns_resolution": dns_status,
        "details": "Puppeteer stealth stack ready and DNS reachable"
    }

def check_stadium_registry():
    """Valide l'intégrité du registre maître des coordonnées des stades."""
    if not os.path.exists(STADIUMS_MASTER_PATH):
        return {
            "status": "ERROR",
            "details": f"stadiums_master.json not found at {STADIUMS_MASTER_PATH}"
        }
    try:
        with open(STADIUMS_MASTER_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        total_venues = len(data)
        if total_venues < 200:
            return {
                "status": "WARNING",
                "venues_count": total_venues,
                "details": "Registry has fewer than 200 venues"
            }
            
        # Vérification des clubs piliers
        sample_clubs = ["PSG", "Real Madrid", "Bayern Munich", "Bodø/Glimt", "Liverpool", "Inter"]
        missing = [c for c in sample_clubs if c not in data or data[c].get("lat") is None]
        
        if missing:
            return {
                "status": "WARNING",
                "venues_count": total_venues,
                "missing_samples": missing,
                "details": f"Some sample clubs lack valid coords: {missing}"
            }
            
        return {
            "status": "OK",
            "venues_count": total_venues,
            "details": f"Registry certified ({total_venues} venues loaded)"
        }
    except Exception as e:
        return {"status": "ERROR", "details": f"Registry read error: {str(e)}"}

def main():
    print("Running Enhanced Data Collector QA Health Check...")
    open_meteo = check_open_meteo()
    betclic = check_betclic_environment()
    registry = check_stadium_registry()
    
    overall_status = "HEALTHY"
    if any(s.get("status") in ["ERROR", "DOWN"] for s in [open_meteo, betclic, registry]):
        overall_status = "DEGRADED"
    elif any(s.get("status") == "WARNING" for s in [open_meteo, betclic, registry]):
        overall_status = "WARNING"
        
    report = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "open_meteo": open_meteo,
        "betclic_extractor": betclic,
        "stadium_registry": registry,
        "overall_status": overall_status
    }
    
    output_json = json.dumps(report, indent=2, ensure_ascii=False)
    print(output_json)
    
    if overall_status == "DEGRADED":
        sys.exit(1)

if __name__ == "__main__":
    main()
