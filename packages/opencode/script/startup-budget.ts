#!/usr/bin/env bun

// Startup budget harness: guards CLI startup performance against silent
// regressions (e.g. future eager imports). Measures the compiled binary's
// `--version` and `--help` latency, computes p50/p95, and fails (exit 1)
// only when p50 exceeds budget.
//
// Budgets (defaults, ms): generous on purpose. Measured 2026-09-23 on a
// Windows host: --version p50 ~5s, --help p50 ~12s, with wide run-to-run
// variance (2-10s; cold page cache / Defender rescans). Override via:
//   STARTUP_BUDGET_VERSION_MS, STARTUP_BUDGET_HELP_MS, STARTUP_BUDGET_RUNS
// The first spawn per command is an unmeasured warmup, discarded.

import path from "path"
import { fileURLToPath } from "url"

const VERSION_RUNS = 5
const HELP_RUNS = 3
const VERSION_BUDGET_MS = 12000
const HELP_BUDGET_MS = 25000

function readPositiveInt(name: string): number | undefined {
  const raw = process.env[name]
  if (raw === undefined) return undefined
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed <= 0) return undefined
  return parsed
}

function percentile(samples: number[], q: number): number {
  const sorted = [...samples].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)
  return sorted[index]
}

function timeSpawn(bin: string, args: string[]): number {
  const start = performance.now()
  Bun.spawnSync([bin, ...args], { stdout: "ignore", stderr: "ignore" })
  return performance.now() - start
}

function measure(bin: string, args: string[], runs: number): number[] {
  timeSpawn(bin, args)
  return Array.from({ length: runs }, () => Math.round(timeSpawn(bin, args)))
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const bin = path.resolve(scriptDir, "../dist/opencode-windows-x64/bin/opencode.exe")

if (!(await Bun.file(bin).exists())) {
  console.log(`SKIP: compiled binary not found at ${bin} (build is heavy and does not always run in CI)`)
  process.exit(0)
}

const runsOverride = readPositiveInt("STARTUP_BUDGET_RUNS")
const versionRuns = runsOverride ?? VERSION_RUNS
const helpRuns = runsOverride ?? HELP_RUNS
const versionBudget = readPositiveInt("STARTUP_BUDGET_VERSION_MS") ?? VERSION_BUDGET_MS
const helpBudget = readPositiveInt("STARTUP_BUDGET_HELP_MS") ?? HELP_BUDGET_MS

const versionSamples = measure(bin, ["--version"], versionRuns)
const helpSamples = measure(bin, ["--help"], helpRuns)

const rows = [
  { command: "--version", samples: versionSamples, budget: versionBudget },
  { command: "--help", samples: helpSamples, budget: helpBudget },
].map((row) => ({ ...row, p50: percentile(row.samples, 0.5), p95: percentile(row.samples, 0.95) }))

console.log("command    runs  min(ms)  p50(ms)  p95(ms)  max(ms)  budget(ms)  status")
for (const row of rows) {
  const min = Math.min(...row.samples)
  const max = Math.max(...row.samples)
  const ok = row.p50 <= row.budget
  console.log(
    `${row.command.padEnd(10)} ${String(row.samples.length).padEnd(5)} ${String(min).padEnd(8)} ${String(row.p50).padEnd(8)} ${String(row.p95).padEnd(8)} ${String(max).padEnd(8)} ${String(row.budget).padEnd(11)} ${ok ? "OK" : "FAIL"}`,
  )
}

const failures = rows.filter((row) => row.p50 > row.budget).map((row) => `${row.command} p50 ${row.p50}ms > budget ${row.budget}ms`)
if (failures.length > 0) {
  console.error(`FAIL: startup budget exceeded:\n- ${failures.join("\n- ")}`)
  process.exit(1)
}
console.log("PASS: startup p50 within budget")
