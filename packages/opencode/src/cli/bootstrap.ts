import { InstanceRuntime } from "../project/instance-runtime"
import { context } from "../project/instance-context"
import yargs from "yargs"
import { RunCommand } from "./cmd/run"
import { GenerateCommand } from "./cmd/generate"
import { ConsoleCommand } from "./cmd/account"
import { ProvidersCommand } from "./cmd/providers"
import { AgentCommand } from "./cmd/agent"
import { UpgradeCommand } from "./cmd/upgrade"
import { UninstallCommand } from "./cmd/uninstall"
import { ModelsCommand } from "./cmd/models"
import { UI } from "./ui"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { ServeCommand } from "./cmd/serve"
import { DebugCommand } from "./cmd/debug"
import { StatsCommand } from "./cmd/stats"
import { McpCommand } from "./cmd/mcp"
import { GithubCommand } from "./cmd/github"
import { ExportCommand } from "./cmd/export"
import { ImportCommand } from "./cmd/import"
import { AttachCommand } from "./cmd/attach"
import { TuiThreadCommand } from "./cmd/tui"
import { AcpCommand } from "./cmd/acp"
import { EOL } from "os"
import { WebCommand } from "./cmd/web"
import { PrCommand } from "./cmd/pr"
import { SessionCommand } from "./cmd/session"
import { DbCommand } from "./cmd/db"
import { PluginCommand } from "./cmd/plug"
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
    .command(AcpCommand)
    .command(McpCommand)
    .command(TuiThreadCommand)
    .command(AttachCommand)
    .command(RunCommand)
    .command(GenerateCommand)
    .command(DebugCommand)
    .command(ConsoleCommand)
    .command(ProvidersCommand)
    .command(AgentCommand)
    .command(UpgradeCommand)
    .command(UninstallCommand)
    .command(ServeCommand)
    .command(WebCommand)
    .command(ModelsCommand)
    .command(StatsCommand)
    .command(ExportCommand)
    .command(ImportCommand)
    .command(GithubCommand)
    .command(PrCommand)
    .command(SessionCommand)
    .command(PluginCommand)
    .command(DbCommand)
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
