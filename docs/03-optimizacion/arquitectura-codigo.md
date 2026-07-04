# Auditoría de Arquitectura y Código

> Read-only audit. Fecha: 2026-07-03

## Resumen Ejecutivo

Se identificaron **3 hallazgos críticos**, **5 de alta severidad**, y varios de severidad media/baja que afectan la arquitectura del proyecto opencode vMK.

**Total: 20+ | 🔴 Críticos: 3 | 🟠 Altos: 5 | 🟡 Medios: 8 | 🟢 Bajos: 4+**

---

## 🔴 Crítico

### C-01: Duplicación masiva de tools entre `core/src/tool/` y `opencode/src/tool/`

**Archivos duplicados** (mismo nombre, implementación paralela V1 vs V2):

| Herramienta | `core/src/tool/` (V2) | `opencode/src/tool/` (V1) |
|---|---|---|
| glob | `glob.ts` | `glob.ts` |
| grep | `grep.ts` | `grep.ts` |
| read | `read.ts` | `read.ts` |
| edit | `edit.ts` | `edit.ts` |
| write | `write.ts` | `write.ts` |
| webfetch | `webfetch.ts` | `webfetch.ts` |
| websearch | `websearch.ts` | `websearch.ts` |
| question | `question.ts` | `question.ts` |
| skill | `skill.ts` | `skill.ts` |
| apply_patch | `apply-patch.ts` (hyphen) | `apply_patch.ts` (underscore) |

**Impacto**: Cada bugfix o mejora debe aplicarse en DOS lugares. Las implementaciones usan APIs distintas:
- Core V2 usa `Tool.make(...)` con `ToolFailure` de `@opencode-ai/llm`, `PermissionV2`, `Location`
- Opencode V1 usa `Tool.define(...)` con `PermissionV1`, `SessionV1`, `InstanceState`

**Evidencia**: `core/src/tool/glob.ts` usa `Tool.make(...)` con `ToolFailure`; `opencode/src/tool/glob.ts` usa `Tool.define(...)` con `PermissionV1.Request`.

### C-02: Duplicación de directorios de configuración entre `core/src/config/` y `opencode/src/config/`

Ambos contienen archivos con nombres idénticos pero función distinta:

| Archivo | `core/` (schemas/tipos) | `opencode/` (implementación) |
|---|---|---|
| `agent.ts` | Schema definition (`ConfigV2.Agent`) | File loading/parsing |
| `command.ts` | Schema definition (`ConfigV2.Command`) | File loading/parsing |
| `markdown.ts` | (markdown config) | Markdown parsing |
| `plugin.ts` | Schema definition (`ConfigV2.Plugin.Entry`) | Plugin loading, dedup |

**Impacto**: La separación schema-vs-lógica no está documentada. Un desarrollador que busca lógica de configuración en `core/` no la encuentra.

### C-03: Duplicación de lógica de sesión entre paquetes

- `packages/core/src/session/runner/` — Orquestación central del ciclo de ejecución V2
- `packages/opencode/src/session/` — Gestión a nivel aplicación (`llm.ts`, `session.ts`)
- `packages/opencode/src/session/llm/` — Adaptadores de runtime nativo y AI SDK

**Evidencia**: `core/src/session/runner/llm.ts` (414 líneas) ejecuta el loop de sesión, mientras que `opencode/src/session/llm.ts` decide qué runtime usar. Hay contaminación de responsabilidades.

---

## 🟠 Alto

### A-01: Dependencia cíclica potencial: `core` ← `llm` ← `opencode`

```
llm → 0 deps internas → solo effect, aws4fetch, smithy ✓ LIMPIO
core → llm ✓
opencode → core, llm, tui, plugin, sdk, server (6 paquetes internos)
```

**Riesgo**: `core` importa `llm` extensivamente (~30 archivos). Si `llm` alguna vez importa `core`, se crea un ciclo. No hay ciclo actualmente, pero es una restricción arquitectónica que debe mantenerse.

### A-02: Duplicación de skills: `core/src/skill/discovery.ts` vs `opencode/src/skill/discovery.ts`

Ambos implementan `SkillDiscovery` con lógica similar pero APIs distintas:
- `core/src/skill/discovery.ts` (167 líneas) — usa `FSUtil`, `Global`, `HttpClient` de Effect
- `opencode/src/skill/discovery.ts` (109 líneas) — usa `FSUtil`, `Global`, `HttpClient` + `LayerNode`

### A-03: Paquete `core` sin `index.ts` — sin encapsulación

Usa `exports` en package.json con patrones glob:
```json
"./*": "./src/*.ts"
```
Cualquier archivo `.ts` directamente en `src/` se vuelve exportable públicamente. No hay encapsulación.

### A-04: 47 dependencias NPM duplicadas entre `core/package.json` y `opencode/package.json`

Esto duplica el tamaño teórico del bundle y puede causar conflictos de versión. Ver reporte de dependencias.

### A-05: Plugin API surface inflada

`ProviderPlugins` exporta **33 plugins** públicamente, pero la mayoría solo se usan en el catálogo de modelos.

---

## 🟡 Medio

- **M-01**: Paquete `@opencode-ai/plugin` infrautilizado (solo 4 archivos, dependencias mínimas)
- **M-02**: 15 directorios compartidos con el mismo nombre entre `core/src/` y `opencode/src/` sin convención documentada
- **M-03**: El paquete `llm` no usa `catalog:` para `effect` (inconsistencia de estilo)

## 🟢 Bajo

- **B-01**: Convención de nombres inconsistente: `apply-patch.ts` (hyphen) vs `apply_patch.ts` (underscore)
- **B-02**: `todowrite.ts` (core) vs `todo.ts` (opencode)

---

## Recomendaciones Clave

1. **Unificar tools V1/V2**: Migrar todas las tools de `opencode/src/tool/` al patrón V2 y eliminar duplicadas.
2. **Mantener `llm` libre de dependencias internas**: No permitir que importe ningún otro `@opencode-ai/*`.
3. **Agregar `index.ts` a `core`**: Definir explícitamente API pública vs interna.
4. **Documentar convención `core/src/config/` (schemas) vs `opencode/src/config/` (lógica)**.
5. **Unificar `skill/discovery.ts`** en un solo lugar.
