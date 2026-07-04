# Auditoría de Dependencias

> Read-only audit. Fecha: 2026-07-03

## Resumen

**Total: 8+ | 🔴 Críticos: 2 | 🟠 Altos: 1 | 🟡 Medios: 3 | 🟢 Bajos: 2+**

---

## 🔴 Crítico

### DEP-01: `effect@4.0.0-beta.83.patch` existe en disco pero NO está registrado en `patchedDependencies`

**Archivo**: `patches/effect@4.0.0-beta.83.patch`
**Problema**: El archivo existe en disco pero NO aparece en `patchedDependencies` del `package.json` raíz.

```json
"patchedDependencies": {
    "@npmcli/agent@4.0.2": "...",
    "@silvia-odwyer/photon-node@0.3.4": "...",
    "@standard-community/standard-openapi@0.2.9": "...",
    "virtua@0.49.2": "...",
    "gcp-metadata@8.1.2": "...",
    "pacote@21.5.0": "...",
    "@modelcontextprotocol/sdk@1.29.0": "..."
}
```

**Impacto**: `bun install` NO aplica este parche. El fix de `HttpApiSchema.StreamSse` (identificador único SSE para evitar colisiones OpenAPI) NO se está aplicando. Cualquier endpoint SSE puede tener schemas OpenAPI incorrectos.

### DEP-02: 47 dependencias NPM duplicadas entre `core` y `opencode`

Ambos `packages/core/package.json` y `packages/opencode/package.json` declaran las mismas dependencias: `@ai-sdk/*` (18 providers), `@opentelemetry/*` (4), `@effect/*`, `drizzle-orm`, `effect`, `zod`, etc.

**Impacto**: Riesgo de version drift. `@ai-sdk/cerebras` tiene version diferente entre paquetes (core: `2.0.41`, opencode: `2.0.60`).

---

## 🟠 Alto

### DEP-03: Parches con versiones no actualizadas (potencialmente obsoletos)

| Patch | Version actual | Version en patch | Diferencia |
|---|---|---|---|
| `gcp-metadata` | `8.1.2` | misma | OK |
| `pacote` | `21.5.0` | misma | OK per el fix sigue en v22 no disponible |
| `@modelcontextprotocol/sdk` | `1.29.0` | misma | Fix no mergeado upstream |
| `@npmcli/agent` | `4.0.2` | misma | Fix no liberado en v5 |

---

## 🟡 Medio

### DEP-04: `cross-spawn` no usa catalog:
En `packages/opencode/package.json`: `"cross-spawn": "^7.0.6"` — debería usar `"catalog:"`.

### DEP-05: node_modules grande (~1GB+) por duplicación de AI SDK providers
18 providers de AI SDK se declaran tanto en core como en opencode. Aunque bun hoist comparte, las declaraciones duplicadas confunden a herramientas como `knip`.

### DEP-06: Sin `knip` ni herramienta de detección de dependencias no usadas
No se encontró configuración de `knip` ni `depcheck`. No se puede verificar automáticamente qué dependencias sobran.

---

## 🟢 Bajo

### DEP-07: Bundle de 126MB
El binario compilado (`opencode-vMK.exe`) pesa 126.89 MB. Buena parte proviene de los 18 providers AI SDK + tree-sitter WASM + SQLite drivers.

### DEP-08: Sin lockfile compartido
No se encontró `bun.lock` en el repo (en `.gitignore`). Esto significa que cada `bun install` puede resolver versiones ligeramente distintas.

---

## Recomendaciones

1. **Resolver efecto orfan**: Verificar si el parche SSE sigue siendo necesario. Si sí, agregar a `patchedDependencies`. Si no, borrar el archivo.
2. **Unificar dependencias duplicadas**: Elegir un solo lugar para las dependencias compartidas (ej. solo en `packages/core/`) y referenciarlas desde `opencode/` o usar `catalog:` sistemáticamente.
3. **Agregar `knip`** para detectar dependencias no usadas.
4. **Revisar versiones de AI SDK providers** para asegurar consistencia entre paquetes.
