# Sesión: Diagnóstico MCP Servers + Análisis de Mejora

## Goal
Diagnosticar el estado de los MCP servers del proyecto vMK (context7, engram, codebase-memory) y definir por dónde empezar a mejorar.

## Aprendizajes Clave

### 1. context7 funciona correctamente
- **Qué**: context7 está conectado y operativo
- **Por qué**: Se ejecuta via `@upstash/context7-mcp` desde `D:\gentleman-agent-gh\opencode.json` (remote HTTP)

### 2. codebase-memory está deshabilitado intencionalmente
- **Qué**: `"enabled": false` en `.opencode/opencode.jsonc`
- **Por qué**: Decisión previa — no se ha necesitado o requiere configuración adicional
- **Dónde**: `.opencode/opencode.jsonc` línea 10
- **Detalle**: Definido como `"command": ["codebase-memory-mcp"]`, el binario existe en `C:\Users\MK\AppData\Roaming\npm\codebase-memory-mcp.ps1`

### 3. engram MCP error -32000: connection closed
- **Qué**: El MCP server engram falla al conectar con error -32000
- **Por qué**: El binario `engram.exe` (v1.16.3) existe y responde OK en CLI (`engram mcp --tools=agent`), pero opencode no logra mantener la conexión STDIO abierta
- **Dónde**: Config en `.opencode/opencode.jsonc` línea 15 — `"command": ["engram"]`, `"timeout": 120000`
- **Detalle**: Posible incompatibilidad de protocolo MCP entre engram y opencode, o timeout de handshake

### 4. Discrepancia de configs entre repos
- **Qué**: `D:\opencode\.opencode\opencode.jsonc` (proyecto vMK) tiene MCP diferente a `D:\gentleman-agent-gh\opencode.json` (repo del agente)
- **Por qué**: El agente gentleman-vMK referencia skills desde gentleman-agent-gh pero MCP se configura localmente
- **Diferencia clave**: gentleman-agent-gh tiene `context7`, `engram`, `sequential-thinking` con configs completas (environment, timeout). vMK solo tiene `codebase-memory` y `engram` sin `context7`.

### 5. Cycle 6 recién empezado
- **Qué**: Cycle 6 (Resource Optimization) está en estado inicial — 0/30 inter, sin tareas definidas
- **Por qué**: Se inició 2026-06-29 pero no se avanzó
- **Dónde**: `CYCLE.md`

## Decisiones
- No compilar/build para no afectar la sesión actual
- Priorizar fix de engram MCP sobre otros issues
- codebase-memory puede habilitarse si es necesario
- context7 no está configurado en .opencode/opencode.jsonc local — solo en gentleman-agent-gh

## Pendiente
- [ ] Arreglar engram MCP — error -32000 connection closed
- [ ] Evaluar si agregar context7 al .opencode/opencode.jsonc local
- [ ] Decidir si habilitar codebase-memory
- [ ] Definir tareas de Cycle 6 (Resource Optimization)
