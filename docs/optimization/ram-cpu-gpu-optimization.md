# RAM, CPU & GPU Optimization — Comprehensive Guide

> **Research Date**: 2026-06-23
> **Sources**: 15+ papers, benchmarks, production reports (2024-2026)

---

## 1. RAM Optimization

### 1.1 V8/JavaScriptCore GC Tuning

| Engine | Flag | Effect |
|--------|------|--------|
| **Node/V8** | `--max-old-space-size=<MB>` | Set heap ceiling (75% of RAM) |
| **Node/V8** | `--optimize-for-size` | Favor memory over speed |
| **Node/V8** | `--max-semi-space-size=<MB>` | Young gen size → GC frequency |
| **Bun/JSC** | Native jemalloc | ~50% lower baseline than Node v22 |

**Bun vs Node RAM** (Zoer.ai 2025):
- Bun: ~50% lower baseline for simple apps
- **But**: some workloads show 40% MORE RAM on Bun (analytics services)
- **Rule**: Always measure your specific pattern

### 1.2 WeakRef & FinalizationRegistry

```js
const cache = new Map();
const ref = new WeakRef(largeObject);
cache.set(key, ref);
// later:
const obj = cache.get(key)?.deref();
if (!obj) { /* recompute */ }
```

- **Use for**: Best-effort caches, leak detection
- **Don't use for**: Correctness-critical data

### 1.3 Buffer Pooling (Node/Bun)

- Internal slab allocator for <8KB buffers
- Pool large buffers: allocate once, reuse via circular buffer
- `Buffer.alloc()` for security (zero-filled)
- `Buffer.allocUnsafe()` only if you overwrite immediately

### 1.4 Streaming > Loading

```js
// BAD: loads entire file
const data = fs.readFileSync('large.log');

// GOOD: streams one chunk at a time
fs.createReadStream('large.log').pipe(transform);
```

### 1.5 PowerShell RAM Optimization

| Method | Speed | Memory |
|--------|-------|--------|
| `.NET StreamReader.ReadLine()` | Fastest | **Lowest** |
| `Get-Content` (piped, no variable) | Medium | Low |
| `Get-Content -ReadCount 512` | Faster | Medium |
| `Get-Content` assigned to variable | Fast | **Highest** |

**Critical rules**:
- Never assign `Get-Content` to variable for large files
- Use `[System.IO.StreamReader]::OpenText()` for large files
- Avoid `+=` on arrays — use `[List[T]]` or pipeline
- Use `-join` not `+=` for string concatenation (85ms vs 67,640ms)
- `$null = cmd` is fastest for suppressing output
- Clear large vars: `$var = $null`

### 1.6 Object Pooling (Hot Paths)

```js
const pool = [];
const POOL_SIZE = 100;
function acquire() { return pool.pop() || { /* fresh */ }; }
function release(obj) { if (pool.length < POOL_SIZE) pool.push(obj); }
```

**When**: Only for objects allocated 10K+ times/second on hot paths.

---

## 2. CPU Optimization

### 2.1 Memoization

```js
const memoize = (fn, resolver = JSON.stringify) => {
  const cache = new Map();
  return (...args) => {
    const key = resolver(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};
```

**Production**: `p-memoize` (TTL, maxAge), `moize` (LRU, deep equality)

### 2.2 Worker Threads (CPU offload)

| Method | Memory | Best For |
|--------|--------|----------|
| Worker Threads | Lower (shared) | CPU tasks in background |
| Cluster API | Higher (separate) | Full CPU utilization |
| Child Process | Medium (fork) | Heavy isolation |

### 2.3 Batching & Debouncing

```js
let queue = [];
setInterval(() => {
  if (queue.length) { db.batchInsert(queue); queue = []; }
}, 100);
```

### 2.4 Algorithm Selection

| Complexity | Impact at 1M items |
|-----------|-------------------|
| O(n²) → O(n log n) | **1000x faster** |
| O(n) → O(1) | Constant-time lookups |

### 2.5 PowerShell CPU Optimization

- `.NET` methods are 2-10x faster than cmdlets
- `[IO.File]::ReadLines()` = **23x faster** than `Get-Content`
- `$filter = '*.log'` filters at OS level vs `Where-Object`
- Use `-File` / `-Directory` to scope `Get-ChildItem`

