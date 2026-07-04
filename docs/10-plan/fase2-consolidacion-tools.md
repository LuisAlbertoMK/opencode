# Fase 2 — Consolidación Tools V1/V2

**Fecha**: 2026-07-03
**Basado en**: Auditoría multi-agente + exploración de código

---

## Contexto

Hay **11 pares de tools** con implementación paralela:

| Tool | V1 (core/src/tool/) | V2 (opencode/src/tool/) |
|------|---------------------|-------------------------|
| bash/shell | bash.ts (242) | shell.ts (683) |
| read | read.ts (105) | read.ts (387) |
| write | write.ts (104) | write.ts (93) |
| edit | edit.ts (199) | edit.ts (760) |
| glob | glob.ts (76) | glob.ts (76) |
| grep | grep.ts (112) | grep.ts (130) |
| skill | skill.ts (71) | skill.ts (105) |
| question | question.ts (44) | question.ts (86) |
| websearch | websearch.ts (143) | websearch.ts (240) |
| webfetch | webfetch.ts (192) | webfetch.ts (217) |
| apply-patch | apply-patch.ts (177) | apply_patch.ts (313) |

### Hallazgo clave

**No hay duplicación de lógica core.** Ambos V1 y V2 usan los mismos servicios
compartidos de `@opencode-ai/core` (ripgrep, FSUtil, FileSystem). La duplicación
está en el wrapping: contexto, permisos, formato de output.

**V2 es la ruta de producción.** El app opencode usa V2 exclusivamente. V1
existe para el session runner de `packages/core` (server/embedded).

### Estrategia de consolidación

No se trata de eliminar V1 (rompería core) sino de:

1. **Extraer shared utilities** de resolución de path/output
2. **Mantener V2 como canon** (más features: truncation, metadata streaming,
   external dir checks, imperative permissions)
3. **Documentar la separación** explícitamente

---

## Plan detallado

### Fase 2.1 — Shared utilities (1-2 días)

| Utilidad | Descripción | Archivos afectados | Esfuerzo |
|----------|-------------|-------------------|----------|
| `resolveDirectory()` | Resolver cwd desde Location/InstanceState | glob, read, grep, bash | 2-4h |
| `formatToolOutput()` | Formato común para salida de tools | glob, grep, read, websearch | 2-4h |
| `createToolMetadata()` | Metadata stream para V2 tools | edit, write, shell | 2-4h |

### Fase 2.2 — Core export map (1-2 días)

Reemplazar `"./*"` en `packages/core/package.json` con exports explícitos.

Estado actual (`package.json:exports`):
```json
"./*": "./src/*"
```

Esto permite imports como `@opencode-ai/core/fs-util` sin barril explícito.
El reemplazo requiere:
1. Crear `packages/core/src/index.ts` con exports barrel
2. Agregar entries explícitas por cada módulo público
3. Verificar que ningún consumidor se rompe

### Fase 2.3 — Tool pair consolidation (por tool, 2-4h c/u)

Orden de prioridad (de más simple a más compleja):

| Orden | Tool | V1 líneas | V2 líneas | Riesgo | Estrategia |
|-------|------|-----------|-----------|--------|------------|
| 1 | glob | 76 | 76 | 🟢 Bajo | Extraer resolveDirectory, mantener V1/V2 |
| 2 | grep | 112 | 130 | 🟢 Bajo | Similar a glob |
| 3 | question | 44 | 86 | 🟢 Bajo | Input/output simple |
| 4 | webfetch | 192 | 217 | 🟡 Medio | Fetch + parse, extraer URL validation |
| 5 | skill | 71 | 105 | 🟡 Medio | Discovery + execute |
| 6 | read | 105 | 387 | 🟡 Medio | File reading, preview |
| 7 | websearch | 143 | 240 | 🟠 Medio-Alto | MCP bridge complex |
| 8 | write | 104 | 93 | 🟠 Medio-Alto | File writing + format |
| 9 | apply-patch | 177 | 313 | 🟠 Medio-Alto | Patch parsing |
| 10 | edit | 199 | 760 | 🔴 Alto | Complex diff+format+LSP |
| 11 | bash/shell | 242 | 683 | 🔴 Alto | Shell execution + security |

---

## PoC: glob

El par más simple. Ambos usan `ripgrep.glob()` como core shared.

### Shared utility: `resolveGlobDirectory()`

```typescript
// shared/glob-utils.ts
export function resolveGlobDirectory(
  basedir: string,
  inputPath?: string
): string {
  const search = inputPath ?? basedir
  return path.isAbsolute(search) ? search : path.resolve(basedir, search)
}
```

### Diferencia V1 vs V2

| Aspecto | V1 | V2 |
|---------|----|----|
| CWD | `location.directory` | `InstanceState.context.directory` |
| Permisos | `PermissionV2.assert()` | `ctx.ask()` |
| Output | Schema tipado + toModelOutput | string + metadata |
| Límite | Parametrizable | Hardcoded 100 |
| Dir externo | No verifica | assertExternalDirectoryEffect() |
| Truncation | No | Mensaje informativo |

### Conclusión

V2 ya es superset funcional de V1 para glob. No hay necesidad de fusionar
implementaciones — la lógica core (ripgrep.glob()) ya está compartida.
