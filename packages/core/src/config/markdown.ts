export * as ConfigMarkdown from "./markdown"

import { inspect } from "node:util"
import matter from "gray-matter"
export function parse(content: string) {
  try {
    return matter(content)
  } catch (e) {
    // vMK: log parse error before retry with sanitized content
    console.warn("ConfigMarkdown.parse failed, retrying with sanitized content:", inspect(e))
    return matter(sanitize(content))
  }
}

export function parseOption(content: string) {
  try {
    return parse(content)
  } catch (e) {
    // vMK: log parse failure before returning undefined
    console.warn("ConfigMarkdown.parseOption failed, returning undefined:", inspect(e))
    return undefined
  }
}

// Other coding agents accept unquoted colons in frontmatter values. Retry
// those values as YAML block scalars so existing config files keep working.
export function sanitize(content: string) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return content
  const frontmatter = match[1]!
  const result = frontmatter.split(/\r?\n/).flatMap((line) => {
    if (line.trim().startsWith("#") || line.trim() === "" || /^\s+/.test(line)) return [line]
    const entry = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/)
    if (!entry) return [line]
    const value = entry[2]!.trim()
    if (value === "" || value === ">" || value === "|" || value.startsWith('"') || value.startsWith("'")) return [line]
    if (!value.includes(":")) return [line]
    return [`${entry[1]!}: |-`, `  ${value}`]
  })
  return content.replace(frontmatter, () => result.join("\n"))
}
