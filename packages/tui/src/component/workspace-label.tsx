import { useTheme } from "../context/theme"

export type WorkspaceStatus = "connected" | "connecting" | "disconnected" | "error"

export function WorkspaceLabel(props: { type: string; name: string; status?: WorkspaceStatus; icon?: boolean }) {
  const { theme } = useTheme()
  // vMK: Distinct symbols per status — no solo color. Accesibilidad para daltonismo.
  // ● connected, ▲ error, ◌ connecting, ○ disconnected
  const statusIcon = () => {
    if (props.status === "connected") return "●"
    if (props.status === "error") return "▲"
    if (props.status === "connecting") return "◌"
    return "○"
  }
  const color = () => {
    if (props.status === "connected") return theme.success
    if (props.status === "error") return theme.error
    return theme.textMuted
  }

  return (
    <>
      {props.icon ? <span style={{ fg: color() }}>{statusIcon()} </span> : undefined}
      <span style={{ fg: theme.text }}>{props.name}</span> <span style={{ fg: theme.textMuted }}>({props.type})</span>
    </>
  )
}
