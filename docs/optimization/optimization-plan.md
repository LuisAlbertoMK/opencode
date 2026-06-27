# opencode-vMK — Optimization Plan

> **Current score**: 7.3/10 (`.project.json`), 6.8/10 (`PROJECT-SCORE.md`) — must reconcile
> **Target**: 8.5–9.0/10
> **Assumption**: Toaster-grade hardware, Bun runtime, TypeScript monorepo (Turborepo)

---

## Priority Matrix

| # | Action | Impact | Effort | Risk | Est. Δ Score |
|---|--------|--------|--------|------|:------------:|
| **P1** | **Fix test configuration** | High | Low | Low | +1.5 |
| **P2** | **Dependency bloat control** — Knip, tree-shaking, barrel elimination | High | Low | Medium | +1.0 |
| **P3** | **Bun-native optimizations** — `bunfig.toml`, `--smol`, JSC flags | High | Medium | Medium | +0.5 |
| **P4** | **Lazy loading / code splitting** — dynamic imports for heavy modules | High | Medium | Low | +0.5 |
| **P5** | **Memoization on hot paths** — agent routing, skill resolution | Medium | Low | Low | +0.3 |
| **P6** | **Effect-TS v4 perf audit** — fiber allocation, GC interaction | Medium | High | Low | +0.3 |
| **P7** | **TALE token budgets** in agent prompts | Medium | Low | None | +0.2 |
| **P8** | **Strict TypeScript** — enable strict flags, fix violations | Medium | Medium | Medium | +0.3 |
| **P9** | **Format optimization** — TOON, short keys | Low | Low | None | +0.1 |

---

## Detailed Breakdown

### P1 — Test Configuration (critical path)
**What**: Tests are not passing — blocks CI/CD and any refactoring
**Actions**:
- Debug test runner config (vitest vs bun:test compatibility)
- Fix failing test cases
- Add CI gate: `bun test` must pass before merge
**Risk**: Low — test config only, no production code changes

### P2 — Dependency Bloat
**What**: 95+ runtime deps, 25 packages, 9 patched dependencies
**Actions**:
- Run Knip → detect dead exports → remove them
- Set `sideEffects: false` in package.json for tree-shaking
- Barrel file elimination with `unbarrelify`
- Establish dep budget: new dep requires +KB justification
**Risk**: Medium — removing deps can break builds if exports are used dynamically

### P3 — Bun-Native Optimizations
**What**: Bun is underconfigured for the workload
**Actions**:
- `bunfig.toml`: jemalloc tuning, GC thresholds
- JSC flags: `--jsc-force-collect-cycles`, heap limits
- Use Bun fast paths: `Bun.file()` → `fs.readFile()`, `Bun.write()` → `fs.writeFile()`
- Enable `--smol` for low-memory mode
**Risk**: Medium — some Bun flags are experimental

### P4 — Lazy Loading / Code Splitting
**What**: Heavy modules loaded at startup instead of on-demand
**Actions**:
- Dynamic imports for langchain/Effect-TS heavy components
- Worker threads for CPU-heavy tasks
- Bundle analysis first: `bundlelens` or `vite-bundle-analyzer`
**Risk**: Low — dynamic imports are standard practice

### P5 — Memoization
**What**: Hot-path functions called repeatedly (agent routing, tool dispatch)
**Actions**:
- `p-memoize` or `moize` with TTL for caching
- Target: functions called 10+ times per turn
**Risk**: Low

### P6 — Effect-TS v4 Perf
**What**: Fiber allocation overhead may affect hot loops
**Actions**:
- Profile fiber creation rate
- Review GC interaction with Effect's runtime
- Consider bun-native alternatives for perf-critical sections
**Risk**: Low — audit only, changes are opt-in

### P7 — TALE Token Budgets
**What**: OpenCode agent prompts lack token budgets
**Actions**:
- Add `"reason in ~N tokens"` budgets to skill loading prompts
- Same approach as gentleman-agent-gh (cross-project consistency)
**Risk**: None

### P8 — Strict TypeScript
**What**: `strict: true` likely disabled or has violations
**Actions**:
- Enable `strict: true` in tsconfig
- Fix `noImplicitAny`, `strictNullChecks` violations
- Add as CI gate
**Risk**: Medium — can surface many latent issues, needs incremental rollout

### P9 — Format Optimization
**What**: Verbose formats waste tokens (JSON, long keys)
**Actions**:
- TOON format for structured data (20-40% savings)
- Short key names (25%+ savings)
**Risk**: None

---

## Cross-Project Concerns (gentleman-agent-gh ↔ opencode-vMK)

| Concern | Impact | Action |
|---------|--------|--------|
| Engram SQLite namespace | Observation pollution risk | Prefix keys per project or separate DBs |
| Junction skill sync | Concurrent edit conflicts | Lock/wait strategy or merge protocol |
| Score alignment | 9.9 vs 7.3 gap widening | Cross-project CI to prevent drift |

---

## Execution Phases

```
Phase 1 (immediate — no profiling needed)
├── P1: Fix test config                              [~2h]
├── P7: TALE token budgets                           [~1h]
└── Reconcile score (7.3 vs 6.8)                     [~30m]

Phase 2 (design — requires baseline)
├── P2: Dep bloat analysis + Knip                    [~4h]
├── Profiling baseline (bundle + CPU + RAM)           [~2h]
└── P9: Format optimization                           [~1h]

Phase 3 (execution)
├── P3: Bun-native optimizations                      [~3h]
├── P4: Lazy loading / code splitting                 [~4h]
├── P5: Memoization                                   [~2h]
├── P6: Effect-TS audit                               [~3h]
└── P8: Strict TS (incremental)                       [~4h]

Phase 4 (hardening)
├── Cross-project sync strategy                       [~2h]
├── Recovery protocol                                 [~1h]
└── Score recalibration + trend                        [~30m]
```

**Total**: ~25-30h engineering time
**Target**: 8.5–9.0/10

---

## Quick Reference

| Topic | Document |
|-------|----------|
| 25+ subagent patterns | `25-approaches-comparison.md` |
| RAM / CPU / GPU / vRAM | `ram-cpu-gpu-optimization.md` |
| Token & context optimization | `token-context-optimization.md` |
| Verification — consistency | `verification-r1-consistency.md` |
| Verification — sources | `verification-r1-sources.md` |
| Verification — gaps | `verification-r1-gaps.md` |

> **Status**: ⏸️ Waiting for user approval to begin Phase 1 execution.
