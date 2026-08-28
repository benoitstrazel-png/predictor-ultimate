---
name: qa_model_monitor
description: Antigravity Skill for monitoring ML predictions, detecting Data Drift, and verifying prediction probabilities sum to 100%.
---

# QA Model Monitor Skill (`skill.qa_model_monitor`)

## Overview
This skill checks the sanity of prediction outputs and model stability:
- Verifies $\sum P(1N2) \approx 100\%$.
- Ensures $xG \ge 0$.
- Flags probability anomalies (e.g. negative probabilities or null values).

## Usage
Run model health audit:
```bash
python .agents/skills/qa_model_monitor/scripts/check_model_health.py
```
