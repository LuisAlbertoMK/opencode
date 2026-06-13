export const isWindows = process.platform === "win32"
export const isMac = process.platform === "darwin"
export const isLinux = process.platform === "linux"

export const WINDOWS = "win32"
export const MAC = "darwin"
export const LINUX = "linux"

// Binary / script extensions
export const ext = isWindows ? ".exe" : ""
export const cmdExt = isWindows ? ".cmd" : ""
export const scriptExt = isWindows ? ".bat" : ".sh"
export const binName = (name: string) => name + ext
export const cmdName = (name: string) => name + cmdExt

// Child process spawn options
export const detached = !isWindows
export const windowsHide = isWindows

// Shell defaults
export const defaultShell = () => (isWindows ? (process.env.COMSPEC ?? "cmd.exe") : "/bin/sh")
export const defaultShellArgs = isWindows ? ["/c"] : ["-lc"]

// Terminal
export const terminalSuspend = !isWindows

// Filesystem quirks
export const caseInsensitiveFs = isWindows
export const normalizePath = (p: string) => (isWindows ? p.toLowerCase() : p)
export const attempts = isWindows ? 50 : 5

// Toolkit paths
export const rgName = isWindows ? "rg.exe" : "rg"
export const illegalChars = isWindows ? new Set(["<", ">", ":", '"', "|", "?", "*"]) as Set<string> | undefined : undefined

// Wildcard / regex
export const wildcardFlags = isWindows ? "si" : "s"

// Namespace re-export per codebase convention (allows `import { Platform }`)
export * as Platform from "./platform"
