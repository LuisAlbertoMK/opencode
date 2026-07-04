# Resumen Ejecutivo — Auditoría Multi-Agente opencode-vMK

**Fecha:** 2026-07-03
**Metodología:** 6 subagentes independientes (read-only) cubriendo 9 categorías
**Alcance:** ~112K líneas de TypeScript en 9 paquetes monorepo

---

## Métricas Agregadas

| Categoría | Documento | 🔴 Crítico | 🟠 Alto | 🟡 Medio | 🟢 Bajo | **Total** |
|---|---|---|---|---|---|---|
| GAPS funcional+técnico | `01-gaps/funcional.md` | 0 | 8 | 15 | 17 | **40** |
| Seguridad — datos/secretos | `02-seguridad/datos-secretos.md` | 1 | 1 | 6 | 6 | **14** |
| Seguridad — auth | `02-seguridad/auth-autorizacion.md` | 0 | 1 | 4 | 3 | **8** |
| Seguridad — inyección | `02-seguridad/inyeccion-validacion.md` | 0 | 1 | 5 | 5 | **11** |
| Optimización — arquitectura | `03-optimizacion/arquitectura-codigo.md` | 3 | 5 | 8 | 4 | **20+** |
| Optimización — dependencias | `03-optimizacion/dependencias.md` | 2 | 1 | 3 | 2 | **8+** |
| UI/UX — flujos de usuario | `04-ui-ux/flujos-usuario.md` | 0 | 3 | 11 | 10 | **24** |
| UI/UX — consistencia visual | `04-ui-ux/consistencia-visual.md` | 0 | 2 | 11 | 7 | **20** |
| Rendimiento — backend | `05-rendimiento/backend-latencia.md` | 0 | 2 | 3 | 3 | **8** |
| Revisión lineal — código muerto | `08-revision-lineal/codigo-muerto.md` | 0 | 2 | 8 | 7 | **17** |
| Revisión lineal — sintaxis/lint | `08-revision-lineal/sintaxis-linting.md` | 1 | 2 | 4 | 3 | **10** |
| Recomendaciones extra | `09-otros/recomendaciones-extra.md` | 0 | 1 | 8 | 5 | **14** |
| **TOTAL** | | **7** | **29** | **86** | **72** | **~194** |

---

## Top 10 Hallazgos Críticos

| # | Severidad | Categoría | Hallazgo | Archivo(s) Clave |
|---|---|---|---|---|
| 1 | 🔴 **Crítico** | Seguridad | `OPENCODE_AUTH_CONTENT` expone TODAS las API keys como env var a subprocesos workspace. Cualquier plugin o script en workspace puede leer todas las credenciales. | `workspace.ts:546` |
| 2 | 🔴 **Crítico** | Arquitectura | Duplicación masiva de tools V1/V2: 10+ herramientas con implementación paralela entre `core/src/tool/` y `opencode/src/tool/`. Cada bugfix requiere doble trabajo. | Ambos `tool/` dirs |
| 3 | 🔴 **Crítico** | Dependencias | `effect@4.0.0-beta.83.patch` huérfano: existe en disco pero NO en `patchedDependencies`. El fix SSE no se aplica. | `patches/effect@4.0.0-beta.83.patch` |
| 4 | 🔴 **Crítico** | Linting | **No hay linter configurado** en todo el repo. Cero eslint/biome/oxlint. 192 usos de `any`, 13 `@ts-expect-error` sin supervisión. | Todo el repo |
| 5 | 🔴 **Crítico** | Arquitectura | Paquete `core` sin `index.ts` — exports glob `./*` permite importar cualquier archivo interno. Sin encapsulación. | `packages/core/package.json` |
| 6 | 🔴 **Crítico** | Dependencias | 47 dependencias duplicadas entre `core` y `opencode`. `@ai-sdk/cerebras` con versiones diferentes (2.0.41 vs 2.0.60). | `package.json` de ambos |
| 7 | 🔴 **Crítico** | Arquitectura | Duplicación de lógica de sesión entre `core/src/session/runner/` y `opencode/src/session/` con responsabilidades contaminadas. | Múltiples archivos |

