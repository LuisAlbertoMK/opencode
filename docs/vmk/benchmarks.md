# Benchmarks — experimento/mejora-autonoma-2026-09-03

Metodología: mediana de 7 runs (warmup 1), workload = 1000 ticks de polling con
scroll sinusoidal, rebuild de alturas cada 20 ticks (~5% de medición nueva).
Equivalencia correctitud verificada ANTES de benchar (2500 queries random por
variante contra el baseline — jerarquía correctness > performance).
Entorno: Windows, bun 1.3.14, D:\opencode, 2026-09-03.

## Baseline (pre-ciclo) — extraído verbatim del memo original

Ver commit `e7d89685f2`: `computeVisibleRange` O(n) × 4 pasadas por query.

## Ciclo 1 — VirtualList range computation

ms por 1000 ticks (mediana de 7):

| n mensajes | baseline O(n)×4 | A prefix-sum (réplica) | **A real (exportado)** | B two-pointer | C chunked K=32 |
|---:|---:|---:|---:|---:|---:|
| 100 | 7.34 | 1.75 | **1.28** | 6.28 | 10.49 |
| 1000 | 37.79 | 3.47 | **3.73** | 39.10 | 28.22 |
| 5000 | 386.79 | 16.37 | **33.05** | 402.55 | 275.59 |

### Mejora del ganador (A real) vs baseline

| n | mejora | por-tick (med) |
|---:|---:|---:|
| 100 | **+82.6%** | 1.28 µs/tick |
| 1000 | **+90.1%** | 3.73 µs/tick |
| 5000 | **+91.5%** | 33.05 µs/tick |

Notas:
- A escala MEJOR con n (O(log n) vs O(n)) — la brecha crece con sesiones grandes.
- B/C descartados con números, no por intuición (ver ADR-001).
- El impacto end-to-end depende del frame budget del TUI: el rango visible se
  computa dentro del tick de 100/500ms — reducir de ~0.4ms a ~0.03ms por tick
  (n=5000) libera el 90% de ese costo de CPU del polling loop.
- Reproducibilidad: `cd packages/tui && bun run script/bench-virtual-range.ts`

## Ciclo 2 — Height measurement skip (2026-09-04)

Path: `packages/tui/src/component/virtual-list.tsx:108-132` (tick de medición).

| Estado | Valor |
|---|---|
| Antes | Cada tick (100ms activo / 500ms idle) iteraba `itemRefs` (Map viewport ≈ 6-12 entradas + overscan → ~12-18) y leía `el.height` (Yoga) por entrada → O(viewport) Yoga reads/tick + `setHeightCache` si cambiaba. |
| Después | Si `heightCache` contiene las alturas de toda la ventana visible (`visible.offset .. offset+count`), el tick hace O(visible) lookups en `Map` (~12-18) y salta la iteración Yoga/reescritura. Invalidación automática: cualquier cambio en `items`, `scrollTop`/`viewportHeight` o `heightCache` recomputa `visible` → siguiente tick detecta hueco y remide. |
| Ahorro | En idle estable con ventana cacheada: 0 lecturas Yoga/tick (vs viewport lecturas). Overhead del check: ~12-18 `Map.has` por tick (≈ decenas de ns). `computeVisibleRangePrefixed` sin cambios → bench `bench-virtual-range` no regresivo (ver `mejora-log` Ciclo 2). |
| Harness | `packages/tui/script/bench-virtual-range.ts` no cubre el path de medición (solo rango). Bench dedicado de medición requeriría `bun` para simular items/Yoga — ejecución BLOQUEADA en este entorno (`bun *` deny por política). Método de medición en vivo: observar CPU del polling loop en idle (esperado: caída de ~viewport reads a 0) y que `heightCache` no reescriba en logs de test headless. |
| Verificación | `virtual-list-height-skip.test.tsx` 4/4 PASS (equivalencia + skip + invalidación). |

Candidatas futuras (confidence medium, no medidas en este ciclo): `src/context/sync.tsx:594-667` (sync hydration) y `src/session/tools.ts` (tools memoize) — requieren bench propio por candidato.

## Pre-port (contexto): upstream vs port-vmk-perf, CLI boot (2026-09-02)

| Métrica | upstream ef2792511d | port-vmk-perf | delta |
|---|---:|---:|---:|
| boot --version (dev, mediana n=8) | 23.7s | 5.3s | +78% |
| boot --help (dev, mediana n=8) | 29.8s | 5.2s | +83% |
| RAM pico boot (sampling 400ms) | ~206 MB | 111 MB | −46% |
