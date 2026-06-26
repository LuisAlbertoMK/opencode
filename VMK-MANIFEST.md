# vMK Manifest — opencode-vMK

> **Identificador único**: `luisAlbertoMK/opencode` — fork de `anomalyco/opencode`
> **Binario**: `opencode-vMK.exe`
> **Canon**: `vMK-dev`

## Propósito Fundamental

**vMK es un fork de opencode para experimentación segura y autónoma.** No reemplaza ni compite con la instalación global de opencode-ai — coexiste como un entorno autocontenido donde se puede modificar, parchar y personalizar opencode SIN poner en riesgo el uso diario estable.

## Principios Rectores

### 1. Aislamiento Total

vMK opera con su propio ecosistema de directorios, configuración y datos:

| Recurso | vMK | Global |
|---------|-----|--------|
| Binario | `opencode-vMK.exe` (en dist/) | `opencode.exe` (npm global) |
| Config | `.vmk-config/` | `~/.config/opencode/` |
| DB | `.vmk-data/` | `~/.local/share/opencode/` |
| Cache | `.vmk-cache/` | `~/.cache/opencode/` |
| Env vars | `vmk.cmd` (setea `OPENCODE_*` apuntando a local) | No aplica |

**Regla de oro**: vMK NUNCA debe tocar la instalación npm global de opencode-ai. Cero archivos fuera del repo.

### 2. Fork Responsable

vMK es un fork conciente — busca un equilibrio entre personalización y mantenibilidad:
- Los cambios al código fuente compartido (`packages/`) se marcan con `// vMK:` para tracking
- El objetivo NO es divergir del upstream, sino poder experimentar y eventualmente aportar fixes
- Sync periódico con `anomalyco/opencode` para no quedar obsoleto

### 3. Agente Propio

vMK incluye su propio sistema de agente (`gentleman-vMK`) con:
- Skills personalizadas (66 skills del repositorio gentleman-agent-gh)
- Ciclo de auto-mejora (self-improvement con inter-track, bitácora, ciclos)
- MCP servers (context7, engram) para documentación y memoria persistente
- Protocolo de verificación con subagentes (triple-verify)

### 4. Mejora Continua

vMK corre su propio ciclo de mejora:
- Diagnóstico con múltiples subagentes
- Fixes con verificación cruzada
- Registro en bitácora + inter-track
- Documentación de hallazgos y antipatrones
- Score de proyecto para tracking objetivo

## Zonas de Contención

| Zona | Archivos | Acción |
|------|----------|--------|
| 🟢 **VERDE** | `vmk.cmd`, `scripts/vmk-*`, `docs/vmk-*`, `.vmk-*`, `VMK-MANIFEST.md` | Modificar libremente |
| 🟡 **AMARILLO** | `packages/*/src/**`, `build.ts`, `turbo.json`, `AGENTS.md` | Documentar con `// vMK:` |
| 🔴 **ROJO** | `C:\...\npm\node_modules\opencode-ai\**`, `~/.opencode/bin/opencode.exe` | **NUNCA TOCAR** |

## Stack Técnico

- **Runtime**: Bun (v1.3.14+, package manager oficial)
- **Framework UI**: TUI (terminal UI propia)
- **Core**: TypeScript + Effect (v4) para lógica funcional
- **DB**: SQLite via Drizzle ORM + Effect
- **Build**: Bun.build() + compile → binario autocontenido
- **OS**: Windows (desarrollo principal), cross-compile a Linux/macOS disponible

## Repositorios Vinculados

- [gentleman-agent-gh](https://github.com/luisAlbertoMK/gentleman-agent-gh) — Skills, scripts y protocolos del agente
- [anomalyco/opencode](https://github.com/anomalyco/opencode) — Upstream (origen del fork)

## Historia

- **2026-06-22**: Compilación exitosa como `opencode-vMK.exe`. Análisis de debilidades del proyecto.
- **2026-06-24**: Fix del revert-loop bug (TUI + server race conditions). Creación de ANTI-PATTERN-CATALOG.md.
- **2026-06-25**: 5-subagentes analysis de mejoras. Creación de este manifiesto.
- **2026-06-25**: Contención implementada — `vmk.cmd` con aislamiento de config/DB/cache, directorios `.vmk-*`, alias `vmk` (PowerShell), safety check script, `.gitignore`. Score: 9.8/10.
