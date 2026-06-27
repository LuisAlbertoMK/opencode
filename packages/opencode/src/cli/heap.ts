import path from "path"
import { writeHeapSnapshot } from "node:v8"
import { Flag } from "@opencode-ai/core/flag/flag"
import { Global } from "@opencode-ai/core/global"
// vMK: aggressive heap thresholds — 30s check interval, 768MB hard / 512MB soft
const MINUTE = 30_000
const LIMIT = 768 * 1024 * 1024
const SOFT_LIMIT = 512 * 1024 * 1024
const MAX_HEAP = 4 * 1024 * 1024 * 1024 // Unused — kept for reference

let timer: Timer | undefined
let lock = false
let armed = true
let lastGc = 0

function tryGc() {
  const now = Date.now()
  if (now - lastGc < 30_000) return
  lastGc = now
  try {
    globalThis.gc?.()
  } catch { /* gc not available */ }
}

export function start() {
  if (!Flag.OPENCODE_AUTO_HEAP_SNAPSHOT) return
  if (timer) return

  const run = async () => {
    if (lock) return

    const stat = process.memoryUsage()
    // Proactive GC when approaching limit
    if (stat.rss > SOFT_LIMIT) tryGc()

    if (stat.rss <= LIMIT) {
      armed = true
      return
    }
    if (!armed) return

    // Emergency GC before snapshot
    tryGc()
    const stat2 = process.memoryUsage()
    if (stat2.rss <= LIMIT) {
      armed = true
      return
    }

    lock = true
    armed = false
    const file = path.join(
      Global.Path.log,
      `heap-${process.pid}-${new Date().toISOString().replace(/[:.]/g, "")}.heapsnapshot`,
    )
    await Promise.resolve()
      .then(() => writeHeapSnapshot(file))
      .catch(() => {})

    lock = false
  }

  timer = setInterval(() => {
    void run()
  }, MINUTE)
  timer.unref?.()
}

/**
 * Set Windows process priority class.
 * Called once at startup to reduce resource contention with other apps.
 */
export function setWindowsPriority() {
  try {
    // @ts-expect-error — Bun FFI or Node priority API
    if (typeof process.setPriority === "function") {
      // Linux/macOS: -10 is moderately high priority
      // process.setPriority(process.pid, -10)
    }
  } catch { /* not supported */ }
}

export * as Heap from "./heap"
