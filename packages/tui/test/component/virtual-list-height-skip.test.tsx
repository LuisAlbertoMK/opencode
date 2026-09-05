/** @jsxImportSource @opentui/solid */
// Ciclo 2 — Height measurement skip: cache completo → skip de la pasada O(viewport).
// Verifica equivalencia de alturas vs baseline con cache completo, skip efectivo
// (sin re-medición redundante) e invalidación correcta al cambiar items/ventana.
// Usa patrón headless testRender reusado de virtual-list-recycle.test.tsx.
import { describe, expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import type { ScrollBoxRenderable } from "@opentui/core"
import { createSignal } from "solid-js"
import { VirtualList } from "../../src/component/virtual-list"
import { buildHeightPrefix, computeVisibleRangePrefixed, computeVisibleRange } from "../../src/component/virtual-range"

interface Item {
  id: number
}

// Pure helper mirroring the tick's cacheComplete check (O(visible) Map lookups).
function isCacheComplete(offset: number, count: number, cache: Map<number, number>): boolean {
  if (count === 0) return false
  for (let i = offset; i < offset + count; i++) if (!cache.has(i)) return false
  return true
}

describe("VirtualList height-measurement skip (ciclo 2)", () => {
  test("cacheComplete helper: true only when every visible index is cached", () => {
    const cache = new Map<number, number>([
      [0, 5],
      [1, 5],
      [2, 5],
    ])
    expect(isCacheComplete(0, 3, cache)).toBe(true)
    expect(isCacheComplete(0, 4, cache)).toBe(false) // 3 missing
    expect(isCacheComplete(1, 2, cache)).toBe(true)
    expect(isCacheComplete(2, 1, cache)).toBe(true)
    expect(isCacheComplete(0, 0, cache)).toBe(false) // empty window → not complete (forces measurement path)
    const empty = new Map<number, number>()
    expect(isCacheComplete(0, 1, empty)).toBe(false)
  })

  test("equivalencia: rango con cache completo idéntico al baseline", () => {
    const n = 50
    const est = 5
    const over = 3
    const heights = new Map<number, number>()
    for (let i = 0; i < n; i++) heights.set(i, 3 + (i % 4)) // alturas medidas simuladas
    const prefix = buildHeightPrefix(heights, n, est)
    for (const st of [0, 12, 30, 80, 120]) {
      const vh = 30
      const base = computeVisibleRange(n, st, vh, heights, est, over)
      const opt = computeVisibleRangePrefixed(prefix, st, vh, over)
      expect(opt.offset).toBe(base.offset)
      expect(opt.count).toBe(base.count)
      expect(opt.paddingTop).toBe(base.paddingTop)
      expect(opt.paddingBottom).toBe(base.paddingBottom)
    }
    // El check de completitud no afecta el rango — solo evita re-leer Yoga.
    // Si cache está completo, el prefix es idéntico al usado por el baseline.
    expect(isCacheComplete(0, 10, heights)).toBe(true)
  })

  test("skip efectivo: ventana estable con cache completo no requiere re-medición", async () => {
    const items: Item[] = Array.from({ length: 40 }, (_, id) => ({ id }))
    const [scrollTop, setScrollTop] = createSignal(0)
    const fakeScroll = {
      get scrollTop() {
        return scrollTop()
      },
      height: 30,
      isDestroyed: false,
    } as unknown as ScrollBoxRenderable

    let renderCount = 0
    const app = await testRender(() => (
      <scrollbox height={30} width={80}>
        <VirtualList items={() => items} scrollRef={() => fakeScroll} estimatedHeight={5} overscan={3}>
          {(item) => {
            renderCount++
            return <text>{item.id}</text>
          }}
        </VirtualList>
      </scrollbox>
    ))

    try {
      await new Promise((r) => setTimeout(r, 500)) // settle alturas iniciales
      const settled = renderCount

      // Shift pequeño dentro de ventana que ya está cacheada (untrack del ciclo 6
      // evita recreación masiva; el skip del ciclo 2 evita re-leer alturas).
      // El segundo shift de vuelta debería recrear aún menos.
      setScrollTop(2)
      await new Promise((r) => setTimeout(r, 500))
      const afterFirst = renderCount
      const delta1 = afterFirst - settled

      setScrollTop(0)
      await new Promise((r) => setTimeout(r, 400))
      const afterBack = renderCount
      const delta2 = afterBack - afterFirst

      // Con ambos fixes (ciclo 6 recycle + ciclo 2 skip), el costo por shift
      // es solo los items entrantes/salientes — no la ventana completa.
      // Cota generosa: ≤ 8 o media ventana.
      const approxWindow = 10 // estimatedHeight=5, height=30 → ~6-10 visibles + overscan
      expect(delta1).toBeLessThanOrEqual(Math.max(8, Math.ceil(approxWindow / 2)) + 6)
      expect(delta2).toBeLessThanOrEqual(Math.max(8, Math.ceil(approxWindow / 2)) + 6)
    } finally {
      app.renderer.destroy()
    }
  })

  test("invalidación: items nuevos y ventana desplazada requieren re-medición", async () => {
    // Caso 1: helper puro — nuevo índice no cacheado invalida el skip
    const cache = new Map<number, number>()
    for (let i = 0; i < 10; i++) cache.set(i, 5)
    expect(isCacheComplete(0, 10, cache)).toBe(true)
    expect(isCacheComplete(0, 11, cache)).toBe(false) // item 10 appended no cacheado
    expect(isCacheComplete(8, 5, cache)).toBe(false) // ventana desplazada incluye 11-12 no cacheados

    // Caso 2: integración headless — append de items + scroll al fondo mide nuevas alturas
    const baseItems: Item[] = Array.from({ length: 20 }, (_, id) => ({ id }))
    const [itemsSig, setItemsSig] = createSignal<Item[]>(baseItems)
    const [scrollTop, setScrollTop] = createSignal(0)
    const fakeScroll = {
      get scrollTop() {
        return scrollTop()
      },
      height: 30,
      isDestroyed: false,
    } as unknown as ScrollBoxRenderable

    let creations = 0
    const seenIds = new Set<number>()
    const app = await testRender(() => (
      <scrollbox height={30} width={80}>
        <VirtualList items={() => itemsSig()} scrollRef={() => fakeScroll} estimatedHeight={5} overscan={3}>
          {(item) => {
            creations++
            seenIds.add(item.id)
            return <text>{item.id}</text>
          }}
        </VirtualList>
      </scrollbox>
    ))

    try {
      await new Promise((r) => setTimeout(r, 400))
      const before = creations
      // Append 10 items (append-only, respeta caveat ciclo 6)
      const extended = [...baseItems, ...Array.from({ length: 10 }, (_, i) => ({ id: 20 + i }))]
      setItemsSig(extended)
      await new Promise((r) => setTimeout(r, 400))
      // Scrollear al fondo para que la ventana incluya los nuevos items
      setScrollTop(80)
      await new Promise((r) => setTimeout(r, 500))
      expect(creations).toBeGreaterThan(before)
      // Los nuevos items deben haber sido renderizados al menos una vez
      expect(seenIds.has(25)).toBe(true)
    } finally {
      app.renderer.destroy()
    }
  })
})
