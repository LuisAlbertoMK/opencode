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

## Ciclo 3 — LSP eviction fiber: arm-on-demand (RECHAZADO con evidencia)

Candidato: reemplazar while(true)+sleep(5min) por timer armado bajo demanda.
Evidencia: el scan es O(clients) con clients<=10, cada 5 min = 12 wakeups/hora
con loop de ~1us → costo total ~12us/hora. Reescribir el scheduling introduce
riesgo (scope del layer, interrupción) por ganancia no medible. Jerarquía de
métricas: el riesgo de correctness no justifica performance no medible.
**Veredicto: REJECT** — no alcanza el umbral de mejora marginal (§5).

## Ciclo 4 — MCP toolTruncateLimit: cache O(1) (RECHAZADO con evidencia)

Candidato: memoizar el lookup de prefijo por server. Evidencia: O(servers)
con servers<=10, ejecutado 1 vez por resultado de tool MCP (frecuencia baja).
Costo actual ~10 iteraciones de Map por llamada (~1us). Cache introduciría
invalidación (config dinámica add/remove) por ganancia no medible.
**Veredicto: REJECT** — mejora marginal bajo umbral (§5).

## Candidatos diferidos (fuera de scope del experimento)

1. **For recreation en window shift**: OpenTUI/Solid recrea ~18 filas por
   shift — optimización de recycling sería en el framework (blast radius
   **Alto** → checkpoint humano obligatorio, §1).
2. **Build levers** (Bun bytecode, smol mode, WAL mmap): naturaleza config de
   build, pertenecen a la integración de port-vmk-perf, no a este experimento.
3. **Test headless del lifecycle de itemRefs** (@opentui/core/testing):
   work item de verificación para próximo ciclo.

## Condición de parada (§5) — alcanzada

Sin gaps ICE relevantes con evidencia restantes · Breaker sobrevivió 3
enfoques en C1 y 3 en C2 · tests verdes · benchmarks >= baseline en todo
ciclo aplicado · candidatos restantes rechazados con números o diferidos
por blast radius Alto.

## Ciclo 5 — build levers (bytecode / smol) — 2026-09-04

Harness: script/bench-boot.ps1 (nuevo) — mediana n=8 (warmup 1), exit code
validado por corrida, RAM pico por sampling 200ms. Métrica: boot --version
del binario compilado.

| Variante | boot mediana | boot min | RAM pico med | tamaño |
|---|---:|---:|---:|---:|
| baseline (sin flags) | 629.1 ms | 426.5 ms | 53.3 MB | 137.5 MB |
| bytecode | 634.4 ms | 434.3 ms | 54.4 MB | 324.7 MB |
| smol (corrida 1) | 450.3 ms | 427.4 ms | 55.4 MB | 137.5 MB |
| smol (corrida 2) | 638.4 ms | 445.6 ms | 47.0 MB | 137.5 MB |
| control baseline re-run | 632.2 ms | 448.5 ms | 54.4 MB | 137.5 MB |

**Bytecode: REJECT** — 0% boot medible, binario +136% (137.5→324.7 MB).
El costo de boot no está en el parseo del bundle pre-minificado.

**Smol: boot NEUTRAL** — el -28% de la corrida 1 NO se repite (corrida 2
vuelve a ~638; mins equivalentes ~427-448 en todas las variantes). El
boot mediano es bimodal por ruido del sistema; el piso (~427 ms) es
idéntico con y sin smol. Valor potencial de smol = RSS de sesión larga
(GC más frecuente) — NO medible en boot; se difiere a la prueba en vivo
del usuario. Flag --smol queda como opt-in en build.ts.

**Veredicto §5**: sin gaps de boot con evidencia → build levers cerrado
en modo diferido para smol (pending live test). WAL mmap queda para el
próximo ciclo (requiere recon de la capa db).
