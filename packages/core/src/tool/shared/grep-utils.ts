// vMK: shared utility — grep output formatting for V1 + V2 tools
/**
 * Format grep match results into a human-readable string for LLM consumption.
 *
 * Both V1 (`core/src/tool/grep.ts`) and V2 (`opencode/src/tool/grep.ts`) tools
 * share the same output format pattern. This utility ensures consistent rendering
 * across implementations.
 *
 * Output format:
 *   Found N matches
 *   path/to/file:
 *     Line X: text
 *     Line Y: text
 *
 *   another/file.ts:
 *     Line Z: text
 *
 * @param matches — Array of grep matches with absolute paths, line numbers, and text.
 * @param total — Total number of matches (before truncation).
 * @param truncated — Whether results were truncated.
 * @returns Formatted string ready for model output or tool response.
 */
export function formatGrepOutput(
  matches: Array<{ path: string; line: number; text: string }>,
  total: number,
  truncated: boolean,
): string {
  if (matches.length === 0) return "No files found"

  const lines: string[] = [`Found ${total} matches${truncated ? " (more matches available)" : ""}`]
  let current = ""
  for (const match of matches) {
    if (current !== match.path) {
      if (current !== "") lines.push("")
      current = match.path
      lines.push(`${match.path}:`)
    }
    lines.push(`  Line ${match.line}: ${match.text}`)
  }

  if (truncated) {
    lines.push("")
    lines.push("(Results truncated. Consider using a more specific path or pattern.)")
  }

  return lines.join("\n")
}
