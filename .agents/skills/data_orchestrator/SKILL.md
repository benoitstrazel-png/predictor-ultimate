---
name: data_orchestrator
description: Antigravity Skill for ETL pipelines, SQL database schema management, and Mercato SCD Type 2 tracking.
---

# Data Orchestrator Skill (`skill.data_orchestrator`)

## Overview
This skill manages data engineering, V2 dimensional warehouse schemas (`predictor_v2.db`), and player transfer history (SCD Type 2):
- **SCD Type 2 Mercato Management**: Ensures zero data loss and exact temporal tracking in `dim_player_contracts_scd2` (`valid_from`, `valid_to`, `is_current`) when players transfer between clubs (e.g., Marmoush, Cherki).
- **SQL Dimensional Warehouse**: Manages `dim_competitions`, `dim_teams`, `dim_players`, `dim_player_contracts_scd2`, `fact_matches`, `fct_match_lineups`, `fact_odds_snapshots`, `fact_model_predictions` and analytical B-Tree indices.

## Usage
Run migration & SCD2 scripts:
```bash
python .agents/skills/data_orchestrator/scripts/init_database.py
python .agents/skills/data_orchestrator/scripts/manage_mercato.py --transfer --player "Omar Marmoush" --to "Manchester City" --date "2025-07-01"
```
