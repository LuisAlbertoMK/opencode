# Improvement Cycle — opencode vMK

> **Cycle**: 2026-06-22 — Project Health Recovery
> **Objective**: Elevar project score de 6.8 → 7.5 cerrando gaps críticos
> **Status**: Active

## Metrics

| Métrica | Target | Actual | Delta |
|---------|--------|--------|-------|
| **Project Score** | 7.5/10 | 6.8/10 | +0.7 |
| **Correctness** | 8 | 7 | +1 |
| **Error Prevention** | 8 | 6 | +2 |
| **Tokens** | 8 | 7 | +1 |
| **inter(30)** | 30 | 28 | +2 |

## Difficulty Mapping

| Dificultad | Criterio | Verification |
|------------|----------|-------------|
| **Fácil** | Archivos faltantes, config | None (zona verde) |
| **Media** | Scripts de package.json | Triple verify L1 |
| **Compleja** | tsconfig, CI/CD | Triple verify L2 |
| **Muy Compleja** | Dependabot/Coverage infra | Triple verify L3 |

## Tasks

| # | Task | Difficulty | Status | inter |
|---|------|------------|--------|-------|
| 1 | Remove `--only-failures` from all package.json `test` scripts | Fácil | ✅ Done | 1 |
| 2 | Create `SKILLS-INDEX.md` | Fácil | ✅ Done | 1 |
| 3 | Create `CYCLE.md` | Fácil | ✅ Done | 1 |
| 4 | Enable `github-triage` + `github-pr-search` tools | Media | ✅ Done | 2 |
| 5 | Create `.github/dependabot.yml` | Media | ✅ Done | 2 |
| 6 | Add `--timeout 30000` to packages/core test script | Fácil | ✅ Done | 1 |
| 7 | Add coverage gate to CI test.yml | Compleja | ✅ Done | 2 |
| 8 | Audit 11 patches for orphaned/needed status | Compleja | ✅ Done (1 orphan removed) | 12 |
| 9 | Enable `noUncheckedIndexedAccess` in core + opencode | Muy Compleja | 🔲 Pending | — |
| 10 | Reorganize AGENTS.md into modules | Compleja | ✅ Done | 3 |

## Exit Criteria

- inter ≥ 30
- No dimension below 8.0
- Project Score ≥ 7.5

## Rollback

Si el score cae >0.5 puntos tras algún cambio, revertir el cambio y registrar
en BITACORA.md con causa raíz.
