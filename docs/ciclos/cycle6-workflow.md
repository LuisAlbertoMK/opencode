# Cycle 6 — Full Gap Analysis & Optimization Workflow

> **Repo**: opencode vMK fork · `vMK-dev`  
> **Fecha**: 2026-06-30  
> **Base**: v1.17.7-vMK-dev · Bun compile · 130.5 MB

---

## Workflow Structure

```
PHASE 1 — DIAGNOSIS (3 subagentes × 3 grupos = 9 subagentes)
├── GROUP 1: Code Quality & Security
│   ├── G1A: Import correctness, circular deps, barrel files
│   ├── G1B: Dead code, unused exports, unreachable paths
│   └── G1C: Security patterns, secrets, error handling
├── GROUP 2: Performance & Resource Usage
│   ├── G2A: Boot time, caching, I/O, config loading
│   ├── G2B: Memory/RAM, heap patterns, object allocation
│   └── G2C: Bundle size, compile output, dep weight
└── GROUP 3: Architecture & Optimization
    ├── G3A: Large files, complexity hotspots, refactor candidates
    ├── G3B: Effect patterns, async boundaries, error propagation
    └── G3C: Plugin system, MCP, external API surface

PHASE 2 — SYNTHESIS
    → Compile all findings into prioritized gap list
    → Score each gap: impact × effort (1-5 each)
    → Create implementation plan

PHASE 3 — REVIEW (3 subagentes verify plan)

PHASE 4 — IMPLEMENT per fix:
    ├── Fix
    ├── 3× subagentes verify (typecheck + logic + perf)
    └── Auto-metrics + bitácora

PHASE 5 — CLOSE
    → Quality gate on all changes
    → Benchmark before/after
    → Cycle report → docs/ciclos/cycle6-YYYYMMDD.md
    → Save to Engram
```

---

## Pre-Audited Items (skip in analysis)

| Item | Status | Source |
|------|--------|--------|
| Dead code (236 unused files) | ✅ Audited | Knip (Cycle 4) |
| Boot chain audit | ✅ Audited | Cycle 5 |
| Config loading sequential I/O | 🔄 Fixed | Cycle 6 (parallel per-dir) |
| MCP token budget | ✅ Audited | BACKLOG #10/#11 |
| Heap thresholds | ✅ Done | Cycle 1 |
| Lazy CLI commands | ✅ Done | Cycle 2 |
| Dynamic import audit | ✅ Done | Cycle 3 |
| Plugin loading | ✅ Audited (parallel already) | BACKLOG #2 (skipped) |

## Confirmed N/A (CLI/TUI project)

- SEO
- GPU/VRAM
- Web accessibility
- PWA/manifest
- Lighthouse metrics

---

## Change Log

| Date | Phase | Description |
|------|-------|-------------|
| 2026-06-30 | Setup | Workflow created |
