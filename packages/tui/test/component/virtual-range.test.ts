import { describe, expect, test } from "bun:test"
import { buildHeightPrefix, computeVisibleRange, computeVisibleRangePrefixed, type VisibleRange } from "../../src/component/virtual-range"

// Seeded PRNG — deterministic across runs.
let seed = 12345
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)

const expectSame = (a: VisibleRange, b: VisibleRange, ctx: string) => {
  expect(a.offset).toBe(b.offset)
  expect(a.count).toBe(b.count)
  expect(a.paddingTop).toBeCloseTo(b.paddingTop, 6)
  expect(a.paddingBottom).toBeCloseTo(b.paddingBottom, 6)
  void ctx
}

describe("computeVisibleRangePrefixed", () => {
  test("exactly matches baseline across randomized queries", () => {
    for (const [n, est, over] of [
      [0, 3, 3],
      [1, 3, 3],
      [5, 3, 3],
      [300, 3, 3],
      [300, 5, 0],
      [300, 8, 10],
      [2000, 4, 2],
    ] as const) {
      const heights = new Map<number, number>()
      for (let i = 0; i < n; i++) if (rnd() > 0.3) heights.set(i, 1 + Math.floor(rnd() * 25))
      const prefix = buildHeightPrefix(heights, n, est)
      for (let q = 0; q < 300; q++) {
        const st = Math.floor(rnd() * (n * est * 1.3))
        const vh = 1 + Math.floor(rnd() * 60)
        const base = computeVisibleRange(n, st, vh, heights, est, over)
        const opt = computeVisibleRangePrefixed(prefix, st, vh, over)
        expectSame(opt, base, `n=${n} st=${st} vh=${vh} over=${over}`)
      }
    }
  })

  test("boundaries: empty list", () => {
    const prefix = buildHeightPrefix(new Map(), 0, 3)
    expect(computeVisibleRangePrefixed(prefix, 0, 30, 3)).toEqual({ offset: 0, count: 0, paddingTop: 0, paddingBottom: 0 })
  })

  test("boundaries: scrollTop beyond total content matches baseline quirk", () => {
    // Baseline behavior (preserved verbatim): when scrollTop exceeds total
    // content, the window renders the tail with paddingTop=0 — NOT an empty
    // window. Both algorithms agree; this pins the pre-existing semantics.
    const heights = new Map<number, number>([[0, 10], [1, 10], [2, 10]])
    const prefix = buildHeightPrefix(heights, 3, 3)
    const base = computeVisibleRange(3, 10_000, 30, heights, 3, 3)
    const r = computeVisibleRangePrefixed(prefix, 10_000, 30, 3)
    expectSame(r, base, "scroll beyond content")
    expect(r.offset).toBe(0)
    expect(r.count).toBe(3)
    expect(r.paddingTop).toBe(0)
  })

  test("boundaries: scrollTop 0 starts at top", () => {
    const heights = new Map<number, number>([[0, 10], [1, 10], [2, 10]])
    const prefix = buildHeightPrefix(heights, 3, 3)
    const r = computeVisibleRangePrefixed(prefix, 0, 20, 0)
    expect(r.offset).toBe(0)
    expect(r.count).toBeGreaterThan(0)
    expect(r.paddingTop).toBe(0)
  })

  test("boundaries: negative scrollTop treated as 0", () => {
    const heights = new Map<number, number>([[0, 10]])
    const prefix = buildHeightPrefix(heights, 1, 3)
    const r = computeVisibleRangePrefixed(prefix, -50, 20, 0)
    expect(r.offset).toBe(0)
    expect(r.paddingTop).toBe(0)
  })

  test("unmeasured items fall back to estimatedHeight", () => {
    const prefix = buildHeightPrefix(new Map(), 10, 5)
    const base = computeVisibleRange(10, 12, 20, new Map(), 5, 0)
    const opt = computeVisibleRangePrefixed(prefix, 12, 20, 0)
    expectSame(opt, base, "unmeasured fallback")
  })

  test("prefix must be rebuilt when heights change (documented contract)", () => {
    // The component memo owns rebuilding; this test pins the semantics.
    const heights = new Map<number, number>([[0, 10], [1, 10], [2, 10]])
    const stale = buildHeightPrefix(heights, 3, 3)
    heights.set(1, 100)
    const fresh = buildHeightPrefix(heights, 3, 3)
    expect(stale[2]).toBe(20)
    expect(fresh[2]).toBe(110)
  })
})
