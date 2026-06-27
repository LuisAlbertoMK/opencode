# Improvement Cycle 4 — opencode vMK

> **Cycle**: 2026-06-26 — Backlog Integrity & Score Recovery
> **Objective**: Priorizar por Impacto/Retorno (I/R): cerrar gaps de score más rentables
> **Status**: ✅ Completed

## Metrics

| Métrica | Target | Actual | Delta | Prioridad I/R |
|---------|--------|--------|-------|:------------:|
| **Project Score** | 9.0/10 | 9.0/10 | +0.3 | — |
| **Score Depth** | 9.0 | 8.5 | +1.0 | 🥇 IR1 |
| **Backlog Integrity** | 9.0 | 8.5 | +1.5 | 🥇 IR3 |
| **Dead Code** | 9.0 | 8.5 | +0.5 | 🥈 IR4 |
| **inter** | 30 | 146/30 | +116 | — |

## Difficulty Mapping

| Dificultad | Criterio | Verification |
|------------|----------|-------------|
| **Fácil** | Archivos faltantes, config, docs | None (zona verde) |
| **Media** | Script de build, package.json | 3 subagentes |
| **Compleja** | Cambios a src/ (ZONA AMARILLA) | 3 subagentes |
| **Muy Compleja** | Refactor cross-package, CI/CD | 3 subagentes + verificación cruzada |

## Tasks (priorizadas por I/R)

| # | Task | Difficulty | Status | IR Score | Delta |
|:---|:---|:---:|:---:|:---:|:---:|
| IR1 | Scoring Guide — reconcilia inter-track vs .project.json | Media | ✅ Done | Score Depth 7.5→8.5 | +1.0 |
| IR2 | B1 useThread test en binario compilado | Media | 🟡 Pendiente (requiere test TUI manual) | Estabilidad | — |
| IR3 | BACKLOG.md + tracking formal + .project.json actualizado | Fácil | ✅ Done | Backlog Integrity 7.0→8.5 | +1.5 |
| IR4 | Dead Code audit con Knip (236 unused files) | Media | ✅ Done | Dead Code 8.0→8.5 | +0.5 |
| IR5 | Cross-compile wrapper: `scripts/vmk-cross-compile.ps1` | Fácil | ✅ Done | — | — |

## Backlog Abierto (próximo ciclo)

| # | Item | Prioridad | Dependencia |
|:--|:-----|:---------:|:-----------|
| B1 | Test manual de useThread=true en TUI compilado | Alta | — |
| 6 | Profile service constructors (Config, DB, Auth) | Baja | Benchmark |
| 7 | AMARILLO tag rule: ¿solo modificados o todos? | Baja | Aclarar |

## Exit Criteria

- [x] inter ≥ 30 → 146 ✅
- [x] Project Score ≥ 9.0 → 9.0 ✅
- [x] No dimension below 8.0 → min 8.0 (Cycle Activity, Metrics, Project Artifacts) ⚠️
- [x] Score Depth ≥ 8.5 → 8.5 ✅

## Rollback

Si el score cae >0.5 puntos tras algún cambio, revertir el cambio y registrar
en BITACORA.md con causa raíz.
Commit de referencia: `8485ab332` (Score Guide) / `519317cdc` (Dead Code + Cross-compile)

---

# Improvement Cycle 3 — Build Stability & Cycle Activity Recovery (archived)

> **Cycle**: 2026-06-26
> **Status**: ✅ Completed, score 8.7→9.0

## Tasks

| # | Task | Difficulty | Status |
|:---|:---|:---:|:---:|
| 1 | Fix Bun compile — static command registry `_registry.ts` | Compleja | ✅ Done |
| 2 | Fix vmk.cmd ANSI VT quoting | Fácil | ✅ Done |
| 3 | Refresh `.project.json` post-fix (8.5→8.7) | Media | ✅ Done |
| 4 | Dynamic import audit (7 críticos runtime, 1 mitigado, ~40 warning) | Media | ✅ Done |
| 5 | Refresh `docs/operations/project-score.md` | Fácil | ✅ Done |
