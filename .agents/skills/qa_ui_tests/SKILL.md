---
name: qa_ui_tests
description: Antigravity Skill for Frontend UI build validation, data contract checks, and route integrity.
---

# QA UI Tests Skill (`skill.qa_ui_tests`)

## Overview
This skill validates the React 18 / Vite Quant Terminal frontend build, route wiring, and asset contracts:
- Audits **Design System & Typography tokens** (`Inter`, `JetBrains Mono`, `--obsidian`, `--value-lime`, `--gold`, `--positive`) in `index.html` and `src/index.css`.
- Verifies **Cockpit Route & Component Integrity** across all 7 lazy-loaded hubs (`DailyBettingHub`, `MatchDeepDive`, `LeagueFocusHub`, `MatchHistoryHub`, `SquadsMercatoProps`, `CopilotView`, `BankrollTracking`) in `src/App.jsx`.
- Validates **Frontend Data Contracts** and payload thresholds (`src/data/app_data.json`, `src/data/compiled/analytics_cache.json`, `src/data/stadiums_master.json`, `public/data/model_backtest_report.json`).

## Usage
Run UI QA build & contract verifier:
```bash
python .agents/skills/qa_ui_tests/scripts/verify_ui_build.py
```
