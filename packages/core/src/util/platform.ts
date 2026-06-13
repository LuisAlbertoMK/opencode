export const isWindows = process.platform === "win32"
export const isMac = process.platform === "darwin"
export const isLinux = process.platform === "linux"

export const WINDOWS = "win32"
export const MAC = "darwin"
export const LINUX = "linux"

export const ext = isWindows ? ".exe" : ""
export const cmdExt = isWindows ? ".cmd" : ""
export const scriptExt = isWindows ? ".bat" : ".sh"
export const binName = (name: string) => name + ext
export const cmdName = (name: string) => name + cmdExt
