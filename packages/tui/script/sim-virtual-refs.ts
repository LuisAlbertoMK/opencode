// Simulation metrics for Ciclo 2 — itemRefs lifecycle (leak fix).
// Run: bun run script/sim-virtual-refs.ts
// Simulates the exact set/cleanup/tick patterns from virtual-list.tsx.

type FakeBox = { height: number; isDestroyed: boolean; weight: number } // weight ≈ retained bytes proxy

const WINDOW = 12 // visible items (like a TUI viewport)
const OVERSCAN = 3
const SHIFTS = 2000 // window shifts (scroll distance)
const LIVE_WEIGHT = 512 // bytes proxy per retained renderable (JS wrapper + Yoga node + Zig backing)

// ---------- Baseline: set-only (current bug) ----------
function runBaseline() {
  const itemRefs = new Map<number, FakeBox>()
  let alloc = 0
  for (let shift = 0; shift < SHIFTS; shift++) {
    const base = shift % Math.max(1, SHIFTS - WINDOW)
    for (let k = 0; k < WINDOW + OVERSCAN * 2; k++) {
      const idx = base + k
      if (!itemRefs.has(idx)) {
        itemRefs.set(idx, { height: 5, isDestroyed: false, weight: LIVE_WEIGHT })
        alloc++
      }
    }
    // items unmount → in baseline NO cleanup runs (stale entries stay)
  }
  return { itemRefs, alloc }
}

// ---------- Fixed: onCleanup guard + isDestroyed skip (A+B) ----------
function runFixed() {
  const itemRefs = new Map<number, FakeBox>()
  let alloc = 0
  let cleaned = 0
  for (let shift = 0; shift < SHIFTS; shift++) {
    const base = shift % Math.max(1, SHIFTS - WINDOW)
    // unmount previous window entries (Solid disposes rows on window shift)
    for (const [idx, el] of itemRefs) {
      const inWindow = idx >= base && idx < base + WINDOW + OVERSCAN * 2
      if (!inWindow || el.isDestroyed) {
        // onCleanup guard: delete only if the stored el is the disposing el
        itemRefs.delete(idx)
        cleaned++
      }
    }
    for (let k = 0; k < WINDOW + OVERSCAN * 2; k++) {
      const idx = base + k
      itemRefs.set(idx, { height: 5, isDestroyed: false, weight: LIVE_WEIGHT })
      alloc++
    }
  }
  return { itemRefs, alloc, cleaned }
}

// ---------- CPU of the tick measurement loop ----------
function tickCpu(mapSize: number, staleRatio: number, ticks = 1000): number {
  const m = new Map<number, FakeBox>()
  for (let i = 0; i < mapSize; i++) {
    m.set(i, { height: i % 7 === 0 ? 0 : 5, isDestroyed: i < mapSize * staleRatio, weight: 0 })
  }
  const runs: number[] = []
  for (let r = 0; r < 7; r++) {
    const t0 = performance.now()
    for (let t = 0; t < ticks; t++) {
      for (const [index, el] of m) {
        if (el.isDestroyed) {
          m.delete(index) // A+B: drop on sight
          continue
        }
        if (el.height > 0) void el.height
      }
    }
    runs.push(performance.now() - t0)
  }
  runs.sort((a, b) => a - b)
  return runs[3]!
}

console.log("=== RAM: entradas retenidas tras", SHIFTS, "window shifts ===")
const base = runBaseline()
const fixed = runFixed()
const retainedBase = base.itemRefs.size
const retainedFixed = fixed.itemRefs.size
const bytesBase = retainedBase * LIVE_WEIGHT
const bytesFixed = retainedFixed * LIVE_WEIGHT
console.log(`  baseline (bug):  ${retainedBase} entradas (${(bytesBase / 1024).toFixed(1)} KB proxy retenidos)`)
console.log(`  fixed (A+B):     ${retainedFixed} entradas (${(bytesFixed / 1024).toFixed(1)} KB proxy)`)
console.log(`  reducción:       ${(100 * (1 - retainedFixed / retainedBase)).toFixed(1)}% de entradas retenidas`)

console.log("\n=== CPU: loop de medición por 1000 ticks (mediana de 7) ===")
const stale = tickCpu(2000, 0.98) // sesión larga scrolleada: mayoría de entradas son muertas SIN fix
const clean = tickCpu(40, 0) // con fix: solo la ventana viva
console.log(`  con leak (2000 entradas, 98% muertas): ${stale.toFixed(2)} ms`)
console.log(`  con fix (≈40 entradas vivas):          ${clean.toFixed(2)} ms`)
console.log(`  mejora CPU del tick:                   ${(100 * (1 - clean / stale)).toFixed(1)}%`)
