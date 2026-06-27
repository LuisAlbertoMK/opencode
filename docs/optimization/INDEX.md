# opencode-vMK — Optimization Research Index

> **Context**: Resource optimization plan for opencode-vMK (TypeScript/Bun monorepo, current score ~7.3/10)
> **Goal**: 8.5–9.0/10 via dependency reduction, config fixes, Bun tuning, and prompt optimization

---

## Core Plan
| File | What |
|------|------|
| [**optimization-plan.md**](./optimization-plan.md) | 9 priorities, detailed actions, risk assessment, 4-phase execution plan, score deltas |

## General Research Docs
| File | Covers | Applies to opencode as |
|------|--------|------------------------|
| [**25-approaches-comparison.md**](./25-approaches-comparison.md) | 25+ subagent/multi-agent architectures | Architecture reference |
| [**ram-cpu-gpu-optimization.md**](./ram-cpu-gpu-optimization.md) | RAM, CPU, GPU/vRAM, Bun/Node tuning | §1.1 (Bun jemalloc), §1.3 (buffer pooling), §2 (CPU), §4.3 (dep bloat) |
| [**token-context-optimization.md**](./token-context-optimization.md) | Token compression, context management, TALE | §3.1 (TALE budgets), §3.3 (dynamic tool loading), §4.2 (format opt) |

## Verification Docs
| File | Relevance to opencode |
|------|-----------------------|
| [**verification-r1-consistency.md**](./verification-r1-consistency.md) | Priority matrix for opencode (P1-P6) |
| [**verification-r1-sources.md**](./verification-r1-sources.md) | Source confidence for claims used in plan |
| [**verification-r1-gaps.md**](./verification-r1-gaps.md) | Missing opencode topics (Bun tuning, Effect-TS, Turbo cache, patches) |

---

## Execution Status

`Phase 1 ░░░░░░░░░░  0%  — waiting for approval`
