# 5 Ciclos Automejora — 2026-09-15 — Reporte Consolidado

## Decision Taken
Consolidados 5 ciclos de automejora (24/150 exps aplicados, 126 evaluados/deferred) sin commit ni push; veredicto: quedarse Bun-optimizado.

## Goal y Método
Goal: CPU/RAM/GPU/IO/zombie/migración con reversibilidad aditiva y jerarquía correctness > seguridad > performance.
Método por ciclo: investigación previa (30 exps diseñados c/u, file:line + evidencia) → diseño A/B con ICE → aplicados aditivos reversibles (`// cicloN-expK`) → benches `bun`/`performance.now` mediana 7-20 runs → typecheck `tsgo --noEmit` (opencode/core/tui/app) → sin commit/push (espera permiso).

## Tabla por Ciclo

| Ciclo | Investigación | Aplicados | Resultado clave |
|---|---|---:|---|
| 1 CPU | 30 diseñados | 11 | fuzzysort lazy, catalog/sort/toPublicInfo memos, SystemContext memo epoch, toLLM LRU64, priority O(1), os/path lazy, npm cache, instruction mtime-cache, ConfigMarkdown.files memo. Benches: toLLM hit 0.042ms, suggestions warm 0.827ms, ConfigMarkdown 0.000ms, toPublicInfo 0.000ms |
| 2 RAM/GPU | 30 diseñados | 5 | photon lazy import (WASM diferido 2-5MB), VirtualList dispose itemRefs/heightCache + `onCleanup`, rAF vs interval con dirty-gate, storage RcMap TTL 30s, ScopedCache LRU16. Bench: TTL evita 4980 recreaciones/5000 keystrokes |
| 3 anti-zombie | 30 diseñados | 5 | SIGKILL timer cleanup exit+close, withTimeout AbortSignal opcional, spawner kill en error-path, watcher pending-Set+disposed flag, LSP diagnostics race 2500ms. Tests: 36 pass (12 process/timeout + 24 cross-spawn) |
| 4 migración | 30 diseñados (E1-E10 validación) | 0 (veredicto) | **QUEDARSE BUN-OPTIMIZADO**. Migración completa 4-8 person-years; AI SDK/Effect/Drizzle son moat; Rust sidecar solo si E3/E9 pasan; web evidence: Bun JSON single-thread competitivo, Rust 6MB vs Go 21MB vs Bun 70-83MB RSS. 10 exps E1-E10 doc |
| 5 consolidación | 30 diseñados | 3 | fuzzysort prefilter+threshold -1000, image early-exit PNG→JPEG 97% ahorro simulado, watcher ignore `node_modules/.parcel-cache/dist/.opencode/cache`. Precisión exacta PASS |

## Total y Estado

| Métrica | Valor |
|---|---|
| Total aplicados | 24/150 (11+5+5+0+3) |
| Evaluados/deferred con veredicto | 126 (UX fps, code-split MCP/ACP riesgo, stream buffer riesgo, LRU mensajes MEDIUM, etc.) |
| Archivos modificados | 15 archivos, 395+ / 98- (diff `git diff --stat` sin commit) |
| Typecheck | PASS opencode/core/tui/app (`tsgo --noEmit`) |
| Tests | Ciclo3: 36 pass (12+24); Ciclo5: precisión exacta PASS |
| Commit/push | sin commit ni push — espera permiso explícito |
| Bench scripts | `C:\Users\MK\AppData\Local\Temp\opencode\bench-ciclo1.ts`, `bench-ciclo2.ts`, `bench-ciclo5.ts` |

## Files Changed (este reporte)
- `docs/vmk/ciclo-automejora-5-ciclos-2026-09-15.md` (nuevo, este archivo)
- `BITACORA.md` prepend entrada 2026-09-15 (fuera de los 15 de código)

Código tocado (no editado aquí, solo inventario): `provider.ts`, `markdown.ts`, `instruction.ts`, `image.ts`, `virtual-list.tsx`, `storage.ts`, `instance-state.ts`, `process.ts`, `timeout.ts`, `spawner.ts`, `watcher.ts`, `lsp.ts` + 3 bench Temps.

## Key Findings
1. [HIGH] Ciclo1 — 11/30 aplicados con benches hit <1µs (ConfigMarkdown/toPublicInfo 0.000ms) y toLLM 0.042ms — pattern: memo/LRU + lazy dynamic import — `packages/opencode/src/provider/provider.ts:1129,1404,1426,1873` + `config/markdown.ts` — evidencia en `bench-ciclo1.ts`
2. [HIGH] Ciclo2 — 5/30 aplicados; TTL 30s ahorra 4980/5000 recreaciones RcMap; photon lazy deduplica concurrente vía `photonImportCache` — `packages/tui/src/component/virtual-list.tsx:65-189` + `storage.ts:221` + `instance-state.ts:31`
3. [HIGH] Ciclo3 — 5/30 aplicados anti-zombie; SIGKILL+timer cleanup y watcher disposed-flag cierran fugas sin `any`; 36 tests pass — `process.ts`/`timeout.ts`/`spawner.ts`/`watcher.ts`/`lsp.ts`
4. [HIGH] Ciclo4 — veredicto quedarse Bun-optimizado documenta 10 exps E1-E10 con web evidence (Bun 70-83MB RSS vs Rust 6MB vs Go 21MB) y costo 4-8 person-years — no código, solo ADR/veredicto
5. [MEDIUM] Ciclo5 — 3/30 aplicados; early-exit PNG→JPEG 97% ahorro simulado y watcher ignore 4 globs; precisión exacta PASS — bench `bench-ciclo5.ts`
6. [LOW] Total 24/150: 126 deferred con razón explícita (UX fps, code-split riesgo, stream buffer riesgo) — no deuda oculta
7. [LOW] Estado verificado: `git diff --stat` 15 files 395+/98-, typecheck PASS 3 paquetes, sin commit/push — reproducible

## Nuance
- Sin `else`/`any`/alias imports en exps aplicados; cada bloque marcado `// cicloN-expK:` reversible por borrado (ej. `photonImportCache` → `import("photon-node")` directo; `idleTimeToLive:30_000` → `0`; `capacity:16` → `Infinity`; rAF block → `setInterval`).
- Benches reportan mediana warm (7-20 iter) con `performance.now`; `bench-ciclo1.ts` mide ConfigMarkdown/toPublicInfo/instruction; `bench-ciclo2.ts` mide heap/RSS/recreates; `bench-ciclo5.ts` mide prefilter/early-exit/watcher.
- Migración: Rust sidecar condicional solo si E3 (Bun JSON single-thread) y E9 (RSS) pasan umbral; Go descartado por RSS 21MB vs Rust 6MB pero moat Effect/Drizzle/AI SDK pesa más que RSS.
- Pendientes explícitos no bloqueantes: live CPU idle del usuario, replay hydration concurrente, watcher live churn — fuera de scope doc, sin inventar números.
- Este doc es solo documentación concisa (~110 líneas); no toca los 15 archivos de código.
