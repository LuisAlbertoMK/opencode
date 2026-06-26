# Plan de Optimización — opencode-vMK

> Proyecto: `D:\opencode` — fork luisAlbertoMK/opencode
> Binario: `opencode-vMK.exe` v1.17.7-vMK-dev
> Score actual: 9.8/10 · Bun 1.3.14 · Effect v4.0.0-beta.74 · OpenTUI 0.3.4

---

## Estado Actual vs Investigación (Análisis de Gap)

| # | Técnica Investigada | Código Real | Gap | Prioridad |
|---|-------------------|-------------|-----|-----------|
| 1 | SQLite WAL + PRAGMAs | ✅ Ya implementado (WAL, NORMAL, busy_timeout=5000, cache_size=-64000) | Sin gap | — |
| 2 | Effect `memoMap` global | ✅ Ya implementado (`Layer.makeMemoMapUnsafe()` singleton) | Sin gap | — |
| 3 | OpenTUI targetFps=30 | ✅ Ya configurado (30/60) | Sin gap | — |
| 4 | Solid `batch()` en multi-signal updates | ❌ No usado. `footer.append()` ya coalescea via queueMicrotask, pero updates multi-señal (setState+setView) no están agrupados | Gap real | 🔴 Alta |
| 5 | OpenTUI `useThread: true` | ⚠️ API existe en 0.3.4, pero no se pasa al crear renderer (default false). Riesgo con Bun compile + threading nativo | Gap real | 🟡 Media |
| 6 | `smol=true` en bunfig | ❌ No existe en `bunfig.toml` de ningún package | Gap real | 🟡 Media |
| 7 | Bun dual-bundle (rolldown → compile) | ❌ Usa `Bun.build()` directo, sin bundler externo | Gap real | 🟡 Media |
| 8 | Heap profiler tuning | ⚠️ Existe con thresholds 1.5GB/2GB/4GB. MAX_HEAP es código muerto (nunca se usa). SOFT_LIMIT/LIMIT sí se usan | Gap parcial | 🟡 Media |
| 9 | AI SDK provider tree-shaking | ⚠️ 20+ providers en `package.json`, dual-path (native+AI SDK) | Gap parcial | 🟡 Media |
| 10 | `drop: ["console", "debugger"]` | ❌ No usado en `Bun.build()` | Gap real | 🟢 Baja |
| 11 | tree-sitter WASM lazy loading | ❓ No explorado en profundidad | Sin dato | 🟢 Baja |
| 12 | LRU cache SQL | ✅ O(1) con Map — el plan anterior decía O(n²) incorrectamente. 64 entradas, eviction por orden de inserción. Todo bien | Sin gap | — |

---

## Fase A — Quick Wins (Alto Impacto, Bajo Riesgo)

### A1. Solid `batch()` en updates multi-señal

**Problema**: El streaming de tokens YA tiene coalescing via `queueMicrotask` en `footer.append()` (footer.ts:535-564). El bottleneck real NO es el render por token, sino que múltiples señales (`setState + setView + setSubagent`) disparan renders separados.

**Solución**: Envolver updates multi-señal en `batch()` de SolidJS:
- `writeSessionOutput` → `batch(() => { setState(); setView(); ... })`
- Handlers de eventos que tocan >1 señal
- `syncFooter` y similares

**Archivos a modificar**:
- `packages/opencode/src/cli/cmd/run/footer.ts` (líneas con `setState`, `setView`)
- `packages/opencode/src/cli/cmd/run/footer.*.tsx` (menus, command, subagent)
- NO en `src/cli/tui/` — ese path solo tiene thin bootstraps

**Impacto estimado**: Reduce renders ~20-30% en UI general (menos frame drops). No es tan alto como estimé inicialmente porque `queueMicrotask` ya agrupa micro-updates.

**Riesgo**: Bajo. `batch()` es core de SolidJS.

**⚠️ Verificación cruzada**: Subagente 2 corrigió la ruta y aclaró que `footer.append()` ya coalescea. El impacto real es menor al estimado original.

