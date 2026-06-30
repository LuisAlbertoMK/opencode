# Optimization Research — Master Index

> **Context**: Multi-project resource optimization for gentleman-agent-gh (PowerShell, 9.9/10) and opencode-vMK (TypeScript/Bun, ~7.3/10)
> **Focus**: Toaster-grade hardware, token reduction, code quality, error reduction, TUI/workflow

---

## Research Documents

### 1. Subagent / Multi-Agent Architectures
[**`25-approaches-comparison.md`**](./25-approaches-comparison.md)
- 13 orchestration patterns (OpenAI Swarm, LangGraph, CrewAI, AutoGen, MetaGPT, BabyAGI, Plan-and-Execute, Hierarchical, MoA, Router, Delegation, Pipe/Filter, Event-Driven)
- 4 memory patterns (Blackboard, Tuple Space, Engram, Hermes/Skill-Forge)
- 4 communication patterns (MCP, A2A, Latent, ACON)
- 4 quality patterns (Reflection, Debate, AgentSlimming, Ensemble)
- 4 ultra-lightweight frameworks (LightAgent, SmolClaw, PicoAgents, Tiny Agents)
- Comparison matrix (RAM/CPU/Tokens/Quality/Complexity)
- ✅ **Winner**: Delegation (subagent-first) — lowest overhead

### 2. RAM / CPU / GPU / vRAM Optimization
[**`ram-cpu-gpu-optimization.md`**](./ram-cpu-gpu-optimization.md)
- V8/JSC GC tuning (Node flags, Bun jemalloc)
- WeakRef, Buffer pooling, Streaming
- PowerShell RAM rules (Get-Content, StreamReader, +=, -join)
- CPU: Memoization, Worker threads, Batching, Algorithm selection
- GPU: Quantization formats (FP16→INT2), KV cache, Speculative decoding
- vRAM budget for 24GB GPU, CPU+GPU hybrid rules
- Cross-cutting: Profiling, Lazy loading, Dep bloat control
- ✅ **Correction applied**: VRAM formula ×1.2 flat → context-dependent

### 3. Token & Context Window Optimization
[**`token-context-optimization.md`**](./token-context-optimization.md)
- Prompt compression (LLMLingua family, Selective Context, Diffusion LLM)
- Lossy vs lossless tradeoff table
- Context window management (StreamingLLM, Hierarchical Summarization, ACON, KV-Cache)
- Token budget allocation (TALE 68.64% reduction with <5% loss)
- Compression decision tree (50/50/80% thresholds)
- Dynamic tool loading (94% context reduction)
- System prompt optimization (Skill-based loading, TOON format)
- Pareto frontier per task type (code 2-5×, chat 10-20×)
- Hardware impact: KV cache memory + inference latency tables
- ✅ **Recommended**: Stacked pipeline (6 stages, 10-30× combined)
- ✅ **Corrections applied**: Qwen model (didn't exist → corrected), KV cache GQA, ACON latency

### 4. Verification Round 1 — Consistency Audit
[**`verification-r1-consistency.md`**](./verification-r1-consistency.md)
- 8 critical issues found in research docs
- Priority matrix per project (gentleman-agent-gh: P1 TALE, P2 compression tree; opencode: P1 dep bloat, P2 lazy loading, P3 Bun-native)

### 5. Verification Round 1 — Source Cross-Reference
[**`verification-r1-sources.md`**](./verification-r1-sources.md)
- 14 claims verified against web sources: 8✅ 3🔶 3❌
- 3 unverified: LangGraph overhead (actual higher), CrewAI overhead (actual higher), Get-Content speed (actual lower)
- 2 partially verified: AutoGen overhead, LightAgent deps

### 6. Verification Round 1 — Gap Analysis
[**`verification-r1-gaps.md`**](./verification-r1-gaps.md)
- 10 missing topics (PowerShell patterns, Bun tuning, Effect-TS perf, cross-project sync, etc.)
- 4 interaction blind spots (sync propagation, score alignment, junction conflicts, engram namespace)
- 4 implementation gaps (no profiling baselines, no migration path, no ops order, no success metrics)
- Top 10 new documents needed

### 7. Final Synthesis — Consolidated Plan
[**`ronda3-synthesis.md`**](./ronda3-synthesis.md)
- gentleman-agent-gh: 4 priorities (TALE, compression tree, PS RAM scan, hierarchical sum)
- opencode-vMK: 7 priorities (dep bloat, test fix, lazy loading, Bun-native, memoization, TALE, Effect-TS)
- Cross-project: 3 concerns (engram namespace, junction sync, score alignment)
- 7 new documents needed (priority-ordered)
- All 8 factual corrections cross-referenced with sources
- Resource budgets per project (current vs target)
- **3-phase execution plan** (waiting for approval)

---

## Quick Reference by Topic

| Topic | Primary Doc | Also In |
|-------|-------------|---------|
| Subagent patterns | `25-approaches-comparison.md` | `ronda3-synthesis.md §4` |
| RAM optimization | `ram-cpu-gpu-optimization.md §1` | `ronda3-synthesis.md §5` |
| CPU optimization | `ram-cpu-gpu-optimization.md §2` | — |
| GPU/vRAM | `ram-cpu-gpu-optimization.md §3` | `token-context-optimization.md §5` |
| Token compression | `token-context-optimization.md §1-2` | `ronda3-synthesis.md §4` |
| Context window | `token-context-optimization.md §2-3` | `ronda3-synthesis.md §1(P2)` |
| TALE budgets | `token-context-optimization.md §3.1` | `ronda3-synthesis.md §1(P1),§2(P6)` |
| Code quality / testing | `ronda3-synthesis.md §2(P2)` | `verification-r1-gaps.md` |
| TUI / workflow | `verification-r1-gaps.md` (gap only) | — |
| Self-improvement cycles | `verification-r1-gaps.md` (gap only) | — |
| Cross-project sync | `verification-r1-gaps.md` | `ronda3-synthesis.md §3` |
| Verification methodology | `verification-r1-*.md` (3 docs) | `ronda3-synthesis.md §4` |
| Corrections applied | `ronda3-synthesis.md §4` | (inline in each corrected doc) |

---

## Execution Phases

```
 Phase 1 (immediate, low risk)
   ├── TALE token budgets (both projects)
   ├── Fix test config (opencode — blocks CI)
   ├── Compression decision tree doc (gentleman)
   └── Reconcile opencode score (7.3 vs 6.8)

 Phase 2 (design, requires profiling)
   ├── Profiling baseline (both projects)
   ├── Dep bloat analysis (opencode)
   ├── PS RAM/CPU scan (gentleman)
   └── Implementation roadmap

 Phase 3 (execution)
   ├── Apply optimizations per priority matrix
   ├── Cross-project sync strategy
   └── Recovery protocol
```

**Status**: ⏸️ Blocked — waiting for user approval to begin Phase 1.
