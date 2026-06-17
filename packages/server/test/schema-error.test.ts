import { describe, expect, it } from "bun:test"
import { truncateReason } from "../src/middleware/schema-error"

describe("SchemaErrorMiddleware", () => {
  describe("truncateReason", () => {
    it("returns the original string when under limit", () => {
      expect(truncateReason("short error")).toBe("short error")
    })

    it("returns the original string when exactly at limit", () => {
      const s = "a".repeat(1024)
      expect(truncateReason(s)).toBe(s)
    })

    it("returns the original string when empty", () => {
      expect(truncateReason("")).toBe("")
    })

    it("truncates and appends char count when over limit", () => {
      const s = "a".repeat(2000)
      const result = truncateReason(s)
      expect(result).toStartWith("a".repeat(1024))
      expect(result).toEndWith("... (976 more chars)")
      expect(result.length).toBe(1024 + "... (976 more chars)".length)
    })

    it("includes correct character count for over-limit strings", () => {
      const s = "x".repeat(1500)
      const result = truncateReason(s)
      expect(result).toEndWith("... (476 more chars)")
    })
  })
})
