// bench-session-mock.ts — harness CPU/RSS LOCAL del path caliente SSE sin red (slice 6.2)
// Mock 100% offline: stream sintético fijo (N=1000, seed fijo) que estresa provider.ts:988
//   texto.replace(/"role"\s*:\s*""/g, '"role":"assistant"') + decode/re-encode por chunk
// Reuso mecanismo de test/provider/transform.test.ts: fetch inyectado via createAnthropic/createAmazonBedrock
//   con fetch: capture — aquí aislamos el hot loop sin SDK para medición pura CPU (offline garantizado).
// Protocolo slice1: 1 warmup + N runs + mediana (BENCH_WARMUPS/BENCH_RUNS). Worktree-safe.
// Referencia: bench-db-mmap.ts / bench-boot.ps1 para estilo; bench-search.ts para median helper.
// Offline: monkey-patch fetch para throw si se intenta red; verificado por flag.

const N = Number(Bun.env.BENCH_N ?? 5000)
const SEED = Number(Bun.env.BENCH_SEED ?? 0x12345678)
const warmups = Number(Bun.env.BENCH_WARMUPS ?? 1)
const runs = Number(Bun.env.BENCH_RUNS ?? 5)
const REPEAT = Number(Bun.env.BENCH_REPEAT ?? 20) // amplifica CPU para granularidad de process.cpuUsage (15ms en Windows)

if (!Number.isInteger(N) || N < 1) {
  console.error("BENCH_N must be positive integer")
  process.exit(1)
}
if (!Number.isInteger(warmups) || warmups < 0) {
  console.error("BENCH_WARMUPS must be non-negative integer")
  process.exit(1)
}
if (!Number.isInteger(runs) || runs < 1) {
  console.error("BENCH_RUNS must be positive integer")
  process.exit(1)
}

// --- offline isolation: fail fast if any fetch is attempted ---
let fetchAttempted = false
const origFetch = globalThis.fetch
globalThis.fetch = Object.assign(
  async (..._args: Parameters<typeof fetch>): Promise<Awaited<ReturnType<typeof fetch>>> => {
    fetchAttempted = true
    throw new Error("OFFLINE VIOLATION: fetch attempted in mock harness — debe ser 100% offline")
  },
  { preconnect: (() => {}) as unknown as (typeof fetch extends { preconnect: infer P } ? P : never) },
) as unknown as typeof fetch

// deterministic PRNG (mulberry32) — seed fijo
function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a += 0x6d2b79f5
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Templates representativos: SSE JSONL con y sin "role":"" para ejercitar la regex global
const TEMPLATES: string[] = [
  `data: {"id":"chatcmpl-000","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":""},"finish_reason":null}]}\n\n`,
  `data: {"id":"chatcmpl-001","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n`,
  `data: {"id":"chatcmpl-002","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}\n\n`,
  `data: {"choices":[{"delta":{"content":" token"}}]}\n\n`,
  `data: {"choices":[{"delta":{"content":" another"}}]}\n\n`,
  `data: {"choices":[{"delta":{"role":""}}]}\n\n`,
  `data: {"id":"chatcmpl-003","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","content":" hi"},"finish_reason":null}]}\n\n`,
  `data: {"choices":[{"delta":{"content":" Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt."}}]}\n\n`,
  `data: {"choices":[{"delta":{"content":" \\"role\\" : \\"\\" inside string?"}}]}\n\n`,
  `data: {"choices":[{"delta":{"content":"  ","role":""}}]}\n\n`,
]

function makeChunks(n: number, seed: number): Uint8Array[] {
  const rand = mulberry32(seed)
  const enc = new TextEncoder()
  const out: Uint8Array[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const pick = TEMPLATES[Math.floor(rand() * TEMPLATES.length)]!
    // payload representativo ~300-600B: agrega pad variable hasta 256B en 50% de chunks
    const padLen = rand() < 0.5 ? Math.floor(rand() * 256) : Math.floor(rand() * 64)
    const tail = padLen > 0 ? `data: {"t":${i},"pad":"${"x".repeat(padLen)}","seq":${rand().toString(36).slice(2)}}\n\n` : ""
    const str = tail ? pick + tail : pick
    const coalesce = rand() < 0.15 ? pick + TEMPLATES[Math.floor(rand() * TEMPLATES.length)]! : str
    out[i] = enc.encode(coalesce)
  }
  return out
}

