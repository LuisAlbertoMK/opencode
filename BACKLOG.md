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
| 1 | B1: useThread=true test en binario compilado | 🟡 Pendiente | Cycle4 | Alta | require test TUI manual |
| 2 | Cross-compile script (Linux/macOS) | 🟡 Pendiente | Cycle4 | Media | build.ts ya soporta targets |
| 3 | Dead Code audit (Knip + unbarrelify) | 🟡 Pendiente | Cycle4 | Media | Pendiente desde audit inicial |
| 4 | AMARILLO tag rule: ¿solo modificados o todos? | 🟡 Pendiente | Cycle4 | Baja | Aclarar con el usuario |
| 5 | Profile service constructors (Config, DB, Auth) | 🟡 Pendiente | Cycle4 | Baja | Requiere benchmark |
| 6 | OpenTUI segfault test config | 🔴 Bloqueado | — | Media | Upstream, no fork-fixable |
| 7 | Migrar BITACORA a entries estructurados | 🟡 Pendiente | Cycle4 | Baja | Actualmente texto libre |

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
