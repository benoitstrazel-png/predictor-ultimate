---
name: data_collector
description: Antigravity Skill to collect sports data, weather, and bookmaker odds (Betclic) across top 5 European football leagues.
---

# Data Collector Skill (`skill.data_collector`)

## Overview
This skill handles automated data collection for **European Football Predictor V2**, covering:
1. **Top 5 European Leagues**: Premier League (`ENG-PL`), La Liga (`ESP-LL`), Serie A (`ITA-SA`), Bundesliga (`GER-BL`), Ligue 1 (`FRA-L1`).
2. **Weather Data**: Open-Meteo API (Historical & Forecast match weather based on stadium geocoordinates).
3. **Betclic Odds**: Puppeteer Stealth scraping for 1N2, Over/Under, and Player Props odds.

## Structure
- `scripts/fetch_weather.py` : Queries Open-Meteo API for historical & upcoming match weather.
- `scripts/scrape_betclic_odds.js` : Automated Puppeteer script for Betclic odds collection.
- `scripts/fetch_fixtures.py` : Normalizes fixtures & scores across all 5 leagues.

## Usage
Run via Python or Node:
```bash
python .agents/skills/data_collector/scripts/fetch_weather.py --league FRA-L1
node .agents/skills/data_collector/scripts/scrape_betclic_odds.js
```
