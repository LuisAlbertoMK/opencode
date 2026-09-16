import { Filesystem } from "@/util/filesystem"
import { FrontmatterError } from "@opencode-ai/core/v1/config/error"
import { ConfigMarkdown as ConfigMarkdownCore } from "@opencode-ai/core/config/markdown"

export const FILE_REGEX = /(?<![\w`])@(\.?[^\s`,.]*(?:\.[^\s`,.]+)*)/g
export const SHELL_REGEX = /!`([^`]+)`/g

// ciclo1-exp20: memo files with LRU 64 for string templates, WeakMap for objects
const filesStringCache = new Map<string, RegExpMatchArray[]>()
const filesWeakCache = new WeakMap<object, RegExpMatchArray[]>()
const FILES_CACHE_LIMIT = 64
export function files(template: string) {
  if (typeof template !== "string") {
    const obj = template as unknown as object
    const cachedWeak = filesWeakCache.get(obj)
    if (cachedWeak) return cachedWeak
    const resultWeak = Array.from((template as unknown as string).matchAll(FILE_REGEX))
    filesWeakCache.set(obj, resultWeak)
    return resultWeak
  }
  const cached = filesStringCache.get(template)
  if (cached) return cached
  const result = Array.from(template.matchAll(FILE_REGEX))
  if (filesStringCache.size >= FILES_CACHE_LIMIT) {
    const firstKey = filesStringCache.keys().next().value
    if (firstKey !== undefined) filesStringCache.delete(firstKey)
  }
  filesStringCache.set(template, result)
  return result
}

export function shell(template: string) {
  return Array.from(template.matchAll(SHELL_REGEX))
}

// other coding agents like claude code allow invalid yaml in their
// frontmatter, we need to fallback to a more permissive parser for those cases
export const fallbackSanitization = ConfigMarkdownCore.sanitize

export async function parse(filePath: string) {
  const template = await Filesystem.readText(filePath)

  try {
    return ConfigMarkdownCore.parse(template)
  } catch (err) {
    throw new FrontmatterError(
      {
        path: filePath,
        message: `${filePath}: Failed to parse YAML frontmatter: ${err instanceof Error ? err.message : String(err)}`,
      },
      { cause: err },
    )
  }
}

export * as ConfigMarkdown from "./markdown"
