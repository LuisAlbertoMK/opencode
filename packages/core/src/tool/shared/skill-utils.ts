// vMK: Shared skill utilities for V1/V2 consolidation.
// Pure functions used by both packages/core (V1) and packages/opencode (V2).
import { pathToFileURL } from "url"

/**
 * Format skill content + file listing into the model-consumable XML-like output.
 *
 * Both V1 and V2 skill tools produce the same output structure:
 * - skill_content wrapper with the skill name
 * - The skill content (trimmed)
 * - Base directory as file:// URL
 * - Sampled file listing
 */
export function formatSkillOutput(
  name: string,
  content: string,
  directory: string,
  files: ReadonlyArray<string>,
): string {
  const base = pathToFileURL(directory).href
  return [
    `<skill_content name="${name}">`,
    `# Skill: ${name}`,
    "",
    content.trim(),
    "",
    `Base directory for this skill: ${base}`,
    "Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.",
    "Note: file list is sampled.",
    "",
    "<skill_files>",
    ...files.map((file) => `<file>${file}</file>`),
    "</skill_files>",
    "</skill_content>",
  ].join("\n")
}
