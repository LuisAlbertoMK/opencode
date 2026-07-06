# Plan Maestro de Mejoras — opencode-vMK

> **Fecha**: 2026-07-06
> **Status**: En ejecución
> **Objetivo**: Optimizar opencode-vMK SIN afectar opencode global

---

## Resumen Ejecutivo

Análisis multi-agente identificó **35 hallazgos** en 3 categorías:
- **Contención/Aislamiento**: 13 hallazgos (3 CRITICAL, 4 HIGH)
- **Performance**: 22 hallazgos (2 HIGH, 8 MEDIUM)
- **Quick Wins**: 8 optimizaciones < 2 horas cada una

**Prioridad #1**: Contención — que vMK NUNCA corrompa opencode global.

---

## Fase 1: Contención CRÍTICA (Bloqueante)

### 1.1 Binary Naming Mismatch [CRITICAL]
**Archivo**: `packages/cli/script/build.ts`
**Problema**: Build crea `lildax`, vmk.cmd busca `opencode-vMK.exe`
**Fix**: Agregar post-build step para renombrar binario cuando `OPENCODE_CHANNEL=vMK-dev`
**Impacto**: vMK no se puede compilar correctamente
**Riesgo**: LOW (cambio aislado en build script)
**Esfuerzo**: 1 hora

### 1.2 Incomplete Path Isolation [CRITICAL]
**Archivo**: `packages/core/src/global.ts`
**Problema**: Solo `OPENCODE_CONFIG_DIR` se override; `data`, `cache`, `state`, `tmp` usan paths compartidos
**Fix**: Hacer que TODOS los paths respeten env vars (`OPENCODE_DATA_DIR`, `OPENCODE_CACHE_DIR`, etc.)
**Impacto**: vMK escribe en directorios compartidos con opencode global
**Riesgo**: MEDIUM (requiere testing exhaustivo)
**Esfuerzo**: 2-3 horas

### 1.3 XDG Env Vars Missing [HIGH]
**Archivo**: `vmk.cmd`
**Problema**: No setea `XDG_DATA_HOME`, `XDG_CONFIG_HOME`, `XDG_CACHE_HOME`
**Fix**: Agregar estas variables apuntando a `.vmk-data`, `.vmk-config`, `.vmk-cache`
**Impacto**: `xdg-basedir` usa paths de Linux en Windows, compartidos con global
**Riesgo**: LOW (solo env vars)
**Esfuerzo**: 15 minutos

### 1.4 Build Script Path Wrong [LOW]
**Archivo**: `vmk.cmd` (línea 31)
**Problema**: Referencia `packages/opencode/script/build.ts` pero es `packages/cli/script/build.ts`
**Fix**: Corregir path
**Impacto**: Build falla inmediatamente (self-evident)
**Riesgo**: LOW
**Esfuerzo**: 1 minuto

### 1.5 Post-Build Validation Missing [MEDIUM]
**Archivo**: `vmk.cmd`
**Problema**: No valida que el binario se creó correctamente
**Fix**: Agregar llamada a `vmk-safety-check.ps1 -CheckBuild` después de build
**Impacto**: Build puede fallar silenciosamente
**Riesgo**: LOW
**Esfuerzo**: 30 minutos

---

## Fase 2: Quick Wins de Performance

### 2.1 Defer Tree-sitter WASM Init [P1]
**Archivo**: `packages/core/src/tool/shared/bash-parser.ts` (línea 54)
**Problema**: `void getParser()` se ejecuta eaglerly al cargar el módulo
**Fix**: Mover init a primer uso de `tryAstCheck()` (regex fallback ya existe)
**Impacto**: Ahorra 50-200ms en startup
**Riesgo**: LOW
**Esfuerzo**: 30 minutos

### 2.2 VirtualList Idle Polling Reduction [P1]
**Archivo**: `packages/tui/src/component/virtual-list.tsx` (líneas 67-106)
**Problema**: Polling a 10fps continuamente incluso cuando idle
**Fix**: Two-tier polling: 100ms cuando scrolling, 500ms cuando idle
**Impacto**: Reduce CPU 60-80% cuando idle
**Riesgo**: LOW
**Esfuerzo**: 1-2 horas

