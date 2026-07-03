# MCP Token Budget — opencode vMK

> Guía operativa para configurar y auditar límites de tokens en MCP servers.
> Referenciado desde `AGENTS.md` (sección MCP Token Budget Rules).

---

## Configuración Global

Los MCP servers tienen límites de truncamiento en dos niveles:

| Nivel | Configuración | Default | Descripción |
|-------|---------------|---------|-------------|
| **Global** | `tool_output` truncate | 500 líneas / 10 KB | Aplicado a TODOS los servers MCP |
| **Por Server** | `truncateLimit` (bytes) | Sin límite (hereda global) | Configurable en `mcpServers.<name>.truncateLimit` |

---

## truncateLimit Recomendados por Server

| Server | truncateLimit (bytes) | Rationale |
|--------|----------------------|-----------|
| `context7` | 8192 (8 KB) | Docs son verbosos; 8 KB permite ~2-3 code snippets completos |
| `engram` | 4096 (4 KB) | Memoria es densa; 4 KB ≈ 50-80 observaciones compactas |
| `codebase-memory` | 16384 (16 KB) | Graph queries pueden ser grandes; 16 KB para resultados completos |
| `github` | 8192 (8 KB) | PR/Issue data es estructurada; 8 KB suficiente para metadata |
| Default (otros) | 5120 (5 KB) | Balance conservador |

**Cómo configurar** (en `.vmk-config/mcp.json` o `opencode.jsonc`):

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@context7/mcp-server"],
      "truncateLimit": 8192
    },
    "engram": {
      "command": "npx",
      "args": ["-y", "@engram/mcp-server"],
      "truncateLimit": 4096
    }
  }
}
```

---

## Límites Conservadores en Parámetros de Herramientas

Al invocar herramientas MCP, **siempre usa límites conservadores** para evitar truncamiento innecesario:

| Herramienta | Parámetro | Valor Recomendado | Default (NO usar) |
|-------------|-----------|-------------------|-------------------|
| `search_graph` | `limit` | 20-30 | 200 |
| `search_code` | `limit` | 5 | 10 |
| `search_code` | `mode` | `"compact"` | `"full"` |
| `query_graph` | `max_rows` | **SIEMPRE** 50 | (requerido) |
| `trace_path` | `depth` | 2 | 3 |
| `get_code_snippet` | — | Preferir sobre `search_code` full | — |

### Ejemplos de Uso Correcto

```typescript
// ✅ BIEN - search_graph con límite conservador
await mcp.search_graph({ query: "config loading", limit: 25, label: "Function" })

// ✅ BIEN - search_code en modo compact
await mcp.search_code({ pattern: "loadInstanceState", limit: 5, mode: "compact" })

// ✅ BIEN - query_graph SIEMPRE con max_rows
await mcp.query_graph({ query: "MATCH (f:Function) WHERE f.name CONTAINS 'load' RETURN f LIMIT 50", max_rows: 50 })

// ❌ MAL - sin límite (truncará a 500 líneas)
await mcp.query_graph({ query: "MATCH (n) RETURN n" })

// ❌ MAL - search_graph con default 200
await mcp.search_graph({ query: "config" })
```

---

## Estrategias de Paginación

Cuando `has_more: true` o `total > offset + returned`:

```typescript
// Page con offset
let offset = 0
const limit = 30
const allResults = []

do {
  const result = await mcp.search_graph({ query: "...", limit, offset })
  allResults.push(...result.results)
  offset += limit
} while (result.has_more)
```

---

## Telemetría y Auditoría

### Script: `vmk-token-audit.ps1`

Analiza logs MCP y reporta:
- Truncamientos por server
- Bytes truncados totales
- Top queries que causan truncamiento
- Recomendaciones de `truncateLimit`

```powershell
.\scripts\vmk-token-audit.ps1 [-LogPath "path\to\logs"] [-Since "2026-07-01"]
```

### Métricas Clave a Seguir

| Métrica | Target | Acción si excede |
|---------|--------|------------------|
| Truncamientos/sesión | < 5 | Revisar `truncateLimit` o queries |
| Bytes truncados/sesión | < 50 KB | Aumentar límites o optimizar queries |
| % queries con `has_more` | < 20% | Añadir paginación o filtros |

---

## Checklist Pre-Commit (MCP)

- [ ] ¿Usé `limit` conservador en `search_graph`/`search_code`?
- [ ] ¿`query_graph` tiene `max_rows` explícito?
- [ ] ¿Preferí `get_code_snippet` sobre `search_code` full?
- [ ] ¿Verifiqué `has_more`/`total` en resultados?
- [ ] ¿El server tiene `truncateLimit` configurado en config?

---

## Referencias

- `AGENTS.md` → sección **MCP Token Budget Rules**
- `vmk-bench.ps1` — incluye métricas de cold boot (no MCP)
- `scripts/vmk-token-audit.ps1` — (pendiente de crear)