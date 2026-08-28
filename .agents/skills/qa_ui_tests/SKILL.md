---
name: qa_ui_tests
description: Antigravity Skill for Frontend UI build validation, data contract checks, and route integrity.
---

# QA UI Tests Skill (`skill.qa_ui_tests`)

## Overview
This skill validates the Next.js/React frontend build and asset contracts:
- Runs build validation (`npm run build` or Vite dry-run).
- Verifies that all 5 European leagues are properly routed.
- Validates Glassmorphism CSS token integrity.

## Usage
Run UI QA build test:
```bash
python .agents/skills/qa_ui_tests/scripts/verify_ui_build.py
```
