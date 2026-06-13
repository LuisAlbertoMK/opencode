import path from "path"

const SEP = "/"

export function abbreviateHome(input: string, home: string) {
  if (!home) return input
  const relative = normalizePath(path.relative(home, input))
  if (relative === "") return "~"
  if (relative === ".." || relative.startsWith("../") || path.isAbsolute(relative)) return input
  return "~" + SEP + relative
}

function normalizePath(p: string) {
  return p.split(path.sep).join(SEP)
}
