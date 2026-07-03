# Ronda 3 — Synthesis: Consolidated Optimization Plan

> **Date**: 2026-06-23
> **Status**: Corrections applied from Rondas 1-2 (8 factual fixes across 3 docs)
> **Next step**: User approval required before any code changes

---

## 1. gentleman-agent-gh — Final Plan

**Current score**: 9.9/10 — marginal gains territory.

### Priority Matrix

| # | Action | Impact | Effort | Risk | Type |
|---|--------|--------|--------|------|------|
| P1 | **TALE token budgets** in skill/prompt definitions | Medium | Low | None | Prompt optimization |
| P2 | **Compression decision tree** (50/50/80% rules) | Medium | Low | None | Process formalization |
| P3 | **PS RAM/CPU review** — scan for `Get-Content`/`+=` patterns | Low | Medium | Low | Code cleanup |
| P4 | **Hierarchical summarization** L1/L2/L3 formalization | Low | Medium | None | Process |
| — | GPU, MoA, heavy frameworks | None | — | — | Not applicable |

### Detailed

**P1 — TALE budgets** (`trust boundaries, medium`):
- Add `"reason in ~N tokens"` budgets to agent skill loading prompts
- Sweet spot: ~50 tokens for reasoning, ~100 for planning, ~20 for classification
- Estimated savings: 68.64% CoT tokens with <5% accuracy loss (TALE, ACL 2025 Findings)

**P2 — Compression decision tree** (`low risk, process`):
- Formalize what the Ponytail Ladder already does: compress by threshold
- Document: <50% skip, 50-80% summarize history, >80% evict middle

**P3 — PS RAM/CPU scan** (`could introduce regressions`):
- Check scripts/ for `+=` on arrays (use `[List[T]]`), `Get-Content` to vars (use `StreamReader`)
- Priority: scripts invoked on every turn (skill loaders, context watchers)

**P4 — Hierarchical summarization** (`documentation only`):
- Currently ad-hoc via context-watchdog skill
- Formalize L1/L2/L3 with clear triggers and output format

---

## 2. opencode-vMK — Final Plan

**Current score**: 7.3/10 (`.project.json`) → must reconcile with 6.8/10 from `PROJECT-SCORE.md`

**First action**: Reconcile scoring discrepancy. Different dimension counts (6 vs 7) and different scores.

### Priority Matrix

| # | Action | Impact | Effort | Risk | Type |
|---|--------|--------|--------|------|------|
| P1 | **Dependency bloat control** | High | Low | Medium | Dependency |
| P2 | **Fix test configuration** | High | Low | Low | Config |
| P3 | **Lazy loading / code splitting** | High | Medium | Low | Architecture |
| P4 | **Bun-native optimizations** | High | Medium | Medium | Config |
| P5 | **Memoization on hot paths** | Medium | Low | Low | Code |
| P6 | **TALE token budgets** (prompts) | Medium | Low | None | Prompt |
| P7 | **Effect-TS v4 perf audit** | Medium | High | Low | Code |

### Detailed

**P1 — Dependency bloat** (`impact: high, risk: medium — could break builds`):
- 95+ runtime deps, 25 packages monorepo, 9 patched dependencies
- Run Knip → dead code elimination → tree-shaking (`sideEffects: false`)
- Barrel file elimination → `unbarrelify`
- **Rule**: Any new dep requires +KB budget justification

**P2 — Test config** (`quick win`):
- Tests are not passing — this blocks CI/CD pipeline
- Debug the test runner config (vitest vs bun:test)
- Without passing tests, all other changes are blind

**P3 — Lazy loading** (`architecture, needs design`):
- Dynamic imports for heavy modules (langchain, Effect-TS components)
- Worker threads for CPU-heavy tasks (file processing, crypto)
- Bundle analysis first: `bundlelens`

**P4 — Bun tuning** (`config changes`):
- `bunfig.toml`: jemalloc tuning, `--smol` mode
- JSC flags: `--jsc-force-collect-cycles`, GC tuning
- Bun fast paths: `Bun.file()` over `fs.readFile()`, `Bun.write()`

**P5 — Memoization** (`code, low risk`):
- Hot paths: agent routing, skill resolution, tool dispatch
- Use `p-memoize` or `moize` with TTL

**P6 — TALE** (`same as gentleman, shared approach`):
- Add token budgets to OpenCode agent prompts
- Cross-project consistency: same format, same budgets

**P7 — Effect-TS perf** (`needs expertise, risky`):
- Fiber allocation overhead in hot loops
- GC interaction with Effect's runtime
- Lower priority until performance baseline established

---

## 3. Cross-Project Concerns

### 3.1 Shared Infrastructure

