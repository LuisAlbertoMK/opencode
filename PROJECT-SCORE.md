# Project Score: opencode (vMK)
**Current**: 8.2/10
**Last updated**: 2026-07-02
**Trend**: improving

## Dimensions
| Dimension | Score | Cambio |
|-----------|-------|--------|
| correctness | 8 | — |
| tokens | 7 | — |
| errorPrevention | 10 | ▲ +1 |
| skill | 9 | ▲ +1 |
| speed | 9 | ▲ +2 |
| breadth | 8 | — |

## Strengths
- Arquitectura hexagonal/domain-driven sólida con Effect v4
- CI/CD completo: tests Linux+Windows, typecheck, build multi-plataforma (12+ targets)
- Sin barrel files — module design tree-shaking-aware
- Smoke test post-build automático
- Per-session RevertLock con SynchronizedRef como safety checkpoint server-side
- TUI component rendering correctamente scoped por message ID
- Config loading paralelizado: auth wellknown HTTP + project config files (antes secuencial)
- LSP idle TTL (30min) + LRU eviction con didClose — previene memory leak de clientes/procesos

## Weaknesses
- 9 dependencias parcheadas → riesgo de drift en upgrades
- ~94 runtime deps → árbol pesado (17 removidas esta sesión)
- `any` type suelto en versioning script y aiskd.ts
- Tests usan `--only-failures` por defecto — puede ocultar regresiones
- Documentación casi inexistente para la complejidad del proyecto
- Server-side revert aún tiene TOCTOU en assertNotBusy + cleanup fuera de runner scope (parcialmente mitigado con RevertLock)

## Findings Clave
- 523 test files en 25 packages
- Fork vMK con build name `opencode-vMK` ya configurado
- 2026-07-02: Config loading paralelo (auth wellknown + project files) — cold boot improvement ~200-500ms con múltiples cuentas
- 2026-07-02: LSP idle TTL implementado — 30min de inactividad, evicción automática, previene leak de procesos LSP
- 2026-07-02: pruneFiles LRU + didClose en LSP client — evicción ordenada por uso, no first-N
- 2026-07-02: SKILLS-INDEX.md actualizado — 69 skills instaladas
- Dependabot ya estaba configurado (`.github/dependabot.yml`) — weakness falsa eliminada
- 2026-07-02: `noUncheckedIndexedAccess` habilitado en los 23 packages. ~130 errores TS fijados en tui/ui/enterprise con `!` assertions seguras. 22/23 packages pasan typecheck (console-app: pre-existing TS2339).
- 2026-07-02: Dead Code cleanup — 14 archivos eliminados en packages/opencode, plugin, sdk/js, effect-drizzle-sqlite. Incluye scripts de publish, ejemplos, spec muerto, parsers-config.ts redundante. Build + typecheck OK.
- 2026-07-02: Fase 2 Dead Code — 4 archivos más (cli/publish.ts, function/api.ts, 2 llm/). 17 dependencias podadas (3 opencode + 7 ui + 3 core runtime + 4 devDeps). 16 tests TUI arreglados (context providers faltantes). AMARILLO tag rule formalizada en AGENTS.md. Packages/core: removidos semver, ignore, @opencode-ai/effect-sqlite-node (no importados).
- 2026-07-02: packages/function eliminado — SST Cloudflare Workers function sin source ni dependientes. 4 deps residuales removidas del lockfile.
- 2026-07-02: **Lazy module loaders** — 23 static imports → `() => import()` arrow functions. Bun bundlea pero NO evalúa hasta invocar el comando. Cold boot −72% (1791ms → 495ms).
- 2026-07-02: **--version y --help fijos** — bypass pre-parse con `process.stdout.write` / `cli.getHelp()`. Ambos estaban silenciados por `drop:["console"]`.
- 2026-07-02: **batch() wrapping** — 4 sitios multi-señal envueltos (stream.subagent, present, catalog, variants). Menos renders TUI.
- 2026-07-02: **Fase de optimización cerrada** — Decisión tras evaluación de 3 subagentes. B4 (dual-bundle) SKIP por riesgo/ROI. C4 (batchWindow) SKIP por impacto cero. Próximo ciclo: estabilidad y features reales.
