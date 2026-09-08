// Ciclo 8 — Delta coalescing harness: 100 deltas sintéticas → 1-2 setStore por frame + equivalencia exacta.
// Headless, no TUI render. Simula el buffer Map<partID+field, string[]> + flush microtask+timeout+batch
// y mide performance.now() + spy de setStore calls.
import { describe, expect, test } from "bun:test"
import { batch } from "solid-js"

// Réplica mínima del buffer de sync.tsx para harness (misma semántica).
function createCoalescer(opts: {
  onFlush: (batchPayload: Map<string, { messageID: string; partID: string; field: string; text: string }>) => void
  isHydrating?: (sessionID: string) => boolean
}) {
  const buffer = new Map<string, { sessionID: string; messageID: string; partID: string; field: string; text: string }>()
  let scheduled = false
  let timer: ReturnType<typeof setTimeout> | undefined

  function flush() {
    scheduled = false
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    if (buffer.size === 0) return
    const toFlush = new Map<string, { sessionID: string; messageID: string; partID: string; field: string; text: string }>()
    const deferred = new Map<string, { sessionID: string; messageID: string; partID: string; field: string; text: string }>()
    for (const [k, v] of buffer) {
      if (opts.isHydrating?.(v.sessionID)) deferred.set(k, v)
      else toFlush.set(k, v)
    }
    if (deferred.size > 0) {
      buffer.clear()
      for (const [k, v] of deferred) buffer.set(k, v)
      if (toFlush.size === 0) {
        scheduled = true
        timer = setTimeout(flush, 16)
        return
      }
    } else {
      buffer.clear()
    }
    if (toFlush.size === 0) return
    batch(() => {
      opts.onFlush(toFlush)
    })
    if (deferred.size > 0) {
      scheduled = true
      timer = setTimeout(flush, 16)
    }
  }

  function schedule() {
    if (scheduled) return
    scheduled = true
    queueMicrotask(flush)
    if (timer === undefined) timer = setTimeout(flush, 16)
  }

  function enqueue(sessionID: string, messageID: string, partID: string, field: string, delta: string) {
    const key = `${messageID}\0${partID}\0${field}`
    const existing = buffer.get(key)
    if (existing) existing.text += delta
    else buffer.set(key, { sessionID, messageID, partID, field, text: delta })
    schedule()
  }

  return { buffer, enqueue, flush }
}

describe("sync delta coalescing — ciclo 8 harness", () => {
  test("100 deltas sintéticas → 1-2 setStore por frame y equivalencia exacta", async () => {
    let flushCalls = 0
    let finalText = ""
    const coalescer = createCoalescer({
      onFlush: (payload) => {
        flushCalls++
        for (const e of payload.values()) finalText += e.text
      },
    })

    const deltas = Array.from({ length: 100 }, (_, i) => `x${i}-`)
    const baseline = deltas.join("")

    const t0 = performance.now()
    for (const d of deltas) coalescer.enqueue("sess-1", "msg-1", "part-1", "text", d)
    // Espera microtask flush
    await new Promise<void>((r) => queueMicrotask(() => r()))
    // Timeout fallback si quedara algo
    await new Promise((r) => setTimeout(r, 20))
    const t1 = performance.now()

    // Objetivo: 100 deltas → 1-2 flushes (batch por frame)
    expect(flushCalls).toBeGreaterThanOrEqual(1)
    expect(flushCalls).toBeLessThanOrEqual(2)
    // Equivalencia exacta vs baseline (concat sin coalescing)
    expect(finalText).toBe(baseline)
    // Métrica temporal: el coalescing no debe degradar (harness no mide mejora de render, solo overhead del buffer)
    const elapsed = t1 - t0
    expect(elapsed).toBeLessThan(100) // 100 deltas coalescadas en <100ms es holgado; baseline sería 100 produce calls
  })

  test("múltiples partes/fields se agrupan pero no mezclan texto", async () => {
    const flushed: string[] = []
    const coalescer = createCoalescer({
      onFlush: (payload) => {
        for (const e of payload.values()) flushed.push(`${e.partID}:${e.field}=${e.text}`)
      },
    })
    coalescer.enqueue("sess-1", "msg-1", "part-A", "text", "hello ")
    coalescer.enqueue("sess-1", "msg-1", "part-B", "text", "world")
    coalescer.enqueue("sess-1", "msg-1", "part-A", "text", "again")
    coalescer.enqueue("sess-1", "msg-1", "part-A", "reasoning", "r1")
    coalescer.enqueue("sess-1", "msg-1", "part-A", "reasoning", "r2")
    await new Promise<void>((r) => queueMicrotask(() => r()))
    await new Promise((r) => setTimeout(r, 20))
    flushed.sort()
    expect(flushed).toEqual(["part-A:reasoning=r1r2", "part-A:text=hello again", "part-B:text=world"])
  })

  test("equivalencia: texto final idéntico a concat directo sin buffer", async () => {
    const direct = { text: "" }
    const coalesced = { text: "" }
    const deltas = ["a", "bc", "", "def", "g"]
    for (const d of deltas) direct.text += d

    let flushedText = ""
    const coalescer = createCoalescer({
      onFlush: (p) => {
        for (const e of p.values()) flushedText += e.text
      },
    })
    for (const d of deltas) coalescer.enqueue("s", "m", "p", "text", d)
    await new Promise<void>((r) => queueMicrotask(() => r()))
    await new Promise((r) => setTimeout(r, 20))
    coalesced.text = flushedText
    expect(coalesced.text).toBe(direct.text)
  })
})
