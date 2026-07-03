# Verification — Ronda 1: Web Source Cross-Reference

> **Date**: 2026-06-23
> **Verifier**: Subagent (Research Verifier)

## Results Summary

| # | Claim | Status | Confidence |
|---|-------|--------|------------|
| 1 | LangGraph 9% overhead | UNVERIFIED — actual 15-38% | Low |
| 2 | CrewAI 15-31% overhead | PARTIALLY — actual 18-48%+ | Medium |
| 3 | AutoGen 31% overhead | PARTIALLY — actual 8-28% latency, 20-50% cost | Medium |
| 4 | AgentSlimming 78.9% | ✅ VERIFIED — ACL 2026 paper | High |
| 5 | SmolClaw 280KB/672KB | ✅ VERIFIED — C11 binary | High |
| 6 | LightAgent 1000 lines | PARTIALLY — core OK but 13+ deps | Medium |
| 7 | Bun ~50% less RAM | ✅ VERIFIED — consistent 43-50% | High |
| 8 | Get-Content 23x faster | UNVERIFIED — actual 6-14x | Low |
| 9 | KV cache bottleneck | ✅ VERIFIED — universal consensus | High |
| 10 | Spec decode 2-4x | ✅ VERIFIED at batch size 1; 1.1-1.2x production | Medium |
| 11 | LLMLingua-2 10-15x | ✅ VERIFIED — 1-2pt drop confirmed | High |
| 12 | StreamingLLM 4M/22x | ✅ VERIFIED — ICLR 2024 | High |
| 13 | ACON 26-54% | ✅ VERIFIED — ICML 2026, Microsoft | High |
| 14 | TALE 68.64% | ✅ VERIFIED — arXiv 2412.18547 | High |

**Overall**: 8/14 fully verified, 3/14 partially verified, 3/14 unverified.
