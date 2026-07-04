# Rationale de Patches — opencode vMK

> Documenta por qué cada patch en `patchedDependencies` es necesario y si hay alternativas upstream.

---

## Resumen

| Paquete | Versión | Upstream Status | Criticalidad |
|---------|---------|-----------------|--------------|
| `@npmcli/agent` | 4.0.2 | No (fix trivial, v5.0.2 sin el fix) | Baja |
| `@silvia-odwyer/photon-node` | 0.3.4 | No (fix específico vMK binary) | **Alta** |
| `@standard-community/standard-openapi` | 0.2.9 | No (edge case $ref externo) | Media |
| `virtua` | 0.49.2 | Sí — parche ya aplica a 0.49.2 (actualizado) | Media |
| `@ai-sdk/xai` | ✅ 4.0.6 | Parche eliminado — PDF support nativo | ~~Alta~~ Hecho |
| `gcp-metadata` | 8.1.2 | No (suppress warning legítimo) | Baja |
| `pacote` | 21.5.0 | Sí — fix nativo en 22.0.0, bloqueado por arborist v9 | Media |
| `@ai-sdk/google` | ✅ 4.0.8 | Parche eliminado — fix nativo en v4 | ~~Alta~~ Hecho |
| `@modelcontextprotocol/sdk` | 1.29.0 | Parcial en 1.30-beta (aún no publicado) | Media |
| `effect` | 4.0.0-beta.83 | Fix específico vMK (HttpApiSchema SSE identifier) | Baja |

---

## Detalle por Patch

### 1. `@npmcli/agent@4.0.2` 🔴 No actualizable
**Archivo**: `patches/@npmcli%2Fagent@4.0.2.patch`
**Cambio**: `this.#proxy ? { url: this.#proxy }` → `this.#proxy ? { url: this.#proxy.toString() }`
**Razón**: `this.#proxy` es un objeto `URL`, no string. Sin `.toString()` falla serialización.
**Upstream**: **Fix NO está en v5.0.2**. Verificado: `lib/agents.js` en v5.0.2 aún tiene `return this.#proxy ? { url: this.#proxy } : {}` sin `.toString()`. v4.0.2→5.0.2 es major bump que no resuelve este fix.
**Acción**: Mantener patch. No hay beneficio en actualizar a v5.x (solo agrega breaking changes sin resolver el fix).

---

### 2. `@silvia-odwyer/photon-node@0.3.4` ⭐ **CRÍTICO**
**Archivo**: `patches/@silvia-odwyer%2Fphoton-node@0.3.4.patch`
**Cambio**: 
1. `imports['__wbindgen_placeholder__'] = module.exports` → usa variable local
2. `module.exports.__wbg_*` → `__wbindgen_placeholder__.__wbg_*`
3. `const path = require('path').join(__dirname, 'photon_rs_bg.wasm')` → `globalThis.__OPENCODE_PHOTON_WASM_PATH || ...`
**Razón**: 
- (1) y (2): Evita contaminar `module.exports` global — necesario para que funcione dentro del binario compilado de Bun (single-file executable)
- (3): Permite inyectar ruta del WASM embebido via `globalThis.__OPENCODE_PHOTON_WASM_PATH` en build time
**Upstream**: Muy específico a cómo Bun compila binarios single-file. **No upstreamable**.
**Acción**: Mantener patch indefinidamente. Documentar en build script.

---

### 3. `@standard-community/standard-openapi@0.2.9`
**Archivo**: `patches/@standard-community%2Fstandard-openapi@0.2.9.patch`
**Cambio**: Al encontrar `$ref` con `://` (URL externa), no intentar resolverlo localmente; devolver `{ type: "string" }` o el resto del schema.
**Razón**: Edge case donde OpenAPI spec referencia schema externo via URL absoluta. Sin patch, lanza error interno.
**Upstream**: Caso edge raro. Podría reportarse pero prioridad baja.
**Acción**: Mantener patch. Re-evaluar si se actualiza paquete.

