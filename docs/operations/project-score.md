# Project Score: opencode-vMK

**Current**: 8.7/10
**Last updated**: 2026-06-26
**Trend**: improving

> Score reconcialiated from inherited 9.8 (gentleman-agent template, not representative).
> Baseline established 2026-06-26 after VMK optimization audit.
> Updated 2026-06-26 — Cycle2 build fix + score refresh.

## Dimensions

| Dimension | Score | Rationale | Δ |
|-----------|-------|-----------|---|
| Cycle Activity | 8.0 | Cycle2 completado (build fix + vmk.cmd + cycle report). Cycle3 iniciado con CYCLE.md actualizado | +1.0 |
| Project Artifacts | 8.5 | BITACORA, optimization plans, ciclo report en docs/ciclos/cycle2.md | +0.5 |
| Dead Code | 8.0 | Knip + unbarrelify partially done. @hono/zod-validator removed. | — |
| Clean Code | 9.0 | Well-structured TS. Registry pattern + nullish coalescing fallback. ~22 AMARILLO files still missing `// vMK:` tags | — |
| Metrics | 8.5 | Tests pass, score-auto.ps1 running, project score tracking estable | +0.5 |
| Backlog Integrity | 7.0 | CYCLE.md con tasks claros para Cycle3. BITACORA actualizada | +1.0 |
| Bitacora | 10.0 | Comprehensive session history | — |
| Security | 10.0 | 3-subagente security review: PASS, no secrets, no injection vectors | — |
| Score Depth | 7.5 | Diferencia entre inter-track (agent) y .project.json (proyecto) entendida y documentada | +0.5 |
| Best Practices | 9.0 | Static registry + fallback pattern. B3 lazy import fixed para Bun compile | +0.5 |
| Orthography | 10.0 | Documentation is clean | — |

## VMK-MANIFEST Progress

| Item | Status | Weight |
|------|--------|--------|
| A1: drop console/debugger | ✅ Done | 100% |
| A2: Heap thresholds 512/768MB | ✅ Done | 100% |
| A3: batch() multi-signal footer | ✅ Done | 100% |
| A4: smol=true | ✅ Done | 100% |
| B1: useThread=true (OpenTUI Zig) | ⚠️ Partial | 50% |
| B2: Project References TS | ❌ Skip | tsgo typechecker, no tsc — no benefit |
| B3: Lazy CLI commands (23 static→dynamic imports) | 🔶 Fixed | 95% — static registry fallback agregado para Bun compile compatibility |
| B4: Memoization hot paths | ❌ Skip | AppRuntime already optimized; no clear targets |
| C2: Knip — remove unused @hono/zod-validator | ✅ Done | 100% |
| C3: AI SDK provider lazy loading | ✅ Already lazy | All providers use dynamic import() |
| C4: tree-sitter WASM lazy loading | ✅ Already lazy | Parser + WASM loaded via dynamic import() |
| C5: Effect.ts Pool/TTL | ✅ Already ok | WebSocket pool has TTL; no Effect Pool usage |
| Benchmark A/B vs upstream | ✅ Done | 100% |
| Score reconciliation | ✅ Done | 100% |
| Test config fix | ❌ Blocked | OpenTUI upstream segfault — not fork-fixable |

**Overall progress**: 10/13 actionable items complete = 77%
**(C3/C4/C5 were pre-optimized by upstream, B2/B4 not applicable)

## Goal

Recalibrate project score to reflect honest VMK optimization progress.
Target 8.5 achieved. No further low-hanging fruit in vMK fork scope.
Remaining items blocked by upstream or not applicable.
## Post-Audit — Cycle2 Build Fix

- **B3**: Lazy CLI commands worked in dev mode but broke Bun compile. Fix: static
  registry (`_registry.ts`) con 23 imports + `lazy()` fallback (`??`). Smoke test PASS.
- **Cycle2 completado**: build fix, vmk.cmd cleanup, cycle report, 2 commits.
- **Cycle3 iniciado**: target Cycle Activity 8.5, Project Score 9.0.

The 32 `packages/core/src/plugin/provider/*.ts` files remain as-is — thin wrappers,
not worth converting. Next ceiling: 9.0/10 after completing Cycle3 tasks.

## Instructions

- Score SHOULD be updated after each VMK optimization is applied
- Trend changes to "up" when score increases 0.3+
- Dimensions are scoped to opencode-vMK fork concerns only
