import { describe, expect, it } from "bun:test"
import { isAllowedCorsOrigin, isAllowedRequestOrigin } from "../src/cors"

describe("isAllowedCorsOrigin", () => {
  it("allows undefined", () => {
    expect(isAllowedCorsOrigin(undefined)).toBe(true)
  })

  it("allows localhost with any port", () => {
    expect(isAllowedCorsOrigin("http://localhost:5173")).toBe(true)
    expect(isAllowedCorsOrigin("http://localhost:3000")).toBe(true)
    expect(isAllowedCorsOrigin("http://localhost:8080/api")).toBe(true)
  })

  it("allows 127.0.0.1 with any port", () => {
    expect(isAllowedCorsOrigin("http://127.0.0.1:5173")).toBe(true)
    expect(isAllowedCorsOrigin("http://127.0.0.1:3000")).toBe(true)
  })

  it("allows oc://renderer", () => {
    expect(isAllowedCorsOrigin("oc://renderer")).toBe(true)
  })

  it("allows tauri localhost origins", () => {
    expect(isAllowedCorsOrigin("tauri://localhost")).toBe(true)
    expect(isAllowedCorsOrigin("http://tauri.localhost")).toBe(true)
    expect(isAllowedCorsOrigin("https://tauri.localhost")).toBe(true)
  })

  it("allows opencode.ai origins", () => {
    expect(isAllowedCorsOrigin("https://opencode.ai")).toBe(true)
    expect(isAllowedCorsOrigin("https://app.opencode.ai")).toBe(true)
    expect(isAllowedCorsOrigin("https://api-v2.opencode.ai")).toBe(true)
  })

  it("rejects unknown origins by default", () => {
    expect(isAllowedCorsOrigin("https://evil.com")).toBe(false)
    expect(isAllowedCorsOrigin("https://localhost:99999")).toBe(false)
  })

  it("allows origins in custom cors list", () => {
    const opts = { cors: ["https://my-extension.com"] }
    expect(isAllowedCorsOrigin("https://my-extension.com", opts)).toBe(true)
    expect(isAllowedCorsOrigin("https://other.com", opts)).toBe(false)
  })
})

describe("isAllowedRequestOrigin", () => {
  it("allows undefined", () => {
    expect(isAllowedRequestOrigin(undefined, "localhost")).toBe(true)
  })

  it("allows same-host origin", () => {
    expect(isAllowedRequestOrigin("http://localhost:5173", "localhost:5173")).toBe(true)
  })

  it("rejects cross-host origin without cors match", () => {
    expect(isAllowedRequestOrigin("https://evil.com", "localhost:5173")).toBe(false)
  })

  it("allows cross-host origin with cors match", () => {
    const opts = { cors: ["https://my-extension.com"] }
    expect(isAllowedRequestOrigin("https://my-extension.com", "localhost:5173", opts)).toBe(true)
  })
})
