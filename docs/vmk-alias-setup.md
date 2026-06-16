# vmk — Alias para build local de opencode

## Petición

Poder ejecutar el binario compilado localmente de opencode (build de desarrollo) desde cualquier directorio/proyecto, con un comando corto, de la misma forma que se ejecuta `opencode` (que apunta al binario oficial instalado en `~/.opencode/bin/`).

## Binario local

```
packages/opencode/dist/opencode-windows-x64/bin/opencode-vMK.exe
```

## Error

```
New-Item -ItemType SymbolicLink
→ Se necesitan privilegios de administrador para esta operación.
```

PowerShell 5.1 no permite crear symlinks sin permisos de administrador (Developer Mode desactivado).

## Solución aplicada

**Hard link** en `~/.opencode/bin/` (directorio que ya está en el PATH):

```powershell
New-Item -ItemType HardLink -Path "$env:USERPROFILE\.opencode\bin\vmk.exe" -Target "ruta\al\binario\local\opencode-vMK.exe"
```

Un hard link es una entrada de directorio adicional que apunta al mismo archivo físico en disco. No ocupa espacio extra, no requiere permisos especiales, y el binario se ejecuta directamente (sin wrapper).

## Resultado

```powershell
vmk --version
→ 0.0.0-dev-202606151946
```

Se puede ejecutar `vmk` desde cualquier terminal o proyecto sin necesidad de estar en el directorio del build.

## Archivos involucrados

| Archivo | Rol |
|---------|-----|
| `packages/opencode/dist/opencode-windows-x64/bin/opencode-vMK.exe` | Build local de desarrollo |
| `~/.opencode/bin/vmk.exe` | Hard link (alias) en el PATH |
| `~/.opencode/bin/opencode.exe` | Binario oficial (intacto) |

## Comandos disponibles

| Comando | Binario | Uso |
|---------|---------|-----|
| `opencode` | Oficial (`~/.opencode/bin/opencode.exe`) | Producción |
| `vmk` | Build local (`opencode-vMK.exe`) | Desarrollo |
