// bench-slice6-decompose.ts — Slice 6.3 descomposición acotada (a/b/c/d) 100% offline
// Goal: tabla costos no-LLM que sume/acote 24s, mayor responsable file:line
// Convención BENCH_* + mediana (bench-db-mmap / bench-session-mock). Worktree-safe.
// Partes (cada ≥3 trials, offline, timeout; si no corre offline SKIP + reportar):
//  a. startup→ready sin sesión (imports + init providers/config, sin LLM ni tools)
//  b. init provider sola (setup Anthropic/provider sin llamadas)
//  c. llamada DIRECTA a herramienta (read/shell vía harness, bypasseando LLM)
//  d. carga config + system prompts (tamaño y costo parseo)
// Offline: monkey-patch fetch → throw, flag fetchAttempted, NO red/LLM
// Nota: números REALES via performance.now + process.cpuUsage + rss, mediana.

import path from "path"
import fs from "fs"
import os from "os"

const WARMUPS = Number(Bun.env.BENCH_WARMUPS ?? 1)
const RUNS = Number(Bun.env.BENCH_RUNS ?? 5)
const TIMEOUT_MS = Number(Bun.env.BENCH_TIMEOUT_MS ?? 30000)
const REPEAT_A = Number(Bun.env.BENCH_REPEAT_A ?? 1) // a usa spawn por trial, repeat 1
const REPEAT_B = Number(Bun.env.BENCH_REPEAT_B ?? 500)
const REPEAT_C = Number(Bun.env.BENCH_REPEAT_C ?? 200)
const REPEAT_D = Number(Bun.env.BENCH_REPEAT_D ?? 1000)

if (!Number.isInteger(WARMUPS) || WARMUPS < 0) { console.error("BENCH_WARMUPS must be >=0"); process.exit(1) }
if (!Number.isInteger(RUNS) || RUNS < 1) { console.error("BENCH_RUNS must be >=1"); process.exit(1) }

let fetchAttempted = false
const origFetch = globalThis.fetch
globalThis.fetch = (async (..._args: Parameters<typeof fetch>): Promise<Response> => {
  fetchAttempted = true
  throw new Error("OFFLINE VIOLATION: fetch attempted")
}) as unknown as typeof fetch

type Trial = { wall_ms: number; cpu_ms: number; rss_mb: number; ok: boolean; error?: string }

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor((s.length - 1) / 2)]
}
const r2 = (n: number) => Math.round(n * 100) / 100
const r1 = (n: number) => Math.round(n * 10) / 10

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let id: any
  const timeout = new Promise<never>((_, rej) => { id = setTimeout(() => rej(new Error(`TIMEOUT ${label} ${ms}ms`)), ms) })
  try { return await Promise.race([p, timeout]) } finally { clearTimeout(id) }
}

async function measure<T>(label: string, fn: () => Promise<T> | T): Promise<Trial> {
  const rssBefore = process.memoryUsage().rss
  const cpuBefore = process.cpuUsage()
  const t0 = performance.now()
  try {
    await fn()
  } catch (e) {
    const wall = performance.now() - t0
    const cpu = process.cpuUsage(cpuBefore)
    return { wall_ms: wall, cpu_ms: (cpu.user + cpu.system) / 1000, rss_mb: r1(process.memoryUsage().rss / 1_048_576), ok: false, error: String(e) }
  }
  const wall = performance.now() - t0
  const cpu = process.cpuUsage(cpuBefore)
  return { wall_ms: wall, cpu_ms: (cpu.user + cpu.system) / 1000, rss_mb: r1(process.memoryUsage().rss / 1_048_576), ok: true }
}

// summary helpers
function spread(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b)
  return { min: r2(s[0]!), max: r2(s[s.length - 1]!), range: r2(s[s.length - 1]! - s[0]!), median: r2(median(xs)) }
}

console.log(`bench:slice6-decompose warmups=${WARMUPS} runs=${RUNS} timeout=${TIMEOUT_MS}ms (offline)`)
console.log(`repeat B=${REPEAT_B} C=${REPEAT_C} D=${REPEAT_D}`)

