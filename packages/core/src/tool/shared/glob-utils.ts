// vMK: shared utility — glob directory resolution for V1 + V2 tools
import path from "path"

/**
 * Resolve the effective search directory for a glob operation.
 *
 * Both V1 (`core/src/tool/glob.ts`) and V2 (`opencode/src/tool/glob.ts`) tools
 * need to resolve a user-provided relative path against a base directory. This
 * utility ensures consistent behavior across implementations.
 *
 * @param basedir — The base directory (e.g., `location.directory` or `ins.directory`).
 * @param inputPath — Optional user-provided path; if omitted, uses `basedir`.
 * @returns The absolute search directory.
 */
export function resolveGlobDirectory(basedir: string, inputPath?: string): string {
  const search = inputPath ?? basedir
  return path.isAbsolute(search) ? search : path.resolve(basedir, search)
}

/**
 * Format glob results into a human-readable string for LLM consumption.
 *
 * Used by V2 glob tool's execute return. V1 glob uses `toModelOutput` instead
 * but the formatting logic is identical.
 *
 * @param files — The raw glob results from ripgrep.
 * @param limit — The maximum number of results (for truncation messaging).
 * @param baseDir — The base directory to resolve absolute paths from.
 * @returns An object with `lines` (string[]) and `truncated` (boolean).
 */
export function formatGlobOutput(
  files: Array<{ path: string }>,
  limit: number,
  baseDir: string,
): { output: string; truncated: boolean } {
  const truncated = files.length >= limit
  const output: string[] = []

  if (files.length === 0) {
    output.push("No files found")
  } else {
    output.push(...files.map((file) => path.resolve(baseDir, file.path)))
    if (truncated) {
      output.push("")
      output.push(
        `(Results are truncated: showing first ${limit} results. Consider using a more specific path or pattern.)`,
      )
    }
  }

  return { output: output.join("\n"), truncated }
}
