// vMK: Fase 1.4 tree-sitter AST shell parser for danger detection
// Uses tree-sitter-bash grammar; falls back when WASM is unavailable.
import { fileURLToPath } from "url"

// Module-level types to avoid static import of web-tree-sitter (may be externalized).
type Parser = { parse(input: string): Tree; setLanguage(lang: unknown): void }
type Tree = { rootNode: SyntaxNode; delete(): void }
type SyntaxNode = {
  readonly type: string; readonly text: string; readonly childCount: number
  child(index: number): SyntaxNode | null; descendantsOfType(type: string): SyntaxNode[]
}

// Lazy parser init – single background attempt, never rejects
let parserInit: Promise<Parser | null> | null = null
// undefined=not tried, null=failed
let parserReady: Parser | null | undefined

const resolveWasm = (asset: string): string => {
  if (asset.startsWith("file://")) return fileURLToPath(asset)
  if (asset.startsWith("/") || /^[a-z]:/i.test(asset)) return asset
  return fileURLToPath(new URL(asset, import.meta.url))
}

const initParser = async (): Promise<Parser | null> => {
  try {
    const { Parser: ParserCls } = await import("web-tree-sitter")
    const { default: treeWasm } = await import(
      // eslint-disable-next-line unicorn/prefer-export-from
      "web-tree-sitter/tree-sitter.wasm" as string,
      { with: { type: "wasm" } },
    )
    await ParserCls.init({ locateFile: () => resolveWasm(treeWasm) })
    const { Language: LangCls } = await import("web-tree-sitter")
    const { default: bashWasm } = await import(
      // eslint-disable-next-line unicorn/prefer-export-from
      "tree-sitter-bash/tree-sitter-bash.wasm" as string,
      { with: { type: "wasm" } },
    )
    const bashLang = await LangCls.load(resolveWasm(bashWasm))
    const p = new ParserCls()
    p.setLanguage(bashLang)
    return p as unknown as Parser
  } catch {
    return null
  }
}

const getParser = async (): Promise<Parser | null> => {
  if (parserReady !== undefined) return parserReady
  parserInit ??= initParser()
  parserReady = await parserInit
  return parserReady
}
// vMK: Defer WASM init to first use — saves 50-200ms from startup critical path.
// Regex fallback in bash.ts handles the case when parser is not yet ready.

// AST sets
const DESTRUCTIVE_COMMANDS = new Set(["mkfs", "mkswap", "dd"])
const SYSTEM_COMMANDS = new Set(["shutdown", "reboot", "halt", "poweroff"])
const PIPED_DOWNLOADERS = new Set(["curl", "wget", "fetch"])
const PIPED_SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh"])

const astDangerCheck = (parser: Parser, command: string): string | undefined => {
  const tree = parser.parse(command)
  try { return walkRoot(tree.rootNode) } finally { tree.delete() }
}

const checkBlockDeviceRedirect = (node: SyntaxNode): string | undefined => {
  for (const redir of node.descendantsOfType("file_redirect")) {
    const m = redir.text.match(/(\/dev\/(sda|sdb|sdc|nvme|hda|zero|random))/i)
    if (m) return `direct block device write (${m[1]})`
  }
  return undefined
}

const checkCommand = (name: string, cmd: SyntaxNode): string | undefined => {
  if (name === "rm" && hasArg(cmd, "-rf", "--recursive") && hasRootArg(cmd)) return "rm -rf / (recursive root delete)"
  if (name === "rm" && hasArg(cmd, "--no-preserve-root")) return "rm --no-preserve-root (bypasses safety)"
  if (DESTRUCTIVE_COMMANDS.has(name) || name.startsWith("mkfs.")) {
    if (name === "dd") {
      if (hasArg(cmd, "if=/dev/zero") || hasArg(cmd, "if=/dev/urandom")) return "disk fill with dd"
      return undefined
      // only block dd with fill patterns (regex parity)
    }
    return `${name} (destructive filesystem command)`
  }
  if (SYSTEM_COMMANDS.has(name)) return `${name} (system state change)`
  if (name === "chmod" && hasArg(cmd, "-R") && hasArg(cmd, "777") && hasArg(cmd, "/")) return "recursive world-writable root"
  if (name === "chown" && hasArg(cmd, "-R") && hasArg(cmd, "/")) return "recursive root ownership change"
  return undefined
}

