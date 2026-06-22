# Sesión: Análisis de Debilidades y Plan de Mejora — opencode vMK

## Goal
Identificar las debilidades del proyecto opencode (fork vMK), definir 5-10 subagentes para revisión completa, y crear un plan de mejora priorizado con implementación.

## Aprendizajes Clave

### 1. `--only-failures` como default en TESTING — ANTIPATRÓN CRÍTICO
- **Qué**: TODOS los packages usan `bun test --only-failures` como script `test` por defecto.
- **Por qué**: `--only-failures` solo ejecuta tests que fallaron en el último run. Si todos pasaron, ejecuta CERO tests y devuelve exit 0. En CI, `bun turbo test` invoca esto → un CI verde puede significar "no se ejecutó ningún test".
- **Dónde**: `packages/core/package.json`, `packages/opencode/package.json`, `packages/tui/package.json`, y ~12 packages más.
- **Detalle**: El CI ejecuta `bun turbo test --output-logs=errors-only` sin forzar `--no-only-failures`. No hay `test:all` ni `test:ci` que fuerce ejecución completa.

### 2. Desierto de skills del agente — 1 vs 62
- **Qué**: AGENTS.md referencia ~62 skills pero solo 1 (`effect`) está instalada en `.opencode/skills/`.
- **Por qué**: El proyecto migró de un sistema de skills a otro, o las skills nunca se portaron.
- **Dónde**: `.opencode/skills/` (solo `effect/SKILL.md`), `.agents/skills/` (no existe)
- **Detalle**: Archivos críticos faltantes: `SKILLS-INDEX.md`, `CYCLE.md`. Tools `github-triage` y `github-pr-search` implementados pero deshabilitados en `opencode.jsonc`. Referencia fantasma a `agent/translator.md`.

### 3. `noUncheckedIndexedAccess: false` en 13/20 packages
- **Qué**: El base `@tsconfig/bun` tiene `noUncheckedIndexedAccess: true`, pero 13 packages lo overridean a `false`.
- **Por qué**: Decisión del equipo para compatibilidad con código legacy, pero permite accesos a índices de array/dict sin verificación → potenciales `undefined` en runtime.
- **Dónde**: `packages/core/tsconfig.json`, `packages/opencode/tsconfig.json`, etc.
- **Detalle**: Los packages `core`, `opencode`, `server`, `llm`, `tui`, `http-recorder`, `containers`, `slack`, `script`, `effect-sqlite-node`, `effect-drizzle-sqlite`, `cli` — todos heredan de `@tsconfig/bun` y overridean `noUncheckedIndexedAccess: false`.

### 4. Sin Dependabot/Renovate — riesgo de seguridad alto
- **Qué**: No hay `.github/dependabot.yml` ni `renovate.json`. 11 patches activos, sin auditorías automáticas.
- **Por qué**: Nunca se configuró. El proyecto tiene 80+ dependencias directas solo en core + opencode.
- **Dónde**: Falta archivo de configuración en `.github/`
- **Detalle**: Irónicamente, el proyecto tiene iconos SVG de Dependabot, Renovate y Snyk en `packages/ui/src/assets/icons/file-types/` pero NINGUNO configurado.

### 5. Sin cobertura de tests en CI
- **Qué**: `test:coverage` existe en todos los packages pero nunca se ejecuta en CI. No hay umbral mínimo.
- **Por qué**: No hay step en `test.yml` que ejecute coverage. No hay herramienta configurada (c8, istanbul).
- **Dónde**: `packages/core/package.json` (`test:coverage`), `.github/workflows/test.yml`
- **Detalle**: 535+ test files pero nadie mide cobertura. `packages/desktop` solo tiene 10 tests, `packages/server` ~5.

### 6. Dispersión de documentación del agente
- **Qué**: AGENTS.md raíz contiene ~500+ líneas con reglas de persona, engram, skills, protocolos todo mezclado.
- **Por qué**: Crecimiento orgánico. Nunca se descompuso en archivos separados.
- **Dónde**: `RAÍZ/AGENTS.md` (monolítico)
- **Detalle**: No hay separación entre "reglas del agente" y "configuración del proyecto". Skills están en `.opencode/skills/`, comandos en `.opencode/command/`, tools en `.opencode/tool/` — sin índice central.

