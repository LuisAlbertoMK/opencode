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

## Segunda ronda — Pre-push hook (bun turbo typecheck: 29 packages)

Al hacer push, el hook `pre-push` ejecuta `bun turbo typecheck` en los **29 packages** del monorepo. Esto destapó errores adicionales que no aparecían al hacer typecheck desde cada package individual:

### Fix #10 — enterprise: symlink roto custom-elements.d.ts (2 errores)
✅ `packages/enterprise/src/custom-elements.d.ts` contenía `../../ui/src/custom-elements.d.ts` como texto plano (symlink no resuelto por git en Windows). Fix: `/// <reference path="..." />`.

### Fix #11 — cross-package @/ fallback para tui, server, cli, opencode
✅ tsgo, al typechequear workspace dependencies, usa el **tsconfig del package invocador** (no el de core). Esto causaba 9 errores `Cannot find module '@/util/platform'` en archivos de `../core/src/`. Fix: agregar `"../core/src/*"` como fallback en `paths` de cada package que dependa de core:
- `packages/tui/tsconfig.json`
- `packages/server/tsconfig.json`
- `packages/cli/tsconfig.json`
- `packages/opencode/tsconfig.json`

### Fix #12 — app: symlink roto custom-elements.d.ts (2 errores)
✅ Mismo fix que enterprise.

### Fix #13 — Funciones huérfanas eliminadas en dead code cleanup (3 packages afectados)
✅ El commit `refactor(core): evict stale BackgroundJob entries, dead code cleanup` eliminó funciones que **otros packages** todavía importaban:
- `core/util/encode.ts`: restaurado `sampledChecksum()` (usado por `ui`)
- `core/util/path.ts`: restaurado `getDirectory()` (usado por `ui`) y `getFilenameTruncated()` (usado por `app`)

### Resultado final

```
bun turbo typecheck
• Packages in scope: 29
• Tasks: 23 successful, 23 total
• Cached: 20 cached, 23 total
• Failed: NONE ✅
```

## Métricas post-fix (FINAL)

| Métrica | Antes | Después | Diferencia |
|---------|-------|---------|------------|
| Errores typecheck **core** | ~25 | **0** | ✅ -25 |
| Errores typecheck **opencode** | ~45 | **0** | ✅ -45 |
| Errores typecheck **turbo 29 packages total** | ❌ roto | **23/23 tasks pass** | ✅ |
| Errores lint (oxlint) | ❌ roto | ✅ 0E/216W | ✅ |
| Runtime `--version` | ❌ | ✅ `local` | ✅ |
| Runtime `--help` | ❌ | ✅ Todos los comandos | ✅ |
| `bun install --frozen-lockfile` | ❌ | ✅ Lockfile sincronizado | ✅ |
| Custom elements (app, enterprise) | ❌ symlinks rotos | ✅ triple-slash refs | ✅ |
| Cross-package tsgo artifacts | — | **0** (path fallbacks) | ✅ |

## Commits realizados (sesión completa)

```
fae835779 fix: infra completa — tsconfig paths, oxlint, runtime, typecheck 0 errors
052c7fe1a fix(enterprise): broken custom-elements.d.ts symlink -> triple-slash ref
1d71ea55d fix(tui): add core src path fallback for cross-package @/ resolution
ea5620571 fix(core): restore sampledChecksum and getDirectory removed in dead code cleanup
efce3b3a0 fix(app): broken custom-elements.d.ts symlink -> triple-slash ref
fa90339d9 fix(core): restore getFilenameTruncated removed in dead code cleanup
809031e62 fix(server): add core src path fallback for cross-package @/ resolution
ddf3a269f fix(cli): add core src path fallback for cross-package @/ resolution
d376f31fe fix(opencode): add core src path fallback for cross-package @/ resolution
```

## Lecciones aprendidas

1. **tsgo + workspace dependencies**: tsgo NO resuelve `@/` paths cuando typecheckea archivos de otro workspace (usa el tsconfig del package invocador). Si un package depende de `@opencode-ai/core` con imports `@/`, necesita `"../core/src/*"` como fallback en su propio tsconfig.
2. **Symlinks en Windows/git**: git puede no resolver symlinks correctamente en Windows, dejando archivos `.d.ts` con contenido textual de ruta. Siempre usar `/// <reference path="..." />` en vez de confiar en symlinks.
3. **Dead code cleanup**: antes de eliminar exports, verificar TODOS los consumers del monorepo con `grep`. Un refactor en core puede romper packages aparentemente no relacionados (ui, app, etc.).