---

## 3. GPU / vRAM Optimization

### 3.1 Quantization Formats

| Format | Bits | vRAM 7B | vRAM 70B | Quality |
|--------|------|---------|----------|---------|
| FP16 | 16 | ~14 GB | ~140 GB | Full |
| INT8 | 8 | ~7 GB | ~70 GB | Near-lossless |
| INT4 (GGUF) | 4 | ~3.5 GB | ~35 GB | Good |
| INT4 (AWQ) | 4 | ~4 GB | ~40 GB | Very good |
| INT2 (AQLM) | 2 | ~1.75 GB | ~18 GB | Fair |

**Formula (weights only)**: `VRAM_weights = Params × (Bits/8)` — for the model itself.

**Total VRAM**: Weights + KV cache. KV cache is **context-dependent**, not a flat percentage.

```
KV_cache_per_token = layers × KV_heads × head_dim × 2 (K+V) × (bits/8)

At 4K context (7B MHA, FP16):  ~3.5% overhead over weights
At 128K context (7B MHA, FP16): ~114% overhead (doubles VRAM)
```

> **⚠️ Correction**: Do NOT use a flat 20% overhead. KV cache overhead is context-dependent: at 4K context it's ~3.5%, at 128K it's ~114%. Always compute for your specific model and context length.

### 3.2 KV Cache Optimization

- **KV cache** = biggest bottleneck at large context
- KV quantization (`-ctk q8_0`): halves vRAM at near-zero quality loss
- **PagedAttention** (vLLM): block allocation → 4x more concurrent requests
- **FlashAttention**: critical at 16K+ context, mandatory at 32K+

### 3.3 Speculative Decoding

| Mode | Tokens/sec (70B) | Best for |
|------|-----------------|----------|
| Standard | ~1,200 | High concurrency |
| Draft (1B) | ~2,600 | Interactive chat |
| EAGLE-3 | ~3,600 | Code, agents |

### 3.4 vRAM Budget (24GB GPU)

| Model | Quant | vRAM | Best for |
|-------|-------|------|----------|
| Qwen3 14B | Q4_K_M | ~8 GB | Best quality on 24GB |
| Llama 3 8B | Q4_K_M | ~5.5 GB | General use |
| Llama 3 70B | Q2_K | ~24 GB | Fits barely |

### 3.5 CPU + GPU Hybrid

- Use `-ngl N` to offload N layers to GPU
- **Performance cliff**: vRAM spill → 10-100x slower (50 GB/s sys RAM vs 900 GB/s vRAM)
- Rule: Fit entirely in vRAM or use CPU-only

---

## 4. Cross-Cutting

### 4.1 Profiling Tools

| Environment | Tool |
|-------------|------|
| Node.js | `node --prof`, clinic.js, Chrome DevTools |
| Bun | `Bun.nanoseconds()`, `--profile` |
| PowerShell | `Measure-Command`, `Compare-Performance` |

### 4.2 Lazy Loading / Code Splitting

- Dynamic imports: `import('./heavy.js')` — loads on demand
- Tree shaking: ensure `sideEffects: false` in package.json
- Barrel file elimination: `unbarrelify`, Knip

### 4.3 Dependency Bloat Control

- Prefer native modules (`node:crypto` over `bcrypt`)
- Tree-shakeable imports: `import map from 'lodash/map'`
- Bundle analysis: `bundlelens`, `vite-bundle-analyzer`

---

## Summary Decision Table

| Goal | #1 Action | Expected Gain | Effort |
|------|----------|--------------|--------|
| Reduce Node RAM | Use Bun OR tune `--max-old-space-size` | 30-50% | Low |
| Reduce PS RAM | Replace `Get-Content` with `StreamReader` | 10-50x | Low |
| Reduce Node CPU | Memoize expensive calls | 2-1000x | Low |
| Reduce LLM vRAM | Quantize to INT4 | 4x | Low |
| Reduce LLM latency | Flash Attention + Speculative Decoding | 2-4x | Medium |
| Reduce PS CPU | .NET methods over cmdlets | 2-10x | Medium |
| General | Profile first, then optimize | Varies | — |
