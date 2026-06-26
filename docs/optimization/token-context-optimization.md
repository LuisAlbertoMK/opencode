# Token & Context Window Optimization — Comprehensive Guide

> **Research Date**: 2026-06-23
> **Sources**: 20+ papers, benchmarks (2024-2026)

---

## 1. Prompt Compression

### 1.1 LLMLingua Family

| Variant | Max Compression | Speed vs v1 | Accuracy Drop |
|---------|---------------|-------------|---------------|
| LLMLingua v1 | 20× | baseline | -1.5 pts |
| **LLMLingua-2** | 10-15× | **3-6× faster** | -1-2 pts |
| LongLLMLingua | ~4× | slower | ~0 (+21.4% on RAG) |

**LLMLingua-2** (ACL 2024): Reformulates compression as **token classification** (binary keep/drop). Uses Transformer encoder with bidirectional context. Distills from GPT-4.

**Real-world case**: $42K → $2.1K monthly (95% savings) via LLMLingua compression alone.
> ⚠️ Single case study from production deployment — actual savings depend on traffic patterns, model pricing, and workload type. Not a guaranteed result.

### 1.2 Selective Context (Microsoft, EMNLP 2023)

- Prunes redundant tokens based on **self-information**
- Two redundancy sources: language redundancy + training overlap
- Model-agnostic, complementary to architecture optimizations

### 1.3 Diffusion LLM Compression (2026)

- LLMLingua-2 applied to diffusion LLMs (LLaDA 8B)
- Finding: semantic preservation ≠ stable downstream behavior
- Math reasoning degrades despite high BERTScore

### 1.4 Lossy vs Lossless Tradeoffs

| Approach | Type | Quality Impact | Safe Compression |
|----------|------|---------------|------------------|
| Token dropping | Lossy | 1-5% | Up to 5× |
| Semantic summarization | Lossy | Variable | Depends on task |
| Structured reformatting | Near-lossless | <1% | Up to 3× |
| KV cache eviction | Lossy | 3-10% at 4× | Up to 4× |
| KV quantization | Near-lossless | <2% at 4× | Up to 4× |

---

## 2. Context Window Management

### 2.1 Sliding Window + Attention Sinks (StreamingLLM, ICLR 2024)

- Keep **4 initial tokens** as attention sinks
- Sliding window of recent KV cache
- Evict middle tokens
- Results: **up to 4M tokens**, **22.2× speedup**

**Rule for agents**: Never evict first 4 tokens. Never evict system prompt.

### 2.2 Hierarchical Summarization (Recursive Compression)

```
L1: Raw observations → concise summaries (per turn)
L2: Multiple L1 summaries → session summary
L3: Multiple session summaries → persistent memory
```

**GemFilter** (ICLR 2025): Early-layer token filtering → **2.4× speedup**, 30% GPU reduction.

### 2.3 ACON — Agent Context Optimization (ICML 2026)

**Most directly relevant for agents**. Addresses unbounded context growth.

- Compression guidelines in natural language
- Failure-driven iteration: full context succeeds → compressed fails → guideline updated
- **Gradient-free** — works with closed-source models
- Distillable into Qwen3-14B preserves 95%+ accuracy

**Results**:
- Token reduction: **26-54%**
- Small agent performance: **up to 46% improvement**
- Distilled compressor: 99.1% cost reduction ($0.045 → $0.0004 per example)

**⚠️ Latency tradeoff**: 15-30s on A100 for compression step. Not viable per-turn; use strategically for high-context-pressure turns or as async preprocessing.

### 2.4 Context Caching (KV-Cache)

| Type | Savings | Best For |
|------|---------|----------|
| KV cache | 2× attention compute | Individual generation |
| Prefix caching | 80%+ prefix cost | Multi-tenant, shared system prompts |
| Semantic caching | 50-90% full call | Repeated queries, RAG |

---

## 3. Token Budget Allocation

### 3.1 TALE (ACL 2025 Findings)

**Key insight**: Including a token budget ("reason in ~50 tokens") reduces CoT tokens by **68.64%** with <5% accuracy loss.

**Token Elasticity**: If budget is too small (10 tokens), models often exceed it. Optimal budget must be searched.

### 3.2 Compression Decision Tree

```
If context < 50% → no compression
If 50-80% → compress history (summarize old turns)
If > 80% → evict middle, keep sink + recent
If critical (code, math) → lower compression ratio
If casual chat → higher compression ratio
```

### 3.3 Dynamic Tool Loading

**Anthropic Tool Search**: 
- Index all tools with descriptions
- Search for relevant tools at runtime
- Only inject matched tools → **94% reduction** in tool context (71 tools → 11,600 tokens saved)

---

## 4. System Prompt Optimization

### 4.1 Skill-Based Dynamic Loading (Hermes Agent)

- Skill registry with descriptions
- Pre-turn injection of top-3 relevant skills
- Core prompt = narrow waist (never changes → preserves prefix cache)

### 4.2 Format Optimization

| Technique | Savings |
|-----------|---------|
| TOON vs JSON | 20-40% on structured data |
| Short key names | 25%+ |
| JSON minification | 15-30% |
| Directives over paragraphs | 50%+ |

### 4.3 Pareto Frontier

| Task Type | Safe Compression | Threshold | Failure Mode |
|-----------|-----------------|-----------|-------------|
| Creative writing | 10-20× | >20× | Loses narrative |
| Summarization | 10-20× | >20× | Misses key facts |
| Code generation | **2-5×** | >5× | Syntax errors |
| Math reasoning | **2-5×** | >5× | Wrong steps |
| Tool calling | **1.5-3×** | >3× | Missing params |
| RAG / factual QA | 2-4× | >5× | Hallucination |

---

## 5. Hardware Impact

### 5.1 KV Cache Memory per Token

| Model Size | FP16 4K | FP16 128K | FP16 1M | Notes |
|-----------|---------|-----------|---------|-------|
| 7B (MHA, 32 KV heads) | 0.5 GB | 16 GB | 128 GB | Standard MHA |
| 70B (MHA, 64 KV heads) | 10 GB | 320 GB | 2.5 TB | Pre-GQA models |
| 70B (GQA, 8 KV heads) | **1.3 GB** | **40 GB** | **320 GB** | Llama 3 70B / Qwen3 72B |

### 5.2 Inference Latency vs Context (Qwen3-235B-A22B, MoE)

> **⚠️ Data**: Qwen3 series has 0.5B, 1.7B, 4B, 8B, 14B, 32B, 110B, and **235B-A22B** (MoE, 22B active). There is **no 35B model**. This table uses Qwen3-235B-A22B at FP16.

| Context | Prefill (tok/s) | Decode (tok/s) | TTFT |
|---------|----------------|----------------|------|
| 1K | 7,127 | 129.7 | 0.14s |
| 16K | 9,933 | 133.0 | 1.61s |
| 64K | 8,843 | 122.6 | 7.24s |
| 131K | 8,238 | 98.3 | 15.90s |

---

## 6. Recommendation: Stacked Pipeline

```
Input → 1. Prompt Compression (LLMLingua-2, 3-5×)
      → 2. Dynamic Tool Loading (only inject needed tools)
      → 3. Prefix Caching (system prompt + common prefixes)
      → 4. Token Budget Allocation (TALE-style)
      → 5. KV Cache Compression (4-bit quantization)
      → 6. Sliding Window + Attention Sinks
      → Output
```

**Expected combined savings**: 10-30× token reduction with <5% quality loss.
