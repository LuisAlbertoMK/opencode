export * as Token from "./token"

const CHARS_PER_TOKEN = 4

const estimateCache = new Map<string, number>()
const CACHE_MAX = 500

export const estimate = (input: string) => {
  const cached = estimateCache.get(input)
  if (cached !== undefined) return cached
  const result = Math.max(0, Math.round(input.length / CHARS_PER_TOKEN))
  if (estimateCache.size >= CACHE_MAX) {
    const firstKey = estimateCache.keys().next()
    if (firstKey.value !== undefined) estimateCache.delete(firstKey.value)
  }
  estimateCache.set(input, result)
  return result
}
