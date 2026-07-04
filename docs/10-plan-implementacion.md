# Plan de Implementación — opencode-vMK

**Fecha:** 2026-07-03
**Basado en:** Auditoría multi-agente (12 reportes, ~194 hallazgos)

---

## Fase 0: Quick Wins (días 1-2) 🟢

| # | Acción | Archivos | Esfuerzo | Impacto | Dependencias |
|---|---|---|---|---|---|
| 0.1 | Resolver parche `effect` huérfano: verificar si el fix SSE sigue siendo necesario. Si sí, agregar a `patchedDependencies`. Si no, borrar. | `patches/effect@4.0.0-beta.83.patch`, `package.json` | 15 min | 🔴 Crítico | Ninguna |
| 0.2 | Agregar `PARALLEL_API_KEY` y `CLOUDFLARE_API_KEY` a `SHELL_ENV_DENY` en shell.ts | `packages/opencode/src/tool/shell.ts:433` | 5 min | 🟢 Bajo | Ninguna |
| 0.3 | Activar scrollbar por defecto en TUI session (cambiar default KV a `true`) | `packages/tui/src/routes/session/index.tsx:1217` | 5 min | 🟡 Medio | Ninguna |
| 0.4 | Configurar `knip` para detección de dependencias/código muerto | Raíz del repo | 30 min | 🟡 Medio | Ninguna |
| 0.5 | Agregar confirmación a session.delete (Ctrl+D) si hay mensajes no guardados | `packages/tui/src/routes/session/index.tsx:514-517` | 30 min | 🟡 Medio | Ninguna |
| 0.6 | Agregar stack trace / logging a catch vacíos (publish-llm-event, database/path, config/markdown) | 3 archivos | 30 min | 🟢 Bajo | Ninguna |

---

## Fase 1: Seguridad (días 3-5) 🔴

| # | Acción | Archivos | Esfuerzo | Impacto | Dependencias |
|---|---|---|---|---|---|
| 1.1 | **Eliminar `OPENCODE_AUTH_CONTENT` env var**. Reemplazar con IPC socket/fifo para pasar credenciales a workspace subprocesses. | `packages/opencode/src/control-plane/workspace.ts:546` | 3-5 días | 🔴 Crítico | Arquitectura de IPC workspace |
| 1.2 | Migrar cifrado de auth.json de clave-derivada-de-hostname a keychain del SO (Windows Credential Manager, macOS Keychain, Linux libsecret). | `packages/opencode/src/auth/crypto.ts` | 5-7 días | 🟠 Alto | 1.1 (idealmente post-IPC) |
| 1.3 | Añadir validación de comandos en bash.ts: deny-list de patrones peligrosos (`rm -rf /`, fork bombs) + límite `--no-preserve-root`. | `packages/core/src/tool/bash.ts` | 1-2 días | 🟠 Alto | Ninguna |
| 1.4 | Reemplazar parseo regex de shell commands con tree-sitter AST parsing. | `packages/core/src/tool/bash.ts` | 3-5 días | 🟠 Alto | 1.3 |
| 1.5 | No mutar `process.env` global para AWS_BEARER_TOKEN_BEDROCK y AICORE_SERVICE_KEY. Usar mapa scoped por provider. | `packages/opencode/src/provider/provider.ts:320,457,585,598` | 1 día | 🟡 Medio | Ninguna |

---

## Fase 2: Arquitectura (semanas 2-3) 🔴

| # | Acción | Archivos | Esfuerzo | Impacto | Dependencias |
|---|---|---|---|---|---|
| 2.1 | **Unificar tools V1/V2**: Migrar todas las tools de `opencode/src/tool/` al patrón V2 (`Tool.make(...)`) y eliminar duplicadas. | 10+ pares de archivos | 2-3 semanas | 🔴 Crítico | Tests de cada tool |
| 2.2 | Agregar `index.ts` a `packages/core/src/` con exports explícitos. Reemplazar glob `./*` en package.json. | `packages/core/src/`, `packages/core/package.json` | 2-3 días | 🔴 Crítico | 2.1 (identificar API pública) |
| 2.3 | Unificar `skill/discovery.ts` en un solo lugar (core o opencode). | `core/src/skill/discovery.ts`, `opencode/src/skill/discovery.ts` | 1 día | 🟠 Alto | Ninguna |
| 2.4 | Documentar convención `core/src/config/` (schemas) vs `opencode/src/config/` (lógica). | Ambos directorios | 2 horas | 🟡 Medio | Ninguna |

