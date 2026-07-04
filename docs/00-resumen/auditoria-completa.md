# Auditoría Multi-Agente 2026 — opencode-vMK

**Fecha**: 2026-07-03
**Tipo**: Auditoría integral multi-agente
**Subagentes**: 6 | **Reportes**: 12 | **Hallazgos**: ~194
**Estado**: ✅ Auditoría completa | 🔄 Fase 0-4 ejecutadas | 🔲 Fase 5-8 pendientes

---

## 1. Resumen por Dimensión

| Dimensión | Severidad | Salud | Hallazgos |
|-----------|-----------|-------|-----------|
| Seguridad | 🔴 7 críticos | 20-40% | Fuga de credenciales, cifrado débil, injection |
| Arquitectura | 🔴 Tools duplicadas | 10-20% | V1/V2 paralelas, sin export map |
| Mantenibilidad | 🔴 Sin linter | 10-20% | 0 linter, 192 any, 13 @ts-expect-error |
| Upstream sync | 🟠 585 commits behind | 5-10% | Riesgo de divergencia irreversible |
| Rendimiento | 🟠 Sin pool, existsSync | 30-40% | I/O bloqueante, sin concurrencia |
| UI/UX | 🟠 Sin virtual scroll | 40-50% | Onboarding, scroll, placeholders |
| Funcional | 🟠 Dual-write V2 | 40-50% | 17+ puntos de migración inconclusa |
| Dependencias | 🟠 47 duplicadas | 50-60% | Parche effect, versiones dispares |

---

## 2. Hallazgos Críticos (🔴) — Todos

| # | Área | Archivo:Línea | Descripción | Estado |
|---|------|---------------|-------------|--------|
| 1 | Seguridad | `workspace.ts:546` | **OPENCODE_AUTH_CONTENT expone TODAS las API keys como env var a subprocesos**. Cualquier plugin/script puede leer todas las credenciales. | ✅ **RESUELTO** (Fase 1.1) |
| 2 | Arquitectura | `core/src/tool/` + `opencode/src/tool/` | **Duplicación masiva tools V1/V2**: 10+ herramientas paralelas con APIs distintas (Tool.make vs Tool.define), 11 pares de archivos. | 🔲 Pendiente (Fase 2) |
| 3 | Linting | Todo el repo | **Sin liner configurado**: 0 config eslint/biome/oxlint, 192 `any` en 71 archivos, 13 `@ts-expect-error` sin razón. | ✅ **RESUELTO** (Fase 4) |
| 4 | Dependencias | `package.json` | **Parche effect huérfano**: `effect@4.0.0-beta.83.patch` no estaba en `patchedDependencies`. | ✅ **RESUELTO** (Fase 0.1) |
| 5 | Arquitectura | `core/package.json` | **Export map con glob `./*`**: 47 dependencias NPM duplicadas entre core y opencode. Sin `index.ts` barrel. | 🔲 Pendiente (Fase 2.2) |
| 6 | Arquitectura | `core/src/session/` | **Lógica de sesión triplicada**: runner, session, llm con responsabilidades contaminadas. | 🔲 Pendiente (Fase 3) |
| 7 | Dependencias | `packages/core/package.json` | **47 dependencias NPM duplicadas** entre core y opencode; `@ai-sdk/cerebras` con versiones diferentes. | 🔲 Pendiente (Fase 8) |

---

## 3. Hallazgos Altos (🟠) — Resumen

