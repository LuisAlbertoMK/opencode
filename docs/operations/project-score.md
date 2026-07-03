# Project Score: opencode-vMK

**Current**: 9.2/10
**Last updated**: 2026-07-03
**Trend**: improving

> Score reconcialiated from inherited 9.8 (gentleman-agent template, not representative).
> Baseline established 2026-06-26 after VMK optimization audit.
> Cycle4: Score Depth 8.5, Backlog Integrity 8.5, Dead Code 8.5 — Score 9.0 hit.
> Cycle5: Boot chain audit, B1 useThread init test, @opentui/core pin revert. Cycle Activity 8.5.
> Cycle7: MCP budget docs/audit, patch rationales, benchmark -72.7% → 9.0 sostenido.
> Cycle8: Effect β.83 upgrade, WASM graceful deg, backlog grooming → 9.1.
> Cycle9: 3 architecture docs (1.5K total lines), CI workflows, skill audit → 9.2.
> Cycle10: Upstream cherry-pick (5 applied, 2 reverted), 616ms cold boot → 9.2 sostenido.

## Dimensions

| Dimension | Score | Rationale | Δ |
|-----------|-------|-----------|---|
| Cycle Activity | 9.5 | Cycles 7-10 completados — docs, CI, upstream sync, effect upgrade | +2.5 |
| Project Artifacts | 9.5 | All architecture docs: LSP, config, plugin. Doc coverage: 5/5 áreas críticas | +1.5 |
| Dead Code | 8.5 | Knip audit limpio, sin nuevos unused files añadidos | — |
| Clean Code | 9.0 | Well-structured TS. vMK tags still pending on ~22 AMARILLO files | — |
| Metrics | 9.0 | Benchs estable (616ms, 126.8MB), smoke tests 7/7, audit skills 69 ok | +1.0 |
| Backlog Integrity | 9.5 | BACKLOG.md actualizado con ciclos 7-10. DoR 77.3% verificado | +1.5 |
| Bitacora | 10.0 | Comprehensive session history | — |
| Security | 10.0 | Gitleaks CI workflow añadido, .gitleaksignore revisado | — |
| Score Depth | 9.0 | Scoring guide actualizado post cycles 7-10 | +0.5 |
| Best Practices | 9.5 | Cross-compile CI, cleanup scripts, LSP lifecycle doc, config pipeline doc | +1.0 |
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

## Cycles 7-10 — Score 9.2 (Docs, CI, Upstream Sync)

| Cycle | Focus | Score Impact | Key Deliverables |
|-------|-------|-------------|------------------|
| 7 | Token Budget & Patches | 9.0 sostenido | MCP docs/audit, 9 patch rationales, benchmark -72.7% |
| 8 | Effect Upgrade & Backlog | 9.1 | Effect β.74→β.83 (21 files), WASM graceful deg, DoR 77.3% |
| 9 | Architecture Docs & CI | 9.2 | LSP (506 lns), Config (604 lns), Plugin (369 lns), 2 CI workflows, skill audit |
| 10 | Upstream Cherry-pick | 9.2 | 5 aplicados, 2 revertidos, 616ms cold boot |

### Cycle 9 — What pushed score from 9.1→9.2
- **Cycle Activity** 8.5→9.5: 4 cycles completed in 3 days across docs/CI/upstream
- **Metrics** 8.5→9.0: Skills audit (69 clean), smoke tests 7/7, stable benchmarks
- **Best Practices** 9.0→9.5: CI workflows (cross-compile, gitleaks), LSP lifecycle practices documented
- **Project Artifacts** 8.5→9.5: 3 architecture docs (1,479 total lines), 5/5 critical areas covered
- **Backlog Integrity** 8.5→9.5: Cycles 7-10 tracked, DoR formalized

### Cycle 10 — Score held at 9.2
- Upstream sync successful but no new dimension score increases
- Ceiling: low-hanging fruit exhausted. Next jumps require:
  - Fixing remaining `any` types (aisdk.ts, versioning.ts)
  - AI SDK 4.x upgrade (@ai-sdk/xai, @ai-sdk/google)
  - Upstream repo structural changes (buildLayer API, observability module)
  - AMARILLO vMK tag coverage on all ~22 files
  - TUI test automation (requires OpenTUI segfault fix upstream)

## Cycle4 — Score 9.0 Hit (I/R Prioritization)

- **IR1**: Scoring Guide — reconcilia inter-track (agente, 9.8) vs .project.json (proyecto, 9.0). Score Depth 7.5→8.5
- **IR3**: BACKLOG.md — tracking formal con estado, prioridad y vínculos. Backlog Integrity 7.0→8.5
- **IR4**: Dead Code audit — Knip 6.17.1, 236 unused files (mayoría console/enterprise/stats fuera de scope vMK). Dead Code 8.0→8.5
- **IR5**: Cross-compile wrapper — `scripts/vmk-cross-compile.ps1` (build.ts ya soporta nativo)
- **IR2** (pendiente): B1 useThread test en binario compilado — requiere test TUI manual

## Post-Audit — Cycle2 Build Fix

- **B3**: Lazy CLI commands worked in dev mode but broke Bun compile. Fix: static
  registry (`_registry.ts`) con 23 imports + `lazy()` fallback (`??`). Smoke test PASS.
- **Cycle2 completado**: build fix, vmk.cmd cleanup, cycle report, 2 commits.

The 32 `packages/core/src/plugin/provider/*.ts` files remain as-is — thin wrappers,
not worth converting. Next ceiling: low-hanging fruit exhausted at 9.0.

## Instructions

- Score SHOULD be updated after each VMK optimization is applied
- Trend changes to "up" when score increases 0.3+
- Dimensions are scoped to opencode-vMK fork concerns only