**Verificación**: `gatherStats: true` en dev muestra cellsUpdated antes/después.

---

### A2. Bun build: `drop: ["console", "debugger"]`

**⚠️ CORRECCIÓN**: La versión anterior del plan decía `drop: ["assert", "debug"]` — esos valores NO son válidos. Bun.build() acepta `"console"` (elimina `console.*`) y `"debugger"` (elimina statements `debugger`).

**Problema**: Código de debug viaja al binario compilado.

**Solución**: Agregar al `Bun.build()` en `packages/opencode/script/build.ts`:

```typescript
drop: ["console", "debugger"]
```

**Archivo**: `packages/opencode/script/build.ts` — línea ~220, donde ya existe `minify: true`.

**Impacto estimado**: Reduce payload JS ~5-10%.

**Riesgo**: Bajo. Elimina `console.*` y `debugger` del bundle. No afecta logging a file (que usa streams nativos, no `console.*`).

**⚠️ Verificación cruzada**: Subagente 1 descubrió el error en los valores de `drop`.

---

### A3. Tuning thresholds del Heap Profiler

**Problema**: Los thresholds actuales (1.5GB soft, 2GB snapshot, 4GB max) están pensados para un server LLM, no para una TUI. Una TUI con memory leak debería alertar mucho antes.

**⚠️ Verificación cruzada**: Subagente 1 descubrió que `MAX_HEAP` **es código muerto** — está definido pero nunca se usa en `start()` ni ninguna función. Cambiarlo tiene efecto CERO.

**Solución**: Reducir thresholds que SÍ se usan:
- `SOFT_LIMIT`: 1.5GB → **512MB** (se usa para GC proactivo y heap snapshot)
- `LIMIT`: 2GB → **768MB** (se usa para heap snapshot auto)
- `MAX_HEAP`: ~~4GB → 1.5GB~~ **Código muerto. No tocar o eliminar.**
- Intervalo: 60s → **30s**

**Archivo**: `packages/opencode/src/cli/heap.ts` (líneas 5-8)

**Impacto estimado**: Detección temprana de leaks, snapshot automático antes de OOM real.

**Riesgo**: Bajo. Falsos positivos posibles si el app legitima usa >512MB (p.ej. sesiones con contextos muy grandes). Monitorear.

---

## Fase B — Optimizaciones Medias (Buen Impacto, Riesgo Moderado)

### B1. `smol=true` en bunfig.toml

**Problema**: Bun usa heap de JavaScript agresivo por defecto (~30% más RAM de la necesaria para throughput máximo). En una TUI el throughput no es crítico.

**Solución**: Agregar en `bunfig.toml` raíz:

```toml
[runtime]
smol = true
```

**Archivo**: `D:\opencode\bunfig.toml`

**Impacto estimado**: Reduce RAM ~25-30% en runtime (~200MB → ~140MB en sesión típica). Pequeña reducción en throughput de JavaScript (no afecta I/O ni SQLite).

**Riesgo**: Moderado. Bun docs advierten que `smol` reduce throughput. Para TUI no debería notarse, pero verificar:
- Latencia de procesamiento de prompts (efecto JS puro)
- Startup time

**Rollback**: Sacar la línea del bunfig.

---

### B2. AI SDK Provider Tree-Shaking

**Problema**: `packages/opencode/package.json` tiene **20+ providers** `@ai-sdk/*` como dependencias. Con `bun build --compile`, Bun los embala **todos** en el binario aunque solo uses 2-3.

**Solución**:
1. Mover providers no usados a `devDependencies` o a un `peerDependencies` opcional
2. O usar `--external '@ai-sdk/*'` en build + documentar que el usuario instala solo los que necesita
3. O crear un `bundler plugin` que remplace imports de providers no configurados por stubs

**Archivos**: `packages/opencode/package.json`, `packages/opencode/script/build.ts`

