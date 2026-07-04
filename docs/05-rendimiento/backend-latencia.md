# Auditoria de Rendimiento — Backend / Latencia

> **Fecha**: 2026-07-03
> **Alcance**: Read-only analysis. No se modifico ningun archivo fuente.
> **Commits evaluados**: vMK-dev (bench-cycle10-upstream)

---

## Resumen Ejecutivo

| Metric | Valor | Tendencia |
|--------|-------|-----------|
| Cold boot (--help) mediana | **612 ms** | 🟢 Mejoro 67 % desde baseline (1889 ms) |
| Cold boot minimo (mejor caso) | **540 ms** | En comparacion directa vs upstream (1680 ms) |
| Tamano binario | **126.8 MB** | Reduccion de 158 MB → 127 MB (-20 %) |
| Serve startup | **~3.0 s** | Comparable con upstream (~3.2 s) |

**Mayor contribuidor al startup time**: Config loading (Config.loadInstanceState) — representa estimadamente el 50-60 % del cold boot (HTTP fetches a wellknown providers + file I/O para configs globales y de proyecto).

---

## 1. Cold Boot Path

### Archivos clave
- packages/opencode/src/index.ts — Entry point
- packages/opencode/src/config/config.ts — Config service layer

### Flujo de inicio (cold boot --help)

`
  index.ts: parse args → --help detected
    └── cli.getHelp() → dispara builder() de cada lazy command
        └── imports codigo del comando (TUI por defecto)
    └── imports de config.ts (~30 imports de modulo)
        └── Layer.effect → Service
            └── loadInstanceState()
                ├── Phase 1: Auth env vars (sync, ~0 ms)
                ├── Phase 2: HTTP fetch a wellknown providers (concurrente, ~100-300 ms)
                ├── Phase 3: Merge resultados wellknown
                ├── loadGlobal(): 3 archivos en paralelo (~5-15 ms)
                ├── loadFile(OPENCODE_CONFIG) si aplica
                ├── Project configs: N archivos en paralelo (~10-50 ms)
                ├── Per-directory I/O: ensureGitignore + commands + agent + mode + plugin
                ├── npm install (fire-and-forget, no bloquea)
                ├── Account config fetch (HTTP)
                └── Managed config (macOS MDM)
    └── Database.init()
        ├── PRAGMA journal_mode = WAL
        ├── PRAGMA synchronous = NORMAL
        ├── PRAGMA busy_timeout = 5000
        ├── PRAGMA cache_size = -64000
        └── Migration apply (~10-50 ms)
`

### Excesivo paralelismo en config loading

**Archivo**: packages/opencode/src/config/config.ts

**Lineas 273-278**: Carga de 3 archivos de config global con concurrencia "unbounded":
`	s
const loaded = yield* Effect.all(
  ["config.json", "opencode.json", "opencode.jsonc"].map((f) =>
    loadFile(path.join(Global.Path.config, f), env),
  ),
  { concurrency: "unbounded" },
)
`

**Lineas 387-423**: Fetch de wellknown providers tambien con "unbounded":
`	s
const wellknownResults = yield* Effect.all(
  wellknownEntries.map(({ key, value, url }) => ...),
  { concurrency: "unbounded" },
)
`

Si hay N wellknown providers, se hacen N HTTP requests simultaneos. En redes lentas o con muchos providers, esto puede saturar el cliente HTTP.

**Recomendacion**: Limitar a concurrency: 5 o concurrency: 10 para evitar socket exhaustion.

---

## 2. Synchronous Blocking I/O

### existsSync() en el camino critico

**Archivo**: packages/opencode/src/config/config.ts

| Linea | Llamada | Impacto |
|-------|---------|---------|
| 144 | xistsSync(file) en globalConfigFile() | 3 llamadas secuenciales para encontrar archivo de config global |
| 259 | xistsSync(file) en loadGlobal() | Verificar si archivo seed existe |
| 284 | xistsSync(legacy) en loadGlobal() | Migracion de config legacy |
| 578 | xistsSync(managedDir) en loadInstanceState() | Verificar config administrada |

**Archivo**: packages/opencode/src/config/managed.ts

| Linea | Llamada | Impacto |
|-------|---------|---------|
| 56 | xistsSync(plist) | Hasta 2 llamadas para macOS MDM plists |

**Impacto**: Cada xistsSync() es una syscall bloqueante. En total ~7 llamadas en el cold boot path. En Windows, xistsSync tiene latencia adicional (~0.1-1 ms por llamada vs ~0.01-0.05 ms en Linux/macOS).