const checkPrivilegedCommand = (name: string, cmd: SyntaxNode): string | undefined => {
  if (name !== "sudo" && name !== "doas") return undefined
  const inner = getInnerCommand(cmd)
  if (inner) {
    if (inner.name === "rm" && hasArg(inner.node, "-rf", "--recursive") && hasRootArg(inner.node)) return `${name} rm -rf / (privileged recursive root delete)`
    if (inner.name && SYSTEM_COMMANDS.has(inner.name)) return `${name} ${inner.name} (privileged system state change)`
    if (inner.name === "dd" && (hasArgPrefix(inner.node, "if=/dev/zero") || hasArgPrefix(inner.node, "if=/dev/urandom"))) return `${name} dd (privileged disk fill)`
    return undefined
  }
  // Case 2: flat words (e.g. 'sudo rm -rf /' — all direct children of command node)
  const words = getWordArgs(cmd)
  const innerName = words[0]
  if (!innerName) return undefined
  if (innerName === "rm" && words.includes("-rf") && (words.includes("/") || words.some((w) => w.startsWith("/*")))) return `${name} rm -rf / (privileged recursive root delete)`
  if (DESTRUCTIVE_COMMANDS.has(innerName) || innerName.startsWith("mkfs.")) return `${name} ${innerName} (privileged destructive command)`
  if (SYSTEM_COMMANDS.has(innerName)) return `${name} ${innerName} (privileged system state change)`
  if (innerName === "dd" && (words.some((w) => w.startsWith("if=/dev/zero") || w.startsWith("if=/dev/urandom")))) return `${name} dd (privileged disk fill)`
  return undefined
}

const checkPipeline = (pipe: SyntaxNode, pipeCmds: ReadonlyArray<CommandInPipe>): string | undefined => {
  if (pipeCmds.length < 2) return undefined
  const firstCmd = pipeCmds[0]
  const lastCmd = pipeCmds.at(-1)
  if (!firstCmd || !lastCmd) return undefined
  if (firstCmd.name && PIPED_DOWNLOADERS.has(firstCmd.name) && lastCmd.name && PIPED_SHELLS.has(lastCmd.name)) return "pipe remote script to shell"

  const hasSudo = pipeCmds.some((c) => c?.name === "sudo")
  const hasShell = pipeCmds.some((c) => {
    if (!c) return false
    if (c.name && PIPED_SHELLS.has(c.name)) return true
    if (c.name === "sudo" || c.name === "doas") return getWordArgs(c.node).some((w) => PIPED_SHELLS.has(w))
    return false
  })
  if (hasSudo && hasShell && firstCmd.name && PIPED_DOWNLOADERS.has(firstCmd.name)) return "pipe remote script to shell (sudo)"
  return undefined
}

const walkRoot = (node: SyntaxNode): string | undefined => {
  for (const cmd of node.descendantsOfType("command")) {
    const name = getCommandName(cmd)
    if (!name) continue
    const danger = checkCommand(name, cmd) ?? checkPrivilegedCommand(name, cmd)
    if (danger) return danger
  }
  for (const pipe of node.descendantsOfType("pipeline")) {
    const danger = checkPipeline(pipe, getPipelineCommands(pipe))
    if (danger) return danger
  }
  return checkBlockDeviceRedirect(node)
}

const getCommandName = (node: SyntaxNode): string | undefined => {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child?.type === "command_name") return child.child(0)?.text ?? child.text
  }
  return undefined
}

const hasArg = (node: SyntaxNode, ...values: string[]): boolean => {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (!child || (child.type !== "word" && child.type !== "number")) continue
    if (values.includes(child.text)) return true
  }
  return false
}

const hasRootArg = (node: SyntaxNode): boolean => {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (!child || (child.type !== "word" && child.type !== "number")) continue
    if (child.text === "/" || child.text.startsWith("/*")) return true
  }
  return false
}

const hasArgPrefix = (node: SyntaxNode, prefix: string): boolean => {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (!child || child.type !== "word") continue
    if (child.text.startsWith(prefix)) return true
  }
  return false
}

type CommandInPipe = { name: string | undefined; node: SyntaxNode }

const getInnerCommand = (node: SyntaxNode): CommandInPipe | undefined => {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (!child || child.type !== "command") continue
    const name = getCommandName(child)
    if (name) return { name, node: child }
  }
  return undefined
}

const getPipelineCommands = (node: SyntaxNode): CommandInPipe[] => {
  const cmds: CommandInPipe[] = []
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (!child || child.type !== "command") continue
    cmds.push({ name: getCommandName(child), node: child })
  }
  return cmds
}

const getWordArgs = (node: SyntaxNode): string[] => {
  const args: string[] = []
  let seenName = false
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (!child) continue
    if (child.type === "command_name") { seenName = true; continue }
    if (!seenName) continue
    if (child.type === "word" || child.type === "number") args.push(child.text)
  }
  return args
}

// Public API

/**
 * Try to detect dangerous patterns in a shell command using tree-sitter AST.
 * Returns undefined when the parser isn't ready, failed, or the command is safe.
 * Caller should fall back to regex-based detection when this returns undefined.
 */
export const tryAstCheck = (command: string): string | undefined => {
  if (parserReady === null) return undefined // init failed
  if (parserReady === undefined) {
    // vMK: first use — trigger init (non-blocking), fall back to regex for this call
    void getParser()
    return undefined
  }
  return astDangerCheck(parserReady, command)
}

export const parserStatus = (): "ready" | "pending" | "failed" => {
  if (parserReady === undefined) return "pending"
  if (parserReady === null) return "failed"
  return "ready"
}