---

## Fase 3: Migración V2 (semanas 2-4) 🟠

| # | Acción | Archivos | Esfuerzo | Impacto | Dependencias |
|---|---|---|---|---|---|
| 3.1 | **Completar migración V2 de session events**: eliminar 17+ puntos de dual-write en `processor.ts` y `prompt.ts`. | `packages/opencode/src/session/processor.ts`, `prompt.ts` | 1-2 semanas | 🟠 Alto | 2.1 (tools unificadas) |
| 3.2 | Implementar `executeStream()` en driver SQLite bun (el usado en producción). | `packages/core/src/database/sqlite.bun.ts:119` | 1-2 días | 🟠 Alto | Ninguna |
| 3.3 | Refactorizar `normalizeMessages` para eficiencia. | `packages/opencode/src/provider/transform.ts:64` | 1 día | 🟠 Alto | Ninguna |
| 3.4 | Implementar apply-patch moves (rename/move support). | `packages/core/src/tool/apply-patch.ts:85` | 2-3 días | 🟠 Alto | 2.1 |
| 3.5 | Implementar formatter integration + LSP diagnostics en edit/write tools. | `packages/core/src/tool/edit.ts`, `write.ts` | 3-5 días | 🟠 Alto | 2.1 |

---

## Fase 4: Linter y Calidad de Código (semanas 3-4) 🔴

| # | Acción | Archivos | Esfuerzo | Impacto | Dependencias |
|---|---|---|---|---|---|
| 4.1 | **Configurar linter** (biome o eslint + prettier) en todo el repo. | Raíz + todos los paquetes | 1-2 días | 🔴 Crítico | Ninguna |
| 4.2 | Eliminar 192 usos de `any` — reemplazar con tipos concretos. | 71 archivos | 3-5 días | 🟡 Medio | 4.1 |
| 4.3 | Revisar 13 `@ts-expect-error` — eliminar o documentar con razón. | 9 archivos | 1 día | 🟢 Bajo | 4.1 |
| 4.4 | Agregar regla CI que falle si hay `any` sin审批 o `@ts-expect-error` sin razón. | CI workflow | 1 hora | 🟡 Medio | 4.1 |

---

## Fase 5: UI/UX (semanas 4-5) 🟠

| # | Acción | Archivos | Esfuerzo | Impacto | Dependencias |
|---|---|---|---|---|---|
| 5.1 | **Implementar virtual scrolling** en session message list. | `packages/tui/src/routes/session/index.tsx` | 3-5 días | 🟠 Alto | Ninguna |
| 5.2 | Agregar flujo de onboarding para primer uso. | `packages/tui/src/feature-plugins/home/tips.tsx` | 2-3 días | 🟡 Medio | Ninguna |
| 5.3 | Hacer placeholders de prompt contextuales al proyecto. | `packages/tui/src/routes/home.tsx:17-20` | 1 día | 🟡 Medio | Ninguna |
| 5.4 | Guardar scroll position por session en KV. | `packages/tui/src/routes/session/index.tsx:1184` | 1 día | 🟡 Medio | Ninguna |
| 5.5 | Mejorar pending message detection: usar timestamp en vez de string comparison. | `packages/tui/src/routes/session/index.tsx:241-250` | 1 día | 🟡 Medio | Ninguna |

---

## Fase 6: Rendimiento (semanas 5-6) 🟡

