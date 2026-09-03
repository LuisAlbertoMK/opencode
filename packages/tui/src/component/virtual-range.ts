// Pure range computation for VirtualList — no SolidJS dependencies so it can
// be unit-tested and benchmarked in isolation. Semantics EXACTLY match the
// original inline memo body it was extracted from (see virtual-list.tsx).

export interface VisibleRange {
  /** Index of the first visible item (after overscan padding). */
  offset: number
  /** Number of items in the visible window (including overscan). */
  count: number
  /** Total height of items above the window (spacer box). */
  paddingTop: number
  /** Total height of items below the window (spacer box). */
  paddingBottom: number
}

// Baseline algorithm (O(n) per tick, 4 passes): kept verbatim from the
// original memo so behavior is provably unchanged by the extraction.
export function computeVisibleRange(
  count: number,
  scrollTop: number,
  viewportHeight: number,
  heights: Map<number, number>,
  estimatedHeight: number,
  overscan: number,
): VisibleRange {
  if (count === 0) return { offset: 0, count: 0, paddingTop: 0, paddingBottom: 0 }

  const st = Math.max(scrollTop, 0)
  const vh = Math.max(viewportHeight, 1)
  const h = (i: number): number => heights.get(i) ?? estimatedHeight

  // Find first visible item: accumulate heights until past scrollTop
  let accum = 0
  let start = 0
  for (let i = 0; i < count; i++) {
    if (accum >= st) {
      start = i
      break
    }
    accum += h(i)
    start = i + 1
  }

  // Find last visible item: continue accumulating until past viewport
  let end = count
  for (let i = start; i < count; i++) {
    if (accum >= st + vh) {
      end = i
      break
    }
    accum += h(i)
  }

  // Apply overscan
  const paddedStart = Math.max(0, start - overscan)
  const paddedEnd = Math.min(count, end + overscan)

  // Recalculate padding using actual heights
  let paddingTop = 0
  for (let i = 0; i < paddedStart; i++) paddingTop += h(i)

  let paddingBottom = 0
  for (let i = paddedEnd; i < count; i++) paddingBottom += h(i)

  return {
    offset: paddedStart,
    count: paddedEnd - paddedStart,
    paddingTop,
    paddingBottom,
  }
}
