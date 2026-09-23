# PR3: tui-parallel — parallelize TUI handler imports

- **Base:** `yargs-lazy`
- **Compare:** `tui-parallel`
- **Head SHA:** `77c3e7e34`
- **Compare URL:** https://github.com/LuisAlbertoMK/opencode/compare/yargs-lazy...tui-parallel?expand=1
- **Suggested PR title:** `refactor(cli): parallelize TUI handler imports`

## Body (suggested, paste into PR description)

Stacked PR 3 of 3 (must merge after PR1 and PR2). Parallelizes the TUI handler imports and fixes parity test types.

### Commits (2)

- `b9055288a` refactor(cli): parallelize tui handler imports
- `77c3e7e34` test(cli): fix parity test types

### Files changed (2 files, +18/-8)

- `packages/opencode/src/cli/cmd/tui.ts`
- `packages/opencode/test/cli/yargs-metadata-parity.test.ts`

### What it does

- Loads independent TUI handler imports in parallel instead of serially.
- Fixes parity test type errors so the metadata guard stays green.

### Out of scope (pre-existing)

- No behavior change to command metadata; parity test still locks it (24 pass).
- `instance-bootstrap.test.ts` pristine failure, `enterprise/custom-elements.d.ts` broken pre-push hook, `yargs`/`bun` `--` semantics, and the ~600ms spawn + AV floor (<400ms unachievable) all remain pre-existing and out of scope.

## Verification checklist (for the receiving team)

- [ ] Open the compare URL above and confirm base `yargs-lazy`, compare `tui-parallel`, 2 commits, 2 files.
- [ ] `git rev-parse --verify tui-parallel` returns `77c3e7e34…`.
- [ ] Run the parity test: 24 pass.
- [ ] Run `opencode:typecheck`: green.
- [ ] Merge order: merge last (sequence 1 -> 2 -> 3). Verify the stack top equals `tui-parallel` before merging.
