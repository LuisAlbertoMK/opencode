import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { hideBin } from "yargs/helpers"

const args = hideBin(process.argv)

// Fast path: print version without evaluating the yargs command graph.
// yargs prints only the version number plus a newline, so mirror that exactly.
// Only inspect args before the first "--" separator so `run -- --version`
// passes --version to the subcommand instead of triggering the fast path.
const separator = args.indexOf("--")
const head = separator === -1 ? args : args.slice(0, separator)
if (head.includes("--version") || head.includes("-v")) {
  // Wait for stdout to flush before process.exit(), same truncation guard
  // used by generate.ts — process.exit() can otherwise drop piped output.
  await new Promise<void>((resolve) => {
    process.stdout.write(InstallationVersion + "\n", () => resolve())
  })
  process.exit(0)
}

const { buildCli, show } = await import("./cli/bootstrap")
const { UI } = await import("./cli/ui")
const { EOL } = await import("os")
const { FormatError } = await import("./cli/error")
const { errorMessage } = await import("./util/error")

const cli = buildCli(args)

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
