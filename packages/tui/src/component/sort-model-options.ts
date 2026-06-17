import { sortBy } from "remeda"

/**
 * Sorted model options by release date (newest first) or by "Free" status + title.
 * Extracted to its own module to break the circular dependency between
 * dialog-model.tsx ↔ dialog-provider.tsx, which caused a TDZ crash
 * when bun compiled the hoisted `function` declaration to `const`.
 */
export function sortModelOptions<T extends { footer?: string; releaseDate: string | number; title: string }>(
  options: T[],
  newestFirst: boolean,
) {
  if (newestFirst) return sortBy(options, [(option) => option.releaseDate, "desc"], (option) => option.title)
  return sortBy(
    options,
    (option) => option.footer !== "Free",
    (option) => option.title,
  )
}
