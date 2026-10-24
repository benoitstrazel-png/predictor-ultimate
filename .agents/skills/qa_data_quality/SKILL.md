---
name: qa_data_quality
description: Antigravity Skill for SQL database quality control, duplicate checking, and Mercato consistency validation.
---

# QA Data Quality Skill (`skill.qa_data_quality`)

## Overview
This skill executes SQL sanity queries and ecosystem audits to detect anomalies, orphaned records, or Mercato overlaps:
- Checks for duplicate active player affiliations (`is_current = 1`).
- Validates date ranges (`valid_from <= valid_to`).
- Verifies foreign key integrity across teams, matches, weather, and predictions.
- Audits full dataset health score (app_data, unified_history, players).

## Structure
- `scripts/check_data_quality.py` : Python SQLite integrity audit (`dim_player_contracts_scd2` & date coherence).
- `scripts/audit_complete_ecosystem.cjs` : Node.js full ecosystem audit and score calculation.

## Usage
Run QA checks:
```bash
python .agents/skills/qa_data_quality/scripts/check_data_quality.py
node .agents/skills/qa_data_quality/scripts/audit_complete_ecosystem.cjs
```