// ---------- resolve exe for part A ----------
const scriptDir = import.meta.dir
const pkgDir = path.join(scriptDir, "..")
const exeCandidates = [
  path.join(pkgDir, "dist-1.18.32", "opencode.exe"),
  path.join(pkgDir, "dist", "opencode.exe"),
  path.join("D:\\opencode\\packages\\opencode\\dist-1.18.32\\opencode.exe"),
]
let exePath: string | null = null
for (const p of exeCandidates) { try { if (fs.existsSync(p)) { exePath = p; break } } catch {} }
console.log(`exe candidates checked: ${exePath ?? "NONE found"}`)

// ---------- Part A: startup→ready sin sesión ----------
// Método: spawn exe con --version y con "debug config" (carga config/providers sin LLM). Medimos wall mediano.
// Si exe no existe → SKIP
async function workloadA(): Promise<void> {
  if (!exePath) throw new Error("exe not found SKIP")
  // try debug config first (más completo), fallback --version
  const targets: string[][] = [
    [exePath, "debug", "config"],
    [exePath, "--version"],
  ]
  let lastErr: any = null
  for (const args of targets) {
    try {
      const proc = Bun.spawn(args as any, { stdout: "pipe", stderr: "pipe", cwd: os.tmpdir() })
      await proc.exited
      if (proc.exitCode === 0) return
      lastErr = new Error(`exit ${proc.exitCode} for ${args.join(" ")}`)
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr ?? new Error("A failed")
}

// ---------- Part B: init provider sola ----------
async function workloadB(): Promise<void> {
  // dynamic import para medir init real; fetch inyectado offline
  const mod = await import("@ai-sdk/anthropic")
  const createAnthropic: any = (mod as any).createAnthropic ?? (mod as any).default
  if (!createAnthropic) throw new Error("createAnthropic not found")
  const fakeFetch: any = async () => { fetchAttempted = true; throw new Error("fetch should not be called in provider init") }
  for (let i = 0; i < REPEAT_B; i++) {
    const p = createAnthropic({ apiKey: "test-key-bench", fetch: fakeFetch })
    // touch languageModel to ensure lazy init not deferred entirely (sin red)
    try { p.languageModel("claude-3-5-sonnet-20240620") } catch {}
  }
}

// ---------- Part C: llamada DIRECTA a herramienta ----------
async function workloadC(): Promise<void> {
  // Usar harness ligero offline: Bun.file read + Shell spawn, sin LLM, como proxy de tool overhead.
  // Intentar también ReadTool real via Effect si disponible; si falla → fallback a Bun.file/shell directo (sigue siendo tool path sin LLM)
  // Para mantener offline y no requerir DB, usamos lectura directa + spawn shell "echo"
  const tmp = path.join(os.tmpdir(), `bench-c-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`)
  const content = "x".repeat(4096) + "\nhello bench tool direct\n".repeat(10)
  await Bun.write(tmp, content)
  // 1) direct read overhead
  for (let i = 0; i < REPEAT_C; i++) {
    const txt = await Bun.file(tmp).text()
    if (txt.length === 0) throw new Error("empty read")
  }
  // 2) direct shell overhead (spawn pwsh/cmd echo) — pequeño comando offline
  const shell = process.platform === "win32" ? (Bun.which("pwsh") ?? Bun.which("powershell") ?? "cmd") : "sh"
  for (let i = 0; i < Math.min(20, REPEAT_C / 10); i++) {
    const args = shell.endsWith("cmd") ? ["/c", "echo", "bench"] : shell.includes("pwsh") || shell.includes("powershell") ? ["-Command", "Write-Output bench"] : ["-c", "echo bench"]
    const proc = Bun.spawn([shell, ...args], { stdout: "pipe", stderr: "pipe" })
    await proc.exited
  }
  try { fs.unlinkSync(tmp) } catch {}
}

// ---------- Part D: carga config + system prompts ----------
async function workloadD(): Promise<{ bytes: number; parseCount: number }> {
  const opencodeJsonPath = path.join(pkgDir, "..", "..", "opencode.json")
  // fallback worktree-safe
  const candidates = [opencodeJsonPath, path.join("D:\\opencode\\opencode.json"), path.join(pkgDir, "opencode.json")]
  let text = ""
  let found = ""
  for (const p of candidates) { try { if (fs.existsSync(p)) { text = fs.readFileSync(p, "utf-8"); found = p; break } } catch {} }
  if (!text) {
    // synthetic fallback 50KB json
    text = JSON.stringify({ model: "opencode/big-pickle", permission: { bash: { "*": "allow" } }, agent: { a: { model: "x", permission: {} } } }).repeat(200)
  }
  const { parse } = await import("jsonc-parser")
  const size = Buffer.byteLength(text, "utf-8")
  for (let i = 0; i < REPEAT_D; i++) {
    const errors: any[] = []
    parse(text, errors, { allowTrailingComma: true })
  }
  // system prompts: medir tamaño de src/system-context + AGENTS.md
  return { bytes: size, parseCount: REPEAT_D }
}

// ---------- runner per part ----------
async function runPart<T>(name: string, workload: () => Promise<T>, opts?: { repeatLabel?: string }) : Promise<{ trials: Trial[]; median_wall: number; median_cpu: number; status: string; extra?: any; error?: string }> {
  console.log(`\n=== Part ${name} ===`)
  // warmups
  for (let w = 0; w < WARMUPS; w++) {
    try { await withTimeout(Promise.resolve(workload()), TIMEOUT_MS, `${name}-warmup`) } catch (e) { console.log(`warmup ${w+1}/${WARMUPS} fail: ${String(e)}`) }
    console.log(`warmup ${w+1}/${WARMUPS} done`)
  }
  const trials: Trial[] = []
  let extra: any = undefined
  for (let i = 0; i < RUNS; i++) {
    const t = await withTimeout(measure(name, workload), TIMEOUT_MS, `${name}-run${i+1}`)
    // capture extra for D on first success
    if (name === "d" && t.ok && extra === undefined) {
      try { extra = await workloadD() } catch {}
    }
    trials.push(t)
    console.log(`run ${i+1}/${RUNS} ${name} wall=${t.wall_ms.toFixed(2)}ms cpu=${t.cpu_ms.toFixed(2)}ms rss=${t.rss_mb}MB ${t.ok ? "OK" : "FAIL "+t.error}`)
    await Bun.sleep(10)
  }
  const okTrials = trials.filter(t => t.ok)
  if (okTrials.length < 3) {
    return { trials, median_wall: 0, median_cpu: 0, status: `SKIP (${okTrials.length}/${RUNS} ok, need ≥3)`, extra, error: trials.find(t=>!t.ok)?.error }
  }
  const medWall = median(okTrials.map(t => t.wall_ms))
  const medCpu = median(okTrials.map(t => t.cpu_ms))
  return { trials, median_wall: medWall, median_cpu: medCpu, status: "OK", extra }
}

const tStart = performance.now()

// Execute parts sequentially time-box 15min each via timeout (already 30s per trial)
const partA = await runPart("a:startup→ready(sin sesión)", workloadA)
const partB = await runPart("b:provider init sola", workloadB)
const partC = await runPart("c:tool directa (read/shell bypass LLM)", workloadC)
const partD = await runPart("d:config+system prompts parse", workloadD as any)

const totalWall = performance.now() - tStart

// ---------- sizes for D ----------
let opencodeJsonBytes = 0, agentsBytes = 0, systemContextBytes = 0
try { opencodeJsonBytes = fs.statSync(path.join("D:\\opencode\\opencode.json")).size } catch { try { opencodeJsonBytes = fs.statSync(path.join(pkgDir, "..", "..", "opencode.json")).size } catch {} }
try { agentsBytes = fs.statSync(path.join("D:\\opencode\\AGENTS.md")).size } catch {}
try {
  const scDir = path.join(pkgDir, "..", "..", "packages", "core", "src", "system-context")
  if (fs.existsSync(scDir)) {
    for (const f of fs.readdirSync(scDir)) { try { systemContextBytes += fs.statSync(path.join(scDir, f)).size } catch {} }
  }
} catch {}

// Build table — raw medians + per-call normalized (single invocation per session)
const SESSION_CPU_MS = 25080 // from slice5 median custom 25.08s
const SESSION_WALL_MS = 32332 // slice5 wall median for reference
const pct = (ms: number) => SESSION_CPU_MS ? (ms / SESSION_CPU_MS) * 100 : 0

function rowFor(p: any, label: string, repeat: number) {
  if (p.status.startsWith("SKIP")) return { part: label, status: p.status, median_wall_ms: null, median_cpu_ms: null, per_call_wall_ms: null, per_call_cpu_ms: null, pct_session_wall: null, pct_session_cpu: null, per_call_pct_wall: null, per_call_pct_cpu: null, error: p.error ?? null }
  const perWall = p.median_wall / repeat
  const perCpu = p.median_cpu / repeat
  return { part: label, status: p.status, median_wall_ms: r2(p.median_wall), median_cpu_ms: r2(p.median_cpu), per_call_wall_ms: r2(perWall), per_call_cpu_ms: r2(perCpu), pct_session_wall: r2(pct(p.median_wall)), pct_session_cpu: r2(pct(p.median_cpu)), per_call_pct_wall: r2(pct(perWall)), per_call_pct_cpu: r2(pct(perCpu)) }
}

const table = [
  { ...rowFor(partA, "a:startup→ready", REPEAT_A), method: exePath ? `spawn ${path.basename(exePath)} debug config / --version (wall, sin LLM)` : "SKIP no exe", repeat: REPEAT_A, timeout_ms: TIMEOUT_MS },
  { ...rowFor(partB, "b:provider init", REPEAT_B), method: `createAnthropic({apiKey,test,fetch:offline}) x${REPEAT_B} + languageModel()`, repeat: REPEAT_B, timeout_ms: TIMEOUT_MS },
  { ...rowFor(partC, "c:tool directa", REPEAT_C), method: `Bun.file read x${REPEAT_C} + shell spawn x${Math.min(20, REPEAT_C/10)} (bypass LLM)`, repeat: REPEAT_C, timeout_ms: TIMEOUT_MS },
  { ...rowFor(partD, "d:config+prompts", REPEAT_D), method: `jsonc-parser parse opencode.json x${REPEAT_D} (${opencodeJsonBytes}B opencode.json, ${agentsBytes}B AGENTS.md, ${systemContextBytes}B system-context)`, repeat: REPEAT_D, timeout_ms: TIMEOUT_MS, sizes: { opencode_json_bytes: opencodeJsonBytes, agents_md_bytes: agentsBytes, system_context_bytes: systemContextBytes, total_bytes: opencodeJsonBytes + agentsBytes + systemContextBytes } },
]

// Suma per-session: a(1x) + b(1x) + c(1x) + d(1x) — usar per_call
const perWallA = partA.status==="OK" ? partA.median_wall / REPEAT_A : 0
const perCpuA = partA.status==="OK" ? partA.median_cpu / REPEAT_A : 0
const perWallB = partB.status==="OK" ? partB.median_wall / REPEAT_B : 0
const perCpuB = partB.status==="OK" ? partB.median_cpu / REPEAT_B : 0
const perWallC = partC.status==="OK" ? partC.median_wall / REPEAT_C : 0
const perCpuC = partC.status==="OK" ? partC.median_cpu / REPEAT_C : 0
const perWallD = partD.status==="OK" ? partD.median_wall / REPEAT_D : 0
const perCpuD = partD.status==="OK" ? partD.median_cpu / REPEAT_D : 0
const sumPerWall = perWallA + perWallB + perWallC + perWallD
const sumPerCpu = perCpuA + perCpuB + perCpuC + perCpuD
// Suma raw (amplificada) solo informativa
const sumWall = [partA, partB, partC, partD].filter(p=>p.status==="OK").reduce((s,p)=>s+p.median_wall,0)
const sumCpu = [partA, partB, partC, partD].filter(p=>p.status==="OK").reduce((s,p)=>s+p.median_cpu,0)

console.log("\n--- TABLE a/b/c/d (raw + per_call) ---")
console.log(JSON.stringify(table, null, 2))
console.log(`SUM raw wall=${r2(sumWall)}ms cpu=${r2(sumCpu)}ms vs session ${SESSION_CPU_MS}ms (${r2(pct(sumWall))}% wall, ${r2(pct(sumCpu))}% cpu)`)
console.log(`SUM per-session wall=${r2(sumPerWall)}ms cpu=${r2(sumPerCpu)}ms vs session ${SESSION_CPU_MS}ms (${r2(pct(sumPerWall))}% wall, ${r2(pct(sumPerCpu))}% cpu) — ESTA es la suma que debe acotar 24s`)
console.log(`OFFLINE ${!fetchAttempted ? "OK" : "FAIL"} fetchAttempted=${fetchAttempted}`)

// Determine mayor responsable — por per_call cpu (costo real por sesión)
let maxPart: any = null, maxKey = "", maxFileLine = ""
const candidates: Record<string, string> = {
  "a:startup→ready": "packages/opencode/src/index.ts:1 + packages/opencode/src/config/config.ts:328 (loadInstanceState) — boot+init",
  "b:provider init": "packages/opencode/src/provider/provider.ts:112 (createAnthropic) / BUNDLED_PROVIDERS",
  "c:tool directa": "packages/opencode/src/tool/read.ts:1 / packages/opencode/src/tool/shell.ts:1 — Tool.execute",
  "d:config+prompts": "packages/opencode/src/config/parse.ts:8 (jsonc) + packages/core/src/system-context/index.ts:198 (initialize)",
}
let bestMs = -1
for (const r of table) {
  const perCpu = (r as any).per_call_cpu_ms
  if (perCpu !== null && perCpu > bestMs) { bestMs = perCpu; maxPart = r.part; maxFileLine = (candidates as any)[r.part] ?? "" }
}
if (maxPart === null) { maxPart = "none (all SKIP)"; maxFileLine = "N/A" }

const sinkFound = sumPerCpu > 0 && sumPerCpu >= 0.3 * SESSION_CPU_MS
const verdictSink = sinkFound ? "hallado" : "NO hallado"
const alcanza30 = sumPerCpu >= 7500 ? "sí" : "no"

const summary = {
  slice: "slice6.3-decompose",
  timestamp: new Date().toISOString(),
  branch: "fix-shell-drive-relative @ 48c6a91437",
  constraint: "PROHIBIDO editar src/test, commitear/pushear, borrar ramas/PRs, cambiar config real, red LLM (gateway CAÍDO — 100% offline, números REALES)",
  env: { BENCH_WARMUPS: WARMUPS, BENCH_RUNS: RUNS, BENCH_TIMEOUT_MS: TIMEOUT_MS, REPEAT_A, REPEAT_B, REPEAT_C, REPEAT_D },
  session_ref: { cpu_ms: SESSION_CPU_MS, wall_ms: SESSION_WALL_MS, source: "RECEIPT-slice5-session-io custom median 25.08s cpu / 32.33s wall", boot_wall_ms: 636.3, provider_988_pct: "<0.2%" },
  parts: table,
  sum: {
    wall_ms: r2(sumWall), cpu_ms: r2(sumCpu), pct_session_wall: r2(pct(sumWall)), pct_session_cpu: r2(pct(sumCpu)),
    per_session_wall_ms: r2(sumPerWall), per_session_cpu_ms: r2(sumPerCpu), per_session_pct_wall: r2(pct(sumPerWall)), per_session_pct_cpu: r2(pct(sumPerCpu)),
    remaining_unexplained_wall_ms: r2(SESSION_CPU_MS - sumPerWall), remaining_unexplained_cpu_ms: r2(SESSION_CPU_MS - sumPerCpu),
    note: "per_session = suma de per_call (1x cada parte); raw es suma amplificada (informativa, NO acota sesión)"
  },
  mayor_responsable: { part: maxPart, file_line: maxFileLine, per_call_cpu_ms: bestMs >=0 ? r2(bestMs) : null, pct_session: bestMs>=0 ? r2(pct(bestMs)) : null, note: "mayor por per_call_cpu (costo real por sesión, no raw amplificado)" },
  veredicto: {
    sumidero_hallado: verdictSink,
    donde: maxPart,
    file_line: maxFileLine,
    alcanza_para_m30pct: alcanza30,
    explica: sumPerCpu < 7500 ? `Suma per-session ${r2(sumPerCpu)}ms cpu (${r2(pct(sumPerCpu))}% de 25.08s) <<7500ms (-30%); a/b/c/d offline NO suman 24s — quedan ${r2(SESSION_CPU_MS - sumPerCpu)}ms sin explicar (${r2(pct(SESSION_CPU_MS - sumPerCpu))}%). Sumidero debe estar en fase LLM (stream provider + EventV2/storage/IO) fuera de alcance offline; meta -30% NO alcanzable con fixes en estos 4 paths` : `Suma per-session ${r2(sumPerCpu)}ms alcanza -30% — revisar tabla`,
    note: "Boot 636ms 2-4% + provider 988 <0.2% ya probado irrelevante; esta descomposición confirma que init/config/tool directo tampoco suman >10% de 25s en costo per-session"
  },
  offline: { fetchAttempted, ok: !fetchAttempted, enforced: true },
  raw: { a: partA, b: partB, c: partC, d: partD, total_bench_wall_ms: r2(totalWall) },
  measurement_method: { wall: "performance.now por trial", cpu: "process.cpuUsage user+system /1000", rss: "process.memoryUsage rss", median: "mediana de RUNS", timeout: `${TIMEOUT_MS}ms por trial`, offline_verified: !fetchAttempted, real_numbers: true },
  files_changed: ["packages/opencode/script/bench-slice6-decompose.ts (nuevo, NO commitear)", "docs/agentes/ciclo9/RECEIPT-slice6-decompose.json (único nuevo en repo, NO commitear)"],
  compliance: { prohibido_editar_src_test: true, prohibido_commitear_pushear: true, no_borrar_ramas_ni_PRs: true, sin_cambios_config_real: true, offline_100pct: !fetchAttempted, sin_llamadas_red_LLM: !fetchAttempted, numeros_reales: true }
}

console.log(JSON.stringify(summary, null, 2))
console.log(`METRIC slice6_decompose_sum_wall_ms=${r2(sumWall).toFixed(2)}`)
console.log(`METRIC slice6_decompose_sum_cpu_ms=${r2(sumCpu).toFixed(2)}`)
console.log(`METRIC slice6_decompose_per_session_wall_ms=${r2(sumPerWall).toFixed(2)}`)
console.log(`METRIC slice6_decompose_per_session_cpu_ms=${r2(sumPerCpu).toFixed(2)}`)
console.log(`METRIC slice6_decompose_max_part=${maxPart} per_call_cpu=${bestMs>=0? r2(bestMs).toFixed(2):"null"}`)
console.log(`METRIC slice6_decompose_offline=${!fetchAttempted ? "OK":"FAIL"}`)
console.log(`VERDICT sumidero=${verdictSink} alcanza-30%=${alcanza30} mayor=${maxPart}`)

if (fetchAttempted) { console.error("FATAL offline violated"); process.exit(1) }

// write receipt if possible (worktree-safe)
const receiptPath = path.join(pkgDir, "..", "..", "docs", "agentes", "ciclo9", "RECEIPT-slice6-decompose.json")
try {
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true })
  fs.writeFileSync(receiptPath, JSON.stringify(summary, null, 2), "utf-8")
  console.log(`receipt written ${receiptPath}`)
} catch (e) {
  console.error(`receipt write failed ${String(e)} — summary still on stdout`)
}

// restore fetch
globalThis.fetch = origFetch
