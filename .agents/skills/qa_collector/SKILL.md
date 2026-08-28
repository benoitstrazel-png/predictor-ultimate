---
name: qa_collector
description: Antigravity Skill for monitoring data collection health, API status, and DOM selector stability.
---

# QA Collector Skill (`skill.qa_collector`)

## Overview
This skill performs quality checks and alerting for data collection pipelines in **European Football Predictor V2**:
- Verifies Open-Meteo API availability & response times.
- Verifies Puppeteer scraper selector validity.
- Detects missing match data, null values, or network timeouts.

## Usage
Run healthcheck script:
```bash
python .agents/skills/qa_collector/scripts/check_collector_health.py
```
