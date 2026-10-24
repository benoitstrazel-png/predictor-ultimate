#!/usr/bin/env python3
"""
QA UI Build, Design System & Frontend Data Contract Verifier (V3).
Audits:
  1. Design System & Typography tokens (index.html, src/index.css)
  2. Cockpit Route & Component Integrity (7 lazy-loaded hubs in src/App.jsx)
  3. Frontend Data Contracts (src/data/app_data.json, src/data/compiled/analytics_cache.json,
     src/data/stadiums_master.json, public/data/model_backtest_report.json)
  4. Asset & Bundle Payload Thresholds
"""

import os
import sys
import json

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))

REQUIRED_COCKPIT_VIEWS = [
    "DailyBettingHub",
    "MatchDeepDive",
    "LeagueFocusHub",
    "MatchHistoryHub",
    "SquadsMercatoProps",
    "CopilotView",
    "BankrollTracking",
]

REQUIRED_ROUTES = [
    "/main",
    "/match-deep-dive",
    "/league-focus",
    "/history",
    "/squads-mercato",
    "/copilot",
    "/model-tracking",
]


def verify_ui():
    issues = []
    warnings = []
    checks = {}

    # 1. Design System & Typography (index.html & src/index.css)
    index_html = os.path.join(ROOT_DIR, "index.html")
    if not os.path.exists(index_html):
        issues.append(f"index.html missing at {index_html}")
        checks["typography"] = "FAILED"
    else:
        with open(index_html, "r", encoding="utf-8") as f:
            html_content = f.read()
        if "Inter" not in html_content and "Space Grotesk" not in html_content:
            issues.append("Quant fonts (Inter / Space Grotesk) missing in index.html")
            checks["typography"] = "FAILED"
        else:
            checks["typography"] = "OK"

    index_css = os.path.join(ROOT_DIR, "src", "index.css")
    if not os.path.exists(index_css):
        issues.append(f"src/index.css missing at {index_css}")
        checks["design_tokens"] = "FAILED"
    else:
        with open(index_css, "r", encoding="utf-8") as f:
            css_content = f.read()
        has_quant_palette = (
            ("--obsidian" in css_content or "--value-lime" in css_content)
            and ("--gold" in css_content or "--positive" in css_content)
        )
        if not has_quant_palette:
            issues.append("Quant color tokens (--obsidian / --gold / --positive) missing in src/index.css")
            checks["design_tokens"] = "FAILED"
        else:
            checks["design_tokens"] = "OK"

    # 2. Cockpit Views & Route Integrity (src/App.jsx)
    app_jsx = os.path.join(ROOT_DIR, "src", "App.jsx")
    if not os.path.exists(app_jsx):
        issues.append("src/App.jsx missing")
        checks["cockpit_routes"] = "FAILED"
    else:
        with open(app_jsx, "r", encoding="utf-8") as f:
            app_content = f.read()

        missing_views = []
        for view in REQUIRED_COCKPIT_VIEWS:
            comp_file = os.path.join(ROOT_DIR, "src", "components", f"{view}.jsx")
            if not os.path.exists(comp_file):
                missing_views.append(f"{view}.jsx (missing file)")
            elif view not in app_content:
                missing_views.append(f"{view} (not wired in App.jsx)")

        missing_routes = [r for r in REQUIRED_ROUTES if f'path="{r}"' not in app_content and f"path='{r}'" not in app_content]

        if missing_views:
            issues.append(f"Cockpit views missing or unwired: {', '.join(missing_views)}")
        if missing_routes:
            issues.append(f"Cockpit routes missing in App.jsx: {', '.join(missing_routes)}")

        checks["cockpit_routes"] = {
            "status": "OK" if not (missing_views or missing_routes) else "FAILED",
            "verified_views": len(REQUIRED_COCKPIT_VIEWS) - len(missing_views),
            "verified_routes": len(REQUIRED_ROUTES) - len(missing_routes),
        }

    # 3. Frontend Data Contracts & Payload Sizes
    contracts = {}

    # 3a. src/data/app_data.json
    app_data_path = os.path.join(ROOT_DIR, "src", "data", "app_data.json")
    if not os.path.exists(app_data_path):
        issues.append("Missing src/data/app_data.json")
        contracts["app_data"] = "MISSING"
    else:
        try:
            size_mb = round(os.path.getsize(app_data_path) / (1024 * 1024), 2)
            with open(app_data_path, "r", encoding="utf-8") as f:
                app_data = json.load(f)
            req_keys = ["supportedLeagues", "fullSchedule", "nextMatches", "modelBenchmarks"]
            missing_k = [k for k in req_keys if k not in app_data]
            if missing_k:
                issues.append(f"app_data.json missing keys: {missing_k}")
            sched = app_data.get("fullSchedule", [])
            missing_pbm = sum(1 for m in sched if not m.get("predictionsByModel") or not all(v in m["predictionsByModel"] for v in ("v1", "v2", "v3")))
            cloned_pbm = sum(
                1 for m in sched
                if m.get("predictionsByModel") and all(v in m["predictionsByModel"] for v in ("v1", "v2", "v3"))
                and m["predictionsByModel"]["v1"].get("probHome") == m["predictionsByModel"]["v2"].get("probHome") == m["predictionsByModel"]["v3"].get("probHome")
                and m["predictionsByModel"]["v1"].get("probDraw") == m["predictionsByModel"]["v2"].get("probDraw") == m["predictionsByModel"]["v3"].get("probDraw")
                and m["predictionsByModel"]["v1"].get("probAway") == m["predictionsByModel"]["v2"].get("probAway") == m["predictionsByModel"]["v3"].get("probAway")
            )
            if missing_pbm > 0:
                issues.append(f"app_data.json has {missing_pbm} matches missing multi-model predictionsByModel (v1/v2/v3)")
            if cloned_pbm > 0:
                issues.append(f"app_data.json has {cloned_pbm} matches with identical cloned V1/V2/V3 probabilities")
            contracts["app_data"] = {
                "size_mb": size_mb,
                "fullSchedule_count": len(sched),
                "nextMatches_count": len(app_data.get("nextMatches", [])),
                "multi_model_sealed_count": len(sched) - missing_pbm,
                "cloned_models_anomalies": cloned_pbm,
            }
        except Exception as e:
            issues.append(f"Corrupted src/data/app_data.json: {e}")

    # 3b. src/data/compiled/analytics_cache.json
    cache_path = os.path.join(ROOT_DIR, "src", "data", "compiled", "analytics_cache.json")
    if not os.path.exists(cache_path):
        issues.append("Missing src/data/compiled/analytics_cache.json")
        contracts["analytics_cache"] = "MISSING"
    else:
        try:
            cache_mb = round(os.path.getsize(cache_path) / (1024 * 1024), 2)
            with open(cache_path, "r", encoding="utf-8") as f:
                cache_data = json.load(f)
            req_keys = ["refs", "teamRecent", "featureStore", "h2hMap"]
            missing_k = [k for k in req_keys if k not in cache_data]
            if missing_k:
                issues.append(f"analytics_cache.json missing keys: {missing_k}")
            if cache_mb > 30.0:
                warnings.append(f"analytics_cache.json is large ({cache_mb} MB > 30 MB threshold)")
            contracts["analytics_cache"] = {
                "size_mb": cache_mb,
                "teamRecent_keys": len(cache_data.get("teamRecent", {})),
                "h2hMap_keys": len(cache_data.get("h2hMap", {})),
            }
        except Exception as e:
            issues.append(f"Corrupted src/data/compiled/analytics_cache.json: {e}")

    # 3c. src/data/stadiums_master.json
    stadiums_path = os.path.join(ROOT_DIR, "src", "data", "stadiums_master.json")
    if not os.path.exists(stadiums_path):
        issues.append("Missing src/data/stadiums_master.json")
    else:
        try:
            with open(stadiums_path, "r", encoding="utf-8") as f:
                stadiums_data = json.load(f)
            contracts["stadiums_master_entries"] = len(stadiums_data)
            if len(stadiums_data) < 100:
                issues.append(f"stadiums_master.json has insufficient coverage ({len(stadiums_data)} < 100)")
        except Exception as e:
            issues.append(f"Corrupted src/data/stadiums_master.json: {e}")

    # 3d. public/data/model_backtest_report.json
    backtest_path = os.path.join(ROOT_DIR, "public", "data", "model_backtest_report.json")
    if not os.path.exists(backtest_path):
        issues.append("Missing public/data/model_backtest_report.json")
    else:
        try:
            with open(backtest_path, "r", encoding="utf-8") as f:
                bt_data = json.load(f)
            contracts["backtest_report_matches"] = bt_data.get("dataset_matches_count", 0)
        except Exception as e:
            issues.append(f"Corrupted public/data/model_backtest_report.json: {e}")

    checks["data_contracts"] = contracts

    return {
        "status": "PASSED" if not issues else "FAILED",
        "checks": checks,
        "warnings": warnings,
        "issues": issues,
    }


if __name__ == "__main__":
    report = verify_ui()
    print(json.dumps(report, indent=2, ensure_ascii=False))
    if report["status"] != "PASSED":
        sys.exit(1)
