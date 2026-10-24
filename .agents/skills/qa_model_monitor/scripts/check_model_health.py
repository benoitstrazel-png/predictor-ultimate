#!/usr/bin/env python3
"""
QA Model Monitor Script (Football Quant Engine V3).
Tests:
1. V3 Hybrid Model Bundle (.joblib) integrity and end-to-end inference (v1, v2, v3).
2. Probability normalization (sum ~ 100%), positivity of xG, and real player roster resolution.
3. Database audit of fact_model_predictions (6,444 rows) for probability drift and calibration metrics.
"""

import sys
import json
import os
import sqlite3

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", "..", "..", ".."))
PREDICTOR_SCRIPTS = os.path.abspath(os.path.join(CURRENT_DIR, "..", "..", "ml_predictor", "scripts"))

for p in (ROOT_DIR, PREDICTOR_SCRIPTS):
    if p not in sys.path:
        sys.path.insert(0, p)

from predict_match import calculate_match_probabilities
from scripts.ml.predict_match_v3 import predict_single_match, MODEL_BUNDLE_PATH

DB_PATH = os.path.join(ROOT_DIR, "predictor_v2.db")

def audit_model():
    issues = []

    # 1. Baseline Poisson mathematical check
    res = calculate_match_probabilities(1.8, 1.2)
    total_p = res["prob_home"] + res["prob_draw"] + res["prob_away"]
    if abs(total_p - 100.0) > 2.0:
        issues.append(f"Poisson sum anomaly: {total_p}% (Expected ~100%)")
    if res["prob_home"] < 0 or res["prob_away"] < 0 or res["prob_draw"] < 0:
        issues.append("Negative probabilities detected in baseline Poisson")

    # 2. V3 Bundle & Live Inference Check
    v3_inference_ok = False
    scorers_resolved = False
    if not os.path.exists(MODEL_BUNDLE_PATH):
        issues.append(f"Missing V3 model bundle: {MODEL_BUNDLE_PATH}")
    else:
        try:
            v3_out = predict_single_match(
                home_team="Paris Saint-Germain",
                away_team="Marseille",
                odd_home=1.65,
                odd_draw=4.10,
                odd_away=5.50
            )
            by_model = v3_out.get("predictions_by_model", {})
            for ver in ("v1", "v2", "v3"):
                m = by_model.get(ver, {})
                s = float(m.get("probHome", 0)) + float(m.get("probDraw", 0)) + float(m.get("probAway", 0))
                if abs(s - 100.0) > 1.0:
                    issues.append(f"Model {ver} probability sum drift: {round(s, 2)}%")
                if float(m.get("lambdaHome", 0)) <= 0 or float(m.get("lambdaAway", 0)) <= 0:
                    issues.append(f"Model {ver} non-positive xG lambda")

            home_scorers = v3_out.get("potential_scorers", {}).get("home", [])
            if not home_scorers or any("Buteur (" in s.get("name", "") for s in home_scorers):
                issues.append("Generic placeholder scorers detected for Paris Saint-Germain")
            else:
                scorers_resolved = True

            v3_inference_ok = True
        except Exception as e:
            issues.append(f"V3 inference error: {str(e)}")

    # 3. Warehouse fact_model_predictions Audit
    db_metrics = {}
    if os.path.exists(DB_PATH):
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("""
                SELECT COUNT(*)
                FROM fact_model_predictions
                WHERE ABS((prob_home + prob_draw + prob_away) - 100.0) > 1.0
                   OR lambda_home_xg <= 0 OR lambda_away_xg <= 0
            """)
            bad_rows = cursor.fetchone()[0]
            if bad_rows > 0:
                issues.append(f"{bad_rows} anomalous predictions in fact_model_predictions")

            cursor.execute("""
                SELECT model_version, COUNT(*), ROUND(AVG(brier_score), 4), ROUND(AVG(log_loss), 4)
                FROM fact_model_predictions
                GROUP BY model_version
            """)
            for ver, cnt, brier, logloss in cursor.fetchall():
                db_metrics[ver] = {
                    "predictions_count": cnt,
                    "brier_score": brier,
                    "log_loss": logloss
                }
            conn.close()
        except Exception as e:
            issues.append(f"Database prediction audit error: {str(e)}")

    # 4. Frontend Payload (app_data.json) Multi-Model Integrity Check
    app_data_path = os.path.join(ROOT_DIR, "src", "data", "app_data.json")
    frontend_multi_model_stats = {}
    if os.path.exists(app_data_path):
        try:
            with open(app_data_path, "r", encoding="utf-8") as f:
                app_data = json.load(f)
            sched = app_data.get("fullSchedule", [])
            missing_pbm = 0
            cloned_pbm = 0
            for m in sched:
                pbm = m.get("predictionsByModel")
                if not pbm or not all(v in pbm for v in ("v1", "v2", "v3")):
                    missing_pbm += 1
                else:
                    v1, v2, v3 = pbm["v1"], pbm["v2"], pbm["v3"]
                    if (
                        v1.get("probHome") == v2.get("probHome") == v3.get("probHome")
                        and v1.get("probDraw") == v2.get("probDraw") == v3.get("probDraw")
                        and v1.get("probAway") == v2.get("probAway") == v3.get("probAway")
                    ):
                        cloned_pbm += 1
            frontend_multi_model_stats = {
                "total_matches": len(sched),
                "missing_predictionsByModel": missing_pbm,
                "cloned_v1_v2_v3_count": cloned_pbm,
            }
            if missing_pbm > 0:
                issues.append(f"{missing_pbm} matches in app_data.json are missing predictionsByModel (v1/v2/v3)")
            if cloned_pbm > 0:
                issues.append(f"{cloned_pbm} matches in app_data.json have identical cloned V1/V2/V3 probabilities")
        except Exception as e:
            issues.append(f"app_data.json multi-model check error: {str(e)}")

    return {
        "status": "PASSED" if not issues else "FAILED",
        "sum_check_total": f"{round(total_p, 2)}%",
        "v3_bundle_ready": v3_inference_ok,
        "real_scorers_resolved": scorers_resolved,
        "warehouse_calibration": db_metrics,
        "frontend_multi_model": frontend_multi_model_stats,
        "issues": issues
    }

if __name__ == "__main__":
    report = audit_model()
    print(json.dumps(report, indent=2, ensure_ascii=False))
    if report["status"] != "PASSED":
        sys.exit(1)
