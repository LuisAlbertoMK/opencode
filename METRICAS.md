# Métricas de mejora — opencode fork

> Baseline: `dbbe67f06` (chore: generate) → HEAD: `2747916b9`  
> Ronda 1: 6 commits, 47 archivos, +395/-233 líneas  
> Ronda 2: 5 commits, 5 archivos, ~+90/-80 líneas

---

## 1. Platform Abstraction (`process.platform` → `Platform.*`)

| Métrica | Antes | Después | Δ |
|---------|-------|---------|---|
| `process.platform` en source | ~83 | 18 | **-78%** |
| `process.platform` en tests | ~142 | ~142 (mantenido) | 0% |
| `Platform.*` referencias | 3 | 88 | **+29x** |
| Platform helpers exportados | 3 (`isWindows`/`isMac`/`isLinux`) | 17 | **+5.7x** |
| Archivos refactorizados | — | 28 | — |

**Helpers nuevos**: `WINDOWS`, `MAC`, `LINUX`, `ext`, `cmdExt`, `scriptExt`, `binName()`, `cmdName()`, `detached`, `windowsHide`, `defaultShell()`, `defaultShellArgs`, `terminalSuspend`, `caseInsensitiveFs`, `normalizePath()`, `attempts`, `rgName`, `illegalChars`, `wildcardFlags`, `export * as Platform`

---

## 2. Seguridad

| Métrica | Antes | Después | Impacto |
|---------|-------|---------|---------|
| **Credenciales en shell env** | Todas las env vars propagadas | 5 vars bloqueadas (`AWS_BEARER_TOKEN_BEDROCK`, `AICORE_SERVICE_KEY`, `OPENCODE_AUTH_CONTENT`, `OPENCODE_SERVER_PASSWORD`, `OPENCODE_SERVER_USERNAME`) | Evita fuga a comandos shell |
| **Provider env global** | `loadBedrock()`/`loadSapAiCore()` mutaban `process.env` globalmente | Scope JIT en `getModel()` con save/restore | Evita contaminación global |
| **Auth.json en reposo** | Plaintext JSON | AES-256-GCM + llave máquina-local | **Cifrado completo** (no solo deterrente) |
| **OPENCODE_AUTH_CONTENT env** | Plaintext en variable de entorno | Mantenido (in-memory, propagación intencional a workspace subprocesos) | Tradeoff conocido |
| **Exa API key** | En URL (query param) | Header `x-api-key` | Eliminado leak por logs/URL |
| **MCP env** | Todas las env vars | Solo `PATH`/`HOME`/`USERPROFILE` | Reduce superficie |

---

## 3. Corrección de Memory Leaks

| Componente | Leak | Fix | Archivos |
|------------|------|-----|----------|
| **LSP broken Set** | `Set<string>` sin límite — servidores fallidos NUNCA reintentados | `Map<string, number>` con ventana de 5 min + auto-limpieza | `lsp/lsp.ts` |
| **LSP clients Array** | `push()` sin eviction — cada cliente = proceso + WebSocket persistente | Identificado, pendiente de fix (idle TTL) | `lsp/lsp.ts` |
| **LSP files Record** | Texto completo de archivos abiertos SIN cleanup | Identificado, pendiente de fix (LRU) | `lsp/client.ts` |
| **Event commitGuards** | Guards acumulados SIN unsubscribe | `beforeCommit()` ahora retorna `Effect<Unsubscribe>` con `splice()` en cleanup | `core/event.ts` |
| **FileSystem ShareNext** | Listeners no removidos al cerrar proyecto | `project()` API retorna `Unsubscribe` | `share/share-next.ts` |
| **BackgroundJob stale** | Entradas huérfanas sin limpieza | Evicción periódica con TTL | `core/background-job.ts` |

---

## 4. Performance y Recursos

| Métrica | Antes | Después |
|---------|-------|---------|
| **Llamadas a `process.platform`** (source) | ~83 | 18 |
| **taskkill Windows** | `taskkill /F /PID` (force directo) | `taskkill /T /PID` → fallback `/F` |
| **LSP download URL mapping** | 8 sitios con lógica duplicada | Usan `Platform.WINDOWS`/`MAC`/`LINUX` |
| **Archivos fuente modificados** | — | 47 |

---

## 5. Resumen por Commit

```
1. 09e32f096 refactor(core): evict stale BackgroundJob entries, dead code cleanup, LSP per-file diagnostics
2. 952ee20e2 fix(core): unsubscribe ShareNext event listeners, add Unsubscribe to project() API
3. 7a955c771 fix(core): MCP env filter, Exa key to header, taskkill graceful, PTY docs, platform helper
4. 0524d2cfb fix(seguridad): filtrar credenciales de shell env, scoping env vars en providers
5. e61a8beb4 refactor(core): reemplazar process.platform por Platform helpers en 28 archivos
6. 870ff25d5 fix(auth,core,lsp): encriptar auth.json con AES-256-GCM, reintentar LSP caídos, unsubscribe commitGuards
```

