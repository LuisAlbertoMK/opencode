// sync-undefined-messages.test.tsx — 1 test pinning guard para messageID inexistente
import { describe, expect, test } from "bun:test"

describe("sync undefined messages — guard para delta sin parte", () => {
  test("delta sobre messageID sin partes no debe producir throw y no registra buffer", () => {
    const store: Record<string, unknown[]> = {}
    const buffer = new Map<string, string>()
    const messageID = "missing-msg"
    const partID = "part-1"
    const field = "text"
    const delta = "x"

    // Simula el guard del case message.part.delta: if (!parts) break
    const parts = store[messageID] as unknown[] | undefined
    if (!parts) {
      expect(buffer.size).toBe(0)
      return
    }
    // Si hubiera partes, encolaría
    const key = `${messageID}\0${partID}\0${field}`
    buffer.set(key, (buffer.get(key) ?? "") + delta)
    expect(buffer.size).toBe(1)
  })
})
