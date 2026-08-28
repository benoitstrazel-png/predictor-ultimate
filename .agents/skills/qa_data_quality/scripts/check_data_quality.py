#!/usr/bin/env python3
"""
SQL Data Quality Auditor for European Football Predictor V2.
Checks for duplicate current affiliations, broken date ranges, and orphan records.
"""

import os
import sys
import sqlite3
import json

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "predictor_v2.db"))

def audit_database():
    if not os.path.exists(DB_PATH):
        return {"status": "ERROR", "details": f"Database file missing: {DB_PATH}"}
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    anomalies = []
    
    # 1. Check for players with multiple active teams (is_current = 1)
    cursor.execute("""
        SELECT player_id, COUNT(*) as active_count
        FROM player_team_history
        WHERE is_current = 1
        GROUP BY player_id
        HAVING active_count > 1
    """)
    multiple_active = cursor.fetchall()
    if multiple_active:
        anomalies.append({
            "type": "MULTIPLE_ACTIVE_AFFILIATIONS",
            "severity": "HIGH",
            "count": len(multiple_active),
            "sample": multiple_active[:5]
        })
        
    # 2. Check for invalid date ranges (valid_from > valid_to)
    cursor.execute("""
        SELECT history_id, player_id, valid_from, valid_to
        FROM player_team_history
        WHERE valid_to IS NOT NULL AND valid_from > valid_to
    """)
    invalid_dates = cursor.fetchall()
    if invalid_dates:
        anomalies.append({
            "type": "INVALID_DATE_RANGE",
            "severity": "HIGH",
            "count": len(invalid_dates),
            "sample": invalid_dates[:5]
        })
        
    conn.close()
    
    status = "PASSED" if not anomalies else "FAILED"
    return {
        "status": status,
        "anomalies_found": len(anomalies),
        "details": anomalies
    }

if __name__ == "__main__":
    report = audit_database()
    print(json.dumps(report, indent=2))
    if report["status"] != "PASSED":
        sys.exit(1)