| # | Área | Descripción | Estado |
|---|------|-------------|--------|
| 8 | Seguridad | Clave de cifrado AES-GCM derivada de hostname (determinista, sin salt) — crypto.ts:7-9 | 🔲 Pendiente (Fase 1.2) |
| 9 | Seguridad | Shell injection en bash.ts + shell.ts — ChildProcess con shell=true sin sanitizar | 🔲 Pendiente (Fase 1.4) |
| 10 | Seguridad | SSRF potencial en webfetch — URL validada solo con startsWith("http") | 🔲 Pendiente (Fase 1.x) |
| 11 | Functional | V2 Dual-write masiva: 15+ puntos en processor.ts + prompt.ts | 🔲 Pendiente (Fase 3) |
| 12 | Functional | Bash tool con 12 TODO estructurales — tree-sitter, Windows paths, background jobs | 🔲 Pendiente (Fase 1.4 + otras) |
| 13 | Functional | executeStream() no implementado en 3 DB drivers — Stream.die() | 🔲 Pendiente (Fase 3.2) |
| 14 | Rendimiento | existsSync() en cold boot path — 7+ llamadas síncronas bloqueantes | 🔲 Pendiente (Fase 6.1) |
| 15 | Rendimiento | Sin pool de procesos — cada comando shell spawns nuevo proceso | 🔲 Pendiente (Fase 6.x) |
| 16 | UI/UX | Sin virtual scrolling — renderiza todos los mensajes en DOM | 🔲 Pendiente (Fase 5) |
| 17 | UI/UX | Sin onboarding para nuevo usuario | 🔲 Pendiente (Fase 5.2) |
| 18 | UI/UX | ErrorComponent con palette hardcodeada (no ThemeContext) | 🔲 Pendiente (Fase 6) |
| 19 | UI/UX | 30+ violaciones de texto crudo como hijo directo de <box> | 🔲 Pendiente (Fase 6) |
| 20 | Dead Code | 5 funciones/keymaps @deprecated en API pública de plugins TUI | 🔲 Pendiente |
| 21 | Dead Code | 5 miembros del hook API @deprecated | 🔲 Pendiente |
| 22 | Linting | 192 ocurrencias de any → 50 resueltas (Record<string,unknown>), 25 + sdk:any + Schema.Any restantes | ✅ Parcial |
| 23 | Dependencias | Parches con versiones no actualizadas (gcp-metadata, pacote, MCP SDK) | 🔲 Pendiente (Fase 8) |
| 24 | Recomendaciones | Regex-based shell parsing en bash.ts — SHELL_TOKEN_RE con falsos negativos | 🔲 Pendiente (Fase 1.4) |
| 25 | Recomendaciones | Flag mirrorAssistant duplica toda la lógica de eventos V1/V2 | 🔲 Pendiente (Fase 3) |

---

## 4. Estado de Implementación

### Fase 0: Quick Wins ✅ **COMPLETA**
| Item | Descripción | Archivos |
|------|-------------|----------|
| 0.1 | Parche effect resuelto: agregado a patchedDependencies | `package.json`, `patches/` |
| 0.2 | PARALLEL_API_KEY + CLOUDFLARE a SHELL_ENV_DENY | `opencode/src/tool/shell.ts:433` |
| 0.3 | ~~Scrollbar default~~ (postergado — decisión UI) | — |
| 0.4 | knip ya configurado (solo documentar) | `knip.json` |
| 0.5 | ~~session.delete confirm~~ (postergado — UX design pendiente) | — |
| 0.6 | Logging a catch vacíos (3 archivos) | `markdown.ts`, `database/path.ts` |

### Fase 1: Seguridad 🟡 **PARCIAL**
| Item | Descripción | Estado |
|------|-------------|--------|
| 1.1 | OPENCODE_AUTH_CONTENT eliminado de env vars | ✅ **COMPLETO** |
| 1.2 | Migrar cifrado auth.json a OS keychain | 🔲 Pendiente (5-7 días) |
| 1.3 | Deny-list de patrones peligrosos en bash.ts | ✅ **COMPLETO** (16 patrones) |
| 1.4 | Tree-sitter AST shell parsing | 🔲 Pendiente (3-5 días) |
| 1.5 | No mutar process.env global para tokens AWS | ❌ Won't Fix (JIT es correcto) |

### Fase 2: Arquitectura 🔲 **PENDIENTE**
| Item | Descripción | Esfuerzo |
|------|-------------|----------|
| 2.1 | Unificar tools V1/V2 (11 pares) | 2-3 semanas |
| 2.2 | Export map: glob → exports explícitos en core | 2-3 días |
| 2.3 | Unificar skill/discovery.ts | 1 día |
| 2.4 | Documentar convención core vs opencode config | 2 horas |

### Fase 3: Migración V2 🔲 **PENDIENTE**
| Item | Descripción | Dependencia |
|------|-------------|-------------|
| 3.1 | Eliminar 17+ dual-write en processor.ts + prompt.ts | Fase 2.1 |
| 3.2 | Implementar executeStream() en SQLite bun | Ninguna |
| 3.3 | Refactorizar normalizeMessages | Ninguna |
| 3.4 | Implementar apply-patch moves | Fase 2.1 |
| 3.5 | Formatter integration + LSP en edit/write | Fase 2.1 |

### Fase 4: Linter + Calidad ✅ **COMPLETA**
| Item | Descripción | Archivos |
|------|-------------|----------|
| 4.1 | oxlint configurado (correctness/suspicious/pedantic) | `.oxlintrc.json` |
| 4.2 | Eliminar any: 50 Record<any> + 4 callbacks + 3 annots | 10+ archivos |
| 4.3 | @ts-expect-error: 2 fix, 9 legítimos | `llm.ts`, `session.ts` |
| 4.4 | CI gate: linter en pre-push hook | `.husky/pre-push` |

