// vMK: static command registry — forces Bun.compile() to bundle all dynamically-imported modules
// lazy() in index.ts uses dynamic import() which Bun.compile can't resolve in compiled binaries.
// This file provides a static fallback map that works in both dev and compiled modes.

import { AcpCommand } from "./acp"
import { AttachCommand } from "./attach"
import { AgentCommand } from "./agent"
import { ConsoleCommand } from "./account"
import { DbCommand } from "./db"
import { DebugCommand } from "./debug"
import { ExportCommand } from "./export"
import { GenerateCommand } from "./generate"
import { GithubCommand } from "./github"
import { ImportCommand } from "./import"
import { McpCommand } from "./mcp"
import { ModelsCommand } from "./models"
import { PluginCommand } from "./plug"
import { PrCommand } from "./pr"
import { ProvidersCommand } from "./providers"
import { RunCommand } from "./run"
import { ServeCommand } from "./serve"
import { SessionCommand } from "./session"
import { StatsCommand } from "./stats"
import { TuiThreadCommand } from "./tui"
import { UninstallCommand } from "./uninstall"
import { UpgradeCommand } from "./upgrade"
import { WebCommand } from "./web"

/** vMK: maps import paths (as used by lazy() in index.ts) to their module exports */
export const cmdRegistry: Record<string, Record<string, any>> = {
  "./cli/cmd/acp": { AcpCommand },
  "./cli/cmd/attach": { AttachCommand },
  "./cli/cmd/agent": { AgentCommand },
  "./cli/cmd/account": { ConsoleCommand },
  "./cli/cmd/db": { DbCommand },
  "./cli/cmd/debug": { DebugCommand },
  "./cli/cmd/export": { ExportCommand },
  "./cli/cmd/generate": { GenerateCommand },
  "./cli/cmd/github": { GithubCommand },
  "./cli/cmd/import": { ImportCommand },
  "./cli/cmd/mcp": { McpCommand },
  "./cli/cmd/models": { ModelsCommand },
  "./cli/cmd/plug": { PluginCommand },
  "./cli/cmd/pr": { PrCommand },
  "./cli/cmd/providers": { ProvidersCommand },
  "./cli/cmd/run": { RunCommand },
  "./cli/cmd/serve": { ServeCommand },
  "./cli/cmd/session": { SessionCommand },
  "./cli/cmd/stats": { StatsCommand },
  "./cli/cmd/tui": { TuiThreadCommand },
  "./cli/cmd/uninstall": { UninstallCommand },
  "./cli/cmd/upgrade": { UpgradeCommand },
  "./cli/cmd/web": { WebCommand },
}
