// bench-db-mmap.ts — micro-bench del lever WAL-mmap (ciclo 5, protocolo v3)
// Reproduce la config de pragmas de packages/core/src/database/database.ts
// (A = actual) contra A+mmap+temp_store (B), con files frescos por corrida e
// interleaved A/B para cancelar drift de FS cache. Métrica: mediana de 5.

import { Database } from "bun:sqlite"
import { mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"

const tmpRoot = join(import.meta.dir, ".bench-db-tmp")
rmSync(tmpRoot, { recursive: true, force: true })
mkdirSync(tmpRoot, { recursive: true })

const ROW_TEXT = "x".repeat(2048) // ~2KB por fila, similar a mensajes
const INSERTS = 3000
const SELECTS = 2000

function pragmas(db: Database, variant: "A" | "B") {
  // A = config actual de database.ts
  db.exec("PRAGMA journal_mode = WAL")
  db.exec("PRAGMA synchronous = NORMAL")
  db.exec("PRAGMA busy_timeout = 5000")
  db.exec("PRAGMA cache_size = -64000")
  db.exec("PRAGMA foreign_keys = ON")
  if (variant === "B") {
    db.exec("PRAGMA mmap_size = 134217728") // 128MB
    db.exec("PRAGMA temp_store = MEMORY")
  }
}

function workload(tag: string): { insertMs: number; selectMs: number; scanMs: number } {
  const file = join(tmpRoot, `db-${tag}.sqlite`)
  const db = new Database(file)
  pragmas(db, tag.startsWith("B") ? "B" : "A")
  db.exec("CREATE TABLE bench (id TEXT PRIMARY KEY, data TEXT NOT NULL)")

  const ids: string[] = []
  for (let i = 0; i < INSERTS; i++) ids.push(`id-${String(i).padStart(6, "0")}`)

  const t0 = performance.now()
  db.exec("BEGIN")
  const ins = db.prepare("INSERT INTO bench (id, data) VALUES (?, ?)")
  for (const id of ids) ins.run(id, ROW_TEXT)
  db.exec("COMMIT")
  const insertMs = performance.now() - t0

  // selects aleatorios por PK
  const sel = db.prepare("SELECT data FROM bench WHERE id = ?")
  const t1 = performance.now()
  for (let i = 0; i < SELECTS; i++) {
    sel.get(ids[(i * 7919) % INSERTS])
  }
  const selectMs = performance.now() - t1

  // full scan
  const scan = db.prepare("SELECT count(*) AS n, sum(length(data)) AS bytes FROM bench")
  const t2 = performance.now()
  scan.get()
  const scanMs = performance.now() - t2

  db.close()
  return { insertMs, selectMs, scanMs }
}

// warmup
workload("A-warm")
workload("B-warm")

const RUNS = 5
const A: { insertMs: number[]; selectMs: number[]; scanMs: number[] } = { insertMs: [], selectMs: [], scanMs: [] }
const B: { insertMs: number[]; selectMs: number[]; scanMs: number[] } = { insertMs: [], selectMs: [], scanMs: [] }

for (let i = 0; i < RUNS; i++) {
  const a = workload(`A-${i}`)
  A.insertMs.push(a.insertMs)
  A.selectMs.push(a.selectMs)
  A.scanMs.push(a.scanMs)
  const b = workload(`B-${i}`)
  B.insertMs.push(b.insertMs)
  B.selectMs.push(b.selectMs)
  B.scanMs.push(b.scanMs)
}

const med = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor((s.length - 1) / 2)]
}
const r1 = (n: number) => Math.round(n * 10) / 10

console.log(
  JSON.stringify(
    {
      runs: RUNS,
      rows: INSERTS,
      row_bytes: ROW_TEXT.length,
      A_median: {
        insert_ms: r1(med(A.insertMs)),
        select_ms_2000: r1(med(A.selectMs)),
        scan_ms: r1(med(A.scanMs)),
      },
      B_median: {
        insert_ms: r1(med(B.insertMs)),
        select_ms_2000: r1(med(B.selectMs)),
        scan_ms: r1(med(B.scanMs)),
      },
      delta_pct: {
        insert: r1(((med(B.insertMs) - med(A.insertMs)) / med(A.insertMs)) * 100),
        select: r1(((med(B.selectMs) - med(A.selectMs)) / med(A.selectMs)) * 100),
        scan: r1(((med(B.scanMs) - med(A.scanMs)) / med(A.scanMs)) * 100),
      },
    },
    null,
    2,
  ),
)

rmSync(tmpRoot, { recursive: true, force: true })
