# Quick Wins — Fase 0 + Fase 1 Parcial (Completada)

> **Cycle**: 11 | **Fecha**: 2026-07-03
> **Estado**: ✅ Fase 0 completada. Fase 1: 1.1 + 1.3 completados, 1.5 evaluado (won't fix)

## Resumen

Quick Wins identificados en la auditoría multi-agente (docs/10-plan-implementacion.md), resueltos en orden de impacto.

---

## 0.1 — Parche effect huérfano 🔴

**Estado**: ✅ Resuelto  
**Archivo**: `package.json` (patchedDependencies)  
**Parche**: `patches/effect@4.0.0-beta.83.patch`  

El archivo de parche existía en disco pero NO estaba registrado en `patchedDependencies`. El parche corrige un collision de identificador OpenAPI en `HttpApiSchema.StreamSse` (el wrapper JSON del SSE reclamaba el nombre del schema de datos decodificado). Sin el parche, cualquier endpoint SSE puede tener schemas OpenAPI incorrectos.

**Verificación posterior**: 8/8 patches OK, build 126.9 MB, 7/7 TUI tests.

---

## 0.2 — SHELL_ENV_DENY +PARALLEL_API_KEY +CLOUDFLARE_API_TOKEN 🟢

**Estado**: ✅ Resuelto  
**Archivo**: `packages/opencode/src/tool/shell.ts:433`  

Agregadas dos variables de entorno al bloqueo `SHELL_ENV_DENY` (no heredadas por comandos shell del usuario):
- `PARALLEL_API_KEY` — usada por websearch tool
- `CLOUDFLARE_API_TOKEN` — usada por SST resource bindings

Estas se suman a las 5 ya bloqueadas: `AWS_BEARER_TOKEN_BEDROCK`, `AICORE_SERVICE_KEY`, `OPENCODE_AUTH_CONTENT`, `OPENCODE_SERVER_PASSWORD`, `OPENCODE_SERVER_USERNAME`.

**Nota**: Esto solo protege comandos shell (`spawn`). Los subprocesos workspace todavía heredan `OPENCODE_AUTH_CONTENT` con TODAS las claves — eso se aborda en Fase 1.1.

---

## 0.4 — knip ya configurado 🟡

**Estado**: ✅ Ya existía (no requirió acción)  
**Archivo**: `knip.json`  

knip ya está configurado en la raíz con:
- 31 entry points (todos los paquetes)
- Proyecto: `packages/*/src/**/*.ts` y `*.tsx`
- Reglas: `devDependencies: "warn"`
- Excluye: storybook, node_modules, dist, tests
- Ignora deps: @parcel/watcher-*, electron, husky, turbo, etc.

**Último reporte** (`knip_header.txt`): 218 unused files, 97 unused dependencies, 32 unused devDependencies detectados.

**Recomendación futura**: Revisar los 218 unused files — muchos pueden ser de la app web/console que no aplican a vMK.

---

## 0.6 — Logging a catch vacíos 🟢

**Estado**: ✅ Resuelto  
**Archivos modificados**:

| Archivo | Cambio |
|---|---|
| `packages/core/src/config/markdown.ts:7,15` | `catch {}` → `catch (e) { console.warn(...) }` con `inspect(e)` antes de fallback |
| `packages/core/src/database/path.ts:91` | `catch { return [] }` → `catch (e) { console.warn(...); return [] }` |

**No modificados** (patrones intencionales con fallback):
- `packages/core/src/session/runner/publish-llm-event.ts:36` — `catch { return String(value) }` tiene return, no es vacío
- `packages/core/src/session/runner/to-llm-message.ts:27` — `catch { // fall through }` tiene comentario documentado

---

## Verificación Post-Fase 0

| Check | Resultado |
|---|---|
| Build | ✅ 126.9 MB |
| Smoke test | ✅ `--version` exit 0 |
| TUI tests | ✅ 7/7 PASS |
| Patch integrity | ✅ 8/8 OK |
| vMK safety check | ✅ `opencode-vMK.exe` correcto |

---

---

## Fase 1 — Seguridad (Parcial)

### 1.1 — OPENCODE_AUTH_CONTENT eliminado 🔴

**Estado**: ✅ Completado (incremental, no IPC full)
**Archivos afectados**:
- `packages/opencode/src/control-plane/workspace.ts` — removida línea `OPENCODE_AUTH_CONTENT: JSON.stringify(yield* auth.all())`
- `packages/opencode/src/auth/index.ts` — se mantiene el check `process.env.OPENCODE_AUTH_CONTENT` como debug override
- `packages/opencode/src/tool/shell.ts` — actualizado comment de SHELL_ENV_DENY
- `packages/opencode/test/control-plane/workspace.test.ts` — removida assertion de env var

**Qué cambió**: Los workspace subprocessos ahora leen el archivo `auth.json` cifrado directamente desde el filesystem (en lugar de recibir todas las credenciales como env var). La clave de cifrado se deriva del hostname + homedir (igual que antes), así que funciona transparentemente.

**Trade-off consciente**: No se implementó IPC socket full (3-5 días). El fix actual elimina el vector de exposición masiva de credenciales. La mejora completa (Fase 1.1 real) requeriría IPC socket con auth por demanda.

### 1.3 — Deny-list de comandos peligrosos en bash.ts 🟠

**Estado**: ✅ Completado
**Archivo**: `packages/core/src/tool/bash.ts`

Agregada función `isDangerous()` con 16 patrones bloqueados:

| Patrón | Descripción |
|---|---|
| `rm -rf /` | Recursive root delete |
| `rm --no-preserve-root` | Bypass safety flag |
| `:(){ ... };:` | Fork bomb |
| `dd if=/dev/zero of=/` | Disk fill |
| `> /dev/sda` (etc) | Block device write |
| `mkfs` | Filesystem creation |
| `mkswap` | Swap creation |
| `shutdown` / `reboot` / `halt` / `poweroff` | System control |
| `chmod -R 777 /` | World-writable root |
| `chown -R / ` | Ownership change |
| `curl ... \| sh` | Pipe remote script to shell |
| `wget --mirror ... \| sh` | Pipe remote mirror to shell |

El bloqueo ocurre **antes** de cualquier side effect (antes de `ChildProcess.make`). Retorna un `ToolFailure` con mensaje descriptivo.

### 1.5 — process.env mutation (evaluado, won't fix) 🟡

**Estado**: ⏭️ Evaluado — no se implementó
**Archivo**: `packages/opencode/src/provider/provider.ts`

El patrón JIT (just-in-time) para `AWS_BEARER_TOKEN_BEDROCK` y `AICORE_SERVICE_KEY` en `getModel()`:
1. Guarda valor previo
2. Setea env var
3. Ejecuta SDK call
4. Restaura valor previo en `finally`

**Razón para no cambiar**: Es el estándar para SDKs que requieren env vars. No se puede evitar sin forkear los SDKs. El window de exposición es mínimo (try/finally bloque síncrono). SHELL_ENV_DENY ya bloquea fuga a child processes.

---

## Siguientes Pasos

Ver `docs/10-plan-implementacion.md` para el plan completo. Pendiente para próximo ciclo:
- **Fase 1.2**: Migrar cifrado auth.json a keychain del SO (5-7 días)
- **Fase 1.4**: Tree-sitter AST parsing para shell commands (3-5 días)
- **Fase 4 (Linter)**: 4.1 Configurar biome/eslint, 4.2 Eliminar 192 `any`
