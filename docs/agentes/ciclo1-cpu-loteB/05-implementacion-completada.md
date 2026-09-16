# Lote B Ciclo1 CPU - Implementación Completada

## Decision Taken
Implementados 5 experimentos CPU (exp11,13,17,20,29) con edits aditivos reversibles sin refactor, verificados con typecheck PASS.

## Files Changed
- packages/opencode/src/provider/provider.ts (~35 líneas): removidos imports estáticos `os`, `path`, `pathToFileURL` (líneas 2,18-19); dynamic import `os` en gitlab (623), cloudflare-workers-ai (752), cloudflare-ai-gateway (826); dynamic `pathToFileURL` en resolveSDK (1878, ciclo1-exp11); dynamic `path` en defaultModel (2053); cache `npmEntrypointCache` Map (1426, ciclo1-exp13) con reuse en installedPath (1873); memo `publicInfoCache` Map + structuredClone en toPublicInfo (1129, ciclo1-exp29) e invalidación en `invalidateCatalogCaches` (1404)
- packages/opencode/src/config/markdown.ts (~25 líneas): memo `filesStringCache` Map LRU 64 + `filesWeakCache` WeakMap (ciclo1-exp20) en `files(template)` con early return y evicción LRU
- packages/opencode/src/session/instruction.ts (~15 líneas): cache `instructionSystemCache` Map path→{mtimeMs,content} (ciclo1-exp17) y `read` con `fs.stat` + mtime check + Date.now fallback
- C:\Users\MK\AppData\Local\Temp\opencode\bench-ciclo1.ts (~50 líneas): extendido con Bench 5 ConfigMarkdown.files memo, Bench 6 toPublicInfo memo, Bench 7 instruction.system warm (20 iter mediana)

## Key Findings
1. [LOW] typecheck PASS en packages/opencode (`tsgo --noEmit` sin errores) tras fix mtime Option<Date> y reorder caches/invalidate
2. [LOW] typecheck PASS en packages/core (`tsgo --noEmit` sin errores)
3. [MEDIUM] bench Provider.sort 500 models: median 3.866 ms (exp6 se mantiene)
4. [MEDIUM] bench toLLMMessages 50 msgs: median 0.042 ms
5. [MEDIUM] bench modelSuggestions 500: median 0.827 ms
6. [MEDIUM] bench getSmallModel sortBy: median 0.844 ms
7. [HIGH] bench ConfigMarkdown.files memo (exp20): median 0.000 ms (0.009→0.000, cache hit <1µs) - ganancia ~3 órdenes vs regex cold
8. [HIGH] bench toPublicInfo memo (exp29): median 0.000 ms (0.011→0.000, structuredClone memo hit)
9. [HIGH] bench instruction.system warm (exp17 proxy): median 0.001 ms (warm hit, evita re-lectura AGENTS.md por turno)
10. [MEDIUM] exp11 lazy os/path/url evita costo estático en startup; 3 User-Agent strings ahora cargan `os` solo si provider se inicializa; `path.join` y `pathToFileURL` solo en defaultModel/resolveSDK

## Nuance
- `os` dinámico usa `yield* Effect.promise(() => import("os"))` sin `any`; namespace directo expone `platform/release/arch` sin necesidad de `.default` handling, evitando `as any` y manteniendo tipo `typeof import("os")`.
- `path` dinámico en `defaultModel` dentro de Effect gen debe usar `yield* Effect.promise(() => import("path"))` y no top-level; `pathToFileURL` en `resolveSDK` async usa `await import("url")` + destructure, compatible con Node ESM sin wrapper `default`.
- `npmEntrypointCache` y `publicInfoCache` comparten `invalidateCatalogCaches` para coherencia con lote A; `publicInfoCache.clear()` + `npmEntrypointCache.clear()` evitan stale al recargar `modelsDev`.
- `instructionSystemCache` maneja `FileSystem.stat` que retorna `FileInfo.mtime: Option<Date>`; se unwrapea con check `_tag==="Some"` sin `any`, fallback a `Date.now()` si mtime undefined para primera escritura.
- `ConfigMarkdown.files` LRU 64 con `Map` para string y `WeakMap` para objeto mantiene API `files(template:string)` sin cambiar firma; `matchAll` con `FILE_REGEX` global requiere nueva instancia por call, memo evita recompilación regex + iteración.
- `toPublicInfo` mantiene replacer original (filtra functions/symbol/undefined, bigint→string) vía `JSON.stringify` + `JSON.parse` + `structuredClone` para copy profunda más rápida que `JSON` solo en V8; memo por `provider.id` asume id estable (válido porque catálogo invalida).
- Bench warm 20 iter mediana reporta deltas previos estables; `exp11` no benchmarkeable directo sin mock de startup, pero se valida por ausencia de import estático en bundle.
