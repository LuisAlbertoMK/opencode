# PR2: yargs-lazy — lazy-load yargs command registration + parity tests

- **Base:** `startup-diet`
- **Compare:** `yargs-lazy`
- **Head SHA:** `14c155a84`
- **Compare URL:** https://github.com/LuisAlbertoMK/opencode/compare/startup-diet...yargs-lazy?expand=1
- **Suggested PR title:** `refactor(cli): lazy-load yargs command registration`

## Body (suggested, paste into PR description)

Stacked PR 2 of 3 (must merge after PR1). Defers yargs command registration behind lazy loading and adds guards against metadata drift plus a startup time budget harness.

### Commits (3)

- `c525970f5` refactor(cli): lazy-load yargs command registration
- `d505a2b16` test(cli): yargs registration metadata parity
- `14c155a84` test(cli): startup time budget harness

### Files changed (5 files, +432/-117)

- `packages/opencode/script/startup-budget.ts` (new: startup time budget harness)
- `packages/opencode/src/cli/bootstrap.ts`
- `packages/opencode/src/cli/cmd/tui.options.ts` (new: extracted TUI options metadata)
- `packages/opencode/src/cli/cmd/tui.ts`
- `packages/opencode/test/cli/yargs-metadata-parity.test.ts` (new: registration metadata parity)

### What it does

- Moves yargs command registration to lazy loading in `bootstrap.ts`.
- Extracts shared TUI options metadata into `tui.options.ts` so lazy and eager paths cannot drift.
- Adds `yargs-metadata-parity` test to lock registration metadata.
- Adds `script/startup-budget.ts` harness to track startup time.

### Out of scope (pre-existing)

- `yargs` populate of `--` and `bun --` forwarding semantics are pre-existing and out of scope.
- `instance-bootstrap.test.ts` fails identically on pristine (pre-existing, unrelated).
- `enterprise/custom-elements.d.ts` broken pre-push hook (pre-existing, unrelated).
- Startup floor ~600ms spawn + AV variance; <400ms is unachievable — the budget harness measures, it does not promise sub-400ms.

## Verification checklist (for the receiving team)

- [ ] Open the compare URL above and confirm base `startup-diet`, compare `yargs-lazy`, 3 commits, 5 files.
- [ ] `git rev-parse --verify yargs-lazy` returns `14c155a84…`.
- [ ] Run the parity test: 24 pass (`packages/opencode/test/cli/yargs-metadata-parity.test.ts`).
- [ ] Run `opencode:typecheck`: green.
- [ ] Merge order: merge only after PR1 (sequence 1 -> 2 -> 3). Do NOT merge before PR1 or after PR3.
