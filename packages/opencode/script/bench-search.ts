import { Effect } from "effect"
import { Fff } from "@opencode-ai/core/filesystem/fff.bun"
import { FileSystem } from "@opencode-ai/core/filesystem"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { Location } from "@opencode-ai/core/location"
import { LocationServiceMap, locationServiceMapLayer } from "@opencode-ai/core/location-services"
import { AppRuntime } from "@/effect/app-runtime"

// Bench reproducible: 1 warmup + N runs + mediana (protocolo ciclo9 slice1)
// Env: BENCH_WARMUPS=1 BENCH_RUNS=3 para piloto, BENCH_RUNS=7 para medición oficial
// Worktree: usa process.cwd() como directory, rutas relativas a import.meta.dir
const dir = AbsolutePath.make(process.cwd())

const warmups = Number(Bun.env.BENCH_WARMUPS ?? 1)
const runs = Number(Bun.env.BENCH_RUNS ?? 3)
if (!Number.isInteger(warmups) || warmups < 0) {
  console.error("BENCH_WARMUPS must be a non-negative integer")
  process.exit(1)
}
if (!Number.isInteger(runs) || runs < 1) {
  console.error("BENCH_RUNS must be a positive integer")
  process.exit(1)
}

const FILE_QUERIES = ["fff", "package.json", "tools/ experiment"]
const GREP_QUERIES = ["FileFinder", "import", "grep", "autocomplete"]
const GLOB_QUERIES = ["**/*.test.ts"]

const FILE_LIMIT = 100
const GREP_LIMIT = 50
const GLOB_LIMIT = 50

const locationRef = Location.Ref.make({ directory: dir })

// Provisiona FileSystem vía LocationServiceMap + AppRuntime (fix Service not found sin tocar runtime real)
const run = <A>(effect: Effect.Effect<A, unknown, FileSystem.Service>) =>
  AppRuntime.runPromise(
    effect.pipe(
      Effect.provide(LocationServiceMap.Service.get(locationRef)),
      Effect.provide(locationServiceMapLayer),
    ),
  ) as Promise<A>

// --- raw Fff picker (no Effect, baseline directo a lib) ---
const t0 = performance.now()
const made = Fff.create({ basePath: dir, aiMode: true })
if (!made.ok) {
  console.error("Fff.create failed:", made.error)
  process.exit(1)
}
const picker = made.value
console.log(`picker create: ${(performance.now() - t0).toFixed(1)}ms`)

const tw = performance.now()
await picker.waitForScan(2_500)
console.log(`wait for scan: ${(performance.now() - tw).toFixed(1)}ms`)

// warmup grep to let the content index build
const tWarmup = performance.now()
picker.grep("_warmup_", { mode: "regex", maxMatchesPerFile: 1, timeBudgetMs: 1_500 })
console.log(`grep warmup: ${(performance.now() - tWarmup).toFixed(1)}ms`)

console.log()
console.log("--- raw picker (warm) ---")

for (const q of FILE_QUERIES) {
  const t = performance.now()
  const r = picker.fileSearch(q, { pageSize: Math.max(FILE_LIMIT, 100) })
  const count = r.ok ? r.value.items.length : "err"
  console.log(`[picker] fileSearch "${q}": ${(performance.now() - t).toFixed(1)}ms (${count} results)`)
}

for (const q of GREP_QUERIES) {
  const t = performance.now()
  const r = picker.grep(q, { mode: "regex", pageSize: GREP_LIMIT, timeBudgetMs: 1_500 })
  const count = r.ok ? r.value.items.length : "err"
  console.log(`[picker] grep "${q}": ${(performance.now() - t).toFixed(1)}ms (${count} matches)`)
}

picker.destroy()

// --- Search service: init breakdown (una vez, fuera del loop de runs) ---
console.log()

const tRuntime = performance.now()
console.log(`[Search] init file (runtime + picker + scan): ${(performance.now() - tRuntime).toFixed(1)}ms`)

const tGrepWarmup = performance.now()
await run(FileSystem.Service.use((svc) => svc.grep({ pattern: "_warmup_grep_", limit: 1 })))
console.log(`[Search] init grep (content index warmup):    ${(performance.now() - tGrepWarmup).toFixed(1)}ms`)

console.log()
console.log(`--- Search service bench: ${warmups} warmup + ${runs} runs (median) ---`)

// Helper median
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

// Acumula timings por query para mediana
const fileTimings: Record<string, number[]> = Object.fromEntries(FILE_QUERIES.map((q) => [q, []]))
const grepTimings: Record<string, number[]> = Object.fromEntries(GREP_QUERIES.map((q) => [q, []]))
const globTimings: Record<string, number[]> = Object.fromEntries(GLOB_QUERIES.map((q) => [q, []]))

for (let i = 0; i < warmups + runs; i++) {
  const isWarmup = i < warmups
  const label = isWarmup ? `warmup ${i + 1}/${warmups}` : `run ${i - warmups + 1}/${runs}`
  console.log(`\n[bench-search ${label}]`)

  for (const q of FILE_QUERIES) {
    const t = performance.now()
    const r = await run(FileSystem.Service.use((svc) => svc.find({ query: q, limit: FILE_LIMIT })))
    const ms = performance.now() - t
    if (!isWarmup) fileTimings[q].push(ms)
    console.log(`[Search.find] "${q}": ${ms.toFixed(1)}ms (${r.length} results)${isWarmup ? " (warmup)" : ""}`)
  }

  for (const q of GREP_QUERIES) {
    const t = performance.now()
    const r = await run(FileSystem.Service.use((svc) => svc.grep({ pattern: q, limit: GREP_LIMIT })))
    const ms = performance.now() - t
    if (!isWarmup) grepTimings[q].push(ms)
    console.log(`[Search.grep] "${q}": ${ms.toFixed(1)}ms (${r.length} matches)${isWarmup ? " (warmup)" : ""}`)
  }

  for (const q of GLOB_QUERIES) {
    const t = performance.now()
    const r = await run(FileSystem.Service.use((svc) => svc.glob({ pattern: q, limit: GLOB_LIMIT })))
    const ms = performance.now() - t
    if (!isWarmup) globTimings[q].push(ms)
    console.log(`[Search.glob] "${q}": ${ms.toFixed(1)}ms (${r.length} files)${isWarmup ? " (warmup)" : ""}`)
  }
}

console.log("\n--- medians (ms) ---")
for (const q of FILE_QUERIES) console.log(`METRIC search_find_${q.replace(/[^a-zA-Z0-9]+/g, "_")}_median_ms=${median(fileTimings[q]).toFixed(1)}`)
for (const q of GREP_QUERIES) console.log(`METRIC search_grep_${q.replace(/[^a-zA-Z0-9]+/g, "_")}_median_ms=${median(grepTimings[q]).toFixed(1)}`)
for (const q of GLOB_QUERIES) console.log(`METRIC search_glob_${q.replace(/[^a-zA-Z0-9]+/g, "_")}_median_ms=${median(globTimings[q]).toFixed(1)}`)

process.exit(0)
