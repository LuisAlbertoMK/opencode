# PR stack handoff — CLI startup (3 stacked PRs)

This bundle lets a team with repository permissions create, verify, and merge the stacked PRs. No code changes are included here — only documentation with exact bases, heads, compare links, and verification steps.

## Stack order (merge strictly 1 -> 2 -> 3)

| # | Base | Compare (head) | Head SHA | Compare URL | Doc |
|---|------|----------------|----------|-------------|-----|
| 1 | `dev` | `startup-diet` | `5684b02e8` | https://github.com/LuisAlbertoMK/opencode/compare/dev...startup-diet?expand=1 | `PR1-startup-diet.md` |
| 2 | `startup-diet` | `yargs-lazy` | `14c155a84` | https://github.com/LuisAlbertoMK/opencode/compare/startup-diet...yargs-lazy?expand=1 | `PR2-yargs-lazy.md` |
| 3 | `yargs-lazy` | `tui-parallel` | `77c3e7e34` | https://github.com/LuisAlbertoMK/opencode/compare/yargs-lazy...tui-parallel?expand=1 | `PR3-tui-parallel.md` |

Rule: each PR's base is the previous PR's head. Merging out of order will conflict or misrepresent the diff. Merge 1, then 2, then 3.

## Full commit list (8 commits, bottom -> top)

- `f00b00585` refactor(cli): fast-path version output before command graph (PR1)
- `d7540d288` refactor(tui): lazy-load terminal error utils (PR1)
- `5684b02e8` refactor(cli): lazy-load heavy command dependencies (PR1)
- `c525970f5` refactor(cli): lazy-load yargs command registration (PR2)
- `d505a2b16` test(cli): yargs registration metadata parity (PR2)
- `14c155a84` test(cli): startup time budget harness (PR2)
- `b9055288a` refactor(cli): parallelize tui handler imports (PR3)
- `77c3e7e34` test(cli): fix parity test types (PR3)

## How the receiving team creates the PRs

1. Open each compare URL in a browser (authenticated with permission to create PRs).
2. Confirm the base/compare pair and commit count match the table above.
3. Click "Create pull request", paste the suggested title and body from the corresponding `PR*.md` file.
4. Create PR1 first, then PR2 (base `startup-diet`), then PR3 (base `yargs-lazy`).
5. Merge in order 1 -> 2 -> 3. Do not squash across stack boundaries in a way that rewrites the intermediate bases before the next PR merges; if GitHub offers "update branch", use it so each child tracks its parent.

## How the receiving team verifies (before each merge)

- Parity test: 24 pass (`packages/opencode/test/cli/yargs-metadata-parity.test.ts`).
- `opencode:typecheck`: green.
- Spot-check SHAs:
  - `git rev-parse --verify startup-diet` → `5684b02e8…`
  - `git rev-parse --verify yargs-lazy` → `14c155a84…`
  - `git rev-parse --verify tui-parallel` → `77c3e7e34…`
- Confirm diff stats per PR doc (PR1: 6 files +146/-121; PR2: 5 files +432/-117; PR3: 2 files +18/-8).

## Pre-existing debts (do NOT gate the stack on these)

- `instance-bootstrap.test.ts` fails identically on a pristine checkout — pre-existing, unrelated.
- `enterprise/custom-elements.d.ts` triggers a broken pre-push hook on pristine — pre-existing, unrelated.
- `yargs` populate of `--` and `bun --` forwarding semantics are pre-existing behavior, intentionally out of scope.
- Startup floor is ~600ms process spawn plus antivirus variance; sub-400ms is unachievable in this environment — the budget harness (PR2) is a measurement tool, not a sub-400ms guarantee.

## Notes

- Source repository: https://github.com/LuisAlbertoMK/opencode
- This handoff was prepared from branch `tui-parallel` without switching branches, committing, or pushing.
- If a compare URL shows unexpected commits, stop: the stack moved. Reconcile SHAs before creating PRs.
