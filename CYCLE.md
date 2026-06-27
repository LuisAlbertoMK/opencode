# Improvement Cycle 3 — opencode vMK

> **Cycle**: 2026-06-26 — Build Stability & Cycle Activity Recovery
> **Objective**: Elevar Cycle Activity de 7.0 → 8.5 y asegurar compilación estable del binario vMK
> **Status**: 🔶 In Progress

## Metrics

| Métrica | Target | Actual | Delta |
|---------|--------|--------|-------|
| **Project Score** | 9.0/10 | 8.7/10 | +0.5 |
| **Cycle Activity** | 8.5 | 7.0 | +1.5 |
| **Project Artifacts** | 9.0 | 8.0 | +1.0 |
| **Metrics** | 9.0 | 8.0 | +1.0 |
| **Backlog Integrity** | 9.0 | 8.0 | +1.0 |
| **inter** | 30 | 4 | +4 |

## Difficulty Mapping

| Dificultad | Criterio | Verification |
|------------|----------|-------------|
| **Fácil** | Archivos faltantes, config, docs | None (zona verde) |
| **Media** | Script de build, package.json | 3 subagentes |
| **Compleja** | Cambios a src/ (ZONA AMARILLA) | 3 subagentes |
| **Muy Compleja** | Refactor cross-package, CI/CD | 3 subagentes + verificación cruzada |

## Tasks

| # | Task | Difficulty | Status | inter |
|:---|:---|:---:|:---:|:---:|
| 1 | Fix Bun compile — static command registry `_registry.ts` | Compleja | ✅ Done (Cycle2) | 3 |
| 2 | Fix vmk.cmd ANSI VT quoting | Fácil | ✅ Done (Cycle2) | 1 |
| 3 | Refresh `.project.json` con métricas post-fix (8.5→8.7) | Media | ✅ Done | 1 |
| 4 | Evaluar otros `import()` dinámicos en codebase | Media | ✅ Done — 7 críticos (runtime, no reparables), 1 mitigado (nuestro fix), ~40 warning | 2 |
| 5 | Refresh `docs/operations/project-score.md` | Fácil | ✅ Done | 1 |

## Exit Criteria

- inter ≥ 30
- Project Score ≥ 9.0
- No dimension below 8.0
- Cycle Activity ≥ 8.5

## Rollback

Si el score cae >0.5 puntos tras algún cambio, revertir el cambio y registrar
en BITACORA.md con causa raíz.
Commit de referencia: `23a14de3b` (Cycle2: build fix + vmk.cmd)
