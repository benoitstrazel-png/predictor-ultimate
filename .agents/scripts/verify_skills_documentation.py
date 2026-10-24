#!/usr/bin/env python3
"""
Audit & Validation Script: Verify that all skills in .agents/skills/
are properly registered and documented in SKILLS_GUIDE.md.
"""

import os
import re
import sys
import json

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SKILLS_DIR = os.path.join(WORKSPACE_ROOT, ".agents", "skills")
GUIDE_AGENTS = os.path.join(WORKSPACE_ROOT, ".agents", "SKILLS_GUIDE.md")
GUIDE_ROOT = os.path.join(WORKSPACE_ROOT, "SKILLS_GUIDE.md")

def get_discovered_skills():
    skills = []
    if not os.path.exists(SKILLS_DIR):
        return skills
    for entry in sorted(os.listdir(SKILLS_DIR)):
        skill_path = os.path.join(SKILLS_DIR, entry, "SKILL.md")
        if os.path.isfile(skill_path):
            with open(skill_path, "r", encoding="utf-8") as f:
                content = f.read()
            match = re.search(r"^name:\s*([^\r\n]+)", content, re.MULTILINE)
            name = match.group(1).strip() if match else entry
            skills.append({
                "folder": entry,
                "name": name,
                "file": skill_path
            })
    return skills

def verify_guide(guide_path, skills):
    if not os.path.exists(guide_path):
        return {"exists": False, "missing_toc": [s["name"] for s in skills], "missing_section": [s["name"] for s in skills]}
    
    with open(guide_path, "r", encoding="utf-8") as f:
        content = f.read()

    missing_toc = []
    missing_section = []

    for skill in skills:
        name = skill["name"]
        # Check TOC link
        if f"[`{name}`]" not in content and f"[{name}]" not in content:
            missing_toc.append(name)
        # Check Section header
        if not re.search(rf"###\s+\d+\.\s+Skill\s+[`]?{re.escape(name)}[`]?", content, re.IGNORECASE):
            missing_section.append(name)

    return {
        "exists": True,
        "path": guide_path,
        "missing_toc": missing_toc,
        "missing_section": missing_section,
        "is_synced": len(missing_toc) == 0 and len(missing_section) == 0
    }

def main():
    skills = get_discovered_skills()
    res_agents = verify_guide(GUIDE_AGENTS, skills)
    res_root = verify_guide(GUIDE_ROOT, skills)

    all_synced = res_agents["is_synced"] and res_root["is_synced"]

    report = {
        "total_skills_discovered": len(skills),
        "skills": [s["name"] for s in skills],
        "agents_skills_guide": res_agents,
        "root_skills_guide": res_root,
        "status": "PASSED" if all_synced else "FAILED"
    }

    print(json.dumps(report, indent=2))
    sys.exit(0 if all_synced else 1)

if __name__ == "__main__":
    main()
