# Fase 2: Consolidación Tools V1/V2

**Fecha**: 2026-07-03
**Basado en**: Auditoría multi-agente + exploración de código

## Resumen

Hay **11 pares de tools** con implementación paralela V1 (core) y V2 (opencode).
V2 es la ruta de producción. V1 existe para el session runner de core.

## Estrategia

### Fase 2.1 — Shared utilities (1-2 días)
Extraer lógica común de resolución de path/directorio/output a un módulo
`core/src/tool/shared/` que ambas implementaciones puedan consumir.

| Utilidad | Archivos afectados | Esfuerzo |
|----------|-------------------|----------|
| `resolveDirectory(ctx, path)` — resolver cwd desde Location/InstanceState | glob, read, write, edit, grep, bash | 2-4h |
| `formatOutput(results, limit, opts)` — formato común para salida de tools | glob, grep, read, websearch | 2-4h |
| `createToolContext(permission, abort, metadata)` — factory de context | todas | 4-6h |

### Fase 2.2 — Core export map (1-2 días)
Reemplazar glob `./*` en `core/package.json` con exports explícitos. Esto
rompe acoplamientos ocultos y revela qué consume core realmente.

### Fase 2.3 — Tool pair consolidation (por tool, 2-4h c/u)
Para cada tool pair (empezando por las más simples):

1. Verificar que V2 es un superset funcional de V1
2. Extraer shared utilities de la tool
3. Hacer V1 delegar a utilities compartidas (o deprecar si core no necesita la tool)
4. Eliminar código duplicado

### Prioridad

| Orden | Tool | V1 líneas | V2 líneas | Complejidad | Notas |
|-------|------|-----------|-----------|-------------|-------|
| 1 | glob | 76 | 76 | 🟢 Baja | PoC — ambas usan ripgrep.glob() |
| 2 | grep | 112 | 130 | 🟢 Baja | Similar a glob |
| 3 | question | 44 | 86 | 🟢 Baja | Simple input/output |
| 4 | webfetch | 192 | 217 | 🟡 Media | Fetch + parse |
| 5 | skill | 71 | 105 | 🟡 Media | Discovery + execute |
| 6 | read | 105 | 387 | 🟡 Media | File reading + preview |
| 7 | websearch | 143 | 240 | 🟠 Alta | MCP bridge |
| 8 | write | 104 | 93 | 🟠 Alta | File writing + format |
| 9 | apply-patch | 177 | 313 | 🟠 Alta | Patch parsing + apply |
| 10 | edit | 199 | 760 | 🔴 Alta | Complex diff+format+LSP |
| 11 | bash | 242 | 683 | 🔴 Alta | Shell execution + security |

## PoC: glob

### Estado actual
| Aspecto | V1 | V2 |
|---------|----|----|
| CWD | `location.directory` | `InstanceState.context.directory` |
| Permisos | `PermissionV2.assert()` | `ctx.ask()` |
| Output | `Schema.Array(FileSystem.Entry)` + `toModelOutput` | `{ title, output: string, metadata }` |
| Límite | Parametrizable (`input.limit`) | Hardcoded (`100`) |
| Directorios externos | No verifica | `assertExternalDirectoryEffect()` |
| Truncation display | No | Mensaje informativo |

### Shared logic (ya compartida vía ripgrep.glob())
```typescript
// Ambos llaman:
yield* ripgrep.glob({ cwd, pattern, limit })
```

### Plan de consolidación
1. Extraer `resolveGlobDirectory(ctx, input)` → utility compartida
2. Mantener V2 como canon (tiene más features: truncation display, external dir check, metadata streaming)
3. V1 se mantiene como está (es usado por core, no por opencode)
4. La ganancia real de Fase 2 no es eliminar V1 sino extraer shared utilities

## Timeline estimado

| Actividad | Esfuerzo |
|-----------|----------|
| Shared utilities de path/dir resolution | 2-4h |
| PoC glob shared utility + verificación | 2-4h |
| grep + question consolidation | 4-6h |
| read + write + skill consolidation | 1-2 días |
| webfetch + websearch consolidation | 1-2 días |
| apply-patch + edit + bash consolidation | 2-3 días |
| Core export map | 1-2 días |
| **Total** | **~8-12 días** |
