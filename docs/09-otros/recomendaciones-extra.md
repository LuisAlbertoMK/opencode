# Recomendaciones Extra

Fecha: 2026-07-03
Auditor: subagente (read-only)

## Hallazgos adicionales no cubiertos en los informes principales

### 1. Arquitectura y Organización

| # | Severidad | Área | Hallazgo | Recomendación |
|---|---|---|---|---|
| 1 | 🟡 Medio | packages/core/src/session/runner/index.ts | El archivo solo tiene 39 líneas y define un TaggedErrorClass + Interface + Service. No hay implementación real — el runner vive en otro lado. Esto es intencional (separación de interfaz/implementación) pero significa que el index.ts del runner es puramente un contrato abstracto. | Considerar fusionar con la implementación si no hay necesidad de múltiples implementaciones. Si es intencional, documentar dónde está la implementación real. |
| 2 | 🟡 Medio | packages/core/src/public/ | La capa pública tiene 7 archivos. Cada archivo sigue el patrón de self-reexport + re-export de tipos internos. La separación está bien pero el valor añadido sobre importar directamente de los módulos internos es cuestionable. | Verificar que la capa public/ no agregue overhead de mantenimiento innecesario. Los consumidores externos (sdk, opencode package) ya importan con subpaths como @opencode-ai/core/session/... |
| 3 | 🟢 Bajo | packages/plugin/ | El package plugin tiene solo 4 archivos fuente (index.ts, tui.ts, tool.ts, shell.ts) más el tsconfig. Su package.json exporta múltiples subpaths. Es un SDK pequeño pero mantenido activamente. | El tamaño reducido sugiere que podría fusionarse con otro package o mantenerse como está. Buen diseño actual. |

### 2. Vulnerabilidades Potenciales

| # | Severidad | Archivo:Línea | Hallazgo | Recomendación |
|---|---|---|---|---|
| 4 | 🟠 Alto | packages/core/src/tool/bash.ts:133-141 | xternalCommandDirectories parsea tokens de shell con regex (SHELL_TOKEN_RE) para detectar referencias a directorios externos. El comentario en línea 83 indica que debería ser reemplazado por un parser de AST (tree-sitter). El regex puede tener falsos negativos con comandos complejos. | Priorizar el TODO de parser-based detection (línea 83). Un regex no es suficiente para determinar seguridad de paths en comandos arbitrarios. |
| 5 | 🟡 Medio | packages/opencode/src/index.ts:75-77 | Process env mutation como side-effect en middleware: process.env.OPENCODE_PURE = "1", process.env.AGENT = "1", etc. Esto es frágil si el proceso comparte entorno con otros módulos. | Considerar usar un Context de Effect o un Service en lugar de mutar process.env. |
| 6 | 🟡 Medio | packages/opencode/src/index.ts:126-137 | Bypass de yargs para --version y --help usando check de args.includes. Esto es frágil: si yargs cambia su parser, --version podría no funcionar. | Documentar por qué este bypass es necesario (vMK optimization). Idealmente encontrar una forma de hacer lazy parsing en yargs sin bypass. |

### 3. Deuda Técnica

| # | Severidad | Archivo:Línea | Hallazgo | Recomendación |
|---|---|---|---|---|
| 7 | 🟡 Medio | packages/opencode/src/session/processor.ts:129 | mirrorAssistant flag controla si los eventos se escriben tanto en V1 como en V2. Esto duplica toda la lógica de eventos en processor.ts. El flag se evalúa en ~15 lugares diferentes. | Una vez completada la migración v2, este flag y todas las ramas condicionales if (mirrorAssistant) pueden eliminarse, reduciendo significativamente la complejidad del archivo. |
| 8 | 🟡 Medio | packages/opencode/src/session/processor.ts:817-818 | Comentario // oxlint-disable-next-line no-self-assignment -- reactivity trigger — hay 2 ocurrencias de ctx.currentText.text = ctx.currentText.text (auto-asignación) usadas como trigger de reactividad. Esto es un hack que sugiere que el sistema de reactividad subyacente no está funcionando correctamente con inmutabilidad. | Investigar por qué se necesita la auto-asignación y corregir el sistema de reactividad. |
| 9 | 🟢 Bajo | packages/opencode/src/session/processor.ts:1121 | Layer.suspend(() => layer.pipe(Layer.provide(...))) — 12 provides encadenados. Esto es correcto pero difícil de mantener si se agregan dependencias. | Considerar usar Layer.merge o un approach más modular. |
| 10 | 🟡 Medio | packages/core/src/tool/bash.ts:52-57 | compactOutput y captureNotice son funciones standalone que podrían ser reemplazadas por un schema de output más estructurado. | Al implementar managed storage (TODO #12), reemplazar estas funciones por schemas Effect. |

### 4. Pruebas y Cobertura

| # | Severidad | Hallazgo | Recomendación |
|---|---|---|---|
| 11 | 🟡 Medio | Los TODOs en bash.ts sobre "Port tree-sitter bash / PowerShell parser-based approval reduction" y "Restore PowerShell and cmd-specific invocation/path handling on Windows" indican que no hay pruebas específicas de shell para Windows. | Agregar pruebas específicas de plataforma para bash en Windows (PowerShell, cmd.exe). |
| 12 | 🟢 Bajo | packages/opencode/src/session/processor.ts tiene 1091 líneas sin descomposición en módulos más pequeños. La función create interna tiene ~900 líneas con closures anidados. | Aunque el código es funcional, un archivo de este tamaño es difícil de testear unitariamente. Considerar dividir en archivos más pequeños (event-handlers, tool-call handlers, etc.). |

### 5. Compatibilidad y Deprecaciones

| # | Severidad | Hallazgo | Recomendación |
|---|---|---|---|
| 13 | 🟡 Medio | packages/opencode/src/server/routes/instance/httpapi/public.ts tiene código legacy SDK v0/v1 que podría eliminarse si ningún cliente existente lo usa. | Auditar cuántos clientes usan la ruta /public y considerar deprecarla. |
| 14 | 🟢 Bajo | packages/opencode/src/config/tui-migrate.ts — migración TUI legacy. Si la migración se completó, este archivo podría eliminarse. | Verificar telemetría o logs para confirmar que ningún usuario necesita esta migración. |

## Resumen

Total: 14 | 🔴 Críticos: 0 | 🟠 Altos: 1 | 🟡 Medios: 10 | 🟢 Bajos: 3

### Prioridades para acción inmediata

1. **🟠 Alto (Hallazgo #4)**: Reemplazar regex-based external directory detection en bash.ts con parser AST (tree-sitter). Esto es una vulnerabilidad de seguridad potencial.
2. **🟡 Medio (Hallazgo #7)**: Completar migración v2 de eventos para eliminar el flag mirrorAssistant y ~15 ramas condicionales en processor.ts.
3. **🟡 Medio (Hallazgo #12)**: Descomposición de processor.ts (1091 líneas) en módulos más pequeños.
4. **🟡 Medio (Hallazgo #8)**: Investigar la necesidad de auto-asignaciones como trigger de reactividad.