### 7. Tests Windows como ciudadano de segunda
- **Qué**: ~15 tests condicionalmente skippeados en Windows (PTY, worktree, symlinks, listen).
- **Por qué**: La plataforma Windows tiene diferencias fundamentales (no Unix sockets, no symlinks sin admin, PTY diferente).
- **Dónde**: `packages/core/test/filesystem/watcher.test.ts`, `packages/core/test/pty/pty-session.test.ts`, etc.
- **Detalle**: HttpApi exerciser solo corre en Linux. Timeout genérico de 20 min en CI sin distinguir que Windows es más lento.

### 8. Tools del agente deshabilitadas pero referenciadas
- **Qué**: `github-triage.ts` y `github-pr-search.ts` existen en `.opencode/tool/` pero están en `"disabled": true` en `opencode.jsonc`.
- **Por qué**: Posiblemente rotas o incompletas. Los agent files (`triage.md`, `duplicate-pr.md`) las referencian como disponibles.
- **Dónde**: `.opencode/tool/github-triage.ts`, `.opencode/tool/github-pr-search.ts`, `.opencode/opencode.jsonc`
- **Detalle**: Hay inconsistencia entre la documentación del agente y la configuración real.

### 9. 11 patches activos — riesgo de drift
- **Qué**: 11 dependencias tienen patches personalizados en `patches/`.
- **Por qué**: Bugs o features faltantes en upstream. El más riesgoso: `gcp-metadata` (autenticación GCP) y `pacote` (manejo de paquetes npm).
- **Dónde**: `patches/` directorio raíz, `package.json` → `patchedDependencies`
- **Detalle**: `@ff-labs/fff-bun` parcheado en versión 0.9.3 pero el proyecto usa 0.9.4 — posible patch huérfano.

### 10. Falta de estandarización en timeouts de test
- **Qué**: `packages/core` usa timeout default de Bun (~5000ms) mientras todos los demás usan `--timeout 30000`.
- **Por qué**: Inconsistencia al configurar los packages.
- **Dónde**: `packages/core/package.json` scripts de test
- **Detalle**: Puede producir falsos fallos si algún test en core tarda más de 5s.

## Decisiones

- Priorizar fixes que dan más impacto inmediato: `--only-failures` → SKILLS-INDEX.md → tools habilitadas → CI coverage
- No tocar `noUncheckedIndexedAccess` aún: requiere cambio masivo en ~13 packages, mejor como proyecto separado
- No tocar patches: requieren verificación con upstream, riesgo de breaking changes
- Crear `.github/dependabot.yml` como primer paso de seguridad automatizada

## Subagentes para Revisión Completa

| # | Subagente | Área | Propósito |
|---|-----------|------|-----------|
| 1 | **sdd-explore** | Testing Pipeline | Auditar `--only-failures` y proponer `test:ci` sin ese flag |
| 2 | **sdd-propose** | Dependabot/Renovate | Proponer configuración de actualización automática |
| 3 | **code-review-agent** | tsconfig strictness | Revisar impacto de activar `noUncheckedIndexedAccess` en core |
| 4 | **judgment-day** | Patches activos | Juzgar si cada patch es necesario o reemplazable |
| 5 | **sdd-design** | Skills System | Diseñar SKILLS-INDEX.md y sistema de skills del agente |
| 6 | **sdd-apply** | Windows Testing | Proponer mejoras para tests en Windows |
| 7 | **sdd-verify** | CI Coverage | Verificar estado actual de cobertura y proponer gates |
| 8 | **security-scanner** | Seguridad | Escanear dependencias y configurar audit automático |
| 9 | **sdd-tasks** | Tools Disabled | Plan para habilitar github-triage y github-pr-search |
| 10 | **self-improvement** | Documentación | Reorganizar AGENTS.md en módulos separados |

## Pendiente
- ✅ Crear este documento de análisis
- 🔲 Fix #1: Cambiar `--only-failures` por test completo en packages principales
- 🔲 Fix #2: Crear SKILLS-INDEX.md con las skills existentes
- 🔲 Fix #3: Crear CYCLE.md con el ciclo de mejora actual
- 🔲 Fix #4: Habilitar tools github-triage y github-pr-search
- 🔲 Fix #5: Crear `.github/dependabot.yml`
- 🔲 Fix #6: Agregar `--timeout` consistente en packages/core
- 🔲 Fix #7: Agregar CI step para coverage
