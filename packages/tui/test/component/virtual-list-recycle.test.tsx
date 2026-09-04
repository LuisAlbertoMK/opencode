/** @jsxImportSource @opentui/solid */
// Ciclo 6 — VirtualList child-scope recycling lifecycle test.
// Headless render via testRender: asserts that a scroll shift recreates only
// the entering boundary items (fixed behavior) instead of the whole visible
// window (the pre-ciclo-6 bug: reactive `visible()` read inside the children
// callback re-executed every child scope per shift). Also asserts absolute
// index equivalence: children-received index === position in the items array.
import { expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import { createSignal } from "solid-js"
import { VirtualList } from "../../src/component/virtual-list"

interface Item {
  id: number
}

test("VirtualList recycles child scopes across window shifts", async () => {
  const items: Item[] = Array.from({ length: 50 }, (_, id) => ({ id }))
  let creations = 0
  const indexById = new Map<number, number>()

  // Fake scroll surface: the component polls scrollRef() every 100ms while
  // scrolling; we mutate scrollTop through a signal to drive shifts.
  const [scrollTop, setScrollTop] = createSignal(0)
  const fakeScroll = {
    get scrollTop() {
      return scrollTop()
    },
    height: 30,
    isDestroyed: false,
  }

  const app = await testRender(() => (
    <scrollbox height={30} width={80}>
      <VirtualList
        items={() => items}
        scrollRef={() => fakeScroll}
        estimatedHeight={5}
        overscan={3}
      >
        {(item, index) => {
          creations++
          indexById.set(item.id, index)
          return <text>{item.id}</text>
        }}
      </VirtualList>
    </scrollbox>
  ))

  try {
    const initial = creations
    // virtualized: fewer creations than items
    expect(initial).toBeGreaterThan(0)
    expect(initial).toBeLessThan(items.length)

    // Let the height measurement settle first: once Yoga heights replace the
    // estimate, the visible window legitimately expands (new items enter).
    // We baseline AFTER settling so the shift delta below isolates recycling.
    await new Promise((resolve) => setTimeout(resolve, 400))
    const settled = creations

    // shift the window by a few items, then wait for the height-measurement
    // cascade to quiesce (entering boxes measure → cache update → recompute)
    setScrollTop(5)
    await new Promise((resolve) => setTimeout(resolve, 500))

    const delta = creations - settled
    // FIXED: shift cost = entering items + one measurement cascade wave —
    // well under half the window. The old pattern recreated the entire
    // visible window (~viewport rows) on EVERY shift.
    const windowCount = indexById.size
    expect(delta).toBeLessThanOrEqual(Math.max(8, Math.ceil(windowCount / 2)))

    // absolute index equivalence: children-received index === array position
    for (const [id, idx] of indexById) {
      const expected = items.findIndex((it) => it.id === id)
      if (idx !== expected) {
        console.log(`MISMATCH id=${id} got=${idx} expected=${expected}`)
      }
      expect(idx).toBe(expected)
    }
  } finally {
    app.renderer.destroy()
  }
})
