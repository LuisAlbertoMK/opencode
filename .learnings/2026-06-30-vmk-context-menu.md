# Sesión: vMK containment + context menu setup

## Goal
Configurar vMK para invocación segura desde cualquier directorio, agregar menú contextual en Explorer, y crear script portable para instalar en cualquier equipo.

## Aprendizajes Clave

### vMK alias en PowerShell Profile
- **Qué**: El alias `vmk` se carga desde `$PROFILE` dotsourceando `scripts/vmk-alias.ps1`
- **Por qué**: Para que `vmk` funcione desde cualquier directorio (Explorer incluido)
- **Dónde**: `C:\Users\MK\Documents\PowerShell\profile.ps1` → `D:\opencode\scripts\vmk-alias.ps1`
- **Detalle**: `vmk-alias.ps1` resuelve la raíz del repo desde `$PSScriptRoot\..`, no necesita paths hardcodeados. También activa ANSI VT processing via Win32 API para que el TUI se vea correctamente en PowerShell.

### Menú contextual vía Registry
- **Qué**: Se agregaron entradas "Open vMK here" y "Open PowerShell 7 here" al menú contextual de Explorer
- **Por qué**: Para acceder directamente desde el Explorador sin abrir terminal manualmente
- **Dónde**: `HKLM\SOFTWARE\Classes\Directory\Background\shell\`, `Directory\shell\`, `Drive\shell\`
- **Detalle**: Requiere admin (HKLM). Tres targets: background (click vacío), folder (click en carpeta), drive (click en unidad). El icono se toma de `opencode-vMK.exe` para identificación visual.

### Script portable vmk-install-context.ps1
- **Qué**: Script que instala/desinstala ambas entradas de menú contextual en cualquier equipo
- **Por qué**: Para portabilidad — ejecutarlo en cualquier máquina con el repo clonado configura todo automáticamente
- **Dónde**: `D:\opencode\scripts\vmk-install-context.ps1`
- **Detalle**: Auto-detecta rutas (repo root, pwsh.exe, opencode-vMK.exe), auto-eleva a admin, soporta `-Action install|uninstall`, modo silencioso con `-Force`.

### La barra de direcciones de Explorer NO es una terminal
- **Qué**: Escribir `vmk` en la barra del Explorer abre `http://vmk/` en el navegador
- **Por qué**: Windows trata texto sin ruta ni protocolo como nombre de host
- **Detalle**: Para ejecutar vMK desde Explorer: Ctrl+L → `pwsh` → en la terminal `vmk`; o click derecho → "Open vMK here".

## Decisiones
- El context menu de PowerShell 7 se agregó por separado del de vMK (PowerShell7 + vmk), no combinado en una sola opción.
- Se usó `-WorkingDirectory "%V"` para background y `Set-Location -literalPath '%V'` para folder/drive por diferencias en cómo Windows pasa el directorio en cada caso.

## Pendiente
- Probar benchmarks en vMK (próxima sesión)
