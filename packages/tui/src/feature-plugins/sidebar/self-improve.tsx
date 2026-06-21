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

const DIM_LABELS: Record<string, string> = {
  correctness: "Correctness",
  tokens: "Token Efficiency",
  errorPrevention: "Error Prevention",
  skill: "Skill Usage",
  speed: "Speed",
  breadth: "Breadth",
}

function defaultScore(): ProjectScore {
  return {
    score: {
      current: 5,
      dimensions: {
        correctness: 5,
        tokens: 5,
        errorPrevention: 5,
        skill: 5,
        speed: 5,
        breadth: 5,
      },
      lastUpdated: new Date().toISOString(),
      trend: "stable",
    },
  }
}

function ensureScoreFile(wt: string): ProjectScore {
  const p = path.join(wt, ".project.json")
  try {
    const raw = readFileSync(p, "utf-8")
    return JSON.parse(raw) as ProjectScore
  } catch {
    return defaultScore()
  }
}

function ScoreDialog(props: { api: TuiPluginApi; score: ProjectScore["score"] }) {
  const theme = () => props.api.theme.current
  const s = props.score
  const entries = () => Object.entries(s.dimensions)

  return (
    <box padding={1}>
      <text fg={theme().text}>
        <b>Project Score — {s.current.toFixed(1)}/10</b>
      </text>
      <text fg={theme().textMuted}>&nbsp;</text>
      <text fg={theme().text}>{s.trend} trend &middot; last updated {s.lastUpdated.slice(0, 10)}</text>
      <text fg={theme().textMuted}>&nbsp;</text>
      {entries().map(([key, val]) => {
        const label = DIM_LABELS[key] ?? key
        const bar = "█".repeat(Math.round(val))
        const empty = "░".repeat(10 - Math.round(val))
        const color = val >= 7 ? theme().success : val >= 4 ? theme().warning : theme().error
        return (
          <box flexDirection="row">
            <text fg={theme().text} width={20}>{label}</text>
            <text fg={color} width={12}>{bar}{empty}</text>
            <text fg={theme().textMuted}>{val.toFixed(1)}</text>
          </box>
        )
      })}
      <text fg={theme().textMuted}>&nbsp;</text>
      <text fg={theme().textMuted}>Press Escape to close</text>
    </box>
  )
}

function View(props: { api: TuiPluginApi; session_id: string }) {
  const theme = () => props.api.theme.current
  const worktree = () => props.api.state.path.worktree

  const score = createMemo<ProjectScore["score"] | undefined>(() => {
    const wt = worktree()
    if (!wt) return undefined
    try {
      return ensureScoreFile(wt).score
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
          fg={theme().info}
          onMouseDown={() => {
            const s = score()
            if (s) props.api.ui.dialog.replace(() => <ScoreDialog api={props.api} score={s} />)
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
