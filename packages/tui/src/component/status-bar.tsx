import { createMemo, createSignal, onCleanup, onMount, Show } from "solid-js"
import { useTheme } from "../context/theme"
import { useRoute } from "../context/route"
import { useSync } from "../context/sync"

// ── Helpers ──────────────────────────────────────────────

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

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

  onMount(() => {
    const timer = setInterval(() => setElapsed(performance.now() - startTime), 3000)
    onCleanup(() => clearInterval(timer))
  })

  return (
    <box flexShrink={0} paddingLeft={1} paddingRight={1}>
      <text fg={theme.textMuted}>
        {fmtUptime(elapsed())}
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