### 2.3 Tool Materialization Cache [P1]
**Archivo**: `packages/core/src/session/runner/llm.ts` (línea 220)
**Problema**: `tools.materialize()` se llama en cada turn
**Fix**: Cachear materialización por agent + permission set
**Impacto**: Elimina overhead redundante en cada step
**Riesgo**: LOW
**Esfuerzo**: 1-2 horas

### 2.4 Compaction Cache Key Fix [P3]
**Archivo**: `packages/core/src/session/compaction.ts` (líneas 80-88)
**Problema**: `JSON.stringify(value)` en cada mensaje para cache key
**Fix**: Usar message ID como cache key en vez de stringificar todo
**Impacto**: Elimina overhead de JSON.stringify
**Riesgo**: LOW
**Esfuerzo**: 1 hora

---

## Fase 3: Optimizaciones Adicionales (Opcional)

### 3.1 Session History Loading [P0]
**Archivo**: `packages/core/src/session/history.ts`
**Problema**: Carga TODOS los mensajes en memoria por cada runner turn
**Fix**: Restringir columnas SELECT, considerar streaming
**Impacto**: Ahorra 10-50MB RAM en sesiones largas
**Riesgo**: MEDIUM
**Esfuerzo**: 2-4 horas

### 3.2 Message Updater Ring Buffer [P3]
**Archivo**: `packages/core/src/session/message-updater.ts`
**Problema**: `rebuildIndex()` O(n) en cada append después del límite
**Fix**: Usar ring buffer o decrementar índices
**Impacto**: Elimina O(n) rebuild
**Riesgo**: LOW
**Esfuerzo**: 1-2 horas

### 3.3 TUI Sync Store Eviction [P1]
**Archivo**: `packages/tui/src/context/sync.tsx`
**Problema**: Guarda messages + parts de TODAS las sesiones vistas
**Fix**: Evict parts de sesiones inactivas
**Impacto**: Ahorra 20-100MB RAM
**Riesgo**: MEDIUM
**Esfuerzo**: 3-4 horas

---

## Checklist de Verificación Post-Implementación

### Contención
- [ ] `vmk build` crea `opencode-vMK.exe` correctamente
- [ ] `vmk` lanza sin errores
- [ ] `.vmk-config/`, `.vmk-data/`, `.vmk-cache/` se usan (NO `~/.config/opencode`)
- [ ] Ejecutar `vmk` y `opencode` global simultáneamente no corrompe datos
- [ ] `vmk-safety-check.ps1 -CheckBuild` pasa
- [ ] No se escriben archivos en `C:\Users\{user}\.local\share\opencode` cuando corre vMK

### Performance
- [ ] Startup time mejoró (medir con `Measure-Command`)
- [ ] CPU usage en idle reducido (monitorear con Task Manager)
- [ ] RAM usage estable en sesiones largas

---

## Agentes Especializados Asignados

| Fase | Agente | Modelo | Tarea |
|------|--------|--------|-------|
| 1 | gentleman-vMK (direct) | qwen3.7-plus | Fixes CRITICAL de contención |
| 2 | gentleman-vMK (direct) | qwen3.7-plus | Quick wins de performance |
| 3 | gentleman-vMK (direct) | qwen3.7-plus | Optimizaciones adicionales |

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Cambios en global.ts rompen opencode global | Media | Alto | Testing exhaustivo + markers `// vMK:` |
| Build script changes rompen compilación | Baja | Alto | Verificar con `vmk build` después de cambios |
| Performance changes introducen bugs | Baja | Medio | Tests existentes deben pasar |
| Path isolation incompleta | Media | Alto | Verificar con `vmk-safety-check.ps1` |

---

## Métricas de Éxito

1. ✅ vMK se compila correctamente como `opencode-vMK.exe`
2. ✅ vMK NO escribe en directorios de opencode global
3. ✅ vMK y opencode global pueden coexistir sin conflictos
4. ✅ Startup time mejoró ≥ 10%
5. ✅ CPU idle redujo ≥ 30%
6. ✅ Todos los tests existentes pasan

---

## Referencias

- Reporte completo de contención: `docs/mejoras/containment-analysis.md`
- Reporte completo de performance: `docs/mejoras/performance-analysis.md`
- Manifiesto vMK: `VMK-MANIFEST.md`
- Plan de multi-model routing: `D:\gentleman-agent-gh\docs\mejoras\PLAN-multi-model-routing.md`

---

*Generado: 2026-07-06 | Cycle 11 | opencode-vMK*
