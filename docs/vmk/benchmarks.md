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

## Pre-port (contexto): upstream vs port-vmk-perf, CLI boot (2026-09-02)

| Métrica | upstream ef2792511d | port-vmk-perf | delta |
|---|---:|---:|---:|
| boot --version (dev, mediana n=8) | 23.7s | 5.3s | +78% |
| boot --help (dev, mediana n=8) | 29.8s | 5.2s | +83% |
| RAM pico boot (sampling 400ms) | ~206 MB | 111 MB | −46% |
