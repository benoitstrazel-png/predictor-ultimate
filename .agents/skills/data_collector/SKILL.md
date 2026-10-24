---
name: data_collector
description: Antigravity Skill to collect sports data, stadium weather via Open-Meteo, and bookmaker odds across top 5 European leagues.
---

# Data Collector Skill (`skill.data_collector`)

## Overview
This skill handles automated data collection for **European Football Predictor V2**, covering:
1. **Top 5 European Leagues**: Premier League (`ENG-PL`), La Liga (`ESP-LL`), Serie A (`ITA-SA`), Bundesliga (`GER-BL`), Ligue 1 (`FRA-L1`).
2. **Weather Data**: Open-Meteo API (Historical & Forecast match weather for 89 European stadiums).
3. **Betclic Odds**: Puppeteer stealth extraction for 1N2, Over/Under, and Player Props odds.

## Structure
- `scripts/fetch_weather.py` : Queries Open-Meteo API for stadium weather by team & date.
- Pipeline extractor integration : `scripts/pipeline/extractors/betclicExtractor.cjs`

## Usage
Run collection via CLI:
```bash
python .agents/skills/data_collector/scripts/fetch_weather.py --team "PSG" --date "2026-10-24"
node scripts/pipeline/extractors/betclicExtractor.cjs
```
