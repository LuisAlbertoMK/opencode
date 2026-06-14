import { createMemo, createSignal, onCleanup, onMount, Show } from "solid-js"
import { useTheme } from "../context/theme"
import { useRoute } from "../context/route"
import { useSync } from "../context/sync"

// ── Helpers ──────────────────────────────────────────────

type CpuSample = { user: number; system: number; time: number }
let prevCpu: CpuSample | null = null

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

function rss(bytes: number): string {
  if (bytes > 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + "G"
  return Math.round(bytes / (1024 * 1024)) + "M"
}

function short(n: number): string {
  if (n > 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
  if (n > 1_000) return (n / 1_000).toFixed(1) + "K"
  return String(n)
}

function fmtUptime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `↑${h}:${String(m % 60).padStart(2, "0")}`
  if (m > 0) return `↑${m}:${String(s % 60).padStart(2, "0")}`
  return `↑${s}s`
}

// ── Component ───────────────────────────────────────────

export function StatusBar() {
  const { theme } = useTheme()
  const route = useRoute()
  const sync = useSync()
  const [mem, setMem] = createSignal(0)
  const [cpu, setCpu] = createSignal(0)
  const [elapsed, setElapsed] = createSignal(0)
  const startTime = performance.now()

  // Reactive session data (updates when sync store changes)
  const session = createMemo(() => {
    if (route.data.type !== "session") return undefined
    return sync.session.get(route.data.sessionID ?? "")
  })
  const cost = createMemo(() => session()?.cost ?? 0)
  const tokens = createMemo(() => session()?.tokens)
  const model = createMemo(() => session()?.model)

  const tick = () => {
    try {
      // Memory
      setMem(process.memoryUsage().rss)
      // CPU (delta between samples)
      const now = process.cpuUsage()
      const wall = performance.now()
      if (prevCpu) {
        const userDelta = now.user - prevCpu.user
        const sysDelta = now.system - prevCpu.system
        const totalDelta = (userDelta + sysDelta) / 1000 // μs → ms
        const dt = wall - prevCpu.time // ms
        if (dt > 0) setCpu(Math.min(999, Math.round((totalDelta / dt) * 100)))
      }
      prevCpu = { user: now.user, system: now.system, time: wall }
      // Uptime
      setElapsed(wall - startTime)
    } catch {
      // process API unavailable
    }
  }

  onMount(() => {
    tick()
    const timer = setInterval(tick, 2000)
    onCleanup(() => clearInterval(timer))
  })

  return (
    <box flexShrink={0} paddingLeft={1} paddingRight={1}>
      <text fg={theme.textMuted}>
        RAM {rss(mem())} · CPU {cpu()}% · {fmtUptime(elapsed())}
        <Show when={model()}>
          {" · "}
          {model()!.providerID}/{model()!.id}
        </Show>
        <Show when={tokens()}>
          {" · in "}
          {short(tokens()!.input)}
          {" · out "}
          {short(tokens()!.output)}
        </Show>
        <Show when={cost() > 0}>
          {" · "}
          {money.format(cost())}
        </Show>
      </text>
    </box>
  )
}
