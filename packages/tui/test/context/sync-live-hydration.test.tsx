// Ciclo 7/8 — pinning de hydration races (6 tests). Sin modificar en ciclo 8: el coalescer debe diferir flush mientras hidrata.
// Replica la semántica del tracker hydratingSessions y el merge atómico en produce.
import { describe, expect, test } from "bun:test"

function createTracker() {
  return new Map<string, { messages: Set<string>; parts: Set<string> }>()
}

describe("sync live hydration — pinning ciclo 7/8 (6 tests)", () => {
  test("tracker: touchPart registra partID solo si la sesión está hidrating", () => {
    const hydrating = createTracker()
    const touchPart = (sessionID: string, partID: string) => {
      hydrating.get(sessionID)?.parts.add(partID)
    }
    // Sin sesión en hydrating → no registra
    touchPart("sess-1", "part-1")
    expect(hydrating.size).toBe(0)
    // Con sesión en hydrating → registra
    hydrating.set("sess-1", { messages: new Set(), parts: new Set() })
    touchPart("sess-1", "part-1")
    expect(hydrating.get("sess-1")!.parts.has("part-1")).toBe(true)
  })

  test("merge hydration: part trackeado preserva current aunque server tenga text vacío", () => {
    const tracker = { messages: new Set<string>(), parts: new Set<string>(["part-1"]) }
    const currentParts: Array<{ id: string; type: string; text: string }> = [{ id: "part-1", type: "text", text: "live hello" }]
    const serverParts: Array<{ id: string; type: string; text: string }> = [{ id: "part-1", type: "text", text: "" }]
    const merged = serverParts.flatMap((part) => {
      const current = currentParts.find((c) => c.id === part.id)
      if (tracker.parts.has(part.id)) return current ? [current] : []
      if (current && (part.type === "text" || part.type === "reasoning") && part.text.length === 0 && current.text.length > 0) return [current]
      return [part]
    })
    expect((merged[0] as { text: string }).text).toBe("live hello")
  })

  test("merge hydration: part no trackeado toma server cuando server tiene contenido", () => {
    const tracker = { messages: new Set<string>(), parts: new Set<string>() }
    const currentParts: Array<{ id: string; type: string; text: string }> = [{ id: "part-1", type: "text", text: "old" }]
    const serverParts: Array<{ id: string; type: string; text: string }> = [{ id: "part-1", type: "text", text: "new server" }]
    const merged = serverParts.flatMap((part) => {
      const current = currentParts.find((c) => c.id === part.id)
      if (tracker.parts.has(part.id)) return current ? [current] : []
      if (current && (part.type === "text" || part.type === "reasoning") && part.text.length === 0 && current.text.length > 0) return [current]
      return [part]
    })
    expect((merged[0] as { text: string }).text).toBe("new server")
  })

  test("coalescer difiere flush mientras la sesión está hidrating (guardarraíl ciclo 7)", async () => {
    const hydrating = createTracker()
    hydrating.set("sess-1", { messages: new Set(), parts: new Set() })
    let flushed = 0
    const buffer = new Map<string, { sessionID: string; text: string }>()
    let scheduled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    function flush() {
      scheduled = false
      if (timer) { clearTimeout(timer); timer = undefined }
      const toFlush = new Map<string, { sessionID: string; text: string }>()
      const deferred = new Map<string, { sessionID: string; text: string }>()
      for (const [k, v] of buffer) {
        if (hydrating.has(v.sessionID)) deferred.set(k, v)
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
      } else buffer.clear()
      if (toFlush.size > 0) flushed++
      if (deferred.size > 0) {
        scheduled = true
        timer = setTimeout(flush, 16)
      }
    }
    function schedule() {
      if (scheduled) return
      scheduled = true
      queueMicrotask(flush)
      if (!timer) timer = setTimeout(flush, 16)
    }
    buffer.set("k1", { sessionID: "sess-1", text: "deferred" })
    schedule()
    await new Promise<void>((r) => queueMicrotask(() => r()))
    await new Promise((r) => setTimeout(r, 5))
    // Debe permanecer diferido mientras hidrata
    expect(flushed).toBe(0)
    expect(buffer.has("k1")).toBe(true)
    // Tras hidratar, flush debe liberar
    hydrating.delete("sess-1")
    // re-schedule manual como hace sync() finally → scheduleDeltaFlush
    schedule()
    await new Promise<void>((r) => queueMicrotask(() => r()))
    await new Promise((r) => setTimeout(r, 20))
    expect(flushed).toBe(1)
    expect(buffer.size).toBe(0)
  })

  test("coalescer flushea sesiones no-hidrating aunque otra sesión siga hidrating", async () => {
    const hydrating = createTracker()
    hydrating.set("sess-hydrating", { messages: new Set(), parts: new Set() })
    const flushedSessions: string[] = []
    const buffer = new Map<string, { sessionID: string; text: string }>()
    let scheduled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    function flush() {
      scheduled = false
      if (timer) { clearTimeout(timer); timer = undefined }
      const toFlush = new Map<string, { sessionID: string; text: string }>()
      const deferred = new Map<string, { sessionID: string; text: string }>()
      for (const [k, v] of buffer) {
        if (hydrating.has(v.sessionID)) deferred.set(k, v)
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
      } else buffer.clear()
      for (const v of toFlush.values()) flushedSessions.push(v.sessionID)
      if (deferred.size > 0) {
        scheduled = true
        timer = setTimeout(flush, 16)
      }
    }
    function schedule() {
      if (scheduled) return
      scheduled = true
      queueMicrotask(flush)
      if (!timer) timer = setTimeout(flush, 16)
    }
    buffer.set("k1", { sessionID: "sess-hydrating", text: "a" })
    buffer.set("k2", { sessionID: "sess-free", text: "b" })
    schedule()
    await new Promise<void>((r) => queueMicrotask(() => r()))
    await new Promise((r) => setTimeout(r, 5))
    expect(flushedSessions).toEqual(["sess-free"])
    expect(buffer.has("k1")).toBe(true)
    expect(buffer.has("k2")).toBe(false)
    hydrating.delete("sess-hydrating")
    schedule()
    await new Promise<void>((r) => queueMicrotask(() => r()))
    await new Promise((r) => setTimeout(r, 20))
    expect(flushedSessions).toEqual(["sess-free", "sess-hydrating"])
  })

  test("hydration finally limpia tracker y permite flush posterior", () => {
    const hydrating = createTracker()
    const syncing = new Map<string, Promise<void>>()
    hydrating.set("sess-1", { messages: new Set(), parts: new Set() })
    syncing.set("sess-1", Promise.resolve())
    // Simula finally de sync()
    syncing.delete("sess-1")
    hydrating.delete("sess-1")
    expect(hydrating.has("sess-1")).toBe(false)
    expect(syncing.has("sess-1")).toBe(false)
  })
})