---

## Top 10 Hallazgos de Alto Impacto

| # | Severidad | Categoría | Hallazgo |
|---|---|---|---|
| 8 | 🟠 **Alto** | GAPS | Migración V2 inconclusa: 17+ puntos de dual-write temporales en session processor + prompt. Frágil ante cambios. |
| 9 | 🟠 **Alto** | GAPS | Tools core sin features clave: Bash (12 TODOs), Edit (5), Write (5). Falta parser-based approval, formatter, LSP. |
| 10 | 🟠 **Alto** | Seguridad | Clave de cifrado derivada de datos predecibles (hostname + homedir). Auth.json descifrable por cualquier proceso local. |
| 11 | 🟠 **Alto** | UI/UX | Sin virtual scrolling en sesiones largas. Renderiza todos los mensajes como nodos DOM del terminal → problema de memoria/performance. |
| 12 | 🟠 **Alto** | Arquitectura | Dependencia cíclica potencial: `core` ← `llm` (30+ archivos importan `@opencode-ai/llm`). Si `llm` importa `core`, se crea ciclo. |
| 13 | 🟠 **Alto** | GAPS | `executeStream()` llama a `Stream.die("not implemented")` en los 3 drivers SQLite. Muerte instantánea si alguien intenta stream. |
| 14 | 🟠 **Alto** | UI/UX | Sin flujo de onboarding para nuevo usuario. Pantalla en blanco con logo + prompt, sin guía inicial. |
| 15 | 🟠 **Alto** | Rendimiento | `existsSync()` en cold boot path (7+ llamadas sincrónicas). `realpathSync.native()` puede tomar 5-50ms por call en Windows. |
| 16 | 🟠 **Alto** | Seguridad | Bash/shell tools sin sanitización de comandos. Sin deny-list de patrones peligrosos (`rm -rf /`, fork bombs). |
| 17 | 🟠 **Alto** | Código muerto | API surface deprecated en plugin package (TUI keymap shim, auth hooks). |

---

## Salud del Proyecto por Dimensión

| Dimensión | Estado | Barra |
|---|---|---|
| **Seguridad** | ⚠️ 1 crítico (exposición API keys) + 2 altos | ████░░░░░░ 40% |
| **Arquitectura** | 🔴 3 críticos (duplicación masiva V1/V2) | ██░░░░░░░░ 20% |
| **Funcionalidad** | 🟡 8 altos (migración V2, tools incompletas) | █████░░░░░ 50% |
| **UI/UX** | 🟡 5 altos (sin virtual scroll, sin onboarding) | ██████░░░░ 60% |
| **Rendimiento** | 🟢 2 altos (startup sync I/O, sin pool) | ████████░░ 80% |
| **Mantenibilidad** | 🔴 Sin linter, código muerto, duplicación | ██░░░░░░░░ 20% |
| **Cobertura tests** | 🟡 7/7 TUI tests pasan, pero sin cifras globales | █████░░░░░ 50% |
| **Upstream sync** | 🔴 585 commits behind, 2/7 cherry-picks revertidos | █░░░░░░░░░ 10% |

---

## Conclusiones

1. **opencode-vMK es funcional y estable** (benchmark 975ms, 7/7 TUI tests, build sano).
2. **El riesgo más urgente es la exposición de API keys** vía `OPENCODE_AUTH_CONTENT` — impacto inmediato y masivo.
3. **La deuda arquitectónica V1/V2 es la第二大** — la duplicación de tools, config y sesión frena todo desarrollo futuro.
4. **La ausencia de linter** permite que 192 `any` y 13 `@ts-expect-error` se acumulen sin control.
5. **585 commits de divergencia upstream** es una bomba de tiempo para futuros cherry-picks.
6. **El TUI es sólido** en crash handling y manejo de errores, pero carece de virtual scrolling y onboarding.
