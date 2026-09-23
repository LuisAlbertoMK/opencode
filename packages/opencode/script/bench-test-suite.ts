// Full-suite timing harness for the test-speed research in ../../perf/test-suite.md.
// Use this for periodic sanity checks; use profile-test-files.ts for discovery.
// Env: BENCH_WARMUPS=0 BENCH_RUNS=1 bun run bench:test
// Worktree: resuelve cwd via import.meta.dir (relativo, sin hardcode D:\opencode)
// Protocolo slice1: 1 warmup + N runs + mediana. Para piloto usar BENCH_WARMUPS=1 BENCH_RUNS=3
// Modo corto (si suite >5min): BENCH_SHORT=1 o BENCH_FILTER="test/tool" usa subset documentado
const warmups = Number(Bun.env.BENCH_WARMUPS ?? 1)
const runs = Number(Bun.env.BENCH_RUNS ?? 3)
const timings: number[] = []

if (!Number.isInteger(warmups) || warmups < 0) {
  console.error("BENCH_WARMUPS must be a non-negative integer")
  process.exit(1)
}
if (!Number.isInteger(runs) || runs < 1) {
  console.error("BENCH_RUNS must be a positive integer")
  process.exit(1)
}

// Modo corto: evita correr suite completa >5min en CI piloto
// BENCH_SHORT=1 -> subset representativo ~30s (tool + session)
// BENCH_FILTER="patron" -> filtro arbitrario pasado a bun test
const short = Bun.env.BENCH_SHORT === "1" || Bun.env.BENCH_SHORT === "true"
const envFilter = Bun.env.BENCH_FILTER?.trim()
const shortFilter = "test/tool"
const filter = envFilter || (short ? shortFilter : undefined)
if (filter) console.log(`bench:test filter="${filter}" ${short ? "(BENCH_SHORT=1)" : "(BENCH_FILTER)"}`)
else console.log("bench:test full suite (sin filtro) — para modo corto usa BENCH_SHORT=1 o BENCH_FILTER")

for (const index of Array.from({ length: warmups + runs }, (_, index) => index)) {
  const measured = index >= warmups
  const label = measured ? `run ${index - warmups + 1}/${runs}` : `warmup ${index + 1}/${warmups}`
  const start = performance.now()
  console.log(`bench:test ${label}${filter ? ` [filter:${filter}]` : ""}`)

  const args = ["test", "--timeout", "30000"]
  if (filter) args.push(filter)
  const proc = Bun.spawn(["bun", ...args], {
    cwd: import.meta.dir + "/..",
    stdout: "inherit",
    stderr: "inherit",
    env: Bun.env,
  })

  const exitCode = await proc.exited
  if (exitCode !== 0) {
    console.error(`bench:test failed during ${label} with exit code ${exitCode}`)
    process.exit(exitCode)
  }

  const seconds = (performance.now() - start) / 1000
  console.log(`bench:test ${label} ${seconds.toFixed(3)}s`)
  if (measured) timings.push(seconds)
}

const sorted = timings.toSorted((a, b) => a - b)
const median = sorted[Math.floor(sorted.length / 2)]
const mean = timings.reduce((sum, timing) => sum + timing, 0) / timings.length
const best = sorted[0] ?? median
const worst = sorted.at(-1) ?? median

console.log(
  `bench:test median=${median.toFixed(3)}s mean=${mean.toFixed(3)}s best=${best.toFixed(3)}s worst=${worst.toFixed(3)}s filter=${filter ?? "full"}`,
)
console.log(`METRIC test_suite_seconds=${median.toFixed(3)}`)
console.log(`METRIC test_suite_best_seconds=${best.toFixed(3)}`)
console.log(`METRIC test_suite_worst_seconds=${worst.toFixed(3)}`)
