import type { TuiPlugin, TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"
import { createMemo, For, Show, createSignal } from "solid-js"
import type { Message, Part } from "@opencode-ai/sdk/v2"
import { useClipboard } from "../../context/clipboard"
import { Locale } from "../../util/locale"

const id = "internal:sidebar-messages"

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function getMessagePreview(msg: Message, parts: ReadonlyArray<Part>): string {
  if (msg.role === "user") return msg.summary?.title ?? msg.summary?.body ?? "(user message)"
  const textParts = parts.filter((p): p is Part & { type: "text"; text: string } => p.type === "text" && !("synthetic" in p ? (p as any).synthetic : false))
  const text = textParts.map((p) => p.text).join(" ").trim()
  if (!text) return "(assistant response)"
  return text.length > 60 ? text.slice(0, 57) + "..." : text
}

function getMessageText(msg: Message, parts: ReadonlyArray<Part>): string {
  if (msg.role === "user") {
    const title = msg.summary?.title ?? ""
    const body = msg.summary?.body ?? ""
    return [title, body].filter(Boolean).join("\n")
  }
  const textParts = parts.filter((p): p is Part & { type: "text"; text: string } => p.type === "text" && !("synthetic" in p ? (p as any).synthetic : false))
  return textParts.map((p) => p.text).join("\n")
}

function View(props: { api: TuiPluginApi; session_id: string }) {
  const [open, setOpen] = createSignal(true)
  const theme = () => props.api.theme.current
  const clipboard = useClipboard()
  const messages = createMemo(() => props.api.state.session.messages(props.session_id))
  const count = createMemo(() => messages().length)

  const handleCopy = async (msg: Message) => {
    const parts = props.api.state.part(msg.id)
    const text = getMessageText(msg, parts)
    if (text) await clipboard.write?.(text)
  }

  const handleCopyAll = async () => {
    const lines: string[] = []
    for (const msg of messages()) {
      const parts = props.api.state.part(msg.id)
      const role = msg.role === "user" ? "You" : "Assistant"
      const text = getMessageText(msg, parts)
      lines.push(`--- ${role} (${formatTime(msg.time.created)}) ---`)
      if (text) lines.push(text)
    }
    await clipboard.write?.(lines.join("\n"))
  }

  return (
    <Show when={count() > 0}>
      <box>
        <box flexDirection="row" gap={1}>
          <Show when={count() > 3}>
            <text fg={theme().text} onMouseDown={() => setOpen((x) => !x)}>
              {open() ? "▼" : "▶"}
            </text>
          </Show>
          <text fg={theme().text}>
            <b>Messages</b>
            <span style={{ fg: theme().textMuted }}> ({count()})</span>
          </text>
          <Show when={count() > 0}>
            <text fg={theme().textMuted} onMouseDown={handleCopyAll}>
              {" "}
              [Copy All]
            </text>
          </Show>
        </box>
        <Show when={count() <= 3 || open()}>
          <For each={messages()}>
            {(msg) => {
              const parts = createMemo(() => props.api.state.part(msg.id))
              const preview = createMemo(() => getMessagePreview(msg, parts()))
              const isUser = msg.role === "user"
              return (
                <box
                  flexDirection="row"
                  gap={1}
                  onMouseDown={() => handleCopy(msg)}
                >
                  <text fg={isUser ? theme().info : theme().success}>{"•"}</text>
                  <text
                    fg={theme().textMuted}
                    wrapMode="none"
                  >
                    {formatTime(msg.time.created)}{" "}
                    {isUser ? "" : "→ "}
                    {preview()}
                  </text>
                </box>
              )
            }}
          </For>
        </Show>
      </box>
    </Show>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 150,
    slots: {
      sidebar_content(_ctx, props) {
        return <View api={api} session_id={props.session_id} />
      },
    },
  })
}

const plugin: BuiltinTuiPlugin = {
  id,
  tui,
}

export default plugin