| Component | Concern | Action |
|-----------|---------|--------|
| Engram SQLite | Shared namespace → observation pollution risk | Prefix keys per project, or separate DBs |
| Junction sync | Both projects sync same skills → conflict on concurrent edits | Lock/wait strategy or merge protocol |
| Score alignment | gentleman 9.9 vs opencode 7.3 — gap is widening | Cross-project CI to prevent drift |

### 3.2 New Documents Needed (from Gap Analysis)

| Priority | Document | Why |
|----------|----------|-----|
| P1 | `profiling-baseline.md` | Can't optimize what you don't measure |
| P2 | `implementation-roadmap.md` | Order of operations with dependencies |
| P3 | `cross-project-sync-strategy.md` | Both projects share engram + junctions |
| P4 | `powershell-agent-patterns.md` | PS-specific optimizations not in general docs |
| P5 | `bun-optimization-guide.md` | Bun-specific tuning reference |
| P6 | `optimization-recovery-protocol.md` | Rollback procedure for failed optimizations |
| P7 | `effect-ts-perf-patterns.md` | Effect-TS v4 performance patterns |

---

## 4. Verification Cross-Reference

### Claims Corrected (this round)

| Doc | Error | Fix | Source |
|-----|-------|-----|--------|
| token-context.md | Qwen3.5-35B | Qwen3-235B-A22B (MoE, 22B active) | Web source cross-ref |
| token-context.md | KV cache 70B: 10GB@4K | Added GQA row: 1.3GB@4K (Llama 3 70B) | Technical consistency audit |
| token-context.md | ACON latency omitted | Added 15-30s A100 warning | Gap analysis |
| token-context.md | LLMLingua $42K→$2.1K as fact | Updated to "case study, results vary" | Source verification |
| ram-cpu-gpu.md | VRAM formula ×1.2 flat | Context-dependent formula with examples | Tech audit + source |
| approaches.md | LangGraph 9% | 15-38% (actual measurements) | Source verification |
| approaches.md | CrewAI 15-31% | 18-48%+ (lower end only simplest) | Source verification |
| approaches.md | AutoGen 31% | 8-28% latency, 20-50% cost | Source verification |

### Remaining Unknowns (documented, accepted)

| Claim | Status | Why Accepted |
|-------|--------|-------------|
| ACON 26-54% reduction | ✅ Verified | ICML 2026 paper |
| TALE 68.64% reduction | ✅ Verified | arXiv 2412.18547 |
| AgentSlimming 78.9% | ✅ Verified | ACL 2026 paper |
| Bun 50% less RAM | ✅ Verified | Multiple independent sources |
| Get-Content 23× faster | ❌ Actual: 6-14× | Lowered to match measured range |
| SmolClaw 280KB/672KB | ✅ Verified | C11 binary confirmed |
| StreamingLLM 4M tokens | ✅ Verified | ICLR 2024 |

---

## 5. Resource Budget ("Toaster Grade")

### gentleman-agent-gh — Current
- **RAM**: ~50-200MB per session (PowerShell + OpenCode host)
- **CPU**: Burst on skill load, idle between turns
- **GPU/vRAM**: N/A (uses API, not local inference)
- **Disk**: ~5MB (skills + scripts)

### gentleman-agent-gh — Target
- **RAM**: <100MB steady state
- **CPU**: <500ms per turn (non-inference)
- **Target compression**: 10-30× token reduction via stacked pipeline

### opencode-vMK — Current
- **RAM**: ~150MB-1GB (Node/Bun + 95 deps)
- **CPU**: Wallet processing + build tooling
- **GPU/vRAM**: N/A (Agent API, not local)
- **Disk**: ~200MB (node_modules + build cache)

### opencode-vMK — Target
- **RAM**: <300MB steady state
- **CPU**: <500ms per turn
- **Deps**: Reduce 95 → <60 runtime deps
- **Build**: <10s cold, <2s warm

---

## 6. Recommendation

**Phase 1 (immediate, low risk)**:
1. Reconcile opencode score (`.project.json` vs `PROJECT-SCORE.md`)
2. TALE token budgets in both projects (1-2 hrs)
3. Fix opencode test config (critical — blocks CI)
4. Compression decision tree doc for gentleman

**Phase 2 (design phase, requires profiling)**:
5. Profiling baseline for both projects
6. Dep bloat analysis + tree-shaking for opencode
7. PS RAM/CPU scan for gentleman
8. Implementation roadmap document

**Phase 3 (execution)**:
9. Apply optimizations per priority matrix
10. Cross-project sync strategy
11. Recovery protocol for rollback safety

---

*Next: User approval → Phase 1 execution*
