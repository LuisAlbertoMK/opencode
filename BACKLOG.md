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
| 1 | B1: useThread=true test en binario compilado | 🔶 En progreso | Cycle5 | Alta | ✅ No crash en init (timeout 3s). Pendiente: test TUI interactivo completo |
| 2 | Parallel plugin loading (100-500ms boot win) | 🟡 Pendiente | Cycle5 | Alta | `packages/opencode/src/plugin/index.ts` — 10 internal plugins en for..of secuencial. Riesgo: orden de hooks determinista. Pendiente: benchmark antes/después |
| 3 | Deferred non-critical config loading | 🟡 Pendiente | Cycle5 | Media | `packages/opencode/src/config/config.ts` — remote configs y `.opencode` scan secuenciales |
| 4 | Lazy database connection | 🟡 Pendiente | Cycle5 | Media | `packages/core/src/database/database.ts` — ZONA ROJA parcial. Requiere upstream sync |
| 5 | Boot chain audit completada | ✅ Hecho | Cycle5 | — | 3 candidatos identificados. Cold boot est: 300ms-1s |
| 6 | Cross-compile script (Linux/macOS) | ✅ Hecho | Cycle4 | Media | `scripts/vmk-cross-compile.ps1` + build.ts nativo |
| 7 | Dead Code audit (Knip) | ✅ Hecho | Cycle4 | Media | 236 unused files (mayoría out-of-scope) |
| 8 | AMARILLO tag rule: ¿solo modificados o todos? | 🟡 Pendiente | Cycle5 | Baja | Aclarar con el usuario |
| 9 | OpenTUI segfault test config | 🔴 Bloqueado | — | Media | Upstream, no fork-fixable |

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
