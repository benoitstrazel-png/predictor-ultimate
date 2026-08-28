#!/usr/bin/env python3
"""
QA Model Monitor Script.
Tests prediction outputs for probability coherence, sum normalization, and expected goal constraints.
"""

import sys
import json
import os

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PREDICTOR_SCRIPTS = os.path.abspath(os.path.join(CURRENT_DIR, "..", "..", "ml_predictor", "scripts"))
if PREDICTOR_SCRIPTS not in sys.path:
    sys.path.append(PREDICTOR_SCRIPTS)

from predict_match import calculate_match_probabilities

def audit_model():
    # Test case: Normal match
    res = calculate_match_probabilities(1.8, 1.2)
    total_p = res["prob_home"] + res["prob_draw"] + res["prob_away"]
    
    issues = []
    if abs(total_p - 100.0) > 2.0:
        issues.append(f"Probabilities sum anomaly: {total_p}% (Expected ~100%)")
        
    if res["prob_home"] < 0 or res["prob_away"] < 0 or res["prob_draw"] < 0:
        issues.append("Negative probabilities detected")
        
    return {
        "status": "PASSED" if not issues else "FAILED",
        "sum_check_total": f"{round(total_p, 2)}%",
        "issues": issues
    }

if __name__ == "__main__":
    report = audit_model()
    print(json.dumps(report, indent=2))
    if report["status"] != "PASSED":
        sys.exit(1)
