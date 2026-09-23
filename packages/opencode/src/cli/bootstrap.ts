import { InstanceRuntime } from "../project/instance-runtime"
import { context } from "../project/instance-context"
import yargs from "yargs"
import type { Argv, CommandModule } from "yargs"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { UI } from "./ui"
import { tuiOptions } from "./cmd/tui.options"
import { EOL } from "os"
import { Heap } from "./heap"

export async function bootstrap<T>(directory: string, cb: () => Promise<T>) {
  const ctx = await InstanceRuntime.load({ directory })
  try {
    return await context.provide(ctx, cb)
  } finally {
    await InstanceRuntime.disposeInstance(ctx)
  }
}

export function show(out: string) {
  const text = out.trimStart()
  if (!text.startsWith("opencode ")) {
    process.stderr.write(UI.logo() + EOL + EOL)
    process.stderr.write(text + EOL)
    return
  }
  process.stderr.write(out)
}

// yargs only reads `command`/`describe`/`aliases` at registration time, so
// those stay static here while the heavy module graph loads behind `builder`
// and `handler`. Top-level `--help` lists commands without running
// sub-builders, so registration stays cheap; showing help for (or parsing) a
// specific command pays that command's import only. Same deferred-import
// pattern as the handler in `src/cli/effect-cmd.ts`.
function lazyCommand<T, U>(
  command: string | readonly string[],
  describe: string | false | undefined,
  load: () => Promise<CommandModule<T, U>>,
  aliases?: string | readonly string[],
): CommandModule<T, U> {
  return {
    command,
    describe,
    aliases,
    builder: async (yargs: Argv<T>): Promise<Argv<U>> => {
      const mod = await load()
      if (mod.builder === undefined) return yargs as unknown as Argv<U>
      if (typeof mod.builder === "function") return mod.builder(yargs)
      return yargs.options(mod.builder) as Argv<U>
    },
    handler: async (args) => {
      const mod = await load()
      await mod.handler(args)
    },
  }
}

export function buildCli(args: string[]) {
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
    .command(
      lazyCommand("acp", "start ACP (Agent Client Protocol) server", async () => {
        const mod = await import("./cmd/acp")
        return mod.AcpCommand
      }),
    )
    .command(
      lazyCommand("mcp", "manage MCP (Model Context Protocol) servers", async () => {
        const mod = await import("./cmd/mcp")
        return mod.McpCommand
      }),
    )
    // The default command keeps a synchronous builder: yargs renders
    // top-level `--help` (and the `parse(args, callback)` output used by
    // `src/index.ts`) synchronously, so an async builder here would drop the
    // default command's positionals/options from help and yield empty output.
    // Only the light `tui.options` module (yargs + network options) loads
    // eagerly; the heavy `tui.ts` graph still loads lazily in the handler.
    .command({
      command: "$0 [project]",
      describe: "start opencode tui",
      builder: (yargs) => tuiOptions(yargs),
      handler: async (args) => {
        const mod = await import("./cmd/tui")
        await mod.TuiThreadCommand.handler(args)
      },
    })
    .command(
      lazyCommand("attach <url>", "attach to a running opencode server", async () => {
        const mod = await import("./cmd/attach")
        return mod.AttachCommand
      }),
    )
    .command(
      lazyCommand("run [message..]", "run opencode with a message", async () => {
        const mod = await import("./cmd/run")
        return mod.RunCommand
      }),
    )
    .command(
      lazyCommand("generate", undefined, async () => {
        const mod = await import("./cmd/generate")
        return mod.GenerateCommand
      }),
    )
    .command(
      lazyCommand("debug", "debugging and troubleshooting tools", async () => {
        const mod = await import("./cmd/debug/index")
        return mod.DebugCommand
      }),
    )
    .command(
      lazyCommand("console", false, async () => {
        const mod = await import("./cmd/account")
        return mod.ConsoleCommand
      }),
    )
    .command(
      lazyCommand(
        "providers",
        "manage AI providers and credentials",
        async () => {
          const mod = await import("./cmd/providers")
          return mod.ProvidersCommand
        },
        ["auth"],
      ),
    )
    .command(
      lazyCommand("agent", "manage agents", async () => {
        const mod = await import("./cmd/agent")
        return mod.AgentCommand
      }),
    )
    .command(
      lazyCommand("upgrade [target]", "upgrade opencode to the latest or a specific version", async () => {
        const mod = await import("./cmd/upgrade")
        return mod.UpgradeCommand
      }),
    )
    .command(
      lazyCommand("uninstall", "uninstall opencode and remove all related files", async () => {
        const mod = await import("./cmd/uninstall")
        return mod.UninstallCommand
      }),
    )
    .command(
      lazyCommand("serve", "starts a headless opencode server", async () => {
        const mod = await import("./cmd/serve")
        return mod.ServeCommand
      }),
    )
    .command(
      lazyCommand("web", "start opencode server and open web interface", async () => {
        const mod = await import("./cmd/web")
        return mod.WebCommand
      }),
    )
    .command(
      lazyCommand("models [provider]", "list all available models", async () => {
        const mod = await import("./cmd/models")
        return mod.ModelsCommand
      }),
    )
    .command(
      lazyCommand("stats", "show token usage and cost statistics", async () => {
        const mod = await import("./cmd/stats")
        return mod.StatsCommand
      }),
    )
    .command(
      lazyCommand("export [sessionID]", "export session data as JSON", async () => {
        const mod = await import("./cmd/export")
        return mod.ExportCommand
      }),
    )
    .command(
      lazyCommand("import <file>", "import session data from JSON file or URL", async () => {
        const mod = await import("./cmd/import")
        return mod.ImportCommand
      }),
    )
    .command(
      lazyCommand("github", "manage GitHub agent", async () => {
        const mod = await import("./cmd/github")
        return mod.GithubCommand
      }),
    )
    .command(
      lazyCommand("pr <number>", "fetch and checkout a GitHub PR branch, then run opencode", async () => {
        const mod = await import("./cmd/pr")
        return mod.PrCommand
      }),
    )
    .command(
      lazyCommand("session", "manage sessions", async () => {
        const mod = await import("./cmd/session")
        return mod.SessionCommand
      }),
    )
    .command(
      lazyCommand(
        "plugin <module>",
        "install plugin and update config",
        async () => {
          const mod = await import("./cmd/plug")
          return mod.PluginCommand
        },
        ["plug"],
      ),
    )
    .command(
      lazyCommand("db", "database tools", async () => {
        const mod = await import("./cmd/db")
        return mod.DbCommand
      }),
    )
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
  return cli
}
