# vMK vs Original — Comparison Benchmark

> Script: `.\scripts\vmk-compare.ps1`

## Purpose

Runs the same battery of tests on **both** the original opencode binary (npm global install)
and the vMK fork binary, then displays a side-by-side comparison table.

Use this to detect regressions or improvements when iterating on vMK changes.

## Quick Start

```powershell
# Default: 3 cold-boot runs
.\scripts\vmk-compare.ps1

# More precise: 5 runs with per-run timings
.\scripts\vmk-compare.ps1 -Runs 5 -Verbose

# Named run (affects output filename)
.\scripts\vmk-compare.ps1 -Label "post-cycle6"
```

## What It Measures

| # | Test | What It Checks |
|:-:|:-----|:---------------|
| 1 | **Binary Size** | File size in MB |
| 2 | **Cold Boot** | Time to show `--help` from cold start (avg/min/max of N runs) |
| 3 | **`--version`** | Exit code + version string |
| 4 | **`providers list`** | Timing + exit code + output length |
| 5 | **`models`** | Timing + exit code + line count |
| 6 | **`serve` 3s** | Starts headless server, verifies it stays alive 3+ seconds |

## Auto-Detected Paths

| Binary | Default Location |
|:-------|:-----------------|
| **Original** | `$env:APPDATA\npm\node_modules\opencode-ai\bin\opencode.exe` |
| **vMK** | `packages/opencode/dist/opencode-windows-x64/bin/opencode-vMK.exe` |

Override with `-OriginalPath` / `-VmkPath` if your binaries live elsewhere:

```powershell
.\scripts\vmk-compare.ps1 -OriginalPath "D:\custom\opencode.exe" -VmkPath "D:\custom\opencode-vMK.exe"
```

## Output

### Console

Side-by-side table with all metrics and a final verdict:

```
  Metric         Original         vMK               Δ Difference
  ------------------------------------------------------------------
  Binary Size      158.21 MB        149.14 MB         -5.7%
  Cold Boot (avg)  1569.7 ms        1513.6 ms         -56.1 ms (-3.6%)
  --version exit   0 [1.17.13]      0 [(no output)]   same
  providers list   2418.9ms exit=0  2458.2ms exit=0   39.3 ms
  models           4093ms 5 lines   3660.9ms 5 lines  -432.1 ms
  serve 3s         ALIVE 3308ms     ALIVE 3023ms      same

  [OK] vMK compatible — no regressions. 2 improvements detected.
```

### JSON

Saved to `docs/metricas/compare-{label}-{yyyyMMdd-HHmmss}.json` for trend tracking:

```powershell
Get-ChildItem docs/metricas/compare-*.json | Select-Object Name
```

## Known Differences

- **`--version` output**: vMK shows no version string because the build strips
  `console.*` calls (`drop: ["console", "debugger"]` in `build.ts`). This is a
  pre-existing vMK trade-off — the binary is smaller but yargs can't print the
  version. Exit code (0) is unaffected.

## Metrics Legend

| Symbol | Meaning |
|:------:|:--------|
| DOWN | vMK is smaller / faster (improvement) |
| UP | vMK is larger / slower (regression) |
| same | Metrics are functionally identical |
| DIFF | Behavioral difference detected (review flagged metrics) |

## Requirements

- PowerShell 7+
- Original binary installed via npm global (`npm install -g opencode-ai`)
- vMK binary built (`bun run build --single` in `packages/opencode/`)
- ZONA ROJA: the script reads the original binary but never modifies it
