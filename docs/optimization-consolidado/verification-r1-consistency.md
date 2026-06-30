# Verification — Ronda 1: Technical Consistency Audit

> **Date**: 2026-06-23
> **Verifier**: Subagent (Technical Auditor)

## Critical Issues Found

1. **ACON latency omitted**: `approaches-comparison.md` lists `+15-30s latency on A100`. `token-context-optimization.md` presents ACON extensively but omits this latency entirely.

2. **LLMLingua cost savings**: `$42K → $2.1K monthly` claim presents a single case study as general expectation — misleading without traffic/mode context.

3. **AgentSlimming 78.9% vs ACON 26-54%**: Docs present as competing, but they measure different dimensions (agent count vs per-agent context). Are complementary.

4. **Qwen3.5-35B does not exist** — Qwen3 series has 0.5B, 1.7B, 4B, 8B, 14B, 32B, 110B, 235B. **No 35B model exists.** All inference data from that table is suspect.

5. **VRAM formula incorrect**: `Params × (Bits/8) × 1.2` — KV cache overhead is context-dependent. At 4K it's ~3.5%, at 128K it's ~114%. Not a flat 20%.

6. **KV Cache table for 70B ignores GQA**: Llama 3 70B uses 8 KV heads, not 64. Real KV cache at 4K ≈ 1.3 GB, not 10 GB = ~8x overstatement.

7. **LangGraph "9% overhead vs raw"**: No citation. Actual data shows 15-38% overhead depending on workload.

8. **CrewAI "15-31% overhead"**: Real range is 18-48%+. The lower end only applies to simplest tasks.

## Priority Order by Impact/Effort

### gentleman-agent-gh (score 9.9/10)
| Priority | Recommendation | Impact | Effort |
|----------|---------------|--------|--------|
| P1 | TALE token budgets (add budgets to prompts) | Medium | Low |
| P2 | Compression decision tree (50/50/80% rules) | Medium | Low |
| P3 | PS RAM/CPU pass (review Get-Content/+= patterns) | Low | Medium |
| P4 | Formalize hierarchical summarization L1/L2/L3 | Low | Medium |
| — | Everything else (GPU, MoA, frameworks) | None | — |

### opencode-vMK (score 7.3/10)
| Priority | Recommendation | Impact | Effort |
|----------|---------------|--------|--------|
| P1 | Dependency bloat control (Knip, tree-shaking, barrels) | High | Low |
| P2 | Lazy loading / code splitting | High | Medium |
| P3 | Bun-native optimizations (Bun fast paths) | High | Medium |
| P4 | Memoization on hot paths | Medium | Low |
| P5 | Format optimization (TOON, short keys) | Medium | Low |
| P6 | TALE token budgets | Medium | Low |
