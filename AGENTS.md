# OpenCode Agent Guide

> Entry point for project-level agent rules. Sections are modularized for
> maintainability — see each file below for full details.

## Project Quick Reference

- To regenerate the JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- The default branch in this repo is `dev`.
- Local `main` ref may not exist; use `dev` or `origin/dev` for diffs.

## Branch Names

Use a short branch name of at most three words, separated by hyphens. Do not use slashes or type prefixes such as `feat/` or `fix/`.

Examples: `session-recovery`, `fix-scroll-state`, `regenerate-sdk`.

## Commits and PR Titles

Use conventional commit-style messages and PR titles: `type(scope): summary`.

Valid types are `feat`, `fix`, `docs`, `chore`, `refactor`, and `test`. Scopes are optional; use the affected package or area when helpful, e.g. `core`, `opencode`, `tui`, `app`, `desktop`, `sdk`, or `plugin`.

Examples: `fix(tui): simplify thinking toggle styling`, `docs: update contributing guide`, `chore(sdk): regenerate types`.

## vMK Containment Protocol

> **REGLA CRÍTICA**: Las modificaciones en D:\opencode NUNCA deben afectar
> la instalación global de opencode (npm global). El comportamiento
> específico de vMK se controla via env vars en vmk.cmd, NO via
> modificaciones al source compartido.

### Zonas de Archivos

| Zona | Archivos | Acción |
|------|----------|--------|
| 🟢 VERDE | `vmk.cmd`, `scripts/vmk-*`, `docs/vmk-*` | Modificar libremente |
| 🟡 AMARILLO | `packages/*/src/**`, `build.ts` | Documentar intención vMK + tag `// vMK:` |
| 🔴 ROJO | `C:\...\npm\node_modules\opencode-ai\**`, `~/.opencode/bin/opencode.exe` | **NUNCA TOCAR** |

### Verificación Obligatoria

**Antes de CUALQUIER modificación:**
1. ¿El archivo está en ZONA VERDE? → Proceder libremente
2. ¿El archivo está en ZONA AMARILLO? → Documentar intención vMK
3. ¿El archivo está en ZONA ROJA? → STOP. No modificar.

**Post-build:**
- El binario DEBE llamarse `opencode-vMK.exe`, NUNCA `opencode.exe`
- Verificar con: `.\scripts\vmk-safety-check.ps1 -CheckBuild`

### Comandos Prohibidos

- ❌ `npm install -g opencode-ai` desde este repo
- ❌ `npm link` / `bun link` desde `packages/opencode/`
- ❌ `npm publish` desde este repo
- ❌ Ejecutar `opencode` directamente (sin vmk.cmd)

### Invocación Segura

```powershell
# SIEMPRE usar vmk.cmd o el alias vmk
.\vmk.cmd                    # Opción 1: batch file
vmk                          # Opción 2: PowerShell alias (requiere . .\scripts\vmk-alias.ps1)
```

### Scripts de Verificación

```powershell
.\scripts\vmk-safety-check.ps1                    # Verificación completa
.\scripts\vmk-safety-check.ps1 -TargetFile "path" # Verificar archivo
.\scripts\vmk-safety-check.ps1 -CheckBuild        # Verificar build
.\scripts\vmk-safety-check.ps1 -CheckGlobal       # Verificar entorno
```

Ver también: `docs/vmk-containment-brainstorm.md` para el análisis completo.

---

## Modules

| Topic | File | Description |
|-------|------|-------------|
| Style Guide | [`.opencode/style-guide.md`](.opencode/style-guide.md) | TS code style: imports, destructuring, control flow, Effect patterns, Drizzle schemas, **TUI text wrapping rules** |
| Testing | [`.opencode/testing.md`](.opencode/testing.md) | Test philosophy, mock avoidance, type checking |
| V2 Session Core | [`specs/v2/session.md`](specs/v2/session.md) | Session V2 architecture: prompt admission, execution, delivery, system context |
| Skills Index | [`SKILLS-INDEX.md`](SKILLS-INDEX.md) | Agent skills catalog: installed + roadmap |
| Improvement Cycle | [`CYCLE.md`](CYCLE.md) | Current improvement cycle, metrics, tasks |
