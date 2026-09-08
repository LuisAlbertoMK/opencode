# TUI Ecosystem Techniques Research — Applicability to OpenTUI + SolidJS + Bun (Windows)

**Stack**: OpenTUI (Zig renderer + TS bindings) · SolidJS (fine-grained reactivity) · Bun (Windows)  
**Date**: 2026-09-05  
**Sources per topic**: ≥3 (official docs + recent community + benchmarks)

---

## 1. OpenTUI Render Pipeline: Frame Composition & Perf Knobs

| Técnica | Pros (max 2) | Contras (max 2) | Fuentes con fecha | Aplicabilidad (1-5) |
|---------|--------------|------------------|-------------------|---------------------|
| **Double buffering nativo (Zig)**: `currentRenderBuffer` / `nextRenderBuffer` swap en `CliRenderer` | ① Zero-copy frame swap; ② `cellsUpdated` stat expuesto para observabilidad | ① Buffer completo en memoria (2× frame size); ② No expone dirty-region API a TS | [OpenTUI Rendering Pipeline](https://opentui.com/docs/core-concepts/rendering-pipeline/) (2024) · [renderer.zig](https://github.com/sst/opentui/blob/3dcc7730/packages/core/src/zig/renderer.zig) (2024) · [Rendering Diagnostics](https://opentui.com/docs/test-and-debug/rendering-diagnostics/) (2024) | **5** — Ya es el core; knobs expuestos (`cellsUpdated`, `stdoutWriteTime`, `renderTime`) vía `getNativeStats()` |
| **Frame diffing a nivel de cell**: compara `current` vs `next` buffer y emite solo *changed runs* | ① Minimiza bytes escritos a stdout; ② Correcto con graphemes/CJK/emoji (no byte-wise) | ① Diff O(n) sobre todo el grid cada frame; ② No hay API para hintar regiones sucias desde TS | Mismas fuentes arriba | **4** — Ya implementado; limitación: no control granular desde app |
| **Stdout buffering (4KB) + `BufferedWriter`**: writes coalescidos en Zig antes de syscall | ① Reduce syscalls drásticamente; ② Funciona en Windows (con `SyncFile` path) | ① Latencia añadida (~frame) hasta flush; ② No configurable desde TS | [renderer.zig](https://github.com/sst/opentui/blob/3dcc7730/packages/core/src/zig/renderer.zig#L80) (2024) | **4** — Ya activo; en Windows usa path síncrono (ver §5) |
| **Render thread opcional (`useThread`)**: offload layout+diff a thread separado | ① No bloquea event loop JS; ② `renderMutex`/`Condition` para sincronización | ① Complejidad de sync; ② Overhead de mutex/condvar en frames pequeños | [renderer.zig](https://github.com/sst/opentui/blob/3dcc7730/packages/core/src/zig/renderer.zig#L120) (2024) | **3** — Disponible pero no usado en opencode; evaluar si layout JS es bottleneck |
| **Hit-grid paralela**: `currentHitGrid`/`nextHitGrid` para mouse/picking | ① Input handling sin re-layout; ② Memoria extra ~4 bytes/cell | ① Duplica memoria de grid; ② Solo para interacción, no render | [renderer.zig](https://github.com/sst/opentui/blob/3dcc7730/packages/core/src/zig/renderer.zig#L130) (2024) | **2** — Ya implementado; no es knob de perf de render |

---

## 2. Ink (React TUI) Techniques: Reconciliation, Yoga Batching, Static Output

| Técnica | Pros (max 2) | Contras (max 2) | Fuentes con fecha | Aplicabilidad (1-5) |
|---------|--------------|------------------|-------------------|---------------------|
| **`<Static>` component**: render-once, append-only para logs/historial | ① Elimina re-renders de items antiguos; ② `items` prop ignora cambios previos | ① Solo para datos inmutables append-only; ② No aplica a streaming text mutante | [Ink Static docs](https://github.com/vadimdemedes/ink#static) (2024) · [Static example](https://github.com/vadimdemedes/ink/blob/master/examples/static/static.tsx) (2024) | **4** — Portable a Solid: pattern `createMemo` + `For` con key estable + `untrack` para zona estática |
| **Yoga layout batching**: `applyStyles` en `commit` phase, no por-setter | ① Un layout pass por frame; ② Evita thrashing Yoga | ① Requiere custom reconciler (Ink lo tiene); ② Solid no usa Yoga | [reconciler.ts](https://github.com/vadimdemedes/ink/blob/master/src/reconciler.ts#L200) (2024) | **2** — Solid usa layout CSS/Flex nativo; Yoga no aplica |
| **Fiber commit-phase `resetAfterCommit`**: `onRender` callback único por frame | ① Single stdout write por frame; ② `throttledOnRender` (16ms) para backpressure | ① Throttle añade latencia; ② `fullStaticOutput` en debug duplica memoria | [ink.tsx](https://github.com/vadimdemedes/ink/blob/master/src/ink.tsx#L150) (2024) | **5** — **Directamente aplicable**: OpenTUI ya tiene `requestRender` + `frame` event; batch writes en `onRender` |
| **`renderToString()` sync**: output síncrono sin event loop (testing/SSR) | ① Determinístico para snapshots; ② Sin async noise | ① No streaming; ② Solo para output final | [Commit 0a0c549](https://github.com/vadimdemedes/ink/commit/0a0c549ba64c6607cd20a2a75f9543ce99a9b47c) (2026-02-10) | **3** — Útil para testing OpenTUI frames (`createTestRenderer` ya existe) |
| **Kitty keyboard protocol detection**: feature-detect input capabilities | ① Progressive enhancement; ② Graceful degradation | ① Async detection añade startup latency; ② No es técnica de render | [ink.tsx](https://github.com/vadimdemedes/ink/blob/master/src/ink.tsx#L90) (2024) | **2** — OpenTUI maneja input aparte; no impacto en render pipeline |

---

## 3. Ratatui / Textual: Differential Render & Scrollback

| Técnica | Pros (max 2) | Contras (max 2) | Fuentes con fecha | Aplicabilidad (1-5) |
|---------|--------------|------------------|-------------------|---------------------|
| **Double buffer + diff en `Terminal::flush()`**: Ratatui swappea buffers y diffea | ① Diff O(celdas cambiadas) no O(total); ② Inmediate mode = sin retención de estado | ① Requiere full redraw cada `draw()`; ② No incremental entre frames | [Ratatui Under the Hood](https://ratatui.rs/concepts/rendering/under-the-hood/) (2024) · [Buffer/Cell impl](https://github.com/ratatui/ratatui-website/blob/main/src/content/docs/concepts/rendering/under-the-hood.md) (2024) | **4** — OpenTUI ya hace diff similar; aprendizaje: `Buffer::diff` retorna operaciones mínimas |
| **Textual Compositor + dirty regions**: `_dirty_regions: set[Region]` + `reflow_visible()` | ① Solo re-render widgets en regiones sucias; ② `reflow_visible` evita layout completo | ① Complejidad alta (maps full/visible/layers); ② Python overhead vs Zig | [Textual Compositor](https://deepwiki.com/Textualize/textual/2.6-rendering-and-compositor) (2026-06-24) · [_compositor.py](https://github.com/Textualize/textual/blob/8ce58dc0/src/textual/_compositor.py) (2024) | **3** — Concepto portable: `renderer.markDirty(region)` + partial flush; OpenTUI no expone hoy |
| **Virtual scrollback (Textual)**: `ScrollView` + `VirtualContent` solo renderiza viewport visible | ① Memoria O(viewport) no O(historial); ② Scroll suave sin re-render todo | ① Requiere medición de contenido previo; ② Complejo con wrapping dinámico | [Textual ScrollView](https://textual.textualize.io/widgets/scroll_view/) (2024) | **4** — **Crítico para opencode**: scrollback actual crece sin límite; implementar virtualización en `ScrollbackSurface` |
| **Cell-level styling (Ratatui `Cell`)**: symbol + fg/bg + modifiers por celda | ① Diff granular (cambio de color = 1 cell); ② No re-encode toda la línea | ① Memoria ~24 bytes/cell; ② Style merging manual en widgets | [Ratatui Cell](https://ratatui.rs/concepts/rendering/under-the-hood/#cell) (2024) | **5** — OpenTUI ya usa modelo paralelo (char/color/attr arrays); idéntico paradigma |
| **Backend abstraction (Crossterm/Termion)**: `Terminal::flush()` delega a backend | ① Portabilidad terminal; ② Backend maneja escape sequences | ① Indirection; ② Backend-specific quirks | [Ratatui Backends](https://ratatui.rs/concepts/rendering/under-the-hood/#backend) (2024) | **3** — OpenTUI usa Zig nativo; no abstrae backend (ventaja: menos capas) |

---

## 4. Delta Coalescing in Streaming (`message.part.delta`)

| Técnica | Pros (max 2) | Contras (max 2) | Fuentes con fecha | Aplicabilidad (1-5) |
|---------|--------------|------------------|-------------------|---------------------|
| **Buffer + flush periódico (40ms)**: acumular deltas por part/field, `batch()` único | ① Reduce reactivity triggers 10-50×; ② Mantiene orden y deduplica con `message.part.updated` | ① Latencia añadida (40ms); ② Buffer por part/field = memoria + complejidad | [opencode PR #36045](https://github.com/anomalyco/opencode/pull/36045) (2026) · [Issue #26688](https://github.com/anomalyco/opencode/issues/26688) (2026-05-10) | **5** — **Ya implementado en `sync.tsx:398-415`** pero SIN batching (aplica delta por delta). Fix directo: añadir buffer + `setTimeout`/`requestAnimationFrame` flush |
| **Flush inmediato para `message.part.delta` + batch resto**: early-return en handler | ① Latencia mínima para streaming text; ② Otros eventos (tools, status) siguen batched | ① Dos codepaths; ② Race condition si `updated` llega antes que `delta` flush | [Issue #26688](https://github.com/anomalyco/opencode/issues/26688) (2026-05-10) · [Follow-up analysis](https://github.com/anomalyco/opencode/issues/26688#issuecomment-...) (2026) | **4** — Mejora UX percibida; riesgo bajo si `updated` limpia buffer (ver PR) |
| **Microtask batching nativo (Solid 2.0 `flush()`)**: setters enqueue, `flush()` drena | ① Alineado con Vue/Svelte; ② `flush(fn)` para síncrono cuando hace falta | ① `batch()` removido en Solid 2.0; ② Requiere migrar a `flush()` | [Solid 2.0 Reactivity](https://github.com/solidjs/solid/blob/next/documentation/solid-2.0/01-reactivity-batching-effects.md) (2026) · [Solid batch doc](https://www.solidjs.com/docs/latest/api/batch) (2024) | **4** — Solid 1.x usa `batch()`; migración a `flush()` simplifica pero requiere testing |
| **Throttle a nivel SDK (16ms)**: `handleEvent` batch all SSE events | ① Simple, centralizado; ② Reduce renders totales | ① Añade latencia a TODO (incl. streaming text); ② No discrimina event types | [server-sdk.tsx:110](https://github.com/anomalyco/opencode/blob/main/packages/app/src/context/server-sdk.tsx#L110) (2026) | **2** — Ya presente en opencode; causa del problema original (scroll freeze) |
| **Coalescing por key (partID+field)**: `Map<key, string[]>` buffer, join en flush | ① Deduplica naturalmente; ② Fácil skip de parts removidas | ① Map lookup por delta; ② Limpieza de keys huérfanas | [PR #36045](https://github.com/anomalyco/opencode/pull/36045) (2026) | **5** — Implementación recomendada: `deltaBuffers: Map<string, string[]>`, flush con `batch(() => ...)` |

---

## 5. ANSI Escape Batching: SGR + Cursor Movement → Fewer Syscalls

| Técnica | Pros (max 2) | Contras (max 2) | Fuentes con fecha | Aplicabilidad (1-5) |
|---------|--------------|------------------|-------------------|---------------------|
| **Sequence buffer (Elixir TermUI)**: iolist accumulator + SGR combining (`ESC[1;31;4m` vs 3 seqs) | ① Mergea SGR adyacentes; ② Threshold auto-flush (4KB); ③ Stats bytes/flush | ① Elixir/beam específico; ② Requiere parsear SGR en buffer | [TermUI SequenceBuffer](https://repo.hex.pm/preview/term_ui/0.2.0/lib/term_ui/renderer/sequence_buffer.ex) (2024) | **4** — **Portable a Zig/TS**: mismo algoritmo en `CliRenderer` output buffer antes de `stdoutWriter.write()` |
| **Windows `condrv` LPC sincrónico**: cada `WriteFile` = round-trip kernel | ① Windows Terminal rápido procesando; ② Overhead fijo ~1µs/call independientemente de size | ① **Bottleneck #1 en Windows**; ② Requiere batching en user-space | [Microsoft Terminal #20473](https://github.com/microsoft/terminal/issues/20473) (2023-2024) | **5** — **Crítico para Bun en Windows**: `Bun.write`/`process.stdout.write` = syscall por llamada |
| **Bun FileSink coalescing**: shared sink per fd, coalesce small writes hasta `flush()`/tick end | ① Reduce syscalls automáticamente; ② Non-blocking en pipes; ③ `Bun.stdout.writer()` usa sink | ① Console path usa `write_all_sync` (no coalesce); ② TTY = blocking write | [Bun PR #37128](https://github.com/oven-sh/bun/pull/37128) (2024) | **4** — Usar `Bun.stdout.writer()` o `Bun.file(1).writer()` en vez de `process.stdout.write` directo |
| **OpenTUI Zig `BufferedWriter(4096)`**: ya bufferiza en Zig antes de write | ① Ya implementado en renderer; ② 4KB threshold | ① Solo en render thread; ② TS-side writes (scrollback, logs) bypassan este buffer | [renderer.zig](https://github.com/sst/opentui/blob/3dcc7730/packages/core/src/zig/renderer.zig#L80) (2024) | **4** — Extender: funnel TODO output (incl. `writeToScrollback`) por este buffer |
| **SGR state tracking + emit solo delta**: track `lastStyle`, emit solo cambios | ① Elimina resets redundantes; ② ~30% menos bytes en output típico | ① State machine compleja (nested styles, reset); ② Debugging harder | [TermUI Style combining](https://repo.hex.pm/preview/term_ui/0.2.0/lib/term_ui/renderer/sequence_buffer.ex#L90) (2024) | **3** — OpenTUI ya emite runs con estilo; ganancia marginal vs buffer size |

---

## Ranking Top-3 para Nuestro Caso + Próximo Experimento

| Rank | Técnica | Impacto Esperado | Esfuerzo | Próximo Experimento (1 semana) |
|------|---------|------------------|----------|--------------------------------|
| **1** | **Delta coalescing 40ms buffer en `sync.tsx`** (Tema 4) | **Alto**: elimina scroll freeze en streaming GLM/Claude; reduce reactivity 10-50× | **Bajo** (~50 líneas): `Map<partID+field, string[]>`, `setTimeout` flush, `batch()` en flush | Implementar en `sync.tsx:398`; medir `cellsUpdated`/frame y scroll latency con `opencode run --print-logs` |
| **2** | **Virtual scrollback en `ScrollbackSurface`** (Tema 3) | **Alto**: memoria O(viewport) vs O(historial); scroll 60fps en sesiones largas | **Medio** (~200 líneas): `VirtualList` pattern, medir líneas visibles, render solo viewport | Prototipo en `packages/tui/src/scrollback-surface.tsx`; benchmark 10k líneas vs actual |
| **3** | **Funnel todo stdout por OpenTUI `BufferedWriter`** (Tema 5) | **Medio-Alto**: reduce syscalls Windows 5-10×; unifica backpressure | **Medio** (~100 líneas): exponer `renderer.writeRaw(bytes)` en TS, migrar `writeToScrollback` + logs | Añadir `writeRaw` a `@opentui/core` TS bindings; medir `stdoutWriteTime` en `getNativeStats()` |

---

## Confidence Summary

| Tema | Confidence (1-5) | Key Evidence |
|------|------------------|--------------|
| 1. OpenTUI Pipeline | **5** | Source code + docs oficiales; knobs ya expuestos |
| 2. Ink Techniques | **4** | Reconciler source + docs; Static pattern portable a Solid |
| 3. Ratatui/Textual | **4** | Docs oficiales + source; dirty regions + virtual scroll aplicables |
| 4. Delta Coalescing | **5** | **Ya hay PR/issue en opencode** con métricas reales (57 deltas, gaps 1s) |
| 5. ANSI Batching | **4** | Windows condrv bottleneck documentado; Bun FileSink + Zig buffer ya existen |

---

## Recommended Action Plan

1. **Semana 1**: Implementar delta coalescing (Tema 4) — mayor ROI, menor riesgo
2. **Semana 2-3**: Virtual scrollback (Tema 3) — requiere diseño de `VirtualList` en Solid
3. **Semana 3-4**: Unified stdout buffer (Tema 5) — requiere cambio en `@opentui/core` TS bindings

**No hacer PoC de**: Ink Yoga layout (no aplica), Ratatui immediate mode (OpenTUI ya retained), SGR combining (ganancia marginal vs buffer size).