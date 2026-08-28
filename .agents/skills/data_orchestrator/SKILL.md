---
name: data_orchestrator
description: Antigravity Skill for ETL pipelines, SQL database schema management, and Mercato SCD Type 2 tracking.
---

# Data Orchestrator Skill (`skill.data_orchestrator`)

## Overview
This skill manages data engineering, database schemas, and player transfer history (SCD Type 2):
- **SCD Type 2 Mercato Management**: Ensures zero data loss and exact temporal tracking when players transfer between clubs (e.g., Marmoush, Cherki).
- **SQL Data Ingestion**: Clean ingestion into `leagues`, `teams`, `players`, `player_team_history`, `matches`, `match_weather`, `match_odds`, `predictions`.

## Usage
Run migration & seed scripts:
```bash
python .agents/skills/data_orchestrator/scripts/init_database.py
python .agents/skills/data_orchestrator/scripts/manage_mercato.py --transfer --player "Omar Marmoush" --to "Manchester City" --date "2026-07-01"
```
