// vMK: Shared read tool utilities for V1/V2 consolidation.
// Pure functions and constants used by both packages/core (V1) and packages/opencode (V2).
import path from "path"

// ---- Constants ----

/** Default maximum number of lines/entries returned by a read/list operation */
export const DEFAULT_READ_LIMIT = 2000

/** Maximum total bytes across all returned lines */
export const MAX_READ_BYTES = 50 * 1024

/** Individual line length cap before truncation */
export const MAX_LINE_LENGTH = 2000

/** Suffix appended to truncated lines */
export const MAX_LINE_SUFFIX = `... (line truncated to ${MAX_LINE_LENGTH} chars)`

/** Image MIME types supported for inline display (base64 data URL) */
export const SUPPORTED_IMAGE_MIMES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
])

// ---- Binary File Detection ----

/** File extensions treated as definitively binary (no content inspection needed) */
export const BINARY_FILE_EXTENSIONS: ReadonlySet<string> = new Set([
  ".zip",
  ".tar",
  ".gz",
  ".exe",
  ".dll",
  ".so",
  ".class",
  ".jar",
  ".war",
  ".7z",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".odt",
  ".ods",
  ".odp",
  ".bin",
  ".dat",
  ".obj",
  ".o",
  ".a",
  ".lib",
  ".wasm",
  ".pyc",
  ".pyo",
])

/** Check if a byte array matches a known magic-byte prefix */
export function matchesMagicBytes(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((value, index) => bytes[index] === value)
}

/**
 * Determine whether a file is binary by checking its extension and content.
 * First checks if the extension is in the known binary list, then scans the
 * first bytes for null bytes and non-printable character ratio (>30%).
 */
export function isBinaryFile(filepath: string, bytes: Uint8Array): boolean {
  const ext = path.extname(filepath).toLowerCase()
  if (BINARY_FILE_EXTENSIONS.has(ext)) return true
  if (bytes.length === 0) return false
  let nonPrintable = 0
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) return true
    if (bytes[i] < 9 || (bytes[i] > 13 && bytes[i] < 32)) nonPrintable++
  }
  return nonPrintable / bytes.length > 0.3
}
