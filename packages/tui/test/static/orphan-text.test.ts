/**
 * Static analysis: detect orphan text in TUI JSX.
 *
 * In the OpenTUI framework, raw text as a direct child of <box>
 * causes: "Orphan text error: '...' must have a <text> as a parent"
 *
 * Scans all .tsx files for violations and reports line-level findings.
 *
 * ERROR  — definitively produces orphan text (blocking)
 * WARNING — expression-as-child that could resolve to a string at runtime
 */
import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "fs"
import { join, relative } from "path"

const TUI_SRC = join(import.meta.dir, "../../src")

function collectFiles(dir: string, pattern: RegExp, root = dir): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectFiles(full, pattern, root))
    } else if (pattern.test(entry.name)) {
      files.push(relative(root, full))
    }
  }
  return files.sort()
}

describe("TUI orphan text detection", () => {
  const files = collectFiles(TUI_SRC, /\.tsx$/).map((f) => f.replace(/\\/g, "/"))

  /**
   * ERROR: inline raw text or expression-after-box on same line
   *
   * Catches: <box>text</box>, <box> text</box>, <box>123</box>, <box>•</box>
   * Ignores: <box><text>…</text></box>, <box>{expr}</box>, <box />
   * Also catches: <box>{props.children} more-text</box> (text after a valid expression
   * that starts with text not preceded by template-literal whitespace).
   */
  const RAW_TEXT_AFTER_BOX = /<box>\s*[^<{/\s]/i

  /**
   * Multiline: line ending with <box> or <box …> followed by a line
   * that contains raw text (does NOT start with <, {, }, or </).
   */
  const BOX_END_RE = /<box[^>]*>\s*$/
  const CLOSING_ONLY = /^[\s)\]}\/]+$/

  /**
   * WARNING patterns: {props.xxx} directly inside <box>.
   *
   * SolidJS JSX.Element includes string, so any bare props-as-child of <box>
   * COULD produce orphan text at runtime if a caller passes a string.
   *
   * These are manually curated and LOGGED as warnings (not errors) because
   * the risk is low — callers typically pass JSX elements.
   *
   * When adding entries, verify that the typed value is JSX.Element and
   * all callers pass valid JSX elements (not strings).
   */
  const KNOWN_LOW_RISK: Record<string, number[]> = {
    "ui/dialog-select.tsx": [515, 669, 712], // titleView?, footer?, gutter?.()
    "component/prompt/index.tsx": [1494], // {props.right}
    "routes/session/permission.tsx": [661, 664], // {props.header}, {props.body}
  }

  for (const file of files) {
    test(`${file} has no orphan text inside <box>`, () => {
      const content = readFileSync(join(TUI_SRC, file), "utf-8")
      const lines = content.split("\n")
      const errors: { line: number; text: string }[] = []
      const warnings: { line: number; text: string }[] = []

      for (let i = 0; i < lines.length; i++) {
        const stripped = lines[i].replace(/\/\*.*?\*\//g, "").replace(/\/\/.*$/, "")

        // 1. Inline raw text after <box> on same line
        if (RAW_TEXT_AFTER_BOX.test(stripped)) {
          errors.push({ line: i + 1, text: lines[i].trim() })
        }

        // 2. Multiline — <box> on line N, text on line N+1
        if (i < lines.length - 1) {
          const trimmed = stripped.trimEnd()
          if (BOX_END_RE.test(trimmed)) {
            const nextLine = lines[i + 1].trim()
            if (
              nextLine.length > 0 &&
              !nextLine.startsWith("<") &&
              !nextLine.startsWith("{") &&
              !nextLine.startsWith("}") &&
              !nextLine.startsWith("</") &&
              !CLOSING_ONLY.test(nextLine)
            ) {
              errors.push({
                line: i + 2,
                text: `multiline orphan: "${nextLine.substring(0, 60)}"`,
              })
            }
          }
        }
      }

      // Check known low-risk patterns (warnings only)
      const fileRisks = KNOWN_LOW_RISK[file]
      if (fileRisks) {
        for (const ln of fileRisks) {
          const idx = ln - 1
          if (idx >= 0 && idx < lines.length) {
            warnings.push({ line: ln, text: `LOW RISK: "${lines[idx].trim()}"` })
          }
        }
      }

      if (warnings.length > 0) {
        console.warn(`\n  ⚠ ${file}: ${warnings.length} low-risk pattern(s):`)
        for (const w of warnings) {
          console.warn(`    L${w.line}: ${w.text}`)
        }
      }

      expect(errors).toEqual([])
    })
  }
})
