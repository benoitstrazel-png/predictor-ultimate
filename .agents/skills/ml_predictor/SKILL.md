---
name: ml_predictor
description: Antigravity Skill for match probability calculation (1N2, exact scores), Value Bet detection, and RAG analytical reasoning.
---

# ML Predictor Skill (`skill.ml_predictor`)

## Overview
This skill executes feature engineering, predictive modeling, and Value Bet identification for **European Football Predictor V2**:
- **Dixon-Coles & Poisson Model**: Computes expected goals ($xG_{home}, xG_{away}$) and exact probability matrices for 1N2 and scores.
- **Value Bet Finder**: Compares model probability against Betclic implied odds ($Edge = P_{model} \times Odd_{betclic} - 1$). Flags value bets when $Edge > 5\%$.
- **RAG Reasoning**: Supplies contextual analytical data to Antigravity's Cognitive Loop.

## Usage
Run match prediction:
```bash
python .agents/skills/ml_predictor/scripts/predict_match.py --home "PSG" --away "Marseille" --odd_home 1.65 --odd_draw 4.20 --odd_away 5.00
```
