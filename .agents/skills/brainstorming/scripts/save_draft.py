#!/usr/bin/env python3
"""
Helper script for the @brainstorming skill.
Saves an enriched prompt draft into `.agents/drafts/` with metadata.
"""

import os
import sys
import argparse
from datetime import datetime

def save_draft(name: str, content: str, tags: str = "brainstorming", output_dir: str = ".agents/drafts") -> str:
    os.makedirs(output_dir, exist_ok=True)
    slug = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in name.lower().strip())
    slug = "_".join(filter(None, slug.split("_")))
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"draft_{timestamp}_{slug}.md"
    filepath = os.path.join(output_dir, filename)

    metadata_header = f"""---
title: "{name}"
date: "{datetime.now().isoformat()}"
tags: [{', '.join(f'"{t.strip()}"' for t in tags.split(','))}]
status: "draft"
created_by: "@brainstorming skill"
---

# 📝 Draft : {name}

> Sauvegardé le {datetime.now().strftime("%d/%m/%Y à %H:%M:%S")} via la skill `@brainstorming`.

## 🎯 Contenu du Prompt Optimisé

{content}
"""

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(metadata_header)

    abs_path = os.path.abspath(filepath)
    print(f"DRAFT_SAVED:{abs_path}")
    return abs_path

def main():
    parser = argparse.ArgumentParser(description="Save prompt draft from @brainstorming skill")
    parser.add_argument("--name", type=str, required=True, help="Short descriptive name of the prompt")
    parser.add_argument("--content", type=str, required=True, help="The enriched prompt content")
    parser.add_argument("--tags", type=str, default="brainstorming", help="Comma-separated tags")
    parser.add_argument("--dir", type=str, default=".agents/drafts", help="Target drafts directory")

    args = parser.parse_args()
    save_draft(args.name, args.content, args.tags, args.dir)

if __name__ == "__main__":
    main()
