# Sintaxis / Linting

Fecha: 2026-07-03
Auditor: subagente (read-only)

## Hallazgos

### 1. Uso excesivo de ny

| # | Severidad | Archivo | Ocurrencias | Descripción | Recomendación |
|---|---|---|---|---|---|
| 1 | 🟠 Alto | packages/opencode/src/provider/transform.ts | 37 | Mayor concentración de ny en el código. Funciones de transformación de proveedores con tipos poco estrictos. | Refactorizar con tipos Effect/Schema fuertes. |
| 2 | 🟠 Alto | packages/opencode/src/provider/provider.ts | 24 | Módulo de providers con manejo muy laxo de tipos. | Migrar a Schema.Class para la configuración de providers. |
| 3 | 🟡 Medio | packages/opencode/src/plugin/github-copilot/copilot.ts | 10 | Integración GitHub Copilot con tipos any. | Definir interfaces específicas. |
| 4 | 🟡 Medio | packages/opencode/src/lsp/lsp.ts | 7 | Módulo LSP con tipos any. | Tipar con genéricos. |
| 5 | 🟡 Medio | packages/core/src/tool/tool.ts | 6 | API pública de herramientas con any. | Notar que SchemaType<A> = Schema.Codec<A, any, never, never> es intencional (necesario para flexibilidad), pero AnyTool = Definition<any, any> filtra any al exterior. |
| 6 | 🟡 Medio | packages/core/src/plugin.ts | 6 | Plugin interface con any. | Definir tipos concretos donde sea posible. |
| 7 | 🟡 Medio | packages/opencode/src/util/rpc.ts | 6 | Utilidad RPC con tipado any. | Usar genéricos. |
| 8 | 🟡 Medio | packages/opencode/src/tool/tool.ts | 5 | Tool definitions con any. | Aplicar Schema.tagged o genéricos. |
| 9 | 🟡 Medio | Otros 62 archivos | 93 | Distribución de any en 62 archivos más (1-4 ocurrencias cada uno). | Revisión gradual en cada módulo. |

**Total: 192 ocurrencias de ny en 71 archivos fuente** (solo packages/core/src/ y packages/opencode/src/).

### 2. TypeScript type escapes (@ts-ignore / @ts-expect-error)

| # | Severidad | Archivo:Línea | Directiva | Razón declarada |
|---|---|---|---|---|
| 1 | 🟡 Medio | packages/core/src/database/sqlite.bun.ts:76 | @ts-expect-error | bun-types missing safeIntegers method |
| 2 | 🟡 Medio | packages/core/src/database/sqlite.bun.ts:92 | @ts-expect-error | bun-types missing safeIntegers method |
| 3 | 🟡 Medio | packages/core/src/filesystem/watcher.ts:3 | @ts-expect-error | @parcel/watcher/wrapper has no types |
| 4 | 🟡 Medio | packages/core/src/npm-config.ts:4 | @ts-expect-error | npm does not publish types |
| 5 | 🟡 Medio | packages/core/src/npm-config.ts:6 | @ts-expect-error | npm does not publish types |
| 6 | 🟢 Bajo | packages/opencode/src/cli/heap.ts:75 | @ts-expect-error | Bun FFI or Node priority API |
| 7 | 🟡 Medio | packages/opencode/src/plugin/index.ts:162 | @ts-expect-error | Sin razón declarada explícita |
| 8 | 🟡 Medio | packages/opencode/src/provider/provider.ts:1189 | @ts-expect-error | Sin razón declarada |
| 9 | 🟡 Medio | packages/opencode/src/provider/provider.ts:1195 | @ts-expect-error | Sin razón declarada |
| 10 | 🟡 Medio | packages/opencode/src/session/llm.ts:342 | @ts-expect-error | Sin razón declarada |
| 11 | 🟡 Medio | packages/opencode/src/session/session.ts:401 | @ts-expect-error | Sin razón declarada |
| 12 | 🟡 Medio | packages/opencode/src/session/session.ts:403 | @ts-expect-error | Sin razón declarada |
| 13 | 🟢 Bajo | packages/opencode/src/server/shared/ui.ts:47 | @ts-expect-error | generated file at build time |

**Total: 13 directivas de type escape en 9 archivos.**

### 3. Configuración de Linter Ausente

| # | Severidad | Descripción | Recomendación |
|---|---|---|---|
| 1 | 🔴 Crítico | **No se encontró ningún archivo de configuración de linter** en el repo: ni .eslintrc*, ni iome.json, ni .oxlintrc.json, ni 	slint.json. | **Instalar biome o eslint.** Un proyecto de este tamaño sin linter es insostenible a largo plazo. Biome se integra bien con el ecosistema y puede reemplazar eslint + prettier. |
| 2 | 🟡 Medio | TypeScript strict mode está habilitado vía @tsconfig/bun (strict: true), pero los flags 
oUnusedLocals: false y 
oUnusedParameters: false desactivan la detección de código muerto. | Cambiar a 
oUnusedLocals: true y 
oUnusedParameters: true progresivamente. |

