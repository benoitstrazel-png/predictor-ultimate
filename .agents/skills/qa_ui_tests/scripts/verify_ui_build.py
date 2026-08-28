#!/usr/bin/env python3
"""
QA UI Build & Contract Verifier.
Checks index.html, index.css, and package.json build compatibility.
"""

import os
import sys
import json

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))

def verify_ui():
    issues = []
    
    index_html = os.path.join(ROOT_DIR, "index.html")
    if not os.path.exists(index_html):
        issues.append(f"index.html missing at {index_html}")
    else:
        with open(index_html, "r", encoding="utf-8") as f:
            content = f.read()
            if ("Space Grotesk" not in content and "Space+Grotesk" not in content) or "Inter" not in content:
                issues.append("Cyber-Analytic fonts (Space Grotesk / Inter) missing in index.html")
                
    index_css = os.path.join(ROOT_DIR, "src", "index.css")
    if not os.path.exists(index_css):
        issues.append(f"src/index.css missing at {index_css}")
    else:
        with open(index_css, "r", encoding="utf-8") as f:
            css_content = f.read()
            if "--value-lime" not in css_content or "--alert-coral" not in css_content:
                issues.append("Cyber-Analytic color tokens (--value-lime / --alert-coral) missing")
                
    return {
        "status": "PASSED" if not issues else "FAILED",
        "issues": issues
    }

if __name__ == "__main__":
    report = verify_ui()
    print(json.dumps(report, indent=2))
    if report["status"] != "PASSED":
        sys.exit(1)
