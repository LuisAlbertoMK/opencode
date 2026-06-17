// Minimal preload for @opencode-ai/server tests.
// The server package is primarily pure functions and Effect layers,
// so we just need a clean environment.
import { afterAll } from "bun:test"

afterAll(async () => {
  // Cleanup any resources if needed
})

// Use in-memory database by default to avoid file IO in tests
process.env["OPENCODE_DB"] ??= ":memory:"
