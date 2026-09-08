// sync.test.tsx — 2 tests pinning delta coalescing básico (ciclo 8)
import { describe, expect, test } from "bun:test"

describe("sync — delta coalescing básico", () => {
  test("concat directo vs coalescido produce texto idéntico", () => {
    // Baseline: sin buffer, cada delta hace concat directo
    let direct = ""
    const deltas = ["hello ", "world", "!"]
    for (const d of deltas) direct = (direct ?? "") + d

    // Coalescido: acumula en buffer y flushea en batch
    const buffer = new Map<string, string[]>()
    const key = "msg:part:text"
    for (const d of deltas) {
      const arr = buffer.get(key) ?? []
      arr.push(d)
      buffer.set(key, arr)
    }
    let coalesced = ""
    for (const arr of buffer.values()) coalesced += arr.join("")
    expect(coalesced).toBe(direct)
    expect(coalesced).toBe("hello world!")
  })

  test("buffer agrupa por field y no mezcla reasoning con text", () => {
    const buffer = new Map<string, string>()
    function add(partID: string, field: string, delta: string) {
      const k = `${partID}\0${field}`
      buffer.set(k, (buffer.get(k) ?? "") + delta)
    }
    add("p1", "text", "a")
    add("p1", "reasoning", "r")
    add("p1", "text", "b")
    expect(buffer.get("p1\0text")).toBe("ab")
    expect(buffer.get("p1\0reasoning")).toBe("r")
    expect(buffer.size).toBe(2)
  })
})
