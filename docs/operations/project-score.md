# Project Score: opencode-vmk

**Current**: 8.5/10
**Last updated**: 2026-06-26
**Trend**: improving

> Score reconcialiated from inherited 9.8 (gentleman-agent template, not representative).
> Baseline established 2026-06-26 after VMK optimization audit.
> Updated 2026-06-26 after full VMK-MANIFEST audit: all 16 items evaluated.

## Dimensions

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Cycle Activity | 7.0 | 4/12 VMK optimizations implemented (A1-A4), 1 partial (B1), 7 pending |
| Project Artifacts | 8.0 | BITACORA, optimization plans, measurement guide exist. No baseline snapshot saved |
| Dead Code | 8.0 | Knip + unbarrelify partially done. @hono/zod-validator removed. B3 lazy imports reduce eager code — 23 modules deferred. C2 main gap closed |
| Clean Code | 9.0 | Well-structured TypeScript. A3 batch() + B3 lazy() applied. ~22 AMARILLO files still missing `// vMK:` tags |
| Metrics | 8.0 | Tests run (30/30 passing in footer suite), CI pipeline via turbo. No perf baseline yet |
| Backlog Integrity | 6.0 | VMK-MANIFEST items documented but no formal tracking board |
| Bitacora | 10.0 | Comprehensive session history |
| Security | 10.0 | No identified issues in vMK scope |
| Score Depth | 7.0 | Previous score (9.8) inherited without calibration. First honest baseline + caught inflation early |
| Best Practices | 8.5 | Solid TS practices. B3: lazy loading of CLI commands implemented. Tree-shaking via C2 still pending |
| Orthography | 10.0 | Documentation is clean |

## VMK-MANIFEST Progress

| Item | Status | Weight |
|------|--------|--------|
| A1: drop console/debugger | ✅ Done | 100% |
| A2: Heap thresholds 512/768MB | ✅ Done | 100% |
| A3: batch() multi-signal footer | ✅ Done | 100% |
| A4: smol=true | ✅ Done | 100% |
| B1: useThread=true (OpenTUI Zig) | ⚠️ Partial | 50% |
| B2: Project References TS | ❌ Skip | tsgo typechecker, no tsc — no benefit |
| B3: Lazy CLI commands (23 static→dynamic imports) | ✅ Done | 100% |
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
## Pending (requires approval)

| Item | Description | File | Effort | Impact |
|------|-------------|------|--------|--------|
| **Core plugins → lazy** | Convert 32 static imports in `packages/core/src/plugin/provider.ts` to dynamic `import()` | `packages/core/src/plugin/provider.ts` + 32 files under `packages/core/src/plugin/provider/*.ts` | Medium-High | Medium — deferred module eval on first command |

This is 🟡 AMARILLO zone (`packages/*/src/**`), requires `// vMK:` tags.
Need: verify build, user approval, then implement + verify.

## Instructions

- Score SHOULD be updated after each VMK optimization is applied
- Trend changes to "up" when score increases 0.3+
- Dimensions are scoped to opencode-vmk fork concerns only
