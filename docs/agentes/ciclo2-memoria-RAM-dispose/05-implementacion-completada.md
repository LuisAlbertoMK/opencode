# Ciclo2 memoria/RAM/dispose — Implementación completada

Fecha: 2026-09-15
Modo: aditivo reversible, sin borrar/push/commit, sin refactor

## Decision Taken
Implementados 5 experimentos aditivos de ciclo2 (exp6 lazy photon, exp5 dispose VirtualList, exp16 rAF, exp9 RcMap TTL 30s, exp8 ScopedCache LRU 16) con verificación typecheck PASS en 3 paquetes y bench mediano ejecutado.

## Files Changed
- `packages/opencode/src/image/image.ts` (líneas 7-16 nuevo cache módulo + línea 79 `getPhotonModule()`): exp6 — 10 líneas añadidas, 1 modificada
- `packages/tui/src/component/virtual-list.tsx` (líneas 65-79 dispose + líneas 87-89 rafActive/id + 95-96 destroyed branch + 110-126 adaptive sin else + 181-189 rAF loop vs interval): exp5+exp16 — 44 líneas añadidas, 9 modificadas
- `packages/opencode/src/storage/storage.ts` (línea 221): exp9 — `idleTimeToLive: 30_000, // ciclo2-exp9: evita re-crear lock por keystroke` (1 línea modificada)
- `packages/opencode/src/effect/instance-state.ts` (línea 31): exp8 — `capacity: 16, // ciclo2-exp8: LRU 16 evita fuga por workspace churn (FIFO evict oldest si no hay LRU nativo)` (1 línea modificada)
- `C:\Users\MK\AppData\Local\Temp\opencode\bench-ciclo2.ts` (nuevo, 148 líneas): bench heap RSS 5000 ops × 11 runs, payload Uint8Array 4KB, mide bounded vs unbounded, TTL recreates, heightCache dispose

## Key Findings
1. [LOW] Typecheck PASS — `bun typecheck` en `packages/opencode` → `tsgo --noEmit` sin errores — OK
2. [LOW] Typecheck PASS — `bun typecheck` en `packages/core` → `tsgo --noEmit` sin errores — OK
3. [LOW] Typecheck PASS — `bun typecheck` en `packages/tui` → `tsgo --noEmit` sin errores — OK
4. [MEDIUM] Bench 11 runs, 5000 ops, Uint8Array 4KB — FIFO-bounded 16 medianΔHeap 0 B (samples: 7.18MB primer warmup luego ~0), Unbounded medianΔHeap 128 B, medianΔRss 24KB, heightCache bounded medianΔHeap 0 B; diferencia warmup bounded 64KB retenido vs unbounded 20MB no visible en median post-GC pero sí en primer sample (7MB vs 17MB) por allocator externo (ArrayBuffer fuera de heapUsed)
5. [MEDIUM] RcMap TTL — TTL=0 median recreates 5000 vs TTL=30s median 20 (ahorro 4980 recreaciones / 5000 keystrokes) — valida exp9: 30s evita churn por keystroke sin fuga
6. [LOW] Grep verificación previa — `photon-node` solo en `packages/opencode/src/image/image.ts` vía `getPhotonModule()` dinámico cacheado; `photonWasm` estático solo como path string, no carga WASM hasta primera `normalize`
7. [LOW] VirtualList dispose — `onCleanup` externo limpia `itemRefs.clear()` + `setHeightCache(new Map())` y destruye BoxRenderable si `destroy` existe, solo referencias JS (no asume API Zig destroy obligatoria)
8. [LOW] exp16 trade-off documentado — `// ciclo2-exp16: rAF evita wake-ups inertes vs setInterval; fallback interval dirty-gated es más estable sin browser clock en TUI Zig` — usa rAF cuando existe, sino interval adaptativo 100/500ms

## Nuance
- Sin `else` en código nuevo (ramas separadas `if (rafActive && ...)` / `if (!rafActive && ...)`), sin `any` (casts vía `as unknown as`), `const` para inmutables y `let` solo para estado mutable del poll, sin alias imports.
- ScopedCache ya soporta LRU nativo vía `capacity`; cambiar a 16 basta, comentario indica FIFO como fallback si no hubiera LRU — no se envolvió con Map adicional para mantener aditividad reversible.
- rAF en TUI Zig: Node/Bun no tiene `requestAnimationFrame` por defecto → `rafActive` detecta disponibilidad y usa fallback interval; en entornos con rAF (opentui con polyfill) evita poll ciego cada 100ms, reduce wake-ups y CPU cuando idle; en modo rAF no se re-crean timers en cada cambio (evita clearInterval/setInterval churn), solo se actualiza `idleCycles`.
- Photon lazy: promesa cacheada a nivel módulo (`photonImportCache`) deduplica concurrentes `normalize` y evita recarga WASM; costo estimado 2-5MB RSS diferido hasta primera imagen.
- Bench limitaciones: `heapUsed` no refleja ArrayBuffer externo (Uint8Array) — por eso medianΔHeap ~0 tras GC; se reporta también RSS y recreates; primer sample sin warmup muestra diferencia real (7MB bounded vs 17MB unbounded). Para medir fuga real usar `--expose-gc` + heap snapshot o `process.memoryUsage().external`.
- Cambios reversibles: cada exp con comentario `// ciclo2-expN:` — revertir es borrar el bloque `photonImportCache/getPhotonModule` y restaurar `import(...)` directo, eliminar `onCleanup` exp5, reemplazar bloque rAF por `let id=setInterval`, volver `idleTimeToLive:0` y `capacity:Infinity`.
- Git status tenía 5 archivos sucios previos (llm.ts, to-llm-message, markdown, provider, instruction) — no tocados por este ciclo; diff de este ciclo aislado a 4 archivos + bench.