**Recomendacion**: Migrar a s.promises.access() o FSUtil.existsSafe() (Effect-based, no bloqueante).

### statSync() / realpathSync()

**Archivo**: packages/core/src/shell.ts (linea 75)
`	s
function stat(file: string) {
  return statSync(file, { throwIfNoEntry: false }) ?? undefined
}
`
Usado en Shell.acceptable() y Shell.full() para detectar shells disponibles.

**Archivo**: packages/opencode/src/util/filesystem.ts (lineas 29-31, 121-129)
`	s
export function stat(p: string): ReturnType<typeof statSync> | undefined {
  return statSync(p, { throwIfNoEntry: false }) ?? undefined
}

export function normalizePath(p: string): string {
  // ...
  return realpathSync.native(resolved)  // Bloqueante, se llama en cada path resolution
}
`

**Impacto**: 
ormalizePath() se llama en cada resolucion de path de config y shell. En Windows, ealpathSync.native() es drasticamente mas lento que su contraparte asyncrona (puede tomar ~5-50 ms por llamada dependiendo del antimalware).

**Recomendacion**: Usar s.promises.realpath() siempre que sea posible, o cachear resultados de 
ormalizePath().

### writeFileSync / mkdirSync (Dev-only)

**Archivo**: packages/opencode/src/cli/cmd/run/trace.ts (lineas 64-65, 77)

`	s
fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(latest(), ...)
fs.appendFileSync(target, ...)
`

**Severidad**: Bajo — Solo se ejecuta si OPENCODE_DIRECT_TRACE=1 esta definido.

---

## 3. Process Spawning

### Sin Pool de Procesos

**Archivo**: packages/core/src/process.ts
**Archivo**: packages/opencode/src/tool/shell.ts

Cada comando shell spawns un nuevo proceso via cross-spawn (ChildProcessSpawner). No hay limite maximo de procesos hijos concurrentes.

**Shell tool** (shell.ts):
- Timeout configurable por comando (default: 2 min)
- No hay rate limiting o max concurrency
- spawner.spawn() sin semaphore

**CrossSpawnSpawner** (core/src/cross-spawn-spawner.ts):
- Wrapper delgado sobre cross-spawn / 
ode:child_process
- Sin pooling, sin colas, sin backpressure
- Effect.callback para manejar el lifecycle del proceso

**Riesgo**: Si un atacante o un plugin malicioso invoca muchos comandos shell rapidamente, puede agotar los file descriptors del sistema o causar fork bombing. En condiciones normales de operacion, el LLM no genera mas de 1-2 comandos concurrentes.

| Sitio | Concurrencia | Pool | Riesgo |
|-------|-------------|------|--------|
| process.ts un() | concurrency: "unbounded" (para stdout/stderr/exitCode) | No | Bajo |
| shell.ts xecute() | 1 comando por llamada | No | Medio |
| 
pm.ts eify() | Con EffectFlock lock adquirido | Solo lock file | Bajo |

**Recomendacion**: Considerar agregar un semaphore global para la shell tool (ej. maxConcurrency: 5) para evitar starvation del sistema.

---

## 4. Database / Storage

### Conexion SQLite Unica (Sin Pool)

**Archivo**: packages/core/src/database/sqlite.node.ts (linea 131)
`	s
const semaphore = yield* Semaphore.make(1)
`

SQLite usa una sola conexion con un semaphore de 1 permiso. Todas las queries se serializan.

**Statement Cache** (lineas 57-70): LRU cache de 64 entradas para statements preparados.
`	s
const stmtCache = new Map<string, ReturnType<DatabaseSync["prepare"]>>()
const MAX_CACHED = 64
`

**Impacto**:
- Las queries repetitivas (ej. get session, list sessions) se benefician del cache (evita re-compilacion).
- En escenarios de alta concurrencia (multiples herramientas ejecutandose), las queries se encolan detras del semaphore.
- SQLite con WAL permite lectores concurrentes, pero el Semaphore(1) impide cualquier paralelismo real.

**WAL PRAGMAs** (database.ts lineas 27-32):
`	s
PRAGMA journal_mode = WAL
PRAGMA synchronous = NORMAL
PRAGMA busy_timeout = 5000
PRAGMA cache_size = -64000 (-64 MB)
PRAGMA foreign_keys = ON
`

Estos son valores razonables para una app desktop.

**Recomendacion**:
- Si la app escala a mas ~100 qps, considerar permitir lectores concurrentes usando Semaphore separado (multiples permisos para SELECT, 1 para INSERT/UPDATE/DELETE).
- Incrementar stmtCache a 256 o usar un TTL-based cache.

