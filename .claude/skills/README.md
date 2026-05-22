# Voltage Design System — Claude Code Skills

**Voltage** is a manufacturing-focused document management application with an industrial design system built on React 19 + TypeScript. It features a lime-green accent (`#A7D34B`) on deep dark backgrounds, JetBrains Mono headings, DM Sans body text, and dark/light mode support via CSS custom properties.

```
 Color Palette
 ─────────────────────────────────────────────
 Accent    ████████  #A7D34B (lime green)
 Circuit   ████████  #4A7C59 (tech green)
 Silver    ████████  #C0C7D4 (metallic)
 Nickel    ████████  #7FB89E (green metallic)
 Tin       ████████  #B8A47F (warm metallic)
 ─────────────────────────────────────────────
 BG Dark   ████████  #0A0C0F → #181C23
 BG Light  ████████  #F0F1F4 → #FFFFFF
```

These 18 skills supercharge Voltage development with structured AI-assisted workflows.

## Quick Start

```bash
# Start the Voltage backend
venv/Scripts/python -m uvicorn src.api.main:app --reload --reload-dir src --port 8000

# Start the Voltage frontend
cd frontend && pnpm dev
```

Skills activate automatically based on task context. You can also invoke them directly:

```
/brainstorming          # Design before you build
/firecrawl              # Extract web content, branding, design tokens
/frontend-design        # Build distinctive Voltage UI components
/systematic-debugging   # 4-phase root cause analysis
```

## Skills Overview

### Core Development Workflows

| Skill | Purpose |
|-------|---------|
| [brainstorming](brainstorming/) | Design-before-implementation with requirements gathering |
| [writing-plans](writing-plans/) | Create executable implementation plans for multi-step tasks |
| [executing-plans](executing-plans/) | Execute written plans with review checkpoints |
| [subagent-driven-development](subagent-driven-development/) | Parallel task execution with independent agents |
| [dispatching-parallel-agents](dispatching-parallel-agents/) | Coordinate independent parallel work |

### Code Quality

| Skill | Purpose |
|-------|---------|
| [requesting-code-review](requesting-code-review/) | Request code review before merging |
| [receiving-code-review](receiving-code-review/) | Process code review feedback with technical rigor |
| [verification-before-completion](verification-before-completion/) | Verify work before claiming completion |
| [test-driven-development](test-driven-development/) | RED-GREEN-REFACTOR discipline |

### Debugging & Integration

| Skill | Purpose |
|-------|---------|
| [systematic-debugging](systematic-debugging/) | 4-phase debugging methodology |
| [component-integration](component-integration/) | Debug integration issues between components |

### Web & Design Extraction

| Skill | Purpose |
|-------|---------|
| [firecrawl](firecrawl/) | Scrape websites, extract branding/colors/fonts, web search |
| [frontend-design](frontend-design/) | Create distinctive, polished Voltage UI components |

### Meta & Automation

| Skill | Purpose |
|-------|---------|
| [reflect](reflect/) | Learn from corrections and improve skills automatically |
| [writing-skills](writing-skills/) | Create and maintain skills themselves |
| [using-superpowers](using-superpowers/) | Discover and use available skills |
| [using-git-worktrees](using-git-worktrees/) | Isolate feature work in git worktrees |
| [finishing-a-development-branch](finishing-a-development-branch/) | Guide branch completion workflow |

## Voltage-Specific Workflows

### Extracting Design Inspiration

```
firecrawl (scrape competitor/reference site)
    → Extract colors, fonts, typography, spacing
    → Compare against Voltage palette (#A7D34B, #4A7C59, etc.)
    → frontend-design (build Voltage-native component)
```

Use firecrawl with `formats=['branding']` to extract design tokens from any website, then adapt them to the Voltage design system defined in `frontend/src/styles/voltage.css`.

### Building New Voltage Components

```
brainstorming (gather requirements, explore approaches)
    → writing-plans (break into executable tasks)
    → frontend-design (implement with Voltage design tokens)
    → verification-before-completion (confirm it works)
    → requesting-code-review (get feedback)
```

### Ingesting External Manufacturing Content

```
firecrawl (scrape industry journals, vendor docs, standards)
    → Firecrawl Python client (src/ingestion/firecrawl_client.py)
    → Full RAG pipeline: classify → score → chunk → embed → store
```

Pre-configured sources include Wire Journal International, Products Finishing, and Metal Finishing News.

### Fixing a Bug

```
systematic-debugging (root cause analysis)
    → test-driven-development (write failing test first)
    → Implement fix (make test pass)
    → verification-before-completion (confirm fix)
    → requesting-code-review (get validation)
```

## Skill Dependencies

```
using-superpowers (entry point)
    ├── brainstorming
    │   └── writing-plans
    │       └── executing-plans / subagent-driven-development
    │           ├── requesting-code-review
    │           └── verification-before-completion
    │
    ├── firecrawl ←→ frontend-design
    │   └── component-integration
    │
    ├── test-driven-development
    │   └── systematic-debugging
    │
    ├── dispatching-parallel-agents
    │
    ├── using-git-worktrees
    │   └── finishing-a-development-branch
    │
    └── reflect
        └── writing-skills
```

## Configuration

### Environment Variables

```bash
# Firecrawl (web scraping & design extraction)
export FIRECRAWL_API_KEY="fc-..."

# Skills directory location
export CLAUDE_SKILLS_DIR="$HOME/.claude/skills"

# Reflect system
export CLAUDE_REFLECT_DIR="$HOME/.claude/reflect"
export CLAUDE_BACKUP_DIR="$HOME/.claude/backups"
export SESSION_DIR="$HOME/.claude/session-env"

# Thresholds
export CLAUDE_LOCK_TIMEOUT=600
export CLAUDE_BACKUP_RETENTION_DAYS=30
export CLAUDE_SEMANTIC_ANALYSIS=true
```

### Reflection System

```bash
/reflect-on       # Enable auto-reflection at session end
/reflect-status   # Check reflection status
/reflect          # Manually trigger reflection
/reflect-off      # Disable auto-reflection
```

## Skill Structure

Each skill directory contains:

```
skill-name/
├── SKILL.md              # Main skill definition (required — Claude reads this)
├── README.md             # User-facing documentation (optional)
├── references/           # Supporting documents (optional)
└── scripts/              # Helper scripts (optional)
```

### SKILL.md Format

```markdown
---
name: skill-name
version: 1.0.0
description: Brief description (Claude uses this for activation)
trigger: When to use this skill
---

# Skill Name

[Skill content with workflows, examples, and guidance]
```

## Troubleshooting

### Skills Not Loading

1. Check file structure: `.claude/skills/SKILL_NAME/SKILL.md` (exact filename)
2. Verify YAML frontmatter is valid
3. Ensure file permissions allow reading

### Reflection Failures

```bash
# Check reflection log
cat ~/.claude/reflect/hook.log

# Check status
/reflect-status
```

### Firecrawl Issues

1. Verify `FIRECRAWL_API_KEY` is set
2. Check rate limits (free tier: 500 credits/month)
3. Review `src/ingestion/firecrawl_client.py` for the Python integration

## Tech Stack Reference

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite 7 |
| CSS | Custom properties in `voltage.css` (no Tailwind) |
| State | Zustand + TanStack React Query |
| Backend | Python + FastAPI + Uvicorn |
| Vector DB | Qdrant |
| Metadata DB | SQLite |
| Icons | Lucide React |
| Charts | ECharts |
| Fonts | JetBrains Mono (headings) + DM Sans (body) |

---

**Version**: 2.0.0
**Last Updated**: 2026-02-23
**Skills**: 18
