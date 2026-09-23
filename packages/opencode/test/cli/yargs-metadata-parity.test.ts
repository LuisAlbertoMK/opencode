import { describe, expect, test } from "bun:test"

// Parity guard for the lazy yargs table in `src/cli/bootstrap.ts` (~lines 96-252).
// yargs reads `command`/`describe`/`aliases` only at registration time, so the
// static args in `lazyCommand(...)` must match the real CommandModule exported
// by each `src/cli/cmd/*.ts` module. Editing one side without the other
// silently degrades `--help`; this test turns that into a loud failure.
//
// Intentional exceptions (do NOT "fix" these):
// - `generate` has no describe (hidden on purpose): expected `undefined`.
// - `console` is hidden on purpose: expected `describe: false`.

const bootstrap = await Bun.file(new URL("../../src/cli/bootstrap.ts", import.meta.url)).text()

const norm = (value: string | readonly string[] | undefined) => [...(value ?? [])].sort()

// Static mirror of the registration table in `buildCli`. Each row is checked
// twice: the literals must still appear in `bootstrap.ts` source (catches edits
// to the lazy side) and must equal the module's export (catches edits to the
// cmd side). The default `$0` command is registered inline, not via
// `lazyCommand`, and is covered the same way through `TuiThreadCommand`.
const cases: Array<{
  exportName: string
  command: string
  describe: string | false | undefined
  aliases?: readonly string[]
  load: () => Promise<Record<string, { command: unknown; describe: unknown; aliases?: unknown }>>
}> = [
  { exportName: "AcpCommand", command: "acp", describe: "start ACP (Agent Client Protocol) server", load: () => import("../../src/cli/cmd/acp") },
  { exportName: "McpCommand", command: "mcp", describe: "manage MCP (Model Context Protocol) servers", load: () => import("../../src/cli/cmd/mcp") },
  { exportName: "TuiThreadCommand", command: "$0 [project]", describe: "start opencode tui", load: () => import("../../src/cli/cmd/tui") },
  { exportName: "AttachCommand", command: "attach <url>", describe: "attach to a running opencode server", load: () => import("../../src/cli/cmd/attach") },
  { exportName: "RunCommand", command: "run [message..]", describe: "run opencode with a message", load: () => import("../../src/cli/cmd/run") },
  { exportName: "GenerateCommand", command: "generate", describe: undefined, load: () => import("../../src/cli/cmd/generate") },
  { exportName: "DebugCommand", command: "debug", describe: "debugging and troubleshooting tools", load: () => import("../../src/cli/cmd/debug/index") },
  { exportName: "ConsoleCommand", command: "console", describe: false, load: () => import("../../src/cli/cmd/account") },
  { exportName: "ProvidersCommand", command: "providers", describe: "manage AI providers and credentials", aliases: ["auth"], load: () => import("../../src/cli/cmd/providers") },
  { exportName: "AgentCommand", command: "agent", describe: "manage agents", load: () => import("../../src/cli/cmd/agent") },
  { exportName: "UpgradeCommand", command: "upgrade [target]", describe: "upgrade opencode to the latest or a specific version", load: () => import("../../src/cli/cmd/upgrade") },
  { exportName: "UninstallCommand", command: "uninstall", describe: "uninstall opencode and remove all related files", load: () => import("../../src/cli/cmd/uninstall") },
  { exportName: "ServeCommand", command: "serve", describe: "starts a headless opencode server", load: () => import("../../src/cli/cmd/serve") },
  { exportName: "WebCommand", command: "web", describe: "start opencode server and open web interface", load: () => import("../../src/cli/cmd/web") },
  { exportName: "ModelsCommand", command: "models [provider]", describe: "list all available models", load: () => import("../../src/cli/cmd/models") },
  { exportName: "StatsCommand", command: "stats", describe: "show token usage and cost statistics", load: () => import("../../src/cli/cmd/stats") },
  { exportName: "ExportCommand", command: "export [sessionID]", describe: "export session data as JSON", load: () => import("../../src/cli/cmd/export") },
  { exportName: "ImportCommand", command: "import <file>", describe: "import session data from JSON file or URL", load: () => import("../../src/cli/cmd/import") },
  { exportName: "GithubCommand", command: "github", describe: "manage GitHub agent", load: () => import("../../src/cli/cmd/github") },
  { exportName: "PrCommand", command: "pr <number>", describe: "fetch and checkout a GitHub PR branch, then run opencode", load: () => import("../../src/cli/cmd/pr") },
  { exportName: "SessionCommand", command: "session", describe: "manage sessions", load: () => import("../../src/cli/cmd/session") },
  { exportName: "PluginCommand", command: "plugin <module>", describe: "install plugin and update config", aliases: ["plug"], load: () => import("../../src/cli/cmd/plug") },
  { exportName: "DbCommand", command: "db", describe: "database tools", load: () => import("../../src/cli/cmd/db") },
]

describe("yargs lazy metadata parity", () => {
  test("bootstrap registers one lazyCommand per cased command (plus the inline $0 default)", () => {
    expect(bootstrap.match(/lazyCommand\(/g) ?? []).toHaveLength(cases.length - 1)
  })

  for (const c of cases) {
    test(`${c.exportName}: bootstrap literals match the module export`, async () => {
      expect(bootstrap.includes(`"${c.command}"`)).toBe(true)
      if (c.describe === undefined) expect(bootstrap.includes(`"${c.command}", undefined`)).toBe(true)
      if (c.describe === false) expect(bootstrap.includes(`"${c.command}", false`)).toBe(true)
      if (typeof c.describe === "string") expect(bootstrap.includes(`"${c.describe}"`)).toBe(true)
      for (const alias of c.aliases ?? []) expect(bootstrap.includes(`"${alias}"`)).toBe(true)

      const mod = await c.load()
      const actual = mod[c.exportName] as { command: unknown; describe: unknown; aliases?: string | readonly string[] }
      expect(actual.command).toEqual(c.command)
      expect(actual.describe ?? undefined).toEqual(c.describe ?? undefined)
      expect(norm(actual.aliases)).toEqual(norm(c.aliases))
    }, 60000)
  }
})
