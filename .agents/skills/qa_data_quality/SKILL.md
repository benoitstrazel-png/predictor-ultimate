---
name: qa_data_quality
description: Antigravity Skill for SQL database quality control, duplicate checking, and Mercato consistency validation.
---

# QA Data Quality Skill (`skill.qa_data_quality`)

## Overview
This skill executes SQL sanity queries to detect anomalies, orphaned records, or Mercato overlaps:
- Checks for duplicate active player affiliations (`is_current = 1`).
- Validates date ranges (`valid_from <= valid_to`).
- Verifies foreign key integrity across teams, matches, weather, and predictions.

## Usage
Run QA checks:
```bash
python .agents/skills/qa_data_quality/scripts/check_data_quality.py
```
