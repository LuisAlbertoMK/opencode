# OpenCode Agent Guide

> Entry point for project-level agent rules. Sections are modularized for
> maintainability — see each file below for full details.

<!-- vMK: anchored-summary -->
## Anchored Summary — opencode-vMK

> **Última actualización**: 2026-07-03 | **Cycle**: 11 | **Estado**: Fase 2.2 completada (core export map)

### Goal
Ejecutar Fase 2.2 del plan de implementación: reemplazar `./*` wildcard con exports explícitos en `@opencode-ai/core`.

### Next up
Fase 2.3 — Consolidar tool pairs (grep, question).

### Key Accomplishments
- ✅ **Fase 0 Quick Wins** — Parche effect resuelto, build fix, PARALLEL_API_KEY+CLOUDFLARE a SHELL_ENV_DENY, logging a catch vacíos
- ✅ **Fase 1 Seguridad** — OPENCODE_AUTH_CONTENT eliminado de env vars (#1 riesgo 🔴), 16 patrones peligrosos bloqueados en bash.ts (deny-list Fase 1.3)
- ✅ **Fase 4.1: Linter configurado** — oxlint activado con categorías `correctness`, `suspicious`, `pedantic` + reglas custom (7655 warnings, 0 errors)
- ✅ **Fase 4.2: `any` elimination** — ~50 instancias de `Record<string, any>` → `Record<string, unknown>` (43 directas + 24 nested), 4 callback params, 3 type annotations fijados. `sdk: any` postergado (requiere refactor mayor). `as any` casts (14) documentados como legítimos (system boundaries)
- ✅ **Fase 4.3: `@ts-expect-error`** — 2 fijados (llm.ts, session.ts), 9 legítimos/legacy mantenidos
- ✅ **Fase 4.4: CI gate** — `bun run lint` agregado como Fase 5 en `.husky/pre-push`
- ✅ **Fase 1.1: OPENCODE_AUTH_CONTENT eliminado** — workspace.ts ya no expone API keys a subprocesos
- ✅ **Fase 1.3: Shell deny-list** — `isDangerous()` con 16 patrones en bash.ts
- ✅ **Fase 2 PoC: Shared utility extracted** — `packages/core/src/tool/shared/glob-utils.ts` (resolveGlobDirectory + formatGlobOutput)
- ✅ **Fase 2.2: Core export map** — Reemplazado `"./*": "./src/*.ts"` con 28 wildcards por subdirectorio + 49 entradas explícitas para archivos toplevel. Build y lint OK. Typecheck pre-existentes sin cambios.
- ✅ **Audit docs consolidated** — `docs/00-resumen/auditoria-completa.md` con todos los hallazgos (~194 items)
- ✅ **Plan de Fase 2** — `docs/10-plan/fase2-consolidacion-tools.md` con 11 tool pairs priorizados

### Estado actual
| Fase | Estado | Notas |
|------|--------|-------|
| Fase 0 | ✅ Completa | Quick Wins + parche effect |
| Fase 1 | 🟡 Parcial | 1.1 ✅ 1.2 🔲 1.3 ✅ 1.4 🔲 1.5 WNF |
| Fase 2 | 🟡 En progreso | PoC shared utility ✅ — export map ✅ — consolidation 🔲 |
| Fase 3 | 🔲 Pendiente | Migración V2 |
| Fase 4 | ✅ Completa | Linter + any |
| Fase 5 | 🔲 Pendiente | Virtual scrolling |
| Fase 6 | 🔲 Pendiente | UI/UX |
| Fase 7 | 🔲 Pendiente | Upstream sync |
| Fase 8 | 🔲 Pendiente | Dependencias |

### Next Steps
- 🔲 **Fase 1.2**: Migrar cifrado auth.json a OS keychain (5-7 días)
- 🔲 **Fase 1.4**: Tree-sitter AST shell parsing (3-5 días)
- 🔲 **Fase 2.3**: Consolidar tool pairs (grep, question) — 2-4h c/u
- 🔲 **Fase 5**: Virtual scrolling en TUI (3-5 días)

### Documentación de auditoría (docs/)
| Archivo | Contenido |
|---------|-----------|
| `00-resumen/auditoria-completa.md` | ✅ Consolidación maestra (~194 hallazgos, 8 dimensiones) |
| `00-resumen-ejecutivo.md` | Resumen ejecutivo con matriz de severidad |
| `01-gaps/funcional.md` | Gaps funcionales (40 hallazgos) |
| `02-seguridad/` | Seguridad (3 reportes: auth, secretos, inyección) |
| `03-optimizacion/` | Arquitectura + dependencias |
| `04-ui-ux/` | UI/UX (consistencia visual + flujos) |
| `05-rendimiento/` | Performance backend |
| `08-revision-lineal/` | Código muerto + linting |
| `09-otros/` | Recomendaciones extra |
| `10-plan-implementacion.md` | Plan general (8 fases, 60-95 días-hombre) |
| `10-plan/index.md` | Índice del plan |
| `10-plan/fase2-consolidacion-tools.md` | Plan detallado Fase 2 |
| `ciclos/cycle11-20260703.md` | Reporte de este ciclo |

---

## Project Quick Reference

- To regenerate the JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- The default branch in this repo is `dev`.
- Local `main` ref may not exist; use `dev` or `origin/dev` for diffs.

## Branch Names

Use a short branch name of at most three words, separated by hyphens. Do not use slashes or type prefixes such as `feat/` or `fix/`.

Examples: `session-recovery`, `fix-scroll-state`, `regenerate-sdk`.

## Commits and PR Titles

Use conventional commit-style messages and PR titles: `type(scope): summary`.

Valid types are `feat`, `fix`, `docs`, `chore`, `refactor`, and `test`. Scopes are optional; use the affected package or area when helpful, e.g. `core`, `opencode`, `tui`, `app`, `desktop`, `sdk`, or `plugin`.

Examples: `fix(tui): simplify thinking toggle styling`, `docs: update contributing guide`, `chore(sdk): regenerate types`.

## vMK Containment Protocol

> **REGLA CRÍTICA**: Las modificaciones en D:\opencode NUNCA deben afectar
> la instalación global de opencode (npm global). El comportamiento
> específico de vMK se controla via env vars en vmk.cmd, NO via
> modificaciones al source compartido.

### Zonas de Archivos

| Zona | Archivos | Acción |
|------|----------|--------|
| 🟢 VERDE | `vmk.cmd`, `scripts/vmk-*`, `docs/vmk-*` | Modificar libremente |
| 🟡 AMARILLO | `packages/*/src/**`, `build.ts` | **Inline `// vMK:`** en TODA línea/bloque modificado + **Header `// vMK:`** (opcional, en cambios arquitectónicamente significativos) |
| 🔴 ROJO | `C:\...\npm\node_modules\opencode-ai\**`, `~/.opencode/bin/opencode.exe` | **NUNCA TOCAR** |

### Verificación Obligatoria

**Antes de CUALQUIER modificación:**
1. ¿El archivo está en ZONA VERDE? → Proceder libremente
2. ¿El archivo está en ZONA AMARILLO? → Documentar intención vMK (ver reglas arriba)
3. ¿El archivo está en ZONA ROJA? → STOP. No modificar.

**Post-build:**
- El binario DEBE llamarse `opencode-vMK.exe`, NUNCA `opencode.exe`
- Verificar con: `.\scripts\vmk-safety-check.ps1 -CheckBuild`

### Comandos Prohibidos

- ❌ `npm install -g opencode-ai` desde este repo
- ❌ `npm link` / `bun link` desde `packages/opencode/`
- ❌ `npm publish` desde este repo
- ❌ Ejecutar `opencode` directamente (sin vmk.cmd)

### Invocación Segura

```powershell
# SIEMPRE usar vmk.cmd o el alias vmk
.\vmk.cmd                    # Opción 1: batch file
vmk                          # Opción 2: PowerShell alias (requiere . .\scripts\vmk-alias.ps1)
```

### Scripts de Verificación

```powershell
.\scripts\vmk-safety-check.ps1                    # Verificación completa
.\scripts\vmk-safety-check.ps1 -TargetFile "path" # Verificar archivo
.\scripts\vmk-safety-check.ps1 -CheckBuild        # Verificar build
.\scripts\vmk-safety-check.ps1 -CheckGlobal       # Verificar entorno
```

Ver también: `docs/vmk-containment-brainstorm.md` para el análisis completo.

---

## MCP Token Budget Rules

Los MCP servers tienen un límite de truncamiento global (`tool_output`) de 500 líneas / 10 KB,
y cada server puede tener su propio `truncateLimit` por server (en bytes).

Al usar herramientas MCP:

1. **Siempre usa límites conservadores** en los parámetros de la herramienta:
   - `search_graph` → `limit: 20-30` (NO el default 200)
   - `search_code` → `limit: 5`, prefiere `mode: "compact"`
   - `query_graph` → **SIEMPRE** incluye `max_rows` (ej. 50). NUNCA sin límite.
   - `trace_path` → `depth: 2` si es posible
2. **Prefiere `get_code_snippet` sobre `search_code` en modo `full`** cuando solo necesitas ver una función específica.
3. **Usa `query_graph` solo para consultas específicas**, nunca queries abiertas como `MATCH (n) RETURN n`.
4. **Verifica `has_more`/`total`** en resultados de `search_graph`/`search_code` — si hay más datos, página con `offset` en vez de pedir todo de golpe.

El sistema truncará automáticamente salidas que excedan los límites, pero cada truncamiento es un viaje de ida y vuelta desperdiciado.

---

## Modules

| Topic | File | Description |
|-------|------|-------------|
| Style Guide | [`.opencode/style-guide.md`](.opencode/style-guide.md) | TS code style: imports, destructuring, control flow, Effect patterns, Drizzle schemas, **TUI text wrapping rules** |
| Testing | [`.opencode/testing.md`](.opencode/testing.md) | Test philosophy, mock avoidance, type checking |
| V2 Session Core | [`specs/v2/session.md`](specs/v2/session.md) | Session V2 architecture: prompt admission, execution, delivery, system context |
| Skills Index | [`SKILLS-INDEX.md`](SKILLS-INDEX.md) | Agent skills catalog: installed + roadmap |
| Improvement Cycle | [`CYCLE.md`](CYCLE.md) | Current improvement cycle, metrics, tasks |
