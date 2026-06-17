import type { TuiPlugin, TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"
import { createMemo, Show } from "solid-js"
import { readFileSync } from "fs"
import path from "path"

const id = "internal:sidebar-self-improve"

type ProjectScore = {
  score: {
    current: number
    dimensions: Record<string, number>
    lastUpdated: string
    trend: string
  }
}

function View(props: { api: TuiPluginApi; session_id: string }) {
  const theme = () => props.api.theme.current
  const worktree = () => props.api.state.path.worktree

  const score = createMemo<ProjectScore["score"] | undefined>(() => {
    const wt = worktree()
    if (!wt) return undefined
    try {
      const raw = readFileSync(path.join(wt, ".project.json"), "utf-8")
      return (JSON.parse(raw) as ProjectScore).score
    } catch {
      return undefined
    }
  })

  const needsImprove = createMemo(() => {
    const s = score()
    return s && s.current < 8
  })

  return (
    <Show when={needsImprove()}>
      <box>
        <text fg={theme().text}>
          <b>Score</b>
        </text>
        <text fg={theme().warning}>{score()!.current.toFixed(1)}/10</text>
        <text
          fg={theme().textMuted}
          onMouseDown={() => {
            props.api.ui.toast({ message: "Self-improvement coming soon" })
          }}
        >
          ⬡ Improve
        </text>
      </box>
    </Show>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 600,
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
