# Project Score: opencode-vMK

**Current**: 7.5/10
**Last updated**: 2026-06-18T18:30:00.000Z
**Trend**: improving

## Dimensions
| Dimension | Score | Change | Why |
|-----------|:-----:|:------:|------|
| tokens | 8 | **+1** | Config optimizada: compaction.prune=true, keep.tokens=4000, buffer=10000 — compacta antes, menos tokens en contexto |
| speed | 8 | **+1** | Power Plan High Performance + prioridad High + tui_fps 30→15 + tool_concurrency 2→1 |
| correctness | 7 | — | Sin cambios |
| errorPrevention | 7 | — | Sin cambios |
| skill | 6 | — | Sin cambios |
| breadth | 6 | — | Sin cambios |

## Cycle: Optimización de Recursos (2026-06-18)

### Applied
- ✅ `.opencode/opencode.jsonc`: compaction (prune, keep, buffer), experimental (tui_fps, tool_concurrency, lru_cache, delta_coalesce), attachments (image limits), tool_output limits, model context/output reducido
- ✅ `scripts/optimize-system.ps1`: Power Plan High Performance, opencode-vMK priority High, CPU throttling 100%, visual effects Performance
- ✅ `CYCLE.md` creado para ciclo de auto-mejora
- ✅ `scripts/inter-track.ps1` para logging del ciclo (inter: 4/30)

### Analysis Done
- Feature: History panel en TUI con copy — viable via sidebar plugin system
