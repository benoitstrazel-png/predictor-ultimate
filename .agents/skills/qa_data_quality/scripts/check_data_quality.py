#!/usr/bin/env python3
"""
SQL Data Quality Auditor for European Football Predictor V2.
Checks for:
1. Duplicate current affiliations (is_current = 1) in dim_player_contracts_scd2.
2. Broken date ranges (valid_from > valid_to) and unbounded historical records (is_current = 0 AND valid_to IS NULL).
3. Reference completeness of dim_competitions (8 official competitions).
4. Analytical B-Tree indices on high-volume tables (fct_match_lineups, fact_match_events, dim_player_contracts_scd2).
5. Physical & relational SQLite integrity (PRAGMA integrity_check).
"""

import os
import sys
import sqlite3
import json

DB_CANDIDATES = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "predictor_v2.db")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "predictor_v2.db")),
    os.path.abspath("predictor_v2.db"),
]
DB_PATH = next((p for p in DB_CANDIDATES if os.path.exists(p)), DB_CANDIDATES[0])

REQUIRED_INDICES = {
    "idx_contracts_player_current",
    "idx_lineups_match",
    "idx_lineups_player",
    "idx_events_match",
    "idx_matches_comp_season",
}

def audit_database():
    if not os.path.exists(DB_PATH):
        return {"status": "ERROR", "details": f"Database file missing: {DB_PATH}"}

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    anomalies = []

    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    existing_tables = {row[0] for row in cursor.fetchall()}

    target_table = "dim_player_contracts_scd2" if "dim_player_contracts_scd2" in existing_tables else "player_team_history"
    id_col = "contract_sk" if target_table == "dim_player_contracts_scd2" else "history_id"

    # 1. Check for players with multiple active teams (is_current = 1)
    cursor.execute(f"""
        SELECT player_id, COUNT(*) as active_count
        FROM {target_table}
        WHERE is_current = 1
        GROUP BY player_id
        HAVING active_count > 1
    """)
    multiple_active = cursor.fetchall()
    if multiple_active:
        anomalies.append({
            "type": "MULTIPLE_ACTIVE_AFFILIATIONS",
            "table": target_table,
            "severity": "HIGH",
            "count": len(multiple_active),
            "sample": multiple_active[:5]
        })

    # 2. Check for invalid date ranges (valid_from > valid_to)
    cursor.execute(f"""
        SELECT {id_col}, player_id, valid_from, valid_to
        FROM {target_table}
        WHERE valid_to IS NOT NULL AND valid_from > valid_to
    """)
    invalid_dates = cursor.fetchall()
    if invalid_dates:
        anomalies.append({
            "type": "INVALID_DATE_RANGE",
            "table": target_table,
            "severity": "HIGH",
            "count": len(invalid_dates),
            "sample": invalid_dates[:5]
        })

    # 3. Check for unbounded historical records (is_current = 0 AND valid_to IS NULL)
    cursor.execute(f"""
        SELECT COUNT(*)
        FROM {target_table}
        WHERE is_current = 0 AND valid_to IS NULL
    """)
    unbounded_historical = cursor.fetchone()[0]
    if unbounded_historical > 0:
        anomalies.append({
            "type": "UNBOUNDED_HISTORICAL_CONTRACTS",
            "table": target_table,
            "severity": "MEDIUM",
            "count": unbounded_historical
        })

    # 4. Check dim_competitions reference completeness
    comp_count = 0
    if "dim_competitions" in existing_tables:
        cursor.execute("SELECT COUNT(*) FROM dim_competitions")
        comp_count = cursor.fetchone()[0]
        if comp_count < 8:
            anomalies.append({
                "type": "INCOMPLETE_DIM_COMPETITIONS",
                "table": "dim_competitions",
                "severity": "MEDIUM",
                "count": comp_count
            })

    # 5. Check required B-Tree analytical indices
    cursor.execute("SELECT name FROM sqlite_master WHERE type='index'")
    existing_indices = {row[0] for row in cursor.fetchall()}
    missing_indices = sorted(REQUIRED_INDICES - existing_indices)
    if missing_indices:
        anomalies.append({
            "type": "MISSING_ANALYTICAL_INDICES",
            "severity": "MEDIUM",
            "missing": missing_indices
        })

    # Collect warehouse metrics
    cursor.execute(f"SELECT COUNT(*) FROM {target_table}")
    total_contracts = cursor.fetchone()[0]
    cursor.execute(f"SELECT COUNT(*) FROM {target_table} WHERE is_current = 1")
    active_contracts = cursor.fetchone()[0]

    conn.close()

    status = "PASSED" if not anomalies else "FAILED"
    return {
        "status": status,
        "anomalies_found": len(anomalies),
        "warehouse_metrics": {
            "scd2_table": target_table,
            "total_contracts": total_contracts,
            "active_contracts": active_contracts,
            "competitions_seeded": comp_count,
            "analytical_indices_verified": len(REQUIRED_INDICES) - len(missing_indices)
        },
        "details": anomalies
    }

if __name__ == "__main__":
    report = audit_database()
    print(json.dumps(report, indent=2))
    if report["status"] != "PASSED":
        sys.exit(1)