**Impacto estimado**: ~500KB-2MB menos en binario, dependiendo de cuántos providers se puedan externalizar.

**Riesgo**: Moderado. Si un provider se necesita en runtime y se externalizó, falla. Requiere análisis fino de cuáles providers usa realmente vMK.

---

### B3. OpenTUI useThread (Zig render thread)

**Problema**: El render loop de OpenTUI corre en el event loop principal de Bun. Si el JS está ocupado (procesando un prompt grande), la UI se congela.

**Estado real**: `@opentui/core` 0.3.4 SÍ soporta `useThread: boolean` en la interfaz (`renderer.d.ts:30`). El `createCliRenderer()` en `runtime.lifecycle.ts` no lo pasa (default `false`). Tests de OpenTUI usan `useThread: false` explícitamente.

**Solución**: Agregar `useThread: true` a la llamada `createCliRenderer()`.

**Archivo**: `packages/opencode/src/cli/cmd/run/runtime.lifecycle.ts` — llamada a `createCliRenderer()` (~línea 182)

**Impacto estimado**: UI responsiva incluso durante procesamiento pesado. Render loop en thread separado.

**⚠️ Riesgo identificado por subagente 2**: `bun build --compile` + Zig threading puede tener problemas. El binary single-file de Bun no siempre maneja correctamente threads nativos. Requiere TESTING MANUAL antes de considerar estable.

**Verificación**: Correr sesión TUI con `gatherStats: true` y monitorear frame times con/sin `useThread`.

---

### B4. Dual-bundle: rolldown/tsdown → Bun compile

