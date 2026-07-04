# Auditoria de Seguridad — Auth / Autorización

**Fecha:** 2026-07-03
**Auditor:** subagente (read-only)

## Hallazgos

| # | Severidad | Archivo:Línea | Descripción | Recomendación |
|---|---|---|---|---|
| 1 | 🟠 Alto | packages/opencode/src/control-plane/workspace.ts:546 | **Todas las credenciales de proveedores volcadas a env var.** OPENCODE_AUTH_CONTENT serializa TODAS las API keys (OpenAI, Anthropic, etc.) y las pasa como variable de entorno a subprocesos workspace. Los subprocesos heredan env vars sin restricción. | No pasar credenciales por env var. Usar socket/fifo temporal con permisos restrictivos o IPC con ámbito controlado. |
| 2 | 🟠 Alto | packages/opencode/src/auth/crypto.ts:7-9 | **Derivación de clave débil en AES-GCM.** Clave deriva de ${hostname}||opencode-auth-v1 con SHA-256. Determinista: misma máquina = misma clave. Sin password de usuario ni salt. Cualquiera con acceso al archivo cifrado puede descifrar. | Migrar a keychain del SO (libsecret, wincredential, Keychain). Como mínimo añadir salt aleatorio almacenado junto al ciphertext. |
| 3 | 🟡 Medio | packages/opencode/src/mcp/auth.ts:80 | **Archivo auth MCP (mcp-auth.json): cifrado con misma clave débil, permisos 0o600 correctos.** Contiene access/refresh tokens OAuth y client secrets de servidores MCP. | Aplicar mismas recomendaciones de cifrado que auth.json (#2). |
| 4 | 🟡 Medio | packages/opencode/src/auth/index.ts:73-77 | **OPENCODE_AUTH_CONTENT como override de entorno.** Si existe en entorno del proceso, salta el archivo cifrado y parsea JSON directamente. Canal alternativo de inyección de credenciales. | Usar solo desde código interno controlado. Validar contenido contra schema antes de usar. |
| 5 | 🟡 Medio | packages/server/src/middleware/authorization.ts:36-38 | **Server auth con Basic auth estático.** Contraseña en Base64 (reversible). Sin rate-limiting, account lockout, ni rotación. Redacted.value() en comparación — verificar que sea timing-safe. | Implementar rate-limiting en middleware de auth. Verificar implementación de Redacted. |
| 6 | 🟡 Medio | packages/opencode/src/permission/index.ts:39-47 | **Permission evaluate usa wildcard matching sin checks de integridad.** Un plugin que registre un ruleset con pattern permisivo puede obtener aprobación para acciones sensibles. | No hay separación de fuentes de rulesets. Considerar validar que rulesets de plugins no sean más permisivos que los del usuario. |
| 7 | 🟢 Bajo | packages/opencode/src/mcp/oauth-callback.ts:6 | **Callback server OAuth bindeado a 127.0.0.1.** Buen diseño. Incluye validación state (CSRF), timeout 5 min, cleanup. | Sin cambios urgentes. Agregar logging de state mismatch. |
| 8 | 🟢 Bajo | packages/opencode/src/mcp/oauth-provider.ts:51 | **client_secret_post si hay clientSecret.** Sin TLS forzado, el secret viaja en texto plano. | Forzar TLS para conexiones MCP remotas con client_secret. |
| 9 | 🟢 Bajo | packages/opencode/src/auth/index.ts:89-93 | **writeFileEncrypt + chmod no atómico.** Si write falla después de escribir pero antes de chmod, el archivo queda con permisos incorrectos. | Usar escritura a temp file + rename atómico. |
| 10 | 🟢 Bajo | packages/opencode/src/server/auth.ts:37 | **Flag.OPENCODE_SERVER_PASSWORD global mutable.** Accesible desde cualquier módulo. Posible filtración. | Migrar a Context.Tag scoped. |

## Resumen

**Total: 10 | 🟠 Altos: 2 | 🟡 Medios: 4 | 🟢 Bajos: 4**

### Notas adicionales

- **Threat model**: Herramienta single-user desktop. Riesgo principal: proceso malicioso en misma máquina (malware, subproceso workspace, otra app) accede a credenciales.
- **Permisos de archivos**: Correctos (0o600) en auth.json y mcp-auth.json.
- **CSRF en OAuth callback**: Correctamente implementado con state parameter + 127.0.0.1.
- **IDOR**: No aplica por ser single-user. No hay roles/usuarios en el sistema.
- **Workspace auth sandbox**: workspace.ts envía OPENCODE_AUTH_CONTENT a subprocesos. Esto es el mayor riesgo de auth identificado.
