# ADR-002: Liberación de itemRefs destruidos en VirtualList

- **Estado**: Aceptado (Ciclo 2, 2026-09-03)
- **Contexto**: `itemRefs` (Map index → BoxRenderable) recibía `.set()` en cada render de fila pero nunca `.delete()`. Cada mensaje alguna vez renderizado retenía su renderable (wrapper JS + nodo Yoga + backing Zig): la RAM crecía sin límite con la distancia de scroll, y el loop de medición del tick iteraba entradas muertas.
- **Decisión**: A) `onCleanup` en el scope de cada fila de `For` con guard de identidad (`itemRefs.get(index) === el`) antes de borrar + B) skip-and-drop de entradas con `isDestroyed` dentro del tick de medición (defensa en profundidad).
- **Alternativas**:
  1. **B solo**: auto-sanación perezosa en el tick. Válido pero deja retener entradas entre ticks; se mantiene como red de seguridad, no como único mecanismo.
  2. **C — WeakRef**: descartado. El Map es el único retainer de los renderables destruidos → delete directo es determinista, más simple y sin overhead por entrada. GC-timing no determinista no aporta nada acá.
- **Consecuencias**:
  - (+) RAM acotada a la ventana viva (~18 entradas vs 2005 tras 2000 shifts: -99.1%).
  - (+) CPU del tick de medición -48.9% en sesiones largas scrolleadas.
  - (+) El guard de identidad elimina el hazard re-mount-before-cleanup (Solid puede montar la fila nueva antes de disponer la vieja en reconciliación).
  - (−) Una línea de estado extra por fila (`let el`) — costo trivial.
- **Verificación**: simulación determinista (script/sim-virtual-refs.ts), typecheck verde, tests del Ciclo 1 sin regresión (7/7). Limitación declarada: no hay test con renderer headless (@opentui/core/testing) del ciclo de vida real — queda como work item de Ciclo siguiente.
