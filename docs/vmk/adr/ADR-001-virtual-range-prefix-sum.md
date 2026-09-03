# ADR-001: Prefix-sum para el rango visible de VirtualList

- **Estado**: Aceptado (Ciclo 1, 2026-09-03)
- **Contexto**: El memo `visible` de VirtualList computaba el rango visible con 4 pasadas O(n) por tick de polling (encuentra-inicio, encuentra-fin, y 2 loops de padding que duplicaban trabajo). Con sesiones largas (n≥1000 mensajes) y polling a 100ms, esto domina el costo del loop.
- **Decisión**: Estructura prefix-sum (`Float64Array` acumulativo) + búsqueda binaria por query. El prefix se reconstruye SOLO cuando cambia el cache de alturas o el conteo de ítems (memo en el componente), no por tick.
- **Alternativas**:
  1. **B — two-pointer persistente**: aprovecha localidad de scroll monotónico. Descartado: el worst-case sigue O(n) (saltos de scroll), y el padding inferior mantiene O(n) sin estructura acumulativa → bench: igual o peor que baseline (39.10 vs 37.79ms @n=1000).
  2. **C — chunked cumsum (K=32)**: rebuild O(n/K), query O(n/K + K). Descartado: los walks intra-chunk + padding O(n) sin cumsum completo → 28.22ms @n=1000 (peor que A: 3.47ms).
- **Consecuencias**:
  - (+) Query O(log n) con padding O(1); mejora medida 82-91% y crece con n.
  - (+) Baseline conservado como `computeVisibleRange` exportado → comparación de regresión y fuzz de equivalencia posibles.
  - (−) Rebuild O(n) por cambio de alturas (aceptable: ocurre solo al medir items nuevos, no por tick).
  - (−) Contrato: el prefix debe reconstruirse si el Map de alturas muta (pinned por test `prefix must be rebuilt when heights change`).
- **Correctitud**: equivalencia exacta verificada (2500 queries random × variantes, semilla fija) + tests de bordes. Quirk pre-existente del baseline (scroll-beyond-content renderiza cola con paddingTop=0) preservado deliberadamente y anclado por test.
