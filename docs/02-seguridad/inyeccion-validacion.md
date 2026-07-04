# Auditoria de Seguridad — Inyección / Validación

**Fecha:** 2026-07-03
**Auditor:** subagente (read-only)

## Hallazgos

| # | Severidad | Archivo:Línea | Descripción | Recomendación |
|---|---|---|---|---|
| 1 | 🟠 Alto | packages/core/src/tool/bash.ts:161-163 | **Shell injection directo — comando sin sanitizar.** ChildProcess.make(input.command, [], { shell }) pasa el comando del usuario (input.command) directamente al shell con shell: true. No hay escape de argumentos ni validación estructural. La función xternalCommandDirectories es "advisory only" (documentado). El único control es la aprobación del usuario vía PermissionV2, que no revisa sintaxis shell. | Implementar validación de comando contra un allowlist de comandos seguros, o parsear el AST (tree-sitter) y validar argumentos como hace shell.ts. Migrar a exec sin shell intermedio si es posible. |
| 2 | 🟠 Alto | packages/opencode/src/tool/shell.ts:302-319 | **Shell injection vía shell tool.** La función cmd() pasa el comando directamente a ChildProcess.make() con shell. Para PowerShell usa ["-Command", command], que es inherentemente ejecución de código arbitrario. Para bash usa ChildProcess.make(command, [], { shell }). No hay sanitización del texto del comando. | El tool está diseñado para ejecutar comandos arbitrarios por naturaleza, pero debe tener controles más estrictos: timeout obligatorio, confirmación explícita para comandos que mutan el sistema, y bloqueo de comandos en deny-list (p.ej., m -rf /, :(){ :|:& };:). |
| 3 | 🟡 Medio | packages/opencode/src/tool/webfetch.ts:76-93 | **SSRF potencial en webfetch tool.** La URL es proporcionada por el LLM y se valida solo con startsWith("http://") o startsWith("https://"). No hay bloqueo de IPs privadas (127.0.0.1, 10.x.x.x, 169.254.x.x, etc.). Posible SSRF para escanear red interna. | Añadir bloqueo de RFC 1918 direcciones y loopback antes de hacer la petición HTTP. |
| 4 | 🟡 Medio | packages/opencode/src/tool/mcp-websearch.ts:77-82 | **MCP tool headers no sanitizados.** headers del usuario se pasan directamente a HttpClientRequest.setHeaders(headers ?? {}). No hay validación de que no contengan cabeceras peligrosas (p.ej., Host manipulado, Authorization con credenciales robadas). | Sanitizar headers prohibiendo cabeceras sensibles (Host, Authorization, Cookie, etc.). |
| 5 | 🟡 Medio | packages/opencode/src/mcp/index.ts:659 | **MCP tool names sanitizados con replace agresivo.** McpCatalog.sanitize() reemplaza /[^a-zA-Z0-9_-]/g con _. Esto evita inyección en nombres de tool, pero la función de sanitize no se aplica al nombre original para display. | Asegurar que el nombre sanitizado se use para routing y el original solo para display. |
| 6 | 🟡 Medio | packages/effect-drizzle-sqlite/src/internal/drizzle-utils.ts:32 | **new Function() con input controlado (JIT compat check).** 
ew Function("input", '"use strict"; return input;')(true) — aunque el input es hardcoded (	rue), el patrón 
ew Function() es peligroso si alguien modifica esta función en el futuro para aceptar input externo. | Refactorizar para no usar 
ew Function(). Usar val con input controlado o simplemente verificar la existencia de JIT de otra forma. |
| 7 | 🟡 Medio | packages/opencode/src/tool/read.ts:29-37 | **Path traversal en Read tool.** filePath es proporcionado por el LLM. Aunque el tool usa ssertExternalDirectoryEffect y FSUtil.contains(), el offset/limit no tienen bound check además de NonNegativeInt. No hay validación de que filePath no contenga .. después de resolución simbólica. | Verificar que la ruta resuelta canónicamente (realpath) esté dentro del directorio del proyecto. |
| 8 | 🟢 Bajo | packages/opencode/src/tool/edit.ts:49-60 | **File lock con key basada en filePath resuelto.** Usa FSUtil.resolve(filePath) como key. Si el filePath contiene symlinks o rutas alternativas (p.ej., \\?\ en Windows), podría haber race condition. | Normalizar con s.realpathSync() antes de usar como key de lock. |
| 9 | 🟢 Bajo | packages/opencode/src/tool/webfetch.ts:158-192 | **HTML sin sanitizar convertido a Markdown.** El HTML fetchado se procesa con Turndown y se pasa al modelo. Si el HTML contiene texto malicioso diseñado para prompt injection, llegará al contexto del LLM. | Esto es inherente a la función de webfetch (el propósito es leer contenido web). Documentar el riesgo de prompt injection vía web content. |
| 10 | 🟢 Bajo | packages/opencode/src/tool/websearch.ts:57 | **Parallel API key en header.** La API key se pasa como Bearer token en header HTTP. Si el endpoint MCP es interceptado (MITM sin TLS), la key se expone. | Forzar HTTPS para endpoints MCP externos. |
| 11 | 🟢 Bajo | packages/desktop/src/main/wsl/sidecar.ts:39-42 | **Password de servidor se pasa por stdin al proceso WSL.** El password viaja en el script piped a stdin del proceso WSL. Otros procesos en WSL no pueden verlo (no es argumento de CLI), pero si WSL captura stdin, podría exponerse. | Usar un socket local con auth token de un solo uso. |

## Resumen

**Total: 11 | 🟠 Altos: 2 | 🟡 Medios: 5 | 🟢 Bajos: 4**

### Notas adicionales

- **Shell injection es el riesgo más grave**: Ambos tools (bash.ts y shell.ts) están diseñados para ejecutar comandos arbitrarios. La protección principal es la aprobación del usuario vía PermissionV2, que es un control administrativo (no técnico). Un usuario descuidado o un ataque de "confused deputy" donde el LLM convence al usuario de aprobar un comando malicioso es el threat model principal.
- **Tree-sitter parsing en shell.ts**: El shell tool usa tree-sitter para análisis AST, que se usa SOLO para permisos (preguntar al usuario sobre directorios externos). NO se usa para evitar injection — es una decisión de diseño deliberada (el tool debe poder ejecutar cualquier comando).
- **WebFetch URL validation**: Mínima. Solo controla que el esquema sea http/https. Un LLM comprometido podría usar webfetch para escanear la red interna (SSRF a 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.1).
- **No hay dangerouslySetInnerHTML ni innerHTML en producción** (solo en tests). Las UI usan frameworks que previenen XSS.
- **No hay postMessage inseguro** — el patrón postMessage en desktop se usa para IPC controlado entre procesos main/renderer.