---

### 4. `virtua@0.49.2` ✅ Actualizado
**Archivo**: `patches/virtua@0.49.2.patch`
**Cambio**: Fix para virtual scrolling en TUI (3.7KB patch).
**Razón**: Comportamiento de scroll virtual necesario para el renderizado TUI.
**Upstream**: v0.49.2 ya actualizado. El parche aplica limpio a 0.49.2.
**Acción**: Mantener. Si hay v0.50+, testear si patch sigue necesario.

---

### 5. `@ai-sdk/xai@3.0.82` ✅ ACTUALIZADO a v4.0.6
**Archivo**: ~~`patches/@ai-sdk%2Fxai@3.0.82.patch`~~ (ELIMINADO)
**Cambio del patch**: Añadía soporte `application/pdf` en `convertToXaiResponsesInput`.
**Upstream**: v4.0.6 incluye PDF support nativo (detección `.pdf` en URI + `"application/pdf"` en mediaType). `createXai()` preservado. API de provider cambió: `responses()` → `languageModel()`.
**Acción**: ✅ Actualizado. Patch removido. Código migrado (`responses()` → `languageModel()` en `xai.ts`). Typecheck + build + 7/7 TUI tests pasan.

---

### 6. `gcp-metadata@8.1.2`
**Archivo**: `patches/gcp-metadata@8.1.2.patch`
**Cambio**: En `isAvailable()`, detectar `AggregateError` de `Promise.any()` y retornar `false` silenciosamente (no warning).
**Razón**: Fuera de GCP, ambos metadata hosts fallan → `Promise.any` rechaza con `AggregateError`. Esto es **comportamiento esperado**, no error. Sin patch, loggea warning molesto.
**Upstream**: Comportamiento legítimo. Podría reportarse como feature request (option para suprimir).
**Acción**: Mantener patch. Baja prioridad para upstream.

---

### 7. `pacote@21.5.0` 🔴 Bloqueado (arborist v9)
**Archivo**: `patches/pacote@21.5.0.patch`
**Cambio**: Mejora fallback de tarball a git clone:
- Antes: solo si error constructor name matchea `/^Http/`
- Después: si `statusCode >= 400` O error code matchea `/^TAR_/`
**Razón**: Maneja caso donde proveedor hosted devuelve HTML sign-in page con HTTP 200 (no error HTTP, pero tarball inválido).
**Upstream**: ✅ **Fix nativo en v22.0.0**. Verificado: `lib/git.js` en pacote@22.0.0 ya incluye:
```javascript
if ((typeof er.statusCode === 'number' && er.statusCode >= 400) ||
    /^TAR_/.test(er.code)) {
  return this.#clone(handler, false)
```
**Acción**: No se puede actualizar a 22.0.0 porque `@npmcli/arborist@9.4.0` requiere `^21.0.2`. Arborist 10.x (pre-release) podría permitirlo. Re-evaluar cuando arborist 10.x estable esté disponible.

---

### 8. `@ai-sdk/google@3.0.73` ✅ ACTUALIZADO a v4.0.8
**Archivo**: ~~`patches/@ai-sdk%2Fgoogle@3.0.73.patch`~~ (ELIMINADO)
**Cambio del patch**: Fix `parts.length === 0` pop en `convertToGoogleGenerativeAIMessages`.
**Upstream**: v4.0.8. `createGoogleGenerativeAI` preservado como alias de `createGoogle`. API de content parts reescrita genéricamente.
**Acción**: ✅ Actualizado. Patch removido. No requiere cambios de API en consumidor (`createGoogleGenerativeAI` funciona igual). Typecheck + build + 7/7 TUI tests pasan.

---