### Fase 5-8 🔲 **PENDIENTES**
| Fase | Área | Items clave |
|------|------|-------------|
| 5 | UI/UX | Virtual scrolling (3-5d), onboarding (2-3d), placeholders (1d) |
| 6 | Rendimiento | existsSync async (1d), concurrencia config (1d), SQLite cache (30min) |
| 7 | Upstream Sync | Sync semanal (2-4h/semana), cherry-picks documentados |
| 8 | Dependencias | 47 duplicadas → 0, pacote/MCP SDK/gcp-metadata patches |

---

## 5. Archivos con Mayor Deuda Técnica

| Archivo | Líneas | Hallazgos | Severidad |
|---------|--------|-----------|-----------|
| `opencode/src/provider/transform.ts` | 1543 | 37 any, normalizeMessages ineficiente | 🔴 Alta |
| `opencode/src/provider/provider.ts` | 1847 | 24 any (13 sdk:any), process.env mutación | 🔴 Alta |
| `opencode/src/session/processor.ts` | 1091 | 15 dual-write, mirrorAssistant, auto-asignación | 🔴 Alta |
| `core/src/tool/bash.ts` | 242 | 12 TODO, sin tree-sitter, deny-list básica | 🔴 Alta |
| `opencode/src/session/session.ts` | 1119 | Session v2 features diferidas, pricing placeholder | 🟠 Alta |
| `core/src/session.ts` | 436 | Schema.Any, Record schemas | 🟡 Media |
| `opencode/src/mcp/auth.ts` | 150+ | Cifrado débil MCP | 🟡 Media |
| `core/src/database/sqlite.bun.ts` | 200+ | executeStream() no implementado | 🟡 Media |

---

## 6. Decisiones Arquitectónicas Clave

### Tomadas
- ✅ **V2 es el canon**: opencode app usa V2 tools exclusivamente. V1 tools en core sirven a su propio session runner.
- ✅ **OPENCODE_AUTH_CONTENT eliminado**: subproceso lee auth.json directamente (no env var). IPC socket postergado.
- ✅ **process.env JIT es correcto**: AWS_BEARER_TOKEN_BEDROCK con try/finally restore es patrón SDK estándar. SHELL_ENV_DENY cubre child processes.
- ✅ **oxlint sobre biome/eslint**: Ya instalado, 3.5s para 2525 files, 189 rules. Suficiente para el proyecto.

### Pendientes
- 🔲 **OS Keychain**: Reemplazar AES-GCM con hostname por Windows Credential Manager / macOS Keychain / Linux libsecret.
- 🔲 **Tree-sitter AST**: Reemplazar SHELL_TOKEN_RE regex con parser AST para detección precisa de comandos peligrosos.
- 🔲 **Shared utilities**: Extraer resolveDirectory(), formatOutput(), createToolContext() de los pares V1/V2.
- 🔲 **Export map**: Reemplazar `./*` en core/package.json con exports explícitos.

---

## 7. Referencia Rápida

### Comandos de verificación
```powershell
bun run lint              # oxlint — 0 errors expected
bun run typecheck          # typecheck — known pre-existing errors in stats-app, tui
.\scripts\vmk-safety-check.ps1   # vMK containment check
.\scripts\vmk-patch-check.ps1    # Patch integrity (8/8 pass)
```

### Documentos relacionados
- `docs/10-plan-implementacion.md` — Plan general de implementación
- `docs/10-plan/index.md` — Índice del plan
- `docs/01-gaps/funcional.md` — Gaps funcionales detallados
- `docs/02-seguridad/` — Hallazgos de seguridad (3 reportes)
- `docs/03-optimizacion/` — Arquitectura y dependencias
- `docs/04-ui-ux/` — UI/UX hallazgos
- `docs/05-rendimiento/backend-latencia.md` — Performance
- `docs/08-revision-lineal/` — Código muerto + linting
- `docs/09-otros/recomendaciones-extra.md` — Recomendaciones extra
- `docs/operations/quick-wins-fase0.md` — Fase 0 detalle
- `docs/operations/fase2-consolidacion-tools.md` — Fase 2 detalle

### Skills relacionados
- `customize-opencode` — Configuración de opencode
- `codebase-memory` — Graph queries para entender arquitectura
- `effect` — Effect TS patterns usados en el proyecto