| # | Acción | Archivos | Esfuerzo | Impacto | Dependencias |
|---|---|---|---|---|---|
| 6.1 | Migrar `existsSync()` a `FSUtil.existsSafe()` asíncrono en cold boot path. | `packages/opencode/src/config/config.ts`, `managed.ts` | 1 día | 🟠 Alto | Ninguna |
| 6.2 | Agregar semáforo de concurrencia en config loading (reemplazar `unbounded`). | `packages/opencode/src/config/config.ts:273,387` | 1 día | 🟡 Medio | Ninguna |
| 6.3 | Bump statement cache de SQLite de 64 a 256 entradas. | `packages/core/src/database/sqlite.node.ts` | 30 min | 🟢 Bajo | Ninguna |
| 6.4 | Reemplazar `realpathSync.native()` con versión asíncrona en filesystem/shell. | `packages/core/src/tool/shell.ts`, filesystem | 1 día | 🟡 Medio | Ninguna |

---

## Fase 7: Upstream Sync (semanal) 🔴

| # | Acción | Esfuerzo | Impacto | Frecuencia |
|---|---|---|---|---|
| 7.1 | **Establecer sync semanal** con `anomalyco/opencode` dev. | 2-4 horas/semana | 🔴 Crítico | Semanal |
| 7.2 | Priorizar cherry-picks de seguridad y fixes de core sobre features nuevos. | — | 🟠 Alto | Semanal |
| 7.3 | Documentar cada cherry-pick: qué, por qué, conflictos encontrados. | 30 min/sesión | 🟡 Medio | Semanal |

---

## Fase 8: Consolidación de Dependencias (semana 6) 🟡

| # | Acción | Archivos | Esfuerzo | Impacto |
|---|---|---|---|---|
| 8.1 | Unificar 47 dependencias duplicadas: elegir `core` como fuente única. | `packages/opencode/package.json` | 1 día | 🟡 Medio |
| 8.2 | Usar `catalog:` consistentemente para todas las dependencias compartidas. | Todos los `package.json` | 1 día | 🟢 Bajo |
| 8.3 | Alinear versiones de AI SDK providers entre paquetes. | `packages/core/package.json`, `packages/opencode/package.json` | 1 día | 🟡 Medio |

---

## Mapa de Dependencias entre Fases

```
Fase 0 (Quick Wins)
  │
  ├──→ Fase 1 (Seguridad) ──→ Fase 3 (V2 Migration)
  │                               │
  └──→ Fase 2 (Arquitectura) ────┘
          │
          ├──→ Fase 4 (Linter)
          │
          ├──→ Fase 5 (UI/UX)
          │
          └──→ Fase 6 (Rendimiento)

Fase 7 (Upstream Sync) ──→ paralela a todas las fases
Fase 8 (Dependencias) ──→ después de Fase 2
```

---

## Carga de Trabajo Estimada

| Fase | Días-hombre | Prioridad | Riesgo si no se hace |
|---|---|---|---|
| Fase 0: Quick Wins | 1 | Alta | Bajo (mejoras incrementales) |
| Fase 1: Seguridad | 10-15 | **Máxima** | Exposición masiva de API keys |
| Fase 2: Arquitectura | 15-20 | **Máxima** | Duplicación sigue creciendo |
| Fase 3: V2 Migration | 15-25 | Alta | Fragilidad de dual-write |
| Fase 4: Linter | 5-8 | **Máxima** | 192 `any` sin control |
| Fase 5: UI/UX | 8-12 | Media | Usabilidad sub-óptima |
| Fase 6: Rendimiento | 3-5 | Media | Startup +50ms en Windows |
| Fase 7: Upstream Sync | 2-4/semana | **Máxima** | Divergencia irreversible |
| Fase 8: Dependencias | 3-5 | Media | Version drift |
| **TOTAL** | **60-95 días-hombre** | | |

---

## Criterios de Éxito

- [ ] `OPENCODE_AUTH_CONTENT` eliminado o reemplazado por IPC seguro
- [ ] Tools V1/V2 unificadas sin duplicación
- [ ] Linter configurado con 0 `any` no aprobados
- [ ] Virtual scrolling implementado en TUI session
- [ ] Sync semanal con upstream establecido
- [ ] Parche effect resuelto (activo o eliminado)
- [ ] 47 dependencias duplicadas reducidas a 0
