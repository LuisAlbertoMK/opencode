# Mejora Log — experimento/mejora-autonoma-2026-09-03

Protocolo: `docs/protocolos/protocolo_mejora_autonoma_v3.md` (gentleman-agent-gh)
Rama base: `port-vmk-perf` (main/dev INTOCABLES). Jerarquía: correctness > seguridad > performance > tamaño.

## Ciclo 1 — VirtualList: range computation O(n)/tick → O(log n)/tick

| Campo | Valor |
|---|---|
| Gap (evidencia) | El memo `visible` ejecutaba 4 loops O(n) por cada tick de polling (100ms scroll / 500ms idle) — 2 para rango + 2 que duplicaban trabajo en padding. Con 5000 mensajes: ~387ms por 1000 ticks. |
| Fuente | Lectura de código `src/component/virtual-list.tsx` + bench `script/bench-virtual-range.ts` |
| ICE | Impacto 6 · Confianza 9 · Esfuerzo 4 |
| Blast radius | **Medio** (lógica interna, contrato estable — función pura extraída, semántica pinned por tests) |
| Scope lock | `src/component/virtual-range.ts` (nuevo), `src/component/virtual-list.tsx`, `test/component/virtual-range.test.ts` (nuevo), `script/bench-virtual-range.ts` (nuevo) |
| Enfoques | **A prefix-sum+binary search (GANADOR)** · B two-pointer (descartado) · C chunked K=32 (descartado) — ver ADR-001 |
| Correctitud | Equivalencia exacta vs baseline: 2500 queries random × 3 variantes ✓ + 7 tests unitarios (bordes + contrato de rebuild) — 7/7 green |
| Benchmarks | Ver `benchmarks.md` — mejora real 82.6% / 90.1% / 91.5% (n=100/1000/5000) |
| Commits | `e7d89685f2` refactor (extracción, sin cambio de comportamiento) → `590bf90514` perf (ganador + tests + harness) |
| DoD | tests green ✓ · bench no regresivo ✓ · 0 vulns nuevas (sin deps) ✓ · ADR ✓ · commits en scope ✓ |
| Rollback | `git revert 590bf90514` revierte solo el perf; `git revert e7d89685f2` la extracción. Ver `rollback-map.md` |

## Ciclo 2 — Height measurement: skip cuando el cache está completo (PENDIENTE)

## Ciclo 3 — LSP eviction fiber: arm-on-demand (PENDIENTE)

## Ciclo 4 — MCP toolTruncateLimit: cache O(1) (PENDIENTE, probable REJECT por gate)
