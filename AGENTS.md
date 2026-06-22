# OpenCode Agent Guide

> Entry point for project-level agent rules. Sections are modularized for
> maintainability — see each file below for full details.

## Project Quick Reference

- To regenerate the JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- The default branch in this repo is `dev`.
- Local `main` ref may not exist; use `dev` or `origin/dev` for diffs.

## Branch Names

Use a short branch name of at most three words, separated by hyphens. Do not use slashes or type prefixes such as `feat/` or `fix/`.

Examples: `session-recovery`, `fix-scroll-state`, `regenerate-sdk`.

## Commits and PR Titles

Use conventional commit-style messages and PR titles: `type(scope): summary`.

Valid types are `feat`, `fix`, `docs`, `chore`, `refactor`, and `test`. Scopes are optional; use the affected package or area when helpful, e.g. `core`, `opencode`, `tui`, `app`, `desktop`, `sdk`, or `plugin`.

Examples: `fix(tui): simplify thinking toggle styling`, `docs: update contributing guide`, `chore(sdk): regenerate types`.

## Modules

| Topic | File | Description |
|-------|------|-------------|
| Style Guide | [`.opencode/style-guide.md`](.opencode/style-guide.md) | TS code style: imports, destructuring, control flow, Effect patterns, Drizzle schemas |
| Testing | [`.opencode/testing.md`](.opencode/testing.md) | Test philosophy, mock avoidance, type checking |
| V2 Session Core | [`specs/v2/session.md`](specs/v2/session.md) | Session V2 architecture: prompt admission, execution, delivery, system context |
| Skills Index | [`SKILLS-INDEX.md`](SKILLS-INDEX.md) | Agent skills catalog: installed + roadmap |
| Improvement Cycle | [`CYCLE.md`](CYCLE.md) | Current improvement cycle, metrics, tasks |