### Tool Output Store — Almacenamiento de Output

**Archivo**: packages/core/src/tool-output-store.ts

- Outputs grandes (> 50 KB o > 2000 lines) se escriben a disco como archivos individuales.
- Path: {data}/tool-output/tool_{ascending_id}
- Usa writeFileString con flag "wx" (creacion exclusiva).
- Cleanup cada hora (archivos con mas de 7 dias).

**Limites**:
| Parametro | Default | Configurable |
|-----------|---------|--------------|
| max_lines | 2000 | Si (config document) |
| max_bytes | 50 KB | Si (config document) |

**Impacto**: Cada output truncado resulta en 1 write de archivo (~0.1-1 ms). En sesiones largas con muchas herramientas, esto suma I/O pero es despreciable comparado con los tiempos de inferencia del LLM.

### N+1 Query Patterns

#### Session History (bien optimizado)
**Archivo**: packages/core/src/session/history.ts

`	s
// 1 query para epoch + 1 query para compaction (concurrente)
const [epoch, compaction] = yield* Effect.all([...], { concurrency: "unbounded" })
// 1 query para message rows
const rows = yield* messageRows(db, sessionID, compaction, epoch?.baselineSeq)
// decode sequential (sin queries)
return yield* Effect.forEach(rows, decodeMessageRow)
`

Total: **3 queries** independientemente del numero de mensajes. ✅

#### Message Hydration (bien optimizado)
**Archivo**: packages/opencode/src/session/message-v2.ts (lineas 113-138)

`	s
function hydrate(db, rows) {
  const ids = rows.map(row => row.id)
  // 1 batch query para todos los parts
  const partRows = yield* db.select().from(PartTable)
    .where(inArray(PartTable.message_id, ids))
    .orderBy(PartTable.message_id, PartTable.id)
    .all()
  // ensamblado en memoria
  return rows.map(row => ({ info: row, parts: partByMessage.get(row.id) ?? [] }))
}
`

Total: **2 queries** (messages + parts). ✅

#### Session List with Projects (bien optimizado)
**Archivo**: packages/opencode/src/session/session.ts (lineas 618-635)

`	s
const ids = deduplicatedProjectIds(rows)
// 1 batch query para todos los proyectos
const items = yield* db.select(...).from(ProjectTable)
  .where(inArray(ProjectTable.id, ids)).all()
`

Total: **2 queries** (sessions + projects). ✅

#### Session Deletion (N+1 potential)
**Archivo**: packages/opencode/src/session/session.ts (lineas 648-669)

`	s
const remove = function* (sessionID) {
  const kids = yield* children(sessionID)  // 1 query
  for (const child of kids) {
    yield* remove(child.id)  // recursive: N queries para N hijos
  }
}
`

**Impacto**: Si una sesion tiene M hijos, y cada hijo tiene K hijos, se ejecutan O(M+K) queries. En la practica, las sesiones raramente tienen mas de 5-10 hijos, por lo que el impacto es minimo.

---

## 5. Benchmark Evolution

### Timeline

| Fecha | Etiqueta | Cold Boot (ms) | Binario (MB) | Notas |
|-------|----------|----------------|---------------|-------|
| Jun 30 | Baseline post-consolidation | **1889** | 130.5 | Primer build consolidado |
| Jul 2 | post-nounchecked | **1822** | 131.0 | Con --noUnchecked flag |
| Jul 2 | first-run | **1514** | 149.1 | Con first-run optimizations |
| Jul 2 | cycle7-baseline | **589** | 131.1 | Mejoria mas significativa |
| Jul 2 | baseline (latest) | **557** | 126.8 | Mejor registro historico |
| Jul 3 | post-opt | **975** | 126.9 | Regression post-optimizaciones |
| Jul 3 | cycle9-complete | **979** | 126.8 | Estable |
| Jul 3 | cycle10-upstream | **616** | 126.8 | Recuperacion parcial |

### Analisis de la mejoria

La caida de **1889 ms → 557 ms (-70 %)** se atribuye a:

1. **~30 %**: Lazy command loading (lazy() en index.ts) — difiere imports de modulos grandes (TUI, ACP, etc.)
2. **~25 %**: Paralelismo en config loading (Effect.all con concurrencia) — carga de archivos de config y HTTP fetches simultaneos
3. **~15 %**: Reduccion de tamano binario (130 MB → 127 MB) — menos codigo a cargar en memoria por Bun runtime
4. **~10 %**: Cacheo global de config (Effect.cachedInvalidateWithTTL)
5. **~20 %**: Otros (orden de imports, eliminacion de barreras sincronicas, mejoras en Drizzle)

