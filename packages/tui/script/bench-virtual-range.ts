// Benchmark + equivalence harness for VirtualList range computation.
// Run: bun run script/bench-virtual-range.ts
// Ciclo 1 — experimento/mejora-autonoma-2026-09-03
import { buildHeightPrefix, computeVisibleRange, computeVisibleRangePrefixed, type VisibleRange } from "../src/component/virtual-range"

// ---------- Approach A: prefix-sum (Float64Array) + binary search ----------
// Rebuild O(n) once per heights change; per query O(log n), padding O(1).
function makeA(heights: Map<number, number>, count: number, est: number) {
  const cum = new Float64Array(count + 1)
  for (let i = 0; i < count; i++) cum[i + 1] = cum[i]! + (heights.get(i) ?? est)
  const lowerBound = (target: number, lo: number, hi: number): number => {
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (cum[mid]! >= target) hi = mid
      else lo = mid + 1
    }
    return lo
  }
  return (scrollTop: number, viewportHeight: number, overscan: number, countOverride?: number): VisibleRange => {
    const n = countOverride ?? count
    if (n === 0) return { offset: 0, count: 0, paddingTop: 0, paddingBottom: 0 }
    const st = Math.max(scrollTop, 0)
    const vh = Math.max(viewportHeight, 1)
    const start = lowerBound(st, 0, n)
    const end = lowerBound(st + vh, start, n)
    const paddedStart = Math.max(0, start - overscan)
    const paddedEnd = Math.min(n, end + overscan)
    return {
      offset: paddedStart,
      count: paddedEnd - paddedStart,
      paddingTop: cum[paddedStart]!,
      paddingBottom: cum[n]! - cum[paddedEnd]!,
    }
  }
}

// ---------- Approach B: persistent two-pointer (monotonic scroll locality) ----------
// Amortized O(1) for monotonic scroll, O(n) worst case on jumps; padding stays O(n).
function makeB(heights: Map<number, number>, count: number, est: number) {
  let lastStart = 0
  let lastAccum = 0 // cumsum up to lastStart
  return (scrollTop: number, viewportHeight: number, overscan: number, countOverride?: number): VisibleRange => {
    const n = countOverride ?? count
    if (n === 0) return { offset: 0, count: 0, paddingTop: 0, paddingBottom: 0 }
    const st = Math.max(scrollTop, 0)
    const vh = Math.max(viewportHeight, 1)
    const h = (i: number): number => heights.get(i) ?? est

    // Reset pointer if scrolled above it
    let start = lastStart
    let accum = lastAccum
    if (accum > st) {
      start = 0
      accum = 0
    }
    while (start < n && accum + h(start) <= st && accum < st) {
      accum += h(start)
      start++
    }
    if (accum < st && start < n) {
      // advance to first index whose cumulative height >= st
      while (start < n && accum < st) {
        accum += h(start)
        start++
      }
    }
    lastStart = start
    lastAccum = accum

    let end = n
    let a = accum
    for (let i = start; i < n; i++) {
      if (a >= st + vh) {
        end = i
        break
      }
      a += h(i)
    }
    const paddedStart = Math.max(0, start - overscan)
    const paddedEnd = Math.min(n, end + overscan)
    let paddingTop = 0
    for (let i = 0; i < paddedStart; i++) paddingTop += h(i)
    let paddingBottom = 0
    for (let i = paddedEnd; i < n; i++) paddingBottom += h(i)
    return { offset: paddedStart, count: paddedEnd - paddedStart, paddingTop, paddingBottom }
  }
}

// ---------- Approach C: chunked cumulative (K=32) ----------
// Rebuild O(n/K) per heights change; per query O(n/K + K).
const K = 32
function makeC(heights: Map<number, number>, count: number, est: number) {
  const chunks: number[] = [0]
  for (let i = 0; i < count; i++) {
    const c = (i / K) | 0
    if (chunks.length <= c + 1) chunks.push(0)
    chunks[c + 1] = chunks[c + 1]! + (heights.get(i) ?? est)
  }
  // chunks[j] = total height of items [0, j*K)
  return (scrollTop: number, viewportHeight: number, overscan: number, countOverride?: number): VisibleRange => {
    const n = countOverride ?? count
    if (n === 0) return { offset: 0, count: 0, paddingTop: 0, paddingBottom: 0 }
    const st = Math.max(scrollTop, 0)
    const vh = Math.max(viewportHeight, 1)
    const h = (i: number): number => heights.get(i) ?? est
    const total = chunks[chunks.length - 1]!

    // find start: walk chunk sums then within chunk
    let start = 0
    let accum = 0
    let j = 0
    while (j + 1 < chunks.length && accum + chunks[j + 1]! <= st) {
      accum += chunks[j + 1]!
      j++
      start = j * K
    }
    while (start < n && accum < st) {
      accum += h(start)
      start++
    }
    if (accum < st) start = n

    let end = n
    let a = accum
    for (let i = start; i < n; i++) {
      if (a >= st + vh) {
        end = i
        break
      }
      a += h(i)
    }
    const paddedStart = Math.max(0, start - overscan)
    const paddedEnd = Math.min(n, end + overscan)
    let paddingTop = 0
    for (let i = 0; i < paddedStart; i++) paddingTop += h(i)
    let paddingBottom = 0
    for (let i = paddedEnd; i < n; i++) paddingBottom += h(i)
    return { offset: paddedStart, count: paddedEnd - paddedStart, paddingTop, paddingBottom }
  }
}

