import type { Argv } from "yargs"
import { withNetworkOptions } from "@/cli/network"

// Option declarations for the default (`$0 [project]`) TUI command.
//
// Split out from `tui.ts` so `src/cli/bootstrap.ts` can register a
// synchronous builder without evaluating the heavy `tui.ts` module graph
// (Rpc, ServerAuth, sdk, ...). yargs renders top-level `--help` (including
// the default command's positionals/options) synchronously and does not
// capture async-builder output in `parse(args, callback)`, so this builder
// must stay sync and light. Single source of truth: `tui.ts` delegates its
// own builder here, and the handler still loads lazily via dynamic import.
export function tuiOptions(yargs: Argv) {
  return withNetworkOptions(yargs)
    .positional("project", {
      type: "string",
      describe: "path to start opencode in",
    })
    .option("model", {
      type: "string",
      alias: ["m"],
      describe: "model to use in the format of provider/model",
    })
    .option("continue", {
      alias: ["c"],
      describe: "continue the last session",
      type: "boolean",
    })
    .option("session", {
      alias: ["s"],
      type: "string",
      describe: "session id to continue",
    })
    .option("fork", {
      type: "boolean",
      describe: "fork the session when continuing (use with --continue or --session)",
    })
    .option("prompt", {
      type: "string",
      describe: "prompt to use",
    })
    .option("agent", {
      type: "string",
      describe: "agent to use",
    })
    .option("auto", {
      type: "boolean",
      describe: "auto-approve permissions that are not explicitly denied (dangerous!)",
      default: false,
    })
    .option("yolo", {
      type: "boolean",
      hidden: true,
      default: false,
    })
    .option("dangerously-skip-permissions", {
      type: "boolean",
      hidden: true,
      default: false,
    })
    .option("mini", {
      type: "boolean",
      describe: "start the minimal interactive interface",
      default: false,
    })
    .option("replay", {
      type: "boolean",
      hidden: true,
    })
    .option("no-replay", {
      type: "boolean",
      describe: "disable mini session history replay on resume and after resize",
    })
    .option("replay-limit", {
      type: "number",
      describe: "cap visible mini replay to the newest N messages",
    })
    .option("demo", {
      type: "boolean",
      hidden: true,
    })
}
