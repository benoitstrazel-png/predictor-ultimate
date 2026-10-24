# Multi-Agent Ecosystem — Predictor Ultimate

This directory defines the specialized autonomous agents configured to collaborate in multi-tasking across data pipelines, user experience, visual interface, system security, and agentic documentation.

## The 5 Specialized Agents

| Agent | Identifier | Role & Scope | Primary Tools & MCP |
| :--- | :--- | :--- | :--- |
| **Data Orchestrator** | `data-orchestrator-agent` | SQLite integrity, Betclic odds pipeline, SCD2 drift, quarantines | `sqlite-mcp`, SQLite scripts, ETL runner |
| **Pure UX Auditor** | `ux-auditor-agent` | User journey, cognitive load of odds/ML, a11y WCAG 2.1 AA | Lighthouse, Puppeteer, DOM audit |
| **UI Design Inspector** | `ui-inspector-agent` | Glassmorphism, Tailwind tokens, Framer Motion 60fps, responsive views | Puppeteer MCP (screenshots), Vite dev server |
| **Security Guardian** | `security-guardian-agent` | Vulnerability auditing, secret leak prevention, XSS/SQLi sanitization | `npm audit`, `pip-audit`, SAST, CSP analysis |
| **Skills Documentarian** | `skills-doc-agent` | Extraction & maintenance of `SKILLS_GUIDE.md`, split-editor ergonomics | Skill scripts testing, Schema auditing |

## Inter-Agent Communication Protocol

The agents communicate via Antigravity's native `send_message` / `invoke_subagent` bus:

```
[Lead Coordinator / User]
       │
       ├──► [data-orchestrator-agent] ──(data contract / anomalies)──► [ui-inspector-agent]
       │                                                                      │
       ├──► [security-guardian-agent] ◄──(payload sanitization)───────────────┤
       │                                                                      │ (screenshots / DOM)
       │                                                                      ▼
       ├──► [skills-doc-agent] ◄────────(sync skills & runbooks)───────► [ux-auditor-agent]
       │
       └──────────────────────────────────────────────────────────────┘
```

## Running Multi-Agent Tasks

You can trigger teamwork anytime via Antigravity slash command `/teamwork-preview` or by invoking subagents individually:
```markdown
@skills-doc-agent Mets à jour SKILLS_GUIDE.md suite aux nouveaux flags CLI du modèle prédictif.
```