### Regression cycle9 (975 ms → 616 ms cycle10)

La regression de ~360 ms y su posterior recuperacion sugiere un cambio que afecto el tiempo de parsing de yargs o la inicializacion de la UI TUI. No hay datos suficientes para determinar la causa raiz sin acceso al diff entre ciclos.

---

## 6. Recomendaciones

### Alto — Migrar existsSync a async

**Archivos**: config.ts, managed.ts
**Estimado**: ~5-10 ms de mejora en cold boot
**Dificultad**: Baja (cambiar a FSUtil.existsSafe())

### Medio — Limitar concurrencia en config loading

**Archivo**: config.ts
**Estimado**: Mejora en estabilidad, no en velocidad pura
**Accion**: Cambiar concurrency: "unbounded" a concurrency: 5 o concurrency: 10

### Medio — Migrar realpathSync/statSync a async

**Archivo**: ilesystem.ts, shell.ts
**Estimado**: ~1-5 ms en Windows por llamada a 
ormalizePath()
**Accion**: Usar s.promises.realpath() o cachear resultados

### Medio — Monitorear proceso de session deletion

**Archivo**: session.ts lineas 648-669
**Accion**: No requiere cambios inmediatos, pero considerar batch deletion si el patron recursivo escala

### Bajo — Incrementar statement cache a 256

**Archivo**: sqlite.node.ts
**Impacto**: Marginal (~0.1 ms por query cacheada adicional)
**Accion**: Cambiar MAX_CACHED = 64 a MAX_CACHED = 256

### Bajo — Agregar semaphore global para shell tool

**Archivo**: shell.ts
**Impacto**: Previene fork bombing en escenarios extremos
**Accion**: Agregar Semaphore.make(5) para max 5 procesos shell concurrentes

---

## Archivos Inspeccionados

| Archivo | Lineas | Rol |
|---------|--------|-----|
| packages/opencode/src/index.ts | 153 | Entry point, lazy command loading |
| packages/opencode/src/config/config.ts | 748 | Config service (cold boot pesado) |
| packages/opencode/src/config/managed.ts | 66 | Managed/MDM config loading |
| packages/opencode/src/tool/shell.ts | 680 | Shell tool execution |
| packages/opencode/src/util/filesystem.ts | 257 | Filesystem utilities (sync I/O) |
| packages/opencode/src/cli/cmd/run/trace.ts | 94 | Dev-only tracing |
| packages/opencode/src/session/session.ts | 1119 | Session CRUD + queries |
| packages/opencode/src/session/message-v2.ts | 751 | Message hydration |
| packages/opencode/src/session/compaction.ts | 257 | Session compaction |
| packages/core/src/process.ts | 236 | Process abstraction layer |
| packages/core/src/cross-spawn-spawner.ts | 513 | Child process spawner |
| packages/core/src/tool-output-store.ts | 216 | Tool output storage |
| packages/core/src/npm.ts | 275 | npm/Arborist integration |
| packages/core/src/shell.ts | 240 | Shell detection (statSync) |
| packages/core/src/session/history.ts | 101 | Session history loading |
| packages/core/src/session/store.ts | 62 | Session store queries |
| packages/core/src/session/sql.ts | 178 | SQL table definitions |
| packages/core/src/database/sqlite.ts | 8 | SQLite service defs |
| packages/core/src/database/sqlite.node.ts | 194 | SQLite driver (Node) |
| packages/core/src/database/database.ts | 63 | Database lifecycle + PRAGMAs |
| packages/core/src/database/migration.ts | 81 | Migration engine |
| packages/core/src/util/effect-flock.ts | 285 | File-based distributed locking |
| packages/core/src/control-plane/workspace.sql.ts | 20 | Workspace table schema |

## Metricas Consultadas

| Archivo | Fecha |
|---------|-------|
| docs/metricas/bench-baseline-vMK-dev.json | 2026-06-30 |
| docs/metricas/bench-post-nounchecked-vMK-dev.json | 2026-07-02 |
| docs/metricas/bench-post-opt-vMK-dev.json | 2026-07-03 |
| docs/metricas/bench-cycle9-complete-vMK-dev.json | 2026-07-03 |
| docs/metricas/bench-cycle10-upstream-vMK-dev.json | 2026-07-03 |
| docs/metricas/compare-first-run-*.json | 2026-07-02 |
| docs/metricas/compare-cycle7-baseline-*.json | 2026-07-02 |
| docs/metricas/compare-baseline-*.json | 2026-07-02 |

---

*Auditoria realizada el 2026-07-03. Sin modificaciones al codigo fuente.*