// --- hot path exacto de provider.ts:988 ---
const HOT_REGEX = /"role"\s*:\s*""/g
function hotTransform(chunk: Uint8Array, decoder: TextDecoder, encoder: TextEncoder): Uint8Array {
  const text = decoder.decode(chunk, { stream: true })
  return encoder.encode(text.replace(HOT_REGEX, '"role":"assistant"'))
}
function noRegexTransform(chunk: Uint8Array, decoder: TextDecoder, encoder: TextEncoder): Uint8Array {
  const text = decoder.decode(chunk, { stream: true })
  return encoder.encode(text) // passthrough sin regex, para medir overhead de decode/encode puro
}

// --- medición por trial ---
type Trial = { wall_ms: number; cpu_ms: number; rss_mb: number; rss_before_mb: number; rss_after_mb: number; outBytes: number }

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor((s.length - 1) / 2)]
}
const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

function runHotTrial(chunks: Uint8Array[]): Trial {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  const rssBefore = process.memoryUsage().rss
  const cpuBefore = process.cpuUsage()
  const t0 = performance.now()
  let total = 0
  for (let r = 0; r < REPEAT; r++) {
    for (const c of chunks) {
      const out = hotTransform(c, decoder, encoder)
      total += out.length
    }
    // reset decoder streaming state entre repeats
    decoder.decode()
  }
  const wall = performance.now() - t0
  const cpu = process.cpuUsage(cpuBefore)
  const cpuMs = (cpu.user + cpu.system) / 1000
  const rssAfter = process.memoryUsage().rss
  if (total === 0) throw new Error("unreachable")
  return { wall_ms: wall, cpu_ms: cpuMs, rss_mb: r1(rssAfter / 1_048_576), rss_before_mb: r1(rssBefore / 1_048_576), rss_after_mb: r1(rssAfter / 1_048_576), outBytes: total }
}

function runNoRegexTrial(chunks: Uint8Array[]): Trial {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  const rssBefore = process.memoryUsage().rss
  const cpuBefore = process.cpuUsage()
  const t0 = performance.now()
  let total = 0
  for (let r = 0; r < REPEAT; r++) {
    for (const c of chunks) {
      const out = noRegexTransform(c, decoder, encoder)
      total += out.length
    }
    decoder.decode()
  }
  const wall = performance.now() - t0
  const cpu = process.cpuUsage(cpuBefore)
  const cpuMs = (cpu.user + cpu.system) / 1000
  const rssAfter = process.memoryUsage().rss
  if (total === 0) throw new Error("unreachable")
  return { wall_ms: wall, cpu_ms: cpuMs, rss_mb: r1(rssAfter / 1_048_576), rss_before_mb: r1(rssBefore / 1_048_576), rss_after_mb: r1(rssAfter / 1_048_576), outBytes: total }
}

async function runStreamTrial(chunks: Uint8Array[]): Promise<Trial> {
  // Simula el ReadableStream pull loop de provider.ts:976-994 (snowflake-cortex wrapper)
  // Para amplificar igual que hot loop, repetimos REPEAT veces el drain
  const rssBefore = process.memoryUsage().rss
  const cpuBefore = process.cpuUsage()
  const t0 = performance.now()
  let total = 0
  for (let rep = 0; rep < REPEAT; rep++) {
    let idx = 0
    const src = new ReadableStream<Uint8Array>({
      pull(ctrl) {
        if (idx < chunks.length) ctrl.enqueue(chunks[idx++]!)
        else ctrl.close()
      },
    })
    const reader = src.getReader()
    const decoder = new TextDecoder()
    const encoder = new TextEncoder()
    const transformed = new ReadableStream<Uint8Array>({
      async pull(ctrl) {
        const { done, value } = await reader.read()
        if (done) {
          ctrl.close()
          return
        }
        const text = decoder.decode(value!, { stream: true })
        ctrl.enqueue(encoder.encode(text.replace(HOT_REGEX, '"role":"assistant"')))
      },
      cancel() {
        reader.cancel()
      },
    })
    const r2 = transformed.getReader()
    while (true) {
      const { done, value } = await r2.read()
      if (done) break
      total += value!.length
    }
  }
  const wall = performance.now() - t0
  const cpu = process.cpuUsage(cpuBefore)
  const cpuMs = (cpu.user + cpu.system) / 1000
  const rssAfter = process.memoryUsage().rss
  if (total === 0) throw new Error("unreachable")
  return { wall_ms: wall, cpu_ms: cpuMs, rss_mb: r1(rssAfter / 1_048_576), rss_before_mb: r1(rssBefore / 1_048_576), rss_after_mb: r1(rssAfter / 1_048_576), outBytes: total }
}

