import { describe, expect, it } from "bun:test"
import { Option, Redacted } from "effect"
import { ServerAuth } from "../src/auth"

describe("ServerAuth", () => {
  // --- required() ---

  describe("required()", () => {
    it("returns true when password is set and non-empty", () => {
      const config = { password: Option.some("secret123"), username: "opencode" }
      expect(ServerAuth.required(config)).toBe(true)
    })

    it("returns false when password is none", () => {
      const config = { password: Option.none(), username: "opencode" }
      expect(ServerAuth.required(config)).toBe(false)
    })

    it("returns false when password is empty string", () => {
      const config = { password: Option.some(""), username: "opencode" }
      expect(ServerAuth.required(config)).toBe(false)
    })
  })

  // --- authorized() ---

  describe("authorized()", () => {
    const config = { password: Option.some("secret"), username: "opencode" }

    it("returns true when credentials match", () => {
      const credentials = { username: "opencode", password: Redacted.make("secret") }
      expect(ServerAuth.authorized(credentials, config)).toBe(true)
    })

    it("returns false when username does not match", () => {
      const credentials = { username: "hacker", password: Redacted.make("secret") }
      expect(ServerAuth.authorized(credentials, config)).toBe(false)
    })

    it("returns false when password does not match", () => {
      const credentials = { username: "opencode", password: Redacted.make("wrong") }
      expect(ServerAuth.authorized(credentials, config)).toBe(false)
    })

    it("returns false when config has no password", () => {
      const noPasswordConfig = { password: Option.none(), username: "opencode" }
      const credentials = { username: "opencode", password: Redacted.make("secret") }
      expect(ServerAuth.authorized(credentials, noPasswordConfig)).toBe(false)
    })
  })

  // --- header() ---

  describe("header()", () => {
    it("returns Basic auth header with default username", () => {
      const header = ServerAuth.header({ password: "secret" })
      expect(header).toStartWith("Basic ")
      // Verify it decodes correctly
      const decoded = Buffer.from(header!.slice(6), "base64").toString()
      expect(decoded).toBe("opencode:secret")
    })

    it("returns Basic auth header with custom username", () => {
      const header = ServerAuth.header({ password: "secret", username: "admin" })
      const decoded = Buffer.from(header!.slice(6), "base64").toString()
      expect(decoded).toBe("admin:secret")
    })

    it("returns undefined when no password provided", () => {
      const original = process.env["OPENCODE_SERVER_PASSWORD"]
      delete process.env["OPENCODE_SERVER_PASSWORD"]
      expect(ServerAuth.header({ password: "" })).toBeUndefined()
      if (original !== undefined) process.env["OPENCODE_SERVER_PASSWORD"] = original
      else delete process.env["OPENCODE_SERVER_PASSWORD"]
    })

    it("returns undefined when password is empty", () => {
      const original = process.env["OPENCODE_SERVER_PASSWORD"]
      delete process.env["OPENCODE_SERVER_PASSWORD"]
      expect(ServerAuth.header({ password: "" })).toBeUndefined()
      if (original) process.env["OPENCODE_SERVER_PASSWORD"] = original
    })

    it("falls back to env var OPENCODE_SERVER_PASSWORD when no credentials arg", () => {
      const original = process.env["OPENCODE_SERVER_PASSWORD"]
      process.env["OPENCODE_SERVER_PASSWORD"] = "env-password"
      try {
        const header = ServerAuth.header()
        expect(header).toStartWith("Basic ")
        const decoded = Buffer.from(header!.slice(6), "base64").toString()
        expect(decoded).toBe("opencode:env-password")
      } finally {
        if (original !== undefined) process.env["OPENCODE_SERVER_PASSWORD"] = original
        else delete process.env["OPENCODE_SERVER_PASSWORD"]
      }
    })

    it("falls back to env var OPENCODE_SERVER_USERNAME when no username in credentials", () => {
      const originalPassword = process.env["OPENCODE_SERVER_PASSWORD"]
      const originalUsername = process.env["OPENCODE_SERVER_USERNAME"]
      process.env["OPENCODE_SERVER_PASSWORD"] = "secret"
      process.env["OPENCODE_SERVER_USERNAME"] = "env-user"
      try {
        const header = ServerAuth.header()
        const decoded = Buffer.from(header!.slice(6), "base64").toString()
        expect(decoded).toBe("env-user:secret")
      } finally {
        if (originalPassword !== undefined) process.env["OPENCODE_SERVER_PASSWORD"] = originalPassword
        else delete process.env["OPENCODE_SERVER_PASSWORD"]
        if (originalUsername !== undefined) process.env["OPENCODE_SERVER_USERNAME"] = originalUsername
        else delete process.env["OPENCODE_SERVER_USERNAME"]
      }
    })
  })

  // --- headers() ---

  describe("headers()", () => {
    it("returns object with Authorization key", () => {
      const result = ServerAuth.headers({ password: "secret" })
      expect(result).toBeDefined()
      expect(result!.Authorization).toStartWith("Basic ")
    })

    it("returns undefined when no credentials", () => {
      expect(ServerAuth.headers()).toBeUndefined()
    })
  })
})
