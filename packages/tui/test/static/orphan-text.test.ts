/**
 * Static analysis: detect orphan text in TUI JSX.
 *
 * In the OpenTUI framework, raw text as a direct child of <box>
 * causes: "Orphan text error: '...' must have a <text> as a parent"
 *
 * This test scans all .tsx files for the pattern and fails if found.
 */
import { describe, expect, test, beforeAll } from "bun:test"
import { readFileSync } from "fs"
import { join, relative } from "path"

const TUI_SRC = join(import.meta.dir, "../../src")

function collectFiles(dir: string, pattern: RegExp, root = dir): string[] {
  const entries = require("fs").readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
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
  const files = collectFiles(TUI_SRC, /\.tsx$/)

  /**
   * Single-line: après <box>, vérifier que le premier caractère non-whitespace
   * n'est PAS du texte brut (doit être < { / pour être valide)
   *
   * Catch: <box>text</box>, <box> text</box>, <box>123</box>, <box>• text</box>
   * Ignore: <box><text>...</text></box>, <box>{expr}</box>, <box />
   */
  const RAW_TEXT_AFTER_BOX = /<box>\s*[^<{/\s]/i

  /**
   * Multiline: ligne se terminant par <box ...> suivie d'une ligne
   * avec du texte brut (ne commençant pas par < { } ou /)
   */
  const BOX_END_RE = /<box[^>]*>\s*$/
  const CLOSING_ONLY = /^[\s)\]}\/]+$/

  for (const file of files) {
    test(`${file} has no orphan text inside <box>`, () => {
      const content = readFileSync(join(TUI_SRC, file), "utf-8")
      const lines = content.split("\n")
      const violations: { line: number; text: string }[] = []

      // Check 1: inline — <box> followed by raw text on same line
      for (let i = 0; i < lines.length; i++) {
        const stripped = lines[i].replace(/\/\*.*?\*\//g, "").replace(/\/\/.*$/, "")
        if (RAW_TEXT_AFTER_BOX.test(stripped)) {
          violations.push({ line: i + 1, text: lines[i].trim() })
        }
      }

      // Check 2: multiline — <box> on line N, text on line N+1
      for (let i = 0; i < lines.length - 1; i++) {
        // Strip comments before checking to avoid false positives
        const stripped = lines[i].replace(/\/\*.*?\*\//g, "").replace(/\/\/.*$/, "").trimEnd()
        if (BOX_END_RE.test(stripped)) {
          const nextLine = lines[i + 1].trim()
          if (
            nextLine.length > 0 &&
            !nextLine.startsWith("<") &&
            !nextLine.startsWith("{") &&
            !nextLine.startsWith("}") &&
            !nextLine.startsWith("</") &&
            !CLOSING_ONLY.test(nextLine)
          ) {
            violations.push({
              line: i + 2,
              text: `multiline orphan: "${nextLine.substring(0, 60)}"`,
            })
          }
        }
      }

      expect(violations).toEqual([])
    })
  }
})
