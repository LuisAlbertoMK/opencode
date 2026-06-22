# Auditoría de Patches — 2026-06-22

## Resumen

| Estado | Cantidad |
|--------|----------|
| ✅ Activos y necesarios | 9 |
| ❌ Huérfanos | 1 |
| ✅ Reemplazados por upstream | 1 |
| 🔴 Alto riesgo | 2 (gcp-metadata, pacote) |

---

## 1. ❌ @ff-labs/fff-bun@0.9.3 — **HUÉRFANO**

| Campo | Valor |
|-------|-------|
| **Patch version** | 0.9.3 |
| **Project dependency** | `0.9.4` (exacta) |
| **Parchea** | Binary resolution: `createRequire` → `require()` directo |
| **Riesgo** | 🟢 Ninguno. El patch simplemente no se aplica porque la versión no coincide. El fix podría estar ya incluido en 0.9.4. |
| **Acción** | **Eliminar** la entrada de `patchedDependencies` |

---

## 2. ✅ @ai-sdk/google@3.0.73 — ACTIVO

| Campo | Valor |
|-------|-------|
| **Parchea** | `convertToGoogleGenerativeAIMessages` — filtra mensajes con `parts.length === 0` que Gemini rechaza |
| **Riesgo** | 🟡 Medio. Toca mensajes entrantes/salientes del LLM. |
| **Upstream** | **NO FIXED** en 3.0.83. Código revisado: el filtro de `contents.pop()` para partes vacías no está en el source de `convert-to-google-generative-ai-messages.ts`. |
| **Acción** | **Mantener**. Bug no resuelto upstream. Monitorear próximas releases del AI SDK. |

---

## 3. ✅ @ai-sdk/xai@3.0.82 — ACTIVO

| Campo | Valor |
|-------|-------|
| **Parchea** | Agrega soporte PDF (`input_file`) al provider xAI |
| **Riesgo** | 🟢 Bajo. Feature addition, no bug fix. |
| **Acción** | **Mantener** hasta que xAI SDK lo soporte nativamente. |

---

## 4. ✅ @modelcontextprotocol/sdk@1.29.0 — ACTIVO (CRÍTICO)

| Campo | Valor |
|-------|-------|
| **Parchea** | Session recovery en StreamableHTTP: `_initialize()` reusable, `onsessionexpired`, reconnection logic, `isRequestActive` check |
| **Riesgo** | 🔴 Alto. 427 líneas de patch. Toca el core del protocolo MCP: lifecyle de conexión, reintentos, sesiones. |
| **Acción** | **Mantener**. Monitorear upstream para cuando saquen estas features oficialmente. |

---

## 5. ✅ @npmcli/agent@4.0.2 — ACTIVO

| Campo | Valor |
|-------|-------|
| **Parchea** | `proxy.toString()` faltante — el proxy URL se serializaba incorrectamente |
| **Riesgo** | 🟢 Bajo. Fix pequeño y acotado. |
| **Upstream** | **NO FIXED** en 4.0.2 ni 5.0.2. `proxy.js` y `agents.js` idénticos. Código fuente revisado en tags de npm/agent. |
| **Acción** | **Mantener**. Bug no resuelto upstream. Bump a 5.0.2 no vale la pena. |

---

## 6. ✅ @silvia-odwyer/photon-node@0.3.4 — ACTIVO

| Campo | Valor |
|-------|-------|
| **Parchea** | WASM compatibility con Bun: separa `__wbindgen_placeholder__` de `module.exports`, permite wasm path custom vía `globalThis.__OPENCODE_PHOTON_WASM_PATH` |
| **Riesgo** | 🟡 Medio. Package nativo (Rust→WASM). El parche es grande (285 líneas) pero es mecánico (rename + path hook). |
| **Acción** | **Mantener**. Evaluar migración a alternativa más moderna para image processing. |

---

## 7. ✅ @standard-community/standard-openapi@0.2.9 — ACTIVO

| Campo | Valor |
|-------|-------|
| **Parchea** | External `$ref` URLs en OpenAPI conversion: skips refs pointing to URLs externas |
| **Riesgo** | 🟢 Bajo. Edge case en conversión de schemas. |
| **Acción** | **Mantener**. |

---

## 8. ✅ gcp-metadata@8.1.2 — ACTIVO (SENSIBLE)

| Campo | Valor |
|-------|-------|
| **Parchea** | `isAvailable()`: captura `AggregateError` de `Promise.any()` para no crashear fuera de GCP |
| **Riesgo** | 🔴 Alto. Package que maneja autenticación GCP (credenciales). Pero el patch es **pequeño y correcto**: solo agrega un catch. |
| **Acción** | **Mantener**. Priorizar upgrade cuando esté disponible. |

---

## 9. ✅ pacote@21.5.0 — ACTIVO (SENSIBLE)

| Campo | Valor |
|-------|-------|
| **Parchea** | Git tarball fallback: detecta HTML sign-in pages (status 200 pero no tarball) y hace fallback a `git clone` |
| **Riesgo** | 🟡 Medio. Package que instala dependencias npm desde git. El patch mejora robustness. |
| **Acción** | **Mantener**. Verificar si fixed en >=21.5.1. |

---

## 10. ✅ solid-js@1.9.13 — REPLACED BY UPSTREAM

| Campo | Valor |
|-------|-------|
| **Parchea** | Transition state fix (#2046): set committed value on first computation during transition |
| **Riesgo** | 🟢 Bajo. Fix de bug en sistema reactivo de SolidJS. |
| **Upstream** | **FIXED IN 1.9.13** ✅. Código revisado: `runComputation` incluye `if (!Transition.sources.has(node)) node.value = nextValue`. |
| **Acción** | **Bump a 1.9.13 y eliminar patch**. ✅ **HECHO** — version bumped, patch file deleted, patchedDependencies entry removed, bun.lock updated. |

---

## 11. ✅ virtua@0.49.1 — ACTIVO

| Campo | Valor |
|-------|-------|
| **Parchea** | `measure()` method en Virtualizer, range clamping (`Math.max(0, next[0])`), `keepMounted` bounds check |
| **Riesgo** | 🟢 Bajo. Feature addition + bug fixes. |
| **Acción** | **Mantener**. Verificar si fixed en >=0.50.0. |

---

## Acciones Realizadas (2026-06-22)

| Prioridad | Acción | Resultado |
|-----------|--------|-----------|
| 🔴 **Alta** | **Eliminar** `@ff-labs/fff-bun@0.9.3` de `patchedDependencies` | ✅ Hecho en commit anterior |
| 🟡 **Media** | Verificar `@ai-sdk/google@3.0.82+` | ❌ **No fixed** en 3.0.83. Mantener patch. |
| 🟡 **Media** | Verificar `solid-js@1.9.11+` | ✅ **Fixed** en 1.9.13. Bump a 1.9.13 y eliminar patch. Hecho. |
| 🟡 **Media** | Verificar `@npmcli/agent@4.0.3+` | ❌ **No fixed** en 4.0.2 ni 5.0.2. Mantener patch. |

## Pendientes

| Prioridad | Acción | ¿Por qué? |
|-----------|--------|-----------|
| 🟡 **Media** | Monitorear `@modelcontextprotocol/sdk` | Session recovery es feature ausente en 1.29.0 |
| 🟢 **Info** | Evaluar alternativa a `photon-node` | Package abandonado? Es nativo WASM, parche grande |