---

---

## 6. Ronda 2 — RAM/CPU/GPU

> Branch: `dev` · Baseline: `92f37cbcf` (fix(lsp): limitar LSP a 128) → HEAD: `2747916b9`  
> 5 commits, 5 archivos modificados, ~+90/-80 líneas

### 6.1 publish-llm-event.ts — String Accumulation

| Métrica | Antes | Después | Δ |
|---------|-------|---------|---|
| Estructura de deltas | `Map<string, string[]>` (N arrays por sesión) | `Map<string, string>` (append directo) | **Elimina N arrays + GC pressure** |
| Streaming overhead | `push()` + `join("")` por flush | `+=` directo | **O(1) append, 0 alloc intermedias** |

**Por qué**: Cada delta parcial creaba un nuevo string en el array, y `join("")` al flush copiaba todo. Con `+=` el engine optimiza en su lugar cuando no hay otras referencias (ROP retires).

### 6.2 message-updater.ts — Message Cap

| Métrica | Antes | Después | Δ |
|---------|-------|---------|---|
| Límite de mensajes | Sin límite (crecimiento unbounded) | Cap a 1000 | **Previene OOM en sesiones largas** |
| Evicción | — | `slice(-cap)` mantiene últimos N | **O(n) acotado** |

### 6.3 search.ts — Eliminar O(n²)

| Métrica | Antes | Después | Δ |
|---------|-------|---------|---|
| Complejidad `getDirectories` | O(n²) — `Array.from(directories)` por entrada | O(1) — referencia directa | **Elimina N² allocs** |
| `directories.size` creciendo | `flatMap` → `Array.from` por cada archivo | `directories` Set referenciado directo | **GC reduction** |

**Patrón**: `directories` era un `Set<string>` convertido a array en CADA iteración de `flatMap`. Con N archivos = N arrays temporales.

### 6.4 worker.ts — GlobalBus Cleanup

| Métrica | Antes | Después | Impacto |
|---------|-------|---------|---------|
| Listener leak en shutdown | `Bus.on(...)` sin cleanup | `on()` retorna unsubscribe, llamado en `shutdown()` | **Elimina ghost listeners** |
| Worker recreado | Listeners acumulados → memory leak por sesión | Cleanup completo en dispose | **Previene leak cross-sesión** |

### 6.5 edit.ts — Levenshtein + Replacers

| Métrica | Antes | Después | Δ |
|---------|-------|---------|---|
| Levenshtein (short, 5ch) | 173,825 ops/s | 1,040,042 ops/s | **6.0x** |
| Levenshtein (medium, 80ch) | 3,731 ops/s | 9,667 ops/s | **2.6x** |
| Levenshtein (long, 300ch) | 552 ops/s | 1,491 ops/s | **2.7x** |
| Memoria Levenshtein | O(n×m) matrix | O(min(n,m)) 2 filas | **~99% menos RAM** |
| `WhitespaceNormalizedReplacer` regex | Re-creado por cada línea match | Pre-computado 1 vez | **Elimina N regex allocs** |
| `normalizeWhitespace(line)` | 2x por línea (if+else) | 1x por línea | **2x menos normalize** |
| `removeIndentation` | Function expression por llamada | Function declaration módulo | **0 alloc por llamada** |

**Benchmark**: `benchmark-levenshtein.ts` (standalone, Bun 1.3.14)

---

## 7. Pendiente (requiere runtime o diseño)

| Ítem | Dependencia | Prioridad |
|------|-------------|-----------|
| TypeScript typecheck | `bun install` en `packages/opencode` | Alta |
| 20x benchmark verifying | Ejecución de `opencode` + medición de heap | Media |
| LSP client idle TTL | Diseño + tests | Baja |
| auth.json OS keychain | Integración Windows Credential Manager / macOS Keychain / Linux secret-tool | Baja |
| auth_token URL (browser) | Limitación inherente de browser WebSocket (no headers) | Baja |
| **watcher.ts debounce** | Coalesce eventos rápidos (git checkout flood) | **Alta** |
| **TUI index.tsx createMemo** | Eliminar `createMemo` dentro de `<For>` (Solid anti-pattern) | Media |
| Benchmark runtime full-suite | Ejecutar benchmark-suite v2 contra HEAD | Media |
| Verificar `removeIndentation` refactor | Test de regresión en `IndentationFlexibleReplacer` | Baja |