### 9. `@modelcontextprotocol/sdk@1.29.0`
**Archivo**: `patches/@modelcontextprotocol%2Fsdk@1.29.0.patch` (grande, 427 líneas)
**Cambios principales**:
1. Añade `transport.onsessionexpired` handler que llama `_initialize` auto-reconnect
2. Refactor: extrae lógica de `initialize` a método `_initialize(transport, options)`
3. Añade overloads TypeScript para `callTool(params, resultSchema?, options?)` con generics
**Razón**: 
- (1) y (2): Soporte para session reconnection automática en transports HTTP (streamable HTTP)
- (3): Type safety para `callTool` con schema de resultado custom
**Upstream**: v1.30.0 en beta. **Revisar changelog v1.30** — probablemente incluido.
**Acción**: Al salir v1.30 estable, test y remover patch si upstream.

---

### 10. `effect@4.0.0-beta.83`
**Archivo**: `patches/effect@4.0.0-beta.83.patch`
**Cambio**: En `HttpApiSchema.js`, reemplaza `Schema.fromJsonString(options.data)` por `sseDataJsonSchema(options.data)` — función helper que verifica si el schema tiene identifier y, de ser así, agrega `identifier: "${identifier}Stream"` al schema wrapper SSE.
**Razón**: Sin el patch, SSE streaming response schemas colisionan en OpenAPI — el schema wrapper `fromJsonString` hereda el identifier del schema interno, causando duplicados. Ej: `ChatCompletion` aparece dos veces (una como response directa, otra como SSE stream wrapper).
**Upstream**: Fix específico vMK. Effect team podría tener approach diferente.
**Acción**: Mantener. Re-evaluar al actualizar Effect (próximo beta).

---

## Convención de Nombrado Patches

`patches/<scope>%2F<name>@<version>.patch`

Ejemplo: `@ai-sdk%2Fxai@3.0.82.patch` → scope=`@ai-sdk`, name=`xai`, version=`3.0.82`

**Regla**: Siempre incluir versión en filename para tracking.

---

## Plan de Acción Priorizado

### ✅ Completado (2026-07-03)
- [x] Verificar `virtua` patch: ya en 0.49.2, doc actualizado
- [x] Verificar `pacote@22.0.0`: fix nativo confirmado, bloqueado por arborist v9
- [x] Verificar `@npmcli/agent@5.0.2`: fix NO está en v5, upgrade sin beneficio
- [x] Verificar `@ai-sdk/xai@4.0.6`: PDF support nativo, API reescrita → **MIGRADO**
- [x] Verificar `@ai-sdk/google@4.0.8`: API reescrita, requiere migración → **MIGRADO**
- [x] Documentar `effect@4.0.0-beta.83` patch (SSE identifier collision fix)
- [x] **AI SDK v4 upgrade**: @ai-sdk/xai 3.0.82 → 4.0.6, @ai-sdk/google 3.0.73 → 4.0.8
- [x] **API fix**: `responses()` → `languageModel()` en xai.ts + openai.ts
- [x] **Parches removidos**: 2 patches eliminados, typecheck + build + 7/7 TUI tests OK

### ⚠️ Orphan: `effect@4.0.0-beta.83.patch`
El archivo `patches/effect@4.0.0-beta.83.patch` existe en disco pero NO está referenciado en `package.json` → `patchedDependencies`. Bun 1.3.14 no lo aplica automáticamente. Posibles causas:
- La instalación de effect via `catalog:` puede manejar patches diferente
- Podría estar aplicado via `bun.lock` directamente
- O es un remanente de una versión anterior

**Acción**: Verificar si el fix de SSE identifier collision sigue siendo necesario en effect@4.0.0-beta.83. Si sí, referenciarlo en `patchedDependencies`. Si no, eliminar el archivo.

### Corto plazo
- [x] Añadir CI check: `scripts/vmk-patch-check.ps1` — verifica parches + `bun install --dry-run`

### Mediano plazo
- [ ] Monitorear `@npmcli/arborist` v10.x stable (desbloquearía pacote@22)
- [ ] Monitorear `@modelcontextprotocol/sdk` v1.30 release
- [ ] Evaluar forks internos para xai/google si no upstreaman features