### 4. Problemas Detectados en Archivos Clave

#### 4a. packages/opencode/src/index.ts (entry point)

El entry point es sólido. Usa lazy loading para comandos (vMK optimization). Sin embargo:
- **Línea 29, 34**: (cmd.builder as any)(yargs) y (args as any) — 2 escapes de tipo en el entry point principal. Aunque justificados por la naturaleza dinámica de yargs, idealmente se podría tipar CommandModule mejor.
- **Línea 75-77**: process.env.OPENCODE_PURE = "1" — asignación a string en lugar de boolean. Patrón común pero frágil.

#### 4b. packages/core/src/session/runner/index.ts

Archivo pequeño (39 líneas) y bien tipado. El único problema es el self-reexport circular ya documentado en codigo-muerto.md.

#### 4c. packages/core/src/tool/bash.ts

- **Líneas 81-92**: **12 TODOs pendientes** (ver sección 5).
- **No hay escapes de tipo** — el archivo usa Effect.Schema correctamente.
- **Línea 159**: Object.assign({}, ...entries.flatMap(...)) para obtener shell de config — funcional pero idiomáticamente mejorable con un pipe de Effect.

#### 4d. packages/opencode/src/session/processor.ts

- **15 TODOs(v2)**: todos sobre "Temporary dual-write while migrating session messages to v2 events". Esto indica que una migración importante está en progreso y no se ha completado.
- **Línea 207, 352**: Uso de Record<string, any> para metadata de tool calls.
- **Línea 133**: Uso de : unknown seguido por rrorMessage(e) — patrón correcto (no any).
- **Línea 682**: 	hrow new Error(value.message) en caso provider-error, en vez de usar Effect.fail.

### 5. TODOs Acumulados

#### bash.ts (12 TODOs, líneas 81-92)

| # | TODO | Impacto |
|---|---|---|
| 1 | Port tree-sitter bash/PowerShell parser-based approval reduction | 🟠 Alto — Seguridad |
| 2 | Port BashArity reusable command-prefix approvals | 🟡 Medio |
| 3 | Replace token-based command-argument external-directory advisories with parser-based detection | 🟠 Alto — Seguridad |
| 4 | Restore PowerShell and cmd-specific invocation/path handling on Windows | 🟡 Medio — Windows |
| 5 | Add plugin shell.env environment augmentation once V2 plugin hooks exist | 🟢 Bajo |
| 6 | Add durable/live progress metadata streaming for long-running commands | 🟡 Medio |
| 7 | Persist background job status and define restart recovery before exposing remote observation | 🟡 Medio |
| 8 | Re-add model-facing background launch with owner-bound get/wait/cancel tools | 🟡 Medio |
| 9 | Add HTTP background-job observation after durable status, restart recovery, and authorization | 🟡 Medio |
| 10 | Revisit process-group cleanup and platform coverage with shell-specific tests | 🟡 Medio |
| 11 | Revisit binary output handling if stdout/stderr decoding is text-only | 🟡 Medio |
| 12 | Stream full shell output into managed storage while retaining bounded in-memory preview | 🟡 Medio |

#### processor.ts (15 TODOs, todos v2 dual-write)

| # | Líneas | TODO | Impacto |
|---|---|---|---|
| 1-15 | 250, 315, 375, 453, 475, 487, 553, 601, 658, 686, 709, 768, 827, 946, 1006 | "Temporary dual-write while migrating session messages to v2 events" | 🟠 Alto — Esto sugiere que la migración v2 de eventos está incompleta y hay 15 puntos donde el código escribe tanto en V1 como en V2. |

## Resumen

Total: 13 hallazgos directos + 27 TODOs

| Categoría | Cantidad | Severidad más alta |
|---|---|---|
| Uso de ny (192 ocurrencias, 71 archivos) | 🔴 Alto | 🟠 Alto (mayoría en provider/transform, provider/provider) |
| Type escapes (13 directivas, 9 archivos) | 🟡 Medio | 🟡 Medio |
| Sin linter configurado | 🔴 **Crítico** | 🔴 **Crítico** |
| TypeScript strict parcial (noUnusedLocals/Params false) | 🟡 Medio | 🟡 Medio |
| TODOs bash.ts | 12 | 🟠 Alto |
| TODOs processor.ts | 15 | 🟠 Alto |

### Recomendaciones prioritarias

1. **🔴 Crítico**: Establecer configuración de linter (biome o eslint) con reglas estándar para TypeScript.
2. **🟠 Alto**: Refactorizar packages/opencode/src/provider/transform.ts y provider/provider.ts para reducir ny — estos son los archivos con mayor concentración.
3. **🟡 Medio**: Completar la migración v2 de eventos (15 TODOs en processor.ts).
4. **🟡 Medio**: Habilitar 
oUnusedLocals/
oUnusedParameters en tsconfig progresivamente.
5. **🟡 Medio**: Abordar los 12 TODOs de bash.ts, especialmente los de seguridad (árbol de sintaxis para aprobaciones).