**Problema**: `Bun.build()` tiene tree-shaking **~15-30% menos agresivo** que rolldown/esbuild (issues abiertos #22797, #16980).

**Solución**: Pipeline de dos pasos:
1. `tsdown` (o `rolldown`) para bundle + tree-shake agresivo
2. `bun build --compile` solo para empaquetar binario

**Archivos**: Nuevo script de build + modificar `packages/opencode/script/build.ts`

**Impacto estimado**: Binario ~20-30% más chico (~130MB → ~95-100MB). Código JS más limpio.

**Riesgo**: Alto. Cambia todo el pipeline de build. Pueden romperse:
- Plugins de Bun (`@opentui/solid/bun-plugin`)
- Path resolution
- Condiciones de browser/platform
- Sourcemaps

**Recomendación**: Probar primero con `--minify` más agresivo antes de ir a dual-bundle.

---

## Fase C — Exploración (Requiere Investigación)

### C1. LRU Cache

**⚠️ CORRECCIÓN**: El plan original decía que el LRU cache usa array con eviction O(n²). **ES INCORRECTO.** La cache usa `Map` de JavaScript:
- `Map.get()` → O(1)
- `Map.set()` → O(1)
- `Map.delete()` → O(1)
- `stmtCache.keys().next().value` → O(1)

Es O(1) en todas las operaciones. 64 entradas con eviction FIFO. Todo bien.

**Decisión**: **SKIP** — YAGNI. No hay nada que optimizar.

---

### C2. Streaming buffering

**⚠️ CORRECCIÓN**: El plan original asumía que cada token dispara un update de UI individual. La realidad es distinta: `footer.append()` (footer.ts:535-564) YA usa `queueMicrotask` para coalescer commits consecutivos del mismo tipo en un solo update. No hay render por token.

**Pipeline real**: `streamText → fullStream → LLMEvent → Session reducer → SDK event bus → stream.transport.ts → reduceSessionData → syncFooter → footer.append (coalesce + queueMicrotask)`

**Oportunidad real**: No es implementar otro buffer (un timer de 50ms añadiría LATENCIA innecesaria), sino envolver updates multi-señal en `batch()` de SolidJS — eso ya está cubierto en **A1**.

**Decisión**: **MERGED into A1**. No hay oportunidad separada aquí.

---

### C3. tree-sitter WASM lazy loading

**Problema**: Las gramáticas WASM de tree-sitter se cargan todas al startup, sumando ~1.4MB+ al binario.

**Evaluación**: Depende del uso. Si vMK no usa highlight syntax al startup, diferir carga. Si usa highlight en todos los mensajes, es necesario.

**Decisión**: Investigar primero si `Language.load()` lazy ya está implementado o si se carga todo al init.

---

### C4. batchWindow en logging

**Nota**: El comentario en `logging.ts` dice "Do not set batchWindow to 0; it causes high idle CPU usage". Revisar valor actual y optimizar para sesiones TUI (menos logging que server).

**Impacto**: Bajo. El logger de opencode es bastante silencioso comparado con un server web.

---

## Prioridad Final

| Item | Impacto | Riesgo | Esfuerzo | Prioridad |
|------|---------|--------|----------|-----------|
| A2. drop: console/debugger | 🟡 Medio | 🟢 Bajo | 🟢 1 línea | **1** |
| A3. Heap thresholds | 🟡 Medio | 🟢 Bajo | 🟢 1 archivo | **2** |
| A1. batch() multi-señal | 🟡 Medio (corregido) | 🟢 Bajo | 🟢 2-3 archivos | **3** |
| B1. smol=true | 🟡 Medio | 🟡 Moderado | 🟢 1 línea | **4** |
| B2. AI SDK tree-shaking | 🟡 Medio | 🟡 Moderado | 🟡 ~4 archivos | **5** |
| B3. useThread | 🟡 Medio | 🔴 Alto | 🔴 Requiere test | **6** |
| B4. Dual-bundle | 🔴 Alto | 🔴 Alto | 🔴 Días | **7** |
| C1. LRU | ✅ Ya O(1) | — | — | **SKIP** |
| C2. Streaming buffer | ✅ Ya existe queueMicrotask | — | — | **MERGED into A1** |

---

## Recomendación de Ejecución

1. **Fase de Medición** (previo a cambios):
   - Medir RSS actual con sesión típica → `Bun.unsafe.memoryFootprint()`
   - Medir binario actual → `ls -lh packages/opencode/dist/opencode-*.exe`
   - Capturar `Bun.generateHeapSnapshot("v8")` como baseline
   - Activar `gatherStats: true` para ver FPS reales

2. **Sprint 1** (A2 + A3 + A1):
   - Día 1: A2 (drop console/debugger) — 1 línea, trivial
   - Día 1: A3 (heap thresholds) — ajustar valores, notar que MAX_HEAP es código muerto
   - Día 2: A1 (batch multi-señal en footer.ts y footer.*.tsx)
   - Día 2-3: Medir impacto de los 3 cambios juntos

3. **Sprint 2** (B1 + B2):
   - Día 4: B1 (smol=true)
   - Día 4-5: B2 (provider tree-shaking)
   - Día 5-6: Medir impacto

4. **Sprint 3** (B3 + B4 si aplican):
   - Semana 2: B3 (useThread test)
   - Semana 2-3: B4 (dual-bundle, si justifica el ROI)

---

## Verificación Cruzada (Completada)

| Subagente | Enfoque | Hallazgos | Estado |
|-----------|---------|-----------|--------|
| **#1** Build/Performance | bunfig, build.ts, heap.ts | ✅ `drop` values incorrectos (FIXED), `MAX_HEAP` código muerto (FIXED), `smol` seguro | **Pasó** |
| **#2** TUI/Effect | SolidJS, OpenTUI, streaming | ✅ Ruta A1 era incorrecta (FIXED), `useThread` API existe, `footer.append()` ya coalescea (FIXED), `memoMap` confirmado | **Pasó** |
| **#3** Dependencias | AI SDK, tree-sitter, LRU | ✅ LRU es O(1) no O(n²) (FIXED). AI SDK y tree-sitter requieren exploración adicional | **Pasó** |

> **Documento verificado por 3 subagentes independientes.** Errores identificados y corregidos: `drop` values, ruta A1, complejidad LRU, `MAX_HEAP` dead code, streaming buffer real.