console.log(`bench:session-mock N=${N} seed=0x${SEED.toString(16)} warmups=${warmups} runs=${runs} repeat=${REPEAT} (stream sintético fijo, offline)`)
console.log(`mechanism: TextDecoder.decode + /"role"\\s*:\\s*""/g + TextEncoder.encode por chunk (provider.ts:988), sin fetch`)

const chunks = makeChunks(N, SEED)
const chunks2x = makeChunks(N * 2, SEED) // para check linealidad, mismo seed para determinismo
const totalInputBytes = chunks.reduce((s, c) => s + c.length, 0)
const avgChunk = r1(totalInputBytes / N)
const totalOps = N * REPEAT
console.log(`synthetic: ${N} chunks x ${REPEAT} repeat = ${totalOps} ops, ${totalInputBytes} bytes base, avg ${avgChunk} B/chunk, total with repeat ~${r1((totalInputBytes * REPEAT) / 1024)} KB`)

// --- warmups ---
for (let w = 0; w < warmups; w++) {
  runHotTrial(chunks)
  runNoRegexTrial(chunks)
  await runStreamTrial(chunks)
  console.log(`warmup ${w + 1}/${warmups} done`)
}

// --- runs: hot loop ---
const hotTrials: Trial[] = []
const noRegexTrials: Trial[] = []
const streamTrials: Trial[] = []

for (let i = 0; i < runs; i++) {
  const ht = runHotTrial(chunks)
  hotTrials.push(ht)
  const nt = runNoRegexTrial(chunks)
  noRegexTrials.push(nt)
  const st = await runStreamTrial(chunks)
  streamTrials.push(st)
  console.log(
    `run ${i + 1}/${runs} hot wall=${ht.wall_ms.toFixed(2)}ms cpu=${ht.cpu_ms.toFixed(2)}ms rss=${ht.rss_mb}MB | noregex cpu=${nt.cpu_ms.toFixed(2)}ms | stream cpu=${st.cpu_ms.toFixed(2)}ms wall=${st.wall_ms.toFixed(2)}ms`,
  )
  // small yield to avoid GC coalescing
  await Bun.sleep(10)
}

// --- baseline median ---
const hotCpu = hotTrials.map((t) => t.cpu_ms)
const hotWall = hotTrials.map((t) => t.wall_ms)
const hotRss = hotTrials.map((t) => t.rss_mb)
const noCpu = noRegexTrials.map((t) => t.cpu_ms)
const streamCpu = streamTrials.map((t) => t.cpu_ms)
const streamWall = streamTrials.map((t) => t.wall_ms)

const medHotCpu = median(hotCpu)
const medHotWall = median(hotWall)
const medHotRss = median(hotRss)
const medNoCpu = median(noCpu)
const medStreamCpu = median(streamCpu)
const medStreamWall = median(streamWall)

// spread: min/max + cv helper
function spread(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b)
  return { min: r2(s[0]!), max: r2(s[s.length - 1]!), range: r2(s[s.length - 1]! - s[0]!), median: r2(median(xs)) }
}

// --- hotspot % : cuánto agrega la regex sobre decode/encode puro ---
// overheadRegex = hot - noregex; %hotspot = overhead / hot *100
const overheadMs = Math.max(0, medHotCpu - medNoCpu)
const hotspotPct = medHotCpu > 0 ? (overheadMs / medHotCpu) * 100 : 0
// alternativa: hot vs stream (incluye overhead ReadableStream)
const streamOverheadPct = medStreamCpu > 0 ? ((medStreamCpu - medHotCpu) / medStreamCpu) * 100 : 0

// --- linealidad: N vs 2N (1 check rápido) ---
// Usamos median de 3 micro-runs 2N para estabilidad mínima sin inflar tiempo
const scaleRuns = 3
const scaleTrials: Trial[] = []
for (let i = 0; i < scaleRuns; i++) scaleTrials.push(runHotTrial(chunks2x))
const med2xCpu = median(scaleTrials.map((t) => t.cpu_ms))
const med2xWall = median(scaleTrials.map((t) => t.wall_ms))
const linearRatioCpu = medHotCpu > 0 ? med2xCpu / medHotCpu : 0
const linearRatioWall = medHotWall > 0 ? med2xWall / medHotWall : 0
const linearOk = linearRatioCpu >= 1.6 && linearRatioCpu <= 2.6 && linearRatioWall >= 1.6 && linearRatioWall <= 2.6
// criterio 1.6-2.6 permite jitter GC/JIT en 2x (ideal 2.0 ±30%)

