import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import type { CommandModule } from "yargs"
import { UI } from "./cli/ui"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { FormatError } from "./cli/error"
import { EOL } from "os"
import { errorMessage } from "./util/error"
import { Heap } from "./cli/heap"

// vMK: lazy command loaders — replaces 23 static imports with deferred
// dynamic import(). --help/--version evaluate 0 command modules; any command
// evaluates exactly 1. Each loader keeps a static import() specifier so Bun
// bundles the module at build time, but its top-level code is not evaluated
// until the command is invoked.
const cmdLoaders = {
  "./cli/cmd/acp": () => import("./cli/cmd/acp"),
  "./cli/cmd/mcp": () => import("./cli/cmd/mcp"),
  "./cli/cmd/tui": () => import("./cli/cmd/tui"),
  "./cli/cmd/attach": () => import("./cli/cmd/attach"),
  "./cli/cmd/run": () => import("./cli/cmd/run"),
  "./cli/cmd/generate": () => import("./cli/cmd/generate"),
  "./cli/cmd/debug": () => import("./cli/cmd/debug"),
  "./cli/cmd/account": () => import("./cli/cmd/account"),
  "./cli/cmd/providers": () => import("./cli/cmd/providers"),
  "./cli/cmd/agent": () => import("./cli/cmd/agent"),
  "./cli/cmd/upgrade": () => import("./cli/cmd/upgrade"),
  "./cli/cmd/uninstall": () => import("./cli/cmd/uninstall"),
  "./cli/cmd/serve": () => import("./cli/cmd/serve"),
  "./cli/cmd/web": () => import("./cli/cmd/web"),
  "./cli/cmd/models": () => import("./cli/cmd/models"),
  "./cli/cmd/stats": () => import("./cli/cmd/stats"),
  "./cli/cmd/export": () => import("./cli/cmd/export"),
  "./cli/cmd/import": () => import("./cli/cmd/import"),
  "./cli/cmd/github": () => import("./cli/cmd/github"),
  "./cli/cmd/pr": () => import("./cli/cmd/pr"),
  "./cli/cmd/session": () => import("./cli/cmd/session"),
  "./cli/cmd/plug": () => import("./cli/cmd/plug"),
  "./cli/cmd/db": () => import("./cli/cmd/db"),
} as const

// vMK: defers builder + handler until the command actually matches.
// Metadata (command/describe/aliases) mirrors each module's own export so
// yargs can match without loading it.
function lazy<T, U>(
  command: string | readonly string[],
  describe: string | false | undefined,
  path: keyof typeof cmdLoaders,
  key: string,
  aliases?: string[],
): CommandModule<T, U> {
  return {
    command,
    describe,
    ...(aliases?.length ? { aliases } : {}),
    builder: async (yargs) => {
      const mod: any = await cmdLoaders[path]()
      const cmd = mod[key] as CommandModule<T, U>
      return cmd.builder ? (cmd.builder as any)(yargs) : yargs
    },
    handler: async (args) => {
      const mod: any = await cmdLoaders[path]()
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
  .command(lazy("mcp", "manage MCP (Model Context Protocol) servers", "./cli/cmd/mcp", "McpCommand", ["ls"]))
  .command(lazy("$0 [project]", "start opencode tui", "./cli/cmd/tui", "TuiThreadCommand"))
  .command(lazy("attach <url>", "attach to a running opencode server", "./cli/cmd/attach", "AttachCommand"))
  .command(lazy("run [message..]", "run opencode with a message", "./cli/cmd/run", "RunCommand"))
  .command(lazy("generate", undefined, "./cli/cmd/generate", "GenerateCommand"))
  .command(lazy("debug", "debugging and troubleshooting tools", "./cli/cmd/debug", "DebugCommand"))
  .command(lazy("console", false, "./cli/cmd/account", "ConsoleCommand"))
  .command(
    lazy("providers", "manage AI providers and credentials", "./cli/cmd/providers", "ProvidersCommand", ["auth"]),
  )
  .command(lazy("agent", "manage agents", "./cli/cmd/agent", "AgentCommand"))
  .command(
    lazy(
      "upgrade [target]",
      "upgrade opencode to the latest or a specific version",
      "./cli/cmd/upgrade",
      "UpgradeCommand",
    ),
  )
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
  .command(lazy("plugin <module>", "install plugin and update config", "./cli/cmd/plug", "PluginCommand", ["plug"]))
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
  // vMK: fast path for first-argument --version — prints directly instead of
  // going through yargs's console.log-based version handling.
  if (args[0] === "-v" || args[0] === "--version") {
    process.stdout.write(InstallationVersion + EOL)
    process.exit(0)
  }
  // vMK: fast path for first-argument --help — getHelp() skips full parsing
  // and command-module loading. Subcommand flags (e.g. `opencode run -h`) fall
  // through to the normal parse so they get the correct scoped help.
  if (args[0] === "-h" || args[0] === "--help") {
    const helpText = await cli.getHelp()
    show(helpText)
    process.exit(0)
  }
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
