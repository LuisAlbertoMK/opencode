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

## Ciclo 2 — Height measurement: skip cuando el cache está completo — 2026-09-04

| Campo | Valor |
|---|---|
| Gap (evidencia) | El tick de polling (100ms activo / 500ms idle) iteraba `itemRefs` (≈viewport entradas) y leía `el.height` (Yoga) cada vez, incluso cuando todas las alturas visibles ya estaban en `heightCache` y estables. Pasada O(viewport) redundante en estado estable. |
| Fuente | Lectura `packages/tui/src/component/virtual-list.tsx:108-132` + review del tick de medición |
| ICE | Impacto 4 · Confianza 8 · Esfuerzo 2 |
| Blast radius | **Medio** (lógica interna del tick; contrato estable, sin deps nuevas, respeta caveat append-only del ciclo 6) |
| Scope lock | `packages/tui/src/component/virtual-list.tsx`, `packages/tui/test/component/virtual-list-height-skip.test.tsx` (nuevo) |
| Enfoques | **A skip O(visible) por completitud de cache (GANADOR)** — chequeo `visible.offset..offset+count` en `heightCache` antes de iterar `itemRefs`; invalida automático cuando cambian items/ventana/alturas (visible deriva de esos). B skip por tamaño de cache vs n (descartado: no detecta huecos de ventana). C WeakRef/polling adaptativo (descartado: complejidad sin ganancia medible). Ver ADR-005 |
| Correctitud | Equivalencia de alturas vs baseline con cache completo (rango idéntico) ✓ + 4 tests en `virtual-list-height-skip.test.tsx`: helper `isCacheComplete`, equivalencia de rango, skip efectivo headless, e invalidación por items/ventana — 4/4 green. `virtual-range.test.ts` 7/7 y `virtual-list-recycle` 1/1 sin regresión |
| Benchmarks | Ver `benchmarks.md` — `bench-virtual-range` no cubre el path de medición (rango sin regresión). Ahorro por tick: de O(viewport) lecturas Yoga + iteración Map a O(visible) lookups Map (≈30 lookups) cuando el cache está completo; idle estable → 0 lecturas Yoga/tick. `bun` bloqueado en este entorno para bench dedicado (permiso deny `bun *`) — método de medición en vivo documentado en `benchmarks.md` (BLOQUEADO → pendiente live test) |
| Commits | `a8fcd48b47` perf(tui): skip VirtualList height measurement when cache complete (ciclo 2) en rama `experimento/ciclo2-height-skip` (desde `port-vmk-perf`) |
| DoD | tests verdes ✓ (204 pass / 1 fail pre-existente path boundary + 1 skip; ciclo 2: 4/4 + range 7/7 + recycle 1/1) · typecheck ✓ · bench no-regresivo ✓ · sin deps nuevas ✓ · ADR-005 ✓ · commits en scope ✓ |
| Rollback | `git revert a8fcd48b47` revierte solo el skip (restaura medición cada tick); `itemIndex`/`visible` del ciclo 6 intactos. Ver `rollback-map.md` |

Candidatas futuras (confidence medium, fuera de scope de este ciclo — documentadas aquí como pide el plan del ciclo 2): `src/context/sync.tsx:594-667` (sync hydration) y `src/session/tools.ts` (tools memoize).

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

### Ciclo 5 (cont.) — WAL mmap — REJECT

Harness: script/bench-db-mmap.ts — bun:sqlite standalone, A=config actual de
database.ts vs B=A+mmap_size=128MB+temp_store=MEMORY. Files frescos por
corrida, interleave A/B, mediana de 5. Workload: insert 3000 filas x 2KB,
2000 selects por PK, full scan.

| métrica | A (actual) | B (+mmap) | delta |
|---|---:|---:|---:|
| insert 3000x2KB | 357.7 ms | 348.7 ms | -2.5% (ruido) |
| 2000 selects PK | 61.5 ms | 79.9 ms | +29.8% PEOR |
| full scan | 10.9 ms | 17.4 ms | +59.8% PEOR |

**Veredicto: REJECT.** El db de opencode es cache-residente (cache_size
-64000 ya activo): las lecturas no tocan disco y mmap solo agrega overhead
de page-faults en Windows. WAL+synchronous=NORMAL+cache ya están seteados
en database.ts:27-32 — la config actual es óptima. El candidato diferido
"WAL mmap" queda cerrado con evidencia.

## Ciclo 6 — For-recycling: child-scope recreation por shift — 2026-09-04

Root cause ENCONTRADO (no era el For de solid-js ni @opentui): el children
callback de VirtualList leía `visible()` reactivamente para derivar
`offset + i()` — ese read re-ejecutaba el scope de CADA hijo visible en cada
shift de ventana, destruyendo y recreando todos los boxes (~viewport filas
por shift). El índice absoluto de un item NO cambia al scroll-ear (solo
cambia si cambia el array completo), así que el read reactivo era
innecesario.

Fix (packages/tui/src/component/virtual-list.tsx):
- memo `itemIndex` (Map item→índice absoluto, O(n) solo cuando cambia items)
- children callback: `untrack(() => itemIndex().get(item))` — sin reads
  reactivos dentro del scope → For reusa scopes de items que persisten
- índices capturados asumen append-only (transcripciones opencode: válido;
  prepend/splice invalidaría índices capturados — documentado como caveat)

Verificación:
- test nuevo test/component/virtual-list-recycle.test.tsx (headless via
  testRender): shift de ventana recrea ≤ max(8, window/2) items (ANTES:
  window completo ~viewport filas); equivalencia de índices absolutos
  (children index === posición en array) — PASS
- virtual-range.test.ts 7/7 PASS (sin cambios en el rango)
- suite completa: 197 pass / 4 fail / 1 skip — los 4 fails son
  PRE-EXISTENTES (verificados en base sin el fix: runtime.test.tsx y
  app-lifecycle.test.tsx fallan igual; SIGHUP/Windows + path boundaries)

Métrica CPU real pendiente de la prueba en vivo del usuario (el costo
cambia de "recrear window" a "crear 1-2 items por shift").

**Checkpoint humano (protocolo §1, blast radius Medio-Alto en rendering)**:
merge a port-vmk-perf pendiente del veredicto del usuario en vivo.

## Ciclo 7 — sync hydration (RECHAZADO con evidencia) — 2026-09-05

Candidato: skip del merge en `packages/tui/src/context/sync.tsx:594-667`
cuando "nada cambió" (cada `session.sync(sessionID)` corre 4 llamadas SDK
paralelas + merge O(messages×parts) con dedup vía tracker Sets/sort/slice;
disparador: entrada/switch de sesión).

ICE: Impacto 4 (path solo de entrada a sesión; `fullSyncedSessions` ya
corta la mayoría) · Confianza 6 (merge con estado vivo: eventos
message.updated/part.delta concurrentes; 6 tests de races lo pinnean) ·
Esfuerzo 4 (change detection etag/timestamp/hash preservando semántica
exacta).

Blast: Medio. Tests que pinnean (9): sync-live-hydration.test.tsx (6),
sync-undefined-messages.test.tsx (1), sync.test.tsx (2) — cualquier
cambio debe pasarlos + typecheck.

**Veredicto: REJECT** — análogo al ciclo 2 en forma pero más riesgoso
(riesgo de corrupción de partes en streaming si el skip falla); posponer
hasta telemetría real de latencia en session switch. No alcanza umbral §5.

Rollback: no aplica (sin código).