const rawSummary = {
  warmups,
  runs,
  N,
  repeat: REPEAT,
  total_ops: N * REPEAT,
  seed: SEED,
  seed_hex: `0x${SEED.toString(16)}`,
  total_input_bytes: totalInputBytes,
  avg_chunk_bytes: avgChunk,
  mechanism: `TextDecoder.decode + HOT_REGEX /"role"\\s*:\\s*""/g + TextEncoder.encode per chunk (provider.ts:988) — loop directo + ReadableStream pull wrapper (snowflake-cortex path)`,
  mock_reuse: `test/provider/transform.test.ts pattern: createAnthropic/createAmazonBedrock({ fetch: capture }) injects mock fetch; here we isolate the transform loop (no SDK) but preserve same regex + decode/encode sequence; offline enforced via global fetch monkey-patch`,
  offline: { fetchAttempted, isolated: !fetchAttempted, enforced: true },
  trials: {
    hot: hotTrials.map((t) => ({ wall_ms: r2(t.wall_ms), cpu_ms: r2(t.cpu_ms), rss_mb: t.rss_mb })),
    no_regex: noRegexTrials.map((t) => ({ wall_ms: r2(t.wall_ms), cpu_ms: r2(t.cpu_ms), rss_mb: t.rss_mb })),
    stream: streamTrials.map((t) => ({ wall_ms: r2(t.wall_ms), cpu_ms: r2(t.cpu_ms), rss_mb: t.rss_mb })),
  },
  medians: {
    hot_cpu_ms: r2(medHotCpu),
    hot_wall_ms: r2(medHotWall),
    hot_rss_mb: r1(medHotRss),
    no_regex_cpu_ms: r2(medNoCpu),
    stream_cpu_ms: r2(medStreamCpu),
    stream_wall_ms: r2(medStreamWall),
  },
  spread: {
    hot_cpu: spread(hotCpu),
    hot_wall: spread(hotWall),
    hot_rss: spread(hotRss),
    no_regex_cpu: spread(noCpu),
    stream_cpu: spread(streamCpu),
  },
  hotspot_988: {
    overhead_regex_cpu_ms: r2(overheadMs),
    hotspot_pct_of_hot: r2(hotspotPct),
    stream_overhead_pct: r2(streamOverheadPct),
    verdict: hotspotPct >= 50 ? "sí-domina" : hotspotPct >= 20 ? "parcial" : "no-domina",
    interpretation: `Regex agrega ${r2(hotspotPct)}% del CPU hot; decode+encode puro = ${r2(medNoCpu)}ms vs hot = ${r2(medHotCpu)}ms`,
  },
  scaling_check: {
    N_vs_2N: { N, "2N": N * 2, med_cpu_N: r2(medHotCpu), med_cpu_2N: r2(med2xCpu), ratio_cpu: r2(linearRatioCpu), ratio_wall: r2(linearRatioWall), linear_ok: linearOk, runs_2N: scaleRuns },
    note: "Duplicar N debe escalar CPU ~2x si harness estresa hotspot (criterio 1.6-2.6 = OK)",
  },
}

console.log(JSON.stringify(rawSummary, null, 2))
console.log(`METRIC session_mock_hot_cpu_ms=${r2(medHotCpu).toFixed(2)}`)
console.log(`METRIC session_mock_hot_wall_ms=${r2(medHotWall).toFixed(2)}`)
console.log(`METRIC session_mock_hot_rss_mb=${r1(medHotRss).toFixed(1)}`)
console.log(`METRIC session_mock_stream_cpu_ms=${r2(medStreamCpu).toFixed(2)}`)
console.log(`METRIC session_mock_hotspot_pct=${r2(hotspotPct).toFixed(1)}`)
console.log(`METRIC session_mock_scale_ratio_cpu=${r2(linearRatioCpu).toFixed(2)} ${linearOk ? "LINEAR_OK" : "NONLINEAR"}`)
console.log(`OFFLINE ${!fetchAttempted ? "OK" : "FAIL"} fetchAttempted=${fetchAttempted}`)
console.log(`HOTSPOT_988 ${hotspotPct >= 50 ? "DOMINA" : hotspotPct >= 20 ? "PARCIAL" : "NO_DOMINA"} ${r2(hotspotPct).toFixed(1)}%`)

if (fetchAttempted) {
  console.error("FATAL: offline isolation violated — fetch was attempted")
  process.exit(1)
}

if (!linearOk) {
  console.warn(`WARN: scaling 2N ratio cpu=${r2(linearRatioCpu).toFixed(2)} fuera de 1.6-2.6 — revisar si harness estresa hotspot linealmente`)
}

// restaura fetch (no necesario pero limpio)
globalThis.fetch = origFetch
