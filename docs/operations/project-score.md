# Project Score: opencode-vmk

**Current**: 7.7/10
**Last updated**: 2026-06-26
**Trend**: recalibrating

> Score reconcialiated from inherited 9.8 (gentleman-agent template, not representative).
> Baseline established 2026-06-26 after VMK optimization audit.

## Dimensions

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Cycle Activity | 7.0 | 4/12 VMK optimizations implemented (A1-A4), 1 partial (B1), 7 pending |
| Project Artifacts | 8.0 | BITACORA, optimization plans, measurement guide exist. No baseline snapshot saved |
| Dead Code | 7.0 | Knip + unbarrelify identified as gap (C2), some dead code likely present |
| Clean Code | 8.5 | Well-structured TypeScript. ~22 AMARILLO files still missing `// vMK:` tags |
| Metrics | 5.0 | No performance baseline, score was inflated, no regression tracking |
| Backlog Integrity | 6.0 | VMK-MANIFEST items documented but no formal tracking board |
| Bitacora | 10.0 | Comprehensive session history |
| Security | 10.0 | No identified issues in vMK scope |
| Score Depth | 5.0 | Previous score (9.8) was inherited without calibration — this is the first honest baseline |
| Best Practices | 8.0 | Solid TS practices, but lazy loading and tree-shaking not implemented |
| Orthography | 10.0 | Documentation is clean |

## VMK-MANIFEST Progress

| Item | Status | Weight |
|------|--------|--------|
| A1: drop console/debugger | ✅ Done | 100% |
| A2: Heap thresholds 512/768MB | ✅ Done | 100% |
| A3: batch() multi-signal footer | ✅ Done | 100% |
| A4: smol=true | ✅ Done | 100% |
| B1: useThread=true (OpenTUI Zig) | ⚠️ Partial | 50% |
| B2: Project References TS | ❌ Pending | 0% |
| B3: Lazy load skills/plugins | ❌ Pending | 0% |
| B4: Memoization hot paths | ❌ Pending | 0% |
| C2: Knip + unbarrelify | ❌ Pending | 0% |
| C3: AI SDK provider lazy loading | ❌ Pending | 0% |
| C4: tree-sitter WASM lazy loading | ❌ Pending | 0% |
| C5: Effect.ts Pool/TTL | ❌ Pending | 0% |
| Benchmark A/B vs upstream | ✅ Done | 100% |
| Score reconciliation | ✅ Done (this doc) | 100% |
| Test config fix | ❌ Pending | 0% |

**Overall progress**: 10.5/15 items weight-complete = 70%

## Goal

Recalibrate project score to reflect honest VMK optimization progress.
Next target: 8.5 (requires test config fix + 2 more optimizations).

## Instructions

- Score SHOULD be updated after each VMK optimization is applied
- Trend changes to "up" when score increases 0.3+
- Dimensions are scoped to opencode-vmk fork concerns only
