import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import type { CommandModule } from "yargs"
import { UI } from "./cli/ui"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { FormatError } from "./cli/error"
import { EOL } from "os"
import { errorMessage } from "./util/error"
import { Heap } from "./cli/heap"
import { cmdRegistry } from "./cli/cmd/_registry"

// vMK: lazy command — replaces 23 static imports with dynamic import()
// vMK: defers builder + handler until the command actually matches
// vMK: --help loads 0 command modules instead of 23; any command loads 1
// vMK: uses cmdRegistry (static) for compiled binaries, falls back to dynamic import() for dev
function lazy<T, U>(
  command: string | readonly string[],
  describe: string | false | undefined,
  path: string,
  key: string,
  aliases?: string[],
): CommandModule<T, U> {
  return {
    command,
    describe,
    ...(aliases?.length ? { aliases } : {}),
    builder: async (yargs) => {
      const mod = cmdRegistry[path] ?? (await import(path))
      const cmd = mod[key] as CommandModule<T, U>
      return cmd.builder ? (cmd.builder as any)(yargs) : yargs
    },
    handler: async (args) => {
      const mod = cmdRegistry[path] ?? (await import(path))
      const cmd = mod[key] as CommandModule<T, U>
      if (cmd.handler) await cmd.handler(args as any)
    },
  }
}

const args = hideBin(process.argv)

function show(out: string) {
  const text = out.trimStart()
  if (!text.startsWith("opencode ")) {
    process.stderr.write(UI.logo() + EOL + EOL)
    process.stderr.write(text + EOL)
    return
  }
  process.stderr.write(out)
}

const cli = yargs(args)
  .parserConfiguration({ "populate--": true })
  .scriptName("opencode")
  .wrap(100)
  .help("help", "show help")
  .alias("help", "h")
  .version("version", "show version number", InstallationVersion)
  .alias("version", "v")
  .option("print-logs", {
    describe: "print logs to stderr",
    type: "boolean",
  })
  .option("log-level", {
    describe: "log level",
    type: "string",
    choices: ["DEBUG", "INFO", "WARN", "ERROR"],
  })
  .option("pure", {
    describe: "run without external plugins",
    type: "boolean",
  })
  .middleware(async (opts) => {
    if (opts.printLogs) process.env.OPENCODE_PRINT_LOGS = "1"
    if (opts.logLevel) process.env.OPENCODE_LOG_LEVEL = opts.logLevel
    if (opts.pure) {
      process.env.OPENCODE_PURE = "1"
    }

    Heap.start()

    process.env.AGENT = "1"
    process.env.OPENCODE = "1"
    process.env.OPENCODE_PID = String(process.pid)
  })
  .usage("")
  .completion("completion", "generate shell completion script")
  .command(lazy("acp", "start ACP (Agent Client Protocol) server", "./cli/cmd/acp", "AcpCommand"))
  .command(lazy("mcp", "manage MCP (Model Context Protocol) servers", "./cli/cmd/mcp", "McpCommand"))
  .command(lazy("$0 [project]", "start opencode tui", "./cli/cmd/tui", "TuiThreadCommand"))
  .command(lazy("attach <url>", "attach to a running opencode server", "./cli/cmd/attach", "AttachCommand"))
  .command(lazy("run [message..]", "run opencode with a message", "./cli/cmd/run", "RunCommand"))
  .command(lazy("generate", undefined, "./cli/cmd/generate", "GenerateCommand"))
  .command(lazy("debug", "debugging and troubleshooting tools", "./cli/cmd/debug", "DebugCommand"))
  .command(lazy("console", false, "./cli/cmd/account", "ConsoleCommand"))
  .command(lazy("providers", "manage AI providers and credentials", "./cli/cmd/providers", "ProvidersCommand", ["auth"]))
  .command(lazy("agent", "manage agents", "./cli/cmd/agent", "AgentCommand"))
  .command(lazy("upgrade [target]", "upgrade opencode to the latest or a specific version", "./cli/cmd/upgrade", "UpgradeCommand"))
  .command(lazy("uninstall", "uninstall opencode and remove all related files", "./cli/cmd/uninstall", "UninstallCommand"))
  .command(lazy("serve", "starts a headless opencode server", "./cli/cmd/serve", "ServeCommand"))
  .command(lazy("web", "start opencode server and open web interface", "./cli/cmd/web", "WebCommand"))
  .command(lazy("models [provider]", "list all available models", "./cli/cmd/models", "ModelsCommand"))
  .command(lazy("stats", "show token usage and cost statistics", "./cli/cmd/stats", "StatsCommand"))
  .command(lazy("export [sessionID]", "export session data as JSON", "./cli/cmd/export", "ExportCommand"))
  .command(lazy("import <file>", "import session data from JSON file or URL", "./cli/cmd/import", "ImportCommand"))
  .command(lazy("github", "manage GitHub agent", "./cli/cmd/github", "GithubCommand"))
  .command(lazy("pr <number>", "fetch and checkout a GitHub PR branch, then run opencode", "./cli/cmd/pr", "PrCommand"))
  .command(lazy("session", "manage sessions", "./cli/cmd/session", "SessionCommand"))
  .command(lazy("plugin <module>", "install plugin and update config", "./cli/cmd/plug", "PluginCommand"))
  .command(lazy("db", "database tools", "./cli/cmd/db", "DbCommand"))
  .fail((msg, err) => {
    if (
      msg?.startsWith("Unknown argument") ||
      msg?.startsWith("Not enough non-option arguments") ||
      msg?.startsWith("Invalid values:")
    ) {
      if (err) throw err
      cli.showHelp(show)
    }
    if (err) throw err
    process.exit(1)
  })
  .strict()

try {
  if (args.includes("-h") || args.includes("--help")) {
    await cli.parse(args, (err: Error | undefined, _argv: unknown, out: string) => {
      if (err) throw err
      if (!out) return
      show(out)
    })
  } else {
    await cli.parse()
  }
} catch (e) {
  const formatted = FormatError(e)
  if (formatted) UI.error(formatted)
  if (formatted === undefined) {
    UI.error("Unexpected error" + EOL)
    process.stderr.write(errorMessage(e) + EOL)
  }
  process.exitCode = 1
} finally {
  // Some subprocesses don't react properly to SIGTERM and similar signals.
  // Most notably, some docker-container-based MCP servers don't handle such signals unless
  // run using `docker run --init`.
  // Explicitly exit to avoid any hanging subprocesses.
  process.exit()
}
