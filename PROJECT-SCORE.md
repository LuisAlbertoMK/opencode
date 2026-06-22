# Project Score: opencode (vMK)
**Current**: 6.8/10
**Last updated**: 2026-06-22
**Trend**: improving

## Dimensions
| Dimension | Score | Cambio |
|-----------|-------|--------|
| correctness | 7 | ▲ +1 |
| tokens | 7 | — |
| errorPrevention | 6 | ▲ +1 |
| skill | 7 | ▲ +1 |
| speed | 7 | — |
| breadth | 7 | ▲ +1 |

## Strengths
- Arquitectura hexagonal/domain-driven sólida con Effect v4
- CI/CD completo: tests Linux+Windows, typecheck, build multi-plataforma (12+ targets)
- Sin barrel files — module design tree-shaking-aware
- Smoke test post-build automático

## Weaknesses
- `noUncheckedIndexedAccess: false` — acceso a arrays/dicts inseguro
- 9 dependencias parcheadas → riesgo de drift en upgrades
- 95+ runtime deps → árbol pesado
- `any` type suelto en versioning script y aiskd.ts
- Sin Dependabot/Renovate
- Tests usan `--only-failures` por defecto — puede ocultar regresiones
- Documentación casi inexistente para la complejidad del proyecto

## Findings Clave
- 523 test files en 25 packages
- Versionado dinámico: `0.0.0-dev-{timestamp}` en preview channels
- Fork vMK con build name `opencode-vMK` ya configurado
