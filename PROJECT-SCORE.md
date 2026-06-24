# Project Score: opencode (vMK)
**Current**: 7.5/10
**Last updated**: 2026-06-24
**Trend**: improving

## Dimensions
| Dimension | Score | Cambio |
|-----------|-------|--------|
| correctness | 8 | ▲ +1 |
| tokens | 7 | — |
| errorPrevention | 9 | ▲ +3 |
| skill | 8 | ▲ +1 |
| speed | 7 | — |
| breadth | 8 | ▲ +1 |

## Strengths
- Arquitectura hexagonal/domain-driven sólida con Effect v4
- CI/CD completo: tests Linux+Windows, typecheck, build multi-plataforma (12+ targets)
- Sin barrel files — module design tree-shaking-aware
- Smoke test post-build automático
- Per-session RevertLock con SynchronizedRef como safety checkpoint server-side
- TUI component rendering correctamente scoped por message ID

## Weaknesses
- `noUncheckedIndexedAccess: false` — acceso a arrays/dicts inseguro
- 9 dependencias parcheadas → riesgo de drift en upgrades
- 95+ runtime deps → árbol pesado
- `any` type suelto en versioning script y aiskd.ts
- Sin Dependabot/Renovate
- Tests usan `--only-failures` por defecto — puede ocultar regresiones
- Documentación casi inexistente para la complejidad del proyecto
- Server-side revert aún tiene TOCTOU en assertNotBusy + cleanup fuera de runner scope (parcialmente mitigado con RevertLock)

## Findings Clave
- 523 test files en 25 packages
- Versionado dinámico: `0.0.0-dev-{timestamp}` en preview channels
- Fork vMK con build name `opencode-vMK` ya configurado
- 2026-06-24: Revert-loop bug fix — TUI Switch scoping + RevertLock safety checkpoint
- Server-side race conditions descubiertas: TOCTOU, sin mutex, snapshots no atómicos, stale snapshot en cleanup
