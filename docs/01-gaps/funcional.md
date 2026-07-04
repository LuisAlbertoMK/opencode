# GAPS · Funcional · opencode-vMK
Fecha: 2026-07-03

## Hallazgos

| # | Severidad | Archivo:Línea | Descripción | Recomendación |
|---|---|---|---|---|
| 1 | 🟠 Alto | `packages/opencode/src/session/processor.ts` (15 líneas) | **V2 Dual-write masiva**: 15 ocurrencias de `// TODO(v2): Temporary dual-write while migrating session messages to v2 events.` en todo el session processor. La migración V2 no está completa y el dual-write es frágil ante cambios. Alto riesgo de inconsistencias. | Completar migración V2 de session events; eliminar ramas dual-write. |
| 2 | 🟠 Alto | `packages/core/src/tool/bash.ts:81-92` | **Bash tool con 12 TODO estructurales**: Faltan parser-based approval reduction (tree-sitter), PowerShell/Windows path handling, plugin shell.env hooks, background job status, durable progress streaming, binary output handling, HTTP observation. | Priorizar parser-based approval reduction + Windows PowerShell path handling para usuarios Windows. |
| 3 | 🟠 Alto | `packages/core/src/tool/edit.ts:83-87` | **Edit tool sin features V2**: Faltan fuzzy correction strategies, formatter integration, watcher events, snapshots/undo, LSP notification/diagnostics. | Implementar formateo vía V2 formatter runtime y LSP diagnostics después de ejecución. |
| 4 | 🟠 Alto | `packages/core/src/tool/write.ts:19,40-43` | **Write tool sin features V2**: Faltan formatter integration, watcher events, snapshots/undo, LSP notification. Ídem edit tool. | Igual que #3 — formateo + LSP post-write. |
| 5 | 🟠 Alto | `packages/core/src/tool/builtins.ts:26` | **Built-in tools incompletas**: TODO lista explícitamente `edit fuzzy parity, task, LSP, repo_clone, repo_overview, plan_exit, Rune/code mode` como faltantes. | Portar remaining launch-follow-up leaves; task tool ya existe en opencode pero falta en core. |
| 6 | 🟠 Alto | `packages/core/src/tool/apply-patch.ts:85` | **Apply-patch moves no implementados**: `"apply_patch moves are not supported yet"` — operación de rename/move vía patch no funciona. | Implementar soporte de move/rename en Patch.parse + LocationMutation. |
| 7 | 🟠 Alto | `packages/core/src/database/sqlite.node.ts:119`, `sqlite.bun.ts:119`, `packages/effect-sqlite-node/src/index.ts:135` | **executeStream() no implementado en 3 DB drivers**: `Stream.die("executeStream not implemented")`. Si alguien intenta stream de datos desde SQLite, es muerte instantánea. | Implementar `executeStream` con generación de Stream desde cursor SQLite. |
| 8 | 🟠 Alto | `packages/opencode/src/provider/transform.ts:64` | **Función `normalizeMessages` ineficiente**: Self-described `// TODO: fix this stupid inefficient dogshit function`. Procesa todos los mensajes del provider sin optimización. | Refactorizar con iteración lazy o memoización de transformaciones comunes. |
| 9 | 🟡 Medio | `packages/opencode/src/tool/tool.ts:14` | **Hack de tipos en DynamicDescription**: `// TODO: remove this hack` — `Metadata` usa `[key: string]: any`, `DynamicDescription` tipo inseguro. | Reemplazar `any` con tipos concretos o un `Schema` conocido. |
| 10 | 🟡 Medio | `specs/v2/todo.md` (secciones completas) | **V2 Work items no implementados**: Plugin API design (James?), Rework Config, Auth system (Dax?), Model Database (Dax?), Provider registration as plugins, Hotreloadable everything. | Priorizar Auth + Plugin API como bloqueante para ecosistema de plugins. Las demás son mejora continua. |
| 11 | 🟡 Medio | `specs/v2/todo.md:43-59` | **V2 Session runner features diferidas**: Background job integration con V2 tool execution, session event cursors sobre HTTP, compaction, durable interruption, retries, stale-owner fencing. | Integrar BackgroundJob con V2 tool execution y exponer event cursors. |
| 12 | 🟡 Medio | `specs/v2/todo.md:126-148` | **Deferred hardening cleanup (15 items)**: DB migration race, process-local wake lifecycle, paged aggregate replays, cross-process SQLite polling, websearch streaming, ripgrep timeout, URL resolution, OpenAI Responses hosted-tool behavior, OTel exports. | Abordar migration race + ripgrep timeout como prioritarios por ser bloqueantes de estabilidad. |
| 13 | 🟡 Medio | `packages/core/src/session/runner/to-llm-message.ts:45` | **TODO: Materialize remote and managed URIs**: Faltan resolución de URIs remotas/manejadas antes de provider-history lowering. | Implementar resolución de URIs en el pipeline de LLM message. |
| 14 | 🟡 Medio | `packages/core/src/public/opencode.ts:82,129` | **API pública incompleta**: `// TODO: Accept explicit storage` + `// TODO: Add OpenCode.create(...) Promise facade`. Faltan entry points para tests y embeddings. | Agregar `OpenCode.create(...)` como fachada Promise sobre Effect API. |
| 15 | 🟡 Medio | `packages/opencode/src/format/index.ts:140` | **Format combiner gap**: `// TODO combine formatters so shared backends like Ruff/uv don't need linked disable handling here.` | Implementar combinación de formatters para backends compartidos. |
| 16 | 🟡 Medio | `packages/opencode/src/server/routes/instance/httpapi/middleware/cors-vary.ts:11` | **CORS Vary header bug**: `// TODO: upstream a fix that merges Vary values in headersFromRequestOptions` — Vary header no se mergea correctamente. | Upstream fix al Effect HttpApi o manejar manualmente merge de Vary. |
| 17 | 🟡 Medio | `packages/opencode/src/agent/agent.ts:382` | **Provider logic bleeding**: `// TODO: clean this up so provider specific logic doesnt bleed over` — lógica específica de provider en el agente genérico. | Extraer provider-specific logic a facades/provider layer. |
| 18 | 🟡 Medio | `packages/opencode/src/account/account.ts:423` | **Multi-org UI pendiente**: `// TODO: When there are multiple orgs, let the user choose` — solo soporta 1 org. | Agregar selector de org cuando hay múltiples. |
| 19 | 🟡 Medio | `packages/opencode/src/control-plane/workspace.ts:487` | **TODO: look into `tapError`**: Error handling incompleto en workspace status management. | Implementar manejo de errores con `tapError` en lugar de catch genérico. |
| 20 | 🟡 Medio | `packages/core/src/tool/edit.ts:83` | **Edit fuzzy correction gap**: `// TODO: Port V1 fuzzy correction strategies only after exact-edit behavior is established` — no hay corrección fuzzy V1 portada. | Portar estrategias fuzzy de V1 después de estabilizar exact-edit. |
| 21 | 🟡 Medio | `packages/opencode/src/session/session.ts:446` | **Pricing model placeholder**: `// TODO: update models.dev to have better pricing model, for now` — pricing model temporal. | Revisar pricing model de models.dev. |
| 22 | 🟡 Medio | `CYCLE.md` (Cycle 10, item 10) | **585 commits behind upstream**: 585 commits de diferencia con `anomalyco/opencode` dev. De 7 cherry-picks intentados, 2 fueron revertidos por incompatibilidad estructural. Riesgo de divergencia irreversible. | Establecer sync semanal; priorizar cherry-picks de seguridad y fixes de core. |
| 23 | 🟡 Medio | `SKILLS-INDEX.md:69-70` | **2 tools de GitHub deshabilitadas**: `github-pr-search` y `github-triage` están marcadas como `⚠️ Deshabilitada en config`. | Revisar por qué están deshabilitadas y reactivar si aplica. |
| 24 | 🟢 Bajo | `packages/core/src/tool/tool.ts:31-32` | **RegistrationError subutilizado**: `RegistrationError` existe pero solo se usa en 1 lugar para validación de nombre. | Expandir uso de RegistrationError para colisiones, tool inválidas, etc. |
| 25 | 🟢 Bajo | `packages/ui/src/components/*.stories.tsx` (13+ archivos) | **TODO de accesibilidad en stories**: Múltiples componentes UI tienen TODO confirmando ARIA attributes, keyboard navigation, focus management de Kobalte. | Auditar ARIA attributes de Kobalte y resolver TODOs de accesibilidad. |
| 26 | 🟢 Bajo | `packages/opencode/src/tool/task.ts` | **Background task implementado pero bash tool background no**: Task tool soporta background mode pero bash tool explícitamente postpone background jobs. | Unificar modelo de background jobs entre tools. |
| 27 | 🟢 Bajo | `packages/core/src/tool/todowrite.ts:49` | **ToolFailure genérico**: `new ToolFailure({ message: "Unable to update todos" })` — sin detalle del error real. | Incluir causa del error en ToolFailure message. |
| 28 | 🟢 Bajo | `packages/core/src/session/runner/publish-llm-event.ts:36` | **Catch vacío en publish-llm-event**: `} catch {` — traga errores de publicación de eventos LLM. | Loggear el error en lugar de silenciarlo. |
| 29 | 🟢 Bajo | `packages/core/src/database/path.ts:91` | **Silent fallback en JSON parse**: `try { items = JSON.parse(input) as string[] } catch { return [] }` — corrupción de datos silenciosa. | No silenciar error de parse; propagar o al menos loggear. |
| 30 | 🟢 Bajo | `packages/opencode/src/cli/cmd/github.handler.ts:170` | **GitHub Copilot guide hidden**: `// TODO: add guide for copilot, for now just hide it`. | Implementar guide para GitHub Copilot. |
| 31 | 🟢 Bajo | `packages/opencode/src/plugin/index.ts:234` | **Eventos de plugin no categorizados**: `// TODO: make proper events for this`. | Crear tipos de eventos propios para plugin lifecycle. |
| 32 | 🟢 Bajo | `packages/core/src/config/markdown.ts:7,15` | **Silent failures en markdown config**: Dos catch vacíos en parsing de markdown config — errores silenciados. | Loggear errores de parse en lugar de tragar. |
| 33 | 🟢 Bajo | `packages/core/src/session.ts:252` | **TODO: Restore recorded sessions**: `// TODO: Restore recorded sessions onto replacement synchronized workspaces`. | Implementar restore de sesiones grabadas. |
| 34 | 🟢 Bajo | `packages/tui/src/parsers-config.ts:153` | **Tree-sitter injections rotas**: `// TODO: Injections not working for some reason`. | Debuggear y fixear injections de tree-sitter. |
| 35 | 🟢 Bajo | `packages/tui/src/parsers-config.ts:287` | **Tree-sitter-nix WASM placeholder**: `// TODO: Replace with official tree-sitter-nix WASM when published`. | Monitorear publicación oficial de tree-sitter-nix WASM. |
| 36 | 🟢 Bajo | `packages/tui/src/component/prompt/index.tsx:401` | **Comando propio pendiente**: `// TODO: this should be its own command`. | Extraer a comando independiente. |
| 37 | 🟢 Bajo | `SKILLS-INDEX.md:49` | **Skill `core-web-vitals` no instalada**: Única skill del roadmap no cubierta. Prioridad Baja. | Instalar si hay necesidad de optimización web. |
| 38 | 🟢 Bajo | `packages/core/src/tool/read-filesystem.ts:22` | **BinaryFileError extiende Error (no Schema.TaggedError)**: Inconsistencia con el patrón de errores del proyecto. | Migrar a `Schema.TaggedErrorClass`. |
| 39 | 🟢 Bajo | `packages/core/src/util/retry.ts:41` | **Retry lanza error genérico**: `throw lastError` sin tipado — pierde información de causa. | Usar efecto tipado con error específico de retry. |
| 40 | 🟢 Bajo | `packages/opencode/src/session/prompt.ts:1068,1083` | **Dual-write también en prompt.ts**: 2 ocurrencias adicionales de V2 dual-write fuera de processor.ts. | Incluir en migración V2 (#1). |

## Resumen

| Severidad | Cantidad |
|-----------|:--------:|
| 🔴 Crítico | 0 |
| 🟠 Alto | 8 |
| 🟡 Medio | 15 |
| 🟢 Bajo | 17 |
| **Total** | **40** |

## Áreas de Mayor Riesgo

1. **Migración V2 inconclusa** (Alto): 17+ lugares con dual-write temporales que son frágiles ante cambios. La especificación V2 (`specs/v2/todo.md`) lista ~15 work items no implementados que van desde Plugin API hasta Auth system.

2. **Tools core sin features clave** (Alto): Bash (12 TODOs), Edit (5 TODOs), Write (5 TODOs) — todas carecen de parser-aware approval, formatter integration, LSP diagnostics, snapshots/undo, y background job support.

3. **Database streaming roto** (Alto): `executeStream()` llama a `Stream.die()` en los 3 drivers SQLite. Cualquier feature que intente streamear datos desde SQLite muere instantáneamente.

4. **Deuda técnica upstream** (Medio): 585 commits detrás de upstream. 2/7 cherry-picks recientes fueron revertidos por incompatibilidad estructural, indicando divergencia creciente.

## Recomendaciones Prioritarias

1. Completar migración V2 de session events y eliminar dual-write.
2. Implementar `executeStream()` en al menos el driver bun (usado en producción).
3. Portar parser-based approval reduction para bash (tree-sitter).
4. Establecer sync semanal con upstream (priorizar security fixes).
5. Implementar apply-patch moves (renames).
6. Refactorizar `normalizeMessages` para mejorar performance en providers list.
