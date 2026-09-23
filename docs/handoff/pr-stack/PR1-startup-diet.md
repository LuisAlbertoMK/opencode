# PR1: startup-diet — lazy-load heavy CLI dependencies

- **Base:** `dev`
- **Compare:** `startup-diet`
- **Head SHA:** `5684b02e8`
- **Compare URL:** https://github.com/LuisAlbertoMK/opencode/compare/dev...startup-diet?expand=1
- **Suggested PR title:** `refactor(cli): startup diet — lazy-load heavy CLI dependencies`

## Body (suggested, paste into PR description)

Stacked PR 1 of 3. Reduces CLI startup cost by deferring heavy imports until they are actually needed.

### Commits (3)

- `f00b00585` refactor(cli): fast-path version output before command graph
- `d7540d288` refactor(tui): lazy-load terminal error utils
- `5684b02e8` refactor(cli): lazy-load heavy command dependencies

### Files changed (6 files, +146/-121)

- `packages/opencode/src/cli/bootstrap.ts`
- `packages/opencode/src/cli/cmd/agent.ts`
- `packages/opencode/src/cli/cmd/attach.ts`
- `packages/opencode/src/cli/cmd/github.handler.ts`
- `packages/opencode/src/cli/cmd/tui.ts`
- `packages/opencode/src/index.ts`

### What it does

- Fast-path `--version` output before building the command graph.
- Lazy-loads terminal error utils in the TUI path.
- Lazy-loads heavy command dependencies (`agent`, `attach`, `github.handler`, `tui`) so plain invocations do not pay for them.

### Out of scope (pre-existing)

- `yargs` populate of `--` and `bun --` forwarding semantics are pre-existing behavior and intentionally untouched here (covered by PR2 context where applicable).
- `instance-bootstrap.test.ts` fails identically on a pristine checkout (pre-existing, unrelated).
- `enterprise/custom-elements.d.ts` triggers a broken pre-push hook on pristine (pre-existing, unrelated).
- Startup floor is ~600ms process spawn plus antivirus variance; sub-400ms is unachievable in this environment.

## Verification checklist (for the receiving team)

- [ ] Open the compare URL above and confirm base `dev`, compare `startup-diet`, 3 commits, 6 files.
- [ ] `git rev-parse --verify startup-diet` returns `5684b02e8…`.
- [ ] Run the CLI parity test: 24 pass.
- [ ] Run `opencode:typecheck`: green.
- [ ] Merge order: merge this PR first (1 -> 2 -> 3). Do NOT merge PR2/PR3 before this one.