// ---------- Correctness: exact equivalence vs baseline (hierarchy #1) ----------
function assertEquivalence() {
  let seed = 42
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  const cases: Array<{ n: number; est: number; over: number }> = [
    { n: 0, est: 3, over: 3 },
    { n: 5, est: 3, over: 3 },
    { n: 300, est: 3, over: 3 },
    { n: 300, est: 5, over: 0 },
    { n: 300, est: 8, over: 10 },
  ]
  for (const c of cases) {
    const heights = new Map<number, number>()
    for (let i = 0; i < c.n; i++) if (rnd() > 0.3) heights.set(i, 1 + Math.floor(rnd() * 25))
    const A = makeA(heights, c.n, c.est)
    const B = makeB(heights, c.n, c.est)
    const C = makeC(heights, c.n, c.est)
    for (let q = 0; q < 500; q++) {
      const st = Math.floor(rnd() * (c.n * c.est * 1.2))
      const vh = 10 + Math.floor(rnd() * 60)
      const base = computeVisibleRange(c.n, st, vh, heights, c.est, c.over)
      for (const [name, fn] of [["A", A], ["B", B], ["C", C]] as const) {
        const r = fn(st, vh, c.over)
        if (r.offset !== base.offset || r.count !== base.count || Math.abs(r.paddingTop - base.paddingTop) > 1e-6 || Math.abs(r.paddingBottom - base.paddingBottom) > 1e-6) {
          console.error(`MISMATCH ${name} n=${c.n} st=${st} vh=${vh}: got`, r, "want", base)
          process.exit(1)
        }
      }
    }
  }
  console.log("equivalence: A/B/C === baseline (2500 random queries each) ✓")
}

// ---------- Benchmark ----------
function bench(label: string, fn: (st: number, vh: number, over: number) => VisibleRange, n: number, ticks: number, rebuild: () => void): number {
  const runs: number[] = []
  const est = 3, over = 3
  for (let r = 0; r < 7; r++) {
    const t0 = performance.now()
    for (let t = 0; t < ticks; t++) {
      // simulate scroll: mostly monotonic with occasional jumps; heights change ~5% of ticks
      if (t % 20 === 0) rebuild()
      const st = Math.abs(Math.sin(t / 50) * n * est)
      fn(st, 30, over)
    }
    runs.push(performance.now() - t0)
  }
  runs.sort((a, b) => a - b)
  const med = runs[3]!
  console.log(`  ${label.padEnd(28)} n=${String(n).padStart(5)}  1000 ticks: ${med.toFixed(2).padStart(8)} ms`)
  return med
}

const heightsFor = (n: number) => {
  const m = new Map<number, number>()
  let s = 7
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  for (let i = 0; i < n; i++) if (rnd() > 0.2) m.set(i, 2 + Math.floor(rnd() * 20))
  return m
}

assertEquivalence()

console.log("\n=== BENCH: 1000 ticks (rebuild cada 20 ticks), mediana de 7 ===")
const results: Array<{ variant: string; n: number; ms: number }> = []
for (const n of [100, 1000, 5000]) {
  const heights = heightsFor(n)
  console.log(`  --- n=${n} mensajes ---`)
  results.push({ variant: "baseline O(n)x4", n, ms: bench("baseline O(n)x4", (st, vh, over) => computeVisibleRange(n, st, vh, heights, 3, over), n, 1000, () => {}) })
  results.push({ variant: "A prefix-sum", n, ms: bench("A prefix-sum", makeA(heights, n, 3), n, 1000, () => makeA(heights, n, 3)) })
  results.push({ variant: "A real (exported)", n, ms: (() => {
    // Model the real component: prefix built once, rebuilt via memo only when
    // heights change (rebuild() callback fires every 20 ticks like the replica).
    let prefix = buildHeightPrefix(heights, n, 3)
    return bench("A real (exported)", (st, vh, over) => computeVisibleRangePrefixed(prefix, st, vh, over), n, 1000, () => { prefix = buildHeightPrefix(heights, n, 3) })
  })() })
  results.push({ variant: "B two-pointer", n, ms: bench("B two-pointer", makeB(heights, n, 3), n, 1000, () => makeB(heights, n, 3)) })
  results.push({ variant: "C chunked K=32", n, ms: bench("C chunked K=32", makeC(heights, n, 3), n, 1000, () => makeC(heights, n, 3)) })
}
console.log("\nresumen (ms por 1000 ticks):")
for (const n of [100, 1000, 5000]) {
  const row = results.filter(r => r.n === n)
  const base = row.find(r => r.variant.startsWith("baseline"))!.ms
  const best = row.filter(r => r.variant === "A real (exported)")[0]!
  console.log(`  n=${n}: real=${best.ms.toFixed(2)}ms vs baseline ${base.toFixed(2)}ms → ${(100 * (1 - best.ms / base)).toFixed(1)}% mejora`)
}
