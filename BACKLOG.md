# Backlog — opencode vMK

> Tracking formal de items del manifiesto, ciclos de mejora y deuda técnica.
> Los issues de GitHub están deshabilitados en el fork — este archivo es la
> fuente de verdad para el backlog.

## Estado

| Estado | Significado |
|--------|-------------|
| 🔴 Bloqueado | Depende de upstream o externo |
| 🟡 Pendiente | Priorizado pero no empezado |
| 🔶 En progreso | Asignado y en trabajo |
| ✅ Completado | Entregado y verificado |
| ❌ Skip | Evaluado y descartado |

## Abierto

| # | Item | Estado | Ciclo | Prioridad | Notas |
|:-:|:-----|:------:|:-----:|:---------:|:------|
| 1 | B1: useThread=true test en binario compilado | ✅ Hecho | Cycle5 | Alta | 2026-07-02: test completo creado (scripts/vmk-tui-test.ps1) — 7/7 tests: source regression guard, build, --help, --version, providers list, models, headless server 5s alive |
| 2 | Parallel plugin loading (100-500ms boot win) | ❌ Skip | Cycle5 | Alta | Análisis codebase-memory: el PluginLoader.loadExternal() YA corre en paralelo (Promise.all). La parte secuencial (applyPlugin) es <10ms. La estimación 100-500ms era incorrecta |
| 3 | Deferred config loading — remote configs paralelo | ✅ Hecho | — | Alta | 2026-07-02: wellknown auth entries paralelizadas (antes secuencial, 2 HTTP reqs c/u). Project config files también paralelizados. Tags `// vMK:` en config.ts |
| 4 | Lazy database connection | ❌ Skip | Cycle5 | Media | 2026-07-02: análisis muestra que DB ya es lazy por comando (--help/--version ni tocan AppRuntime). Refactor intra-handler requiere cambios en upstream. Skip como #2 |
| 5 | Boot chain audit completada | ✅ Hecho | Cycle5 | — | 3 candidatos identificados |
| 10 | MCP Token Budget — truncateLimit por server | ✅ Hecho | — | Alta | implementado |
| 11 | MCP Token Budget — instrucciones al agente | ✅ Hecho | — | Alta | sección en AGENTS.md |
| 6 | Cross-compile script (Linux/macOS) | ✅ Hecho | Cycle4 | Media | `scripts/vmk-cross-compile.ps1` |
| 7 | Dead Code audit + cleanup | ✅ Hecho | Cycle4 | Media | 236 unused files (Knip). 2026-07-02: eliminados 14 archivos dead en packages/opencode (parsers-config.ts, 6 scripts, 1 spec), plugin (1 publish, 2 examples), sdk/js (1 example, 1 publish), effect-drizzle-sqlite (1 example). 1 skip (queryKeySerializer.gen.ts — importado). Build + typecheck OK |
| 8 | AMARILLO tag rule — formalizar en AGENTS.md | ✅ Hecho | Cycle5 | Baja | **Decisión**: Inline `// vMK:` en TODA línea modificada (obligatorio) + Header `// vMK:` en cambios arquitectónicamente significativos (opcional). AGENTS.md actualizado. |
| 9 | OpenTUI segfault test config | 🔴 Bloqueado | — | Media | Upstream, no fork-fixable |
| 12 | LSP idle TTL — evicción automática de clientes inactivos | ✅ Hecho | — | Media | 2026-07-02: 30min TTL + scan periódico (5min). `ClientEntry` wrapper con `lastUsed`. Tags `// vMK:` en lsp.ts |
| 13 | LSP pruneFiles LRU + didClose | ✅ Hecho | — | Media | 2026-07-02: evicción por orden de uso (no first-N), + `textDocument/didClose` al server. Tags `// vMK:` en client.ts |
| 14 | SKILLS-INDEX.md actualizado — 69 skills instaladas | ✅ Hecho | — | Baja | 2026-07-02: refleja skills reales en `.vmk-config/skills/` |
| 15 | `noUncheckedIndexedAccess` — todos los packages | ✅ Hecho | — | Alta | 2026-07-02: rollout completo en 23 packages. ~130 errores fijados en tui/ui/enterprise. 22/23 pasan typecheck. console-app: pre-existing TS2339. Score: errorPrevention 10/10 |
| 16 | LSP clients Array — memory leak histórico | ✅ Hecho | — | Media | 2026-07-02: idle TTL + LRU files. Ver #12 y #13 |

## Completado (ciclos anteriores)

| # | Item | Ciclo | Completado en |
|:-:|:-----|:-----:|:-------------|
| A1 | drop console/debugger | Cycle1 | ✅ |
| A2 | Heap thresholds (512/768MB) | Cycle1 | ✅ |
| A3 | batch() multi-signal footer | Cycle1 | ✅ |
| A4 | smol=true | Cycle1 | ✅ |
| B3 | Lazy CLI commands (registry fix) | Cycle2 | 23a14de3b |
| C2 | Knip remove @hono/zod-validator | Cycle1 | ✅ |
| — | Score refresh 8.5→8.7 | Cycle3 | 1e0d77a79 |
| — | Dynamic import audit | Cycle3 | 23487603a |
| — | AMARILLO tags (4 files) | Cycle3 | 74e16de9a |
| — | BITACORA session log | Cycle3 | 6f36bd1c6 |
| — | Scoring guide | Cycle4 | 8485ab332 |

## Vínculos

- [VMK-MANIFEST.md](VMK-MANIFEST.md) — principios rectores y zonas
- [CYCLE.md](CYCLE.md) — ciclo activo de mejora
- [docs/ciclos/](docs/ciclos/) — reportes por ciclo
- [docs/operations/scoring-guide.md](docs/operations/scoring-guide.md) — cómo se mide el proyecto
