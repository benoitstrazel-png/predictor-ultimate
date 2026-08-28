#!/usr/bin/env python3
"""
QA Collector Health Check Script.
Validates Open-Meteo API, network connectivity, and JSON schemas.
"""

import sys
import json
import urllib.request
import time

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

def main():
    print("Running Data Collector QA Health Check...")
    report = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "open_meteo": check_open_meteo(),
        "overall_status": "HEALTHY"
    }
    
    if report["open_meteo"]["status"] != "OK":
        report["overall_status"] = "DEGRADED"
        
    output_json = json.dumps(report, indent=2)
    print(output_json)
    
    if report["overall_status"] != "HEALTHY":
        sys.exit(1)

if __name__ == "__main__":
    main()
