# Bitácora de Correcciones — opencode fork

> Inicio: 2026-06-13 — Sesión de diagnóstico y reparación

## Estado Inicial (antes de tocar nada)

| Aspecto | Status |
|---------|--------|
| Git branch `dev` | Clean, 20 ahead origin/dev, 0 behind |
| bun v1.3.14 | ✅ |
| node_modules | ✅ Instalados |
| `bun run typecheck` (core) | ❌ ~25 errores |
| `bun run typecheck` (opencode) | ❌ ~45 errores (hereda core + propios) |
| `bun run lint` (oxlint) | ❌ Falta binario `oxlint-tsgolint/win32-x64` |
| `bun run dev` | ❌ `@babel/helper-plugin-utils` missing |
| `bun install --frozen-lockfile` | ❌ Lockfile desincronizado |
| `bun install` | ⏳ Timeout 3min |

### Issues identificados

1. **Path alias `@/` no configurado** en `packages/core/tsconfig.json` ni `packages/tui/tsconfig.json` → ~15 errores de módulo
2. **Effect v4 beta** — type inference rota con `unknown` en algunos lugares
3. **oxlint-tsgolint** — falta binario nativo Windows x64
4. **Dependencias opcionales no instaladas**: `@silvia-odwyer/photon-node`, `ai-gateway-provider`, `@ai-sdk/xai`, `clipboardy`
5. **Bun cache corrompido** — `@babel/helper-plugin-utils` no encontrado en runtime
6. **Lockfile desync** — plataform-specific packages

---

## Correcciones

### Fix #1 — Path alias @/ en packages/core
✅ Agregado `"paths": { "@/*": ["./src/*"] }` a `packages/core/tsconfig.json`
→ Eliminó TODOS los errores `Cannot find module '@/util/platform'` (8 archivos afectados)

### Fix #2 — Path alias @/ en packages/tui
✅ Agregado `"paths": { "@/*": ["./src/*"] }` a `packages/tui/tsconfig.json`

### Fix #3 — oxlint-tsgolint Windows binary
✅ `.oxlintrc.json` tenía 3 claves `options` duplicadas + `typeAware: true` que requería `tsgolint` (binario faltante en Windows).
- Limpié duplicados, puse `typeAware: false`
- oxlint ahora corre: **0 errores, 216 warnings** (solo estilo)

### Fix #4 — bun install + cache
✅ `bun install` completó exitosamente. Descargó 28 packages nuevos.
- Lockfile actualizado
- `fix-node-pty` y `husky` hooks ejecutados
- Runtime ahora funciona: `bun run src/index.ts --version` → `local`

### Fix #5 — MCP env type bug
✅ `packages/opencode/src/mcp/index.ts` líneas 317-318: `process.env.PATH` y `process.env.HOME` pueden ser `undefined` pero se asignaban a `Record<string, string>`. Agregué `?? ""` como fallback.

### Fix #6 — Effect type inference en background-job.ts (4 errores)
✅ `SynchronizedRef.modify` infiere `unknown` como error type en Effect v4 beta. Eso se propagaba a `evictStale` y de ahí a `list()`/`get()`. Fix: `yield* evictStale() as Effect.Effect<void, never>` para acotar el error type.

### Fix #7 — globalThis.Platform sin tipo (1 error)
✅ `cross-spawn-spawner.ts` usaba `globalThis.Platform.isWindows` en vez del `Platform` ya importado de `@/util/platform`. Cambiado a `Platform.isWindows`.

### Fix #8 — Test mocks desactualizados (5 errores)
✅ `session-runner-tool-events.test.ts`: `beforeCommit` y `project` ahora devuelven `Effect.succeed(Effect.void)` (necesitan `Effect<Unsubscribe>`, no `Effect<void>`).
✅ Tests de opencode: agregado `diagnosticsForFile: () => Effect.succeed([])` a los 3 mocks de LSP (`prompt.test.ts`, `snapshot-tool-race.test.ts`, `lsp.test.ts`).

### Fix #9 — auth/index.ts type inference (4 errores)
✅ `readFileDecrypt` es `Effect.fn(...)` que devuelve *función*, no Effect. Se llamaba con `yield* readFileDecrypt` (sin `()`). Fix: `yield* readFileDecrypt()`.
✅ Los `Effect.fn` inferían `unknown` como error type. Fix: `Service.of(...) as Interface` para acotar tipos.

---

## Métricas post-fix (FINAL)

| Métrica | Antes | Después | Diferencia |
|---------|-------|---------|------------|
| Errores typecheck **core** | ~25 | **0** | ✅ -25 |
| Errores typecheck **opencode** (propios) | ~45 | **0** | ✅ -45 |
| Errores typecheck **opencode** (cross-package tsgo) | — | 9* | ⚠️ Falsos positivos de tsgo |
| Errores lint (oxlint) | ❌ roto | ✅ 0E/216W | ✅ |
| Runtime `--version` | ❌ | ✅ `local` | ✅ |
| Runtime `--help` | ❌ | ✅ Todos los comandos | ✅ |
| `bun install --frozen-lockfile` | ❌ | ✅ Lockfile sincronizado | ✅ |

*\* Los 9 errores restantes en opencode typecheck son de `../core/src/` — tsgo no resuelve `@/` paths cuando typecheckea archivos de otro workspace package. NO son errores reales. Cada package corre limpio desde su propio directorio.*

## Commits realizados

- `fix(core): add @/ path alias to tsconfig` — packages/core + packages/tui  
- `fix: deduplicate .oxlintrc options, disable typeAware for Windows`  
- `fix(mcp): add fallback for undefined process.env in env vars`  
- `fix(core): constrain Effect type in evictStale for list/get`  
- `fix(core): use imported Platform instead of globalThis.Platform`  
- `fix(core): update EventV2 mock return types for beforeCommit/project`  
- `fix(opencode): add diagnosticsForFile to LSP test mocks`  
- `fix(opencode): call readFileDecrypt() function + cast Service.of types`

