# Rationale de Patches — opencode vMK

> Documenta por qué cada patch en `patchedDependencies` es necesario y si hay alternativas upstream.

---

## Resumen

| Paquete | Versión | Upstream Status | Criticalidad |
|---------|---------|-----------------|--------------|
| `@npmcli/agent` | 4.0.2 | No (fix trivial, v5.0.2 disponible) | Baja |
| `@silvia-odwyer/photon-node` | 0.3.4 | No (fix específico vMK binary) | **Alta** |
| `@standard-community/standard-openapi` | 0.2.9 | No (edge case $ref externo) | Media |
| `virtua` | 0.49.1 | Desconocido (0.49.2 disponible) | Media |
| `@ai-sdk/xai` | 3.0.82 | Posible en 4.x (feature PDF) | **Alta** (blocking major upgrade) |
| `gcp-metadata` | 8.1.2 | No (suppress warning legítimo) | Baja |
| `pacote` | 21.5.0 | Desconocido (22.x disponible) | Media |
| `@ai-sdk/google` | 3.0.73 | Posible en 4.x (fix empty contents) | **Alta** (blocking major upgrade) |
| `@modelcontextprotocol/sdk` | 1.29.0 | Parcial en 1.30-beta | Media |

---

## Detalle por Patch

### 1. `@npmcli/agent@4.0.2`
**Archivo**: `patches/@npmcli%2Fagent@4.0.2.patch`
**Cambio**: `this.#proxy ? { url: this.#proxy }` → `this.#proxy ? { url: this.#proxy.toString() }`
**Razón**: `this.#proxy` es un objeto `URL`, no string. Sin `.toString()` falla serialización.
**Upstream**: Fix trivial (1 línea). v5.0.2 disponible. **Probar si aplica a v5**.
**Acción**: Test patch en v5.0.2; si aplica, actualizar dependencia y remover patch.

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

### 4. `virtua@0.49.1`
**Archivo**: `patches/virtua@0.49.1.patch`
**Cambio**: (Revisar patch completo — 3.7KB)
**Razón**: Fix para virtual scrolling en TUI.
**Upstream**: v0.49.2 disponible (patch version). **Test si patch aplica limpio**.
**Acción**: Intentar actualizar a 0.49.2 y verificar si patch sigue necesario.

---

### 5. `@ai-sdk/xai@3.0.82` ⭐ **BLOQUEA MAJOR UPGRADE**
**Archivo**: `patches/@ai-sdk%2Fxai@3.0.82.patch`
**Cambio**: Añade soporte para `application/pdf` en `convertToXaiResponsesInput` — maneja `input_file` con `file_url`, `file_id`, `file_data`, `filename`.
**Razón**: xAI Responses API soporta PDFs. Sin patch, lanza `UnsupportedFunctionalityError`.
**Upstream**: v4.0.8 disponible (major). **Verificar si PDF support ya incluido en v4**.
**Acción**: 
1. Revisar changelog @ai-sdk/xai v4.x para feature PDF
2. Si sí → remover patch y actualizar a 4.x
3. Si no → decidir: mantener 3.x + patch, o forkar @ai-sdk/xai

---

### 6. `gcp-metadata@8.1.2`
**Archivo**: `patches/gcp-metadata@8.1.2.patch`
**Cambio**: En `isAvailable()`, detectar `AggregateError` de `Promise.any()` y retornar `false` silenciosamente (no warning).
**Razón**: Fuera de GCP, ambos metadata hosts fallan → `Promise.any` rechaza con `AggregateError`. Esto es **comportamiento esperado**, no error. Sin patch, loggea warning molesto.
**Upstream**: Comportamiento legítimo. Podría reportarse como feature request (option para suprimir).
**Acción**: Mantener patch. Baja prioridad para upstream.

---

### 7. `pacote@21.5.0`
**Archivo**: `patches/pacote@21.5.0.patch`
**Cambio**: Mejora fallback de tarball a git clone:
- Antes: solo si error constructor name matchea `/^Http/`
- Después: si `statusCode >= 400` O error code matchea `/^TAR_/`
**Razón**: Maneja caso donde proveedor hosted devuelve HTML sign-in page con HTTP 200 (no error HTTP, pero tarball inválido).
**Upstream**: v22.0.0 disponible. **Test si patch aplica o ya está fixed**.
**Acción**: Test en v22.x; actualizar si posible.

---

### 8. `@ai-sdk/google@3.0.73` ⭐ **BLOQUEA MAJOR UPGRADE**
**Archivo**: `patches/@ai-sdk%2Fgoogle@3.0.73.patch`
**Cambio**: En `convertToGoogleGenerativeAIMessages`, si último `contents` tiene `parts.length === 0`, hacer `pop()`.
**Razón**: Gemini rechaza model entries con `parts` vacío. El filter previo elimina partes vacías pero deja array vacío.
**Upstream**: v4.0.8 disponible. **Verificar si fixed en v4**.
**Acción**: 
1. Revisar changelog @ai-sdk/google v4.x
2. Si fixed → remover patch y actualizar
3. Si no → mismo dilema que xai

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

## Plan de Acción Priorizado

### Inmediato (Esta semana)
- [ ] Test `@npmcli/agent` patch en v5.0.2
- [ ] Test `virtua` patch en v0.49.2
- [ ] Test `pacote` patch en v22.x

### Corto plazo (Próximo ciclo)
- [ ] Verificar `@ai-sdk/xai` v4.x PDF support
- [ ] Verificar `@ai-sdk/google` v4.x empty parts fix
- [ ] Crear `docs/operations/patches-rationale.md` (este archivo)
- [ ] Añadir CI check: `bun install --dry-run` + verify patches apply

### Mediano plazo
- [ ] Monitorear `@modelcontextprotocol/sdk` v1.30 release
- [ ] Evaluar forks internos para xai/google si no upstreaman features

---

## Convención de Nombrado Patches

`patches/<scope>%2F<name>@<version>.patch`

Ejemplo: `@ai-sdk%2Fxai@3.0.82.patch` → scope=`@ai-sdk`, name=`xai`, version=`3.0.82`

**Regla**: Siempre incluir versión en filename para tracking.