<#
.SYNOPSIS
  Instala/desinstala "Open vMK here" y "Open PowerShell 7 here" en el menu contextual de Explorer.

.DESCRIPTION
  Agrega entradas al menu contextual de Windows Explorer (HKLM) para:
    - "Open vMK here"  → lanza opencode-vMK directamente en la carpeta seleccionada
    - "Open PowerShell 7 here" → lanza pwsh.exe en la carpeta seleccionada

  Funciona en background (espacio vacio), folder (icono de carpeta) y drive (unidades).

  Requiere ejecucion como Administrador (el script se auto-eleva si es necesario).

.PARAMETER Action
  install (default) | uninstall

.PARAMETER RepoRoot
  Ruta al repositorio opencode. Default: directorio padre del script (autodetect).

.PARAMETER PwshPath
  Ruta a pwsh.exe. Default: autodetect via Get-Command.

.PARAMETER Force
  Saltar confirmacion.

.EXAMPLE
  .\scripts\vmk-install-context.ps1 -Action install

.EXAMPLE
  .\scripts\vmk-install-context.ps1 -Action uninstall

.EXAMPLE
  .\scripts\vmk-install-context.ps1 -Action install -RepoRoot "D:\opencode" -Force
#>

param(
    [ValidateSet("install", "uninstall")]
    [string]$Action = "install",

    [string]$RepoRoot = "",

    [string]$PwshPath = "",

    [switch]$Force
)

$ErrorActionPreference = "Stop"

# ============================================================
# Auto-detect paths
# ============================================================
if (-not $RepoRoot) {
    $RepoRoot = Resolve-Path "$PSScriptRoot\.."
}

$script:aliasScript = Join-Path $RepoRoot "scripts\vmk-alias.ps1"
$script:vmkDistDir  = Join-Path $RepoRoot "packages\opencode\dist"

# Buscar el binario vMK
$script:vmkExe = Get-ChildItem -Path $vmkDistDir -Recurse -Filter "opencode-vMK.exe" -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
if (-not $script:vmkExe) {
    $script:vmkExe = Get-ChildItem -Path $RepoRoot -Recurse -Filter "opencode-vMK.exe" -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty FullName
}

# Buscar pwsh.exe
if (-not $PwshPath) {
    $PwshPath = (Get-Command pwsh.exe -ErrorAction SilentlyContinue).Source
}
if (-not $PwshPath -or -not (Test-Path $PwshPath)) {
    $candidates = @(
        "C:\Program Files\PowerShell\7\pwsh.exe",
        "C:\Program Files\PowerShell\6\pwsh.exe",
        "$env:LOCALAPPDATA\Microsoft\WindowsApps\pwsh.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { $PwshPath = $c; break }
    }
}

# ============================================================
# Verificaciones
# ============================================================
$errors = @()
if (-not (Test-Path $script:aliasScript)) {
    $errors += "No se encontro vmk-alias.ps1 en $RepoRoot\scripts\"
}
if (-not $script:vmkExe) {
    $errors += "No se encontro opencode-vMK.exe en $RepoRoot. Compila primero con: .\vmk.cmd --build"
}
if (-not $PwshPath -or -not (Test-Path $PwshPath)) {
    $errors += "No se encontro PowerShell 7 (pwsh.exe). Instalalo desde: https://github.com/PowerShell/PowerShell"
}

if ($errors.Count -gt 0) {
    Write-Host "`n=== ERRORES DE CONFIGURACION ===" -ForegroundColor Red
    foreach ($e in $errors) { Write-Host "  - $e" -ForegroundColor Yellow }
    exit 1
}

# ============================================================
# Auto-elevacion (requiere admin para HKLM)
# ============================================================
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[vMK] Elevando a Administrador..." -ForegroundColor Cyan
    $params = @(
        "-ExecutionPolicy", "Bypass"
        "-File", "`"$PSCommandPath`""
        "-Action", $Action
        "-RepoRoot", "`"$RepoRoot`""
        "-PwshPath", "`"$PwshPath`""
    )
    if ($Force) { $params += "-Force" }
    Start-Process -FilePath "powershell.exe" -ArgumentList $params -Verb RunAs -Wait
    exit 0
}

# ============================================================
# Funciones
# ============================================================
function Install-ContextMenu {
    Write-Host "`n=== Instalando menu contextual vMK ===" -ForegroundColor Cyan
    Write-Host "  Repositorio : $RepoRoot" -ForegroundColor Gray
    Write-Host "  vMK binary  : $script:vmkExe" -ForegroundColor Gray
    Write-Host "  pwsh.exe    : $PwshPath" -ForegroundColor Gray
    Write-Host "  alias script: $script:aliasScript" -ForegroundColor Gray

    if (-not $Force) {
        $confirm = Read-Host "`nConfirmar instalacion? (S/n)"
        if ($confirm -eq "n" -or $confirm -eq "N") { Write-Host "Cancelado."; exit 0 }
    }

    # --- PowerShell 7 entries ---
    Add-ContextEntry -Name "PowerShell7" -Label "Open PowerShell 7 here" -Icon "`"$PwshPath`",0" -Command "`"$PwshPath`" -noexit -WorkingDirectory `"%V`"" -FolderCommand "`"$PwshPath`" -noexit -command Set-Location -literalPath '%V'"

    # --- vMK entries ---
    Add-ContextEntry -Name "vmk" -Label "Open vMK here" -Icon "`"$script:vmkExe`",0" -Command "`"$PwshPath`" -noexit -WorkingDirectory `"%V`" -Command `. `"$script:aliasScript`"; vmk" -FolderCommand "`"$PwshPath`" -noexit -command `. `"$script:aliasScript`"; Set-Location -literalPath '%V'; vmk"

    Write-Host "`n[OK] Instalacion completada." -ForegroundColor Green
    Write-Host "Refresca Explorer o reinicia para ver los cambios." -ForegroundColor Cyan
    Write-Host "  taskkill /f /im explorer.exe && start explorer.exe" -ForegroundColor Gray
}

function Add-ContextEntry {
    param(
        [string]$Name,
        [string]$Label,
        [string]$Icon,
        [string]$Command,        # Background (WorkingDirectory nativo)
        [string]$FolderCommand   # Folder/Drive (Set-Location explicito)
    )

    # Background (right-click empty space)
    $bgPath = "HKLM:\SOFTWARE\Classes\Directory\Background\shell\$Name"
    New-Item -Path $bgPath -Force | Out-Null
    Set-ItemProperty -Path $bgPath -Name "(default)" -Value $Label
    Set-ItemProperty -Path $bgPath -Name "Icon" -Value $Icon
    $bgCmd = "$bgPath\command"
    New-Item -Path $bgCmd -Force | Out-Null
    Set-ItemProperty -Path $bgCmd -Name "(default)" -Value $Command

    # Folder (right-click on folder icon)
    $dirPath = "HKLM:\SOFTWARE\Classes\Directory\shell\$Name"
    New-Item -Path $dirPath -Force | Out-Null
    Set-ItemProperty -Path $dirPath -Name "(default)" -Value $Label
    Set-ItemProperty -Path $dirPath -Name "Icon" -Value $Icon
    $dirCmd = "$dirPath\command"
    New-Item -Path $dirCmd -Force | Out-Null
    Set-ItemProperty -Path $dirCmd -Name "(default)" -Value $FolderCommand

    # Drive (right-click on drive icon)
    $drvPath = "HKLM:\SOFTWARE\Classes\Drive\shell\$Name"
    New-Item -Path $drvPath -Force | Out-Null
    Set-ItemProperty -Path $drvPath -Name "(default)" -Value $Label
    Set-ItemProperty -Path $drvPath -Name "Icon" -Value $Icon
    $drvCmd = "$drvPath\command"
    New-Item -Path $drvCmd -Force | Out-Null
    Set-ItemProperty -Path $drvCmd -Name "(default)" -Value $FolderCommand

    Write-Host "  [OK] $Label" -ForegroundColor Green
}

function Uninstall-ContextMenu {
    Write-Host "`n=== Desinstalando menu contextual vMK ===" -ForegroundColor Cyan

    if (-not $Force) {
        $confirm = Read-Host "`nEliminar entradas 'Open vMK here' y 'Open PowerShell 7 here' del menu contextual? (S/n)"
        if ($confirm -eq "n" -or $confirm -eq "N") { Write-Host "Cancelado."; exit 0 }
    }

    $entries = @("vmk", "PowerShell7")
    $paths = @(
        "HKLM:\SOFTWARE\Classes\Directory\Background\shell",
        "HKLM:\SOFTWARE\Classes\Directory\shell",
        "HKLM:\SOFTWARE\Classes\Drive\shell"
    )

    $removed = 0
    foreach ($name in $entries) {
        foreach ($base in $paths) {
            $target = "$base\$name"
            if (Test-Path $target) {
                Remove-Item -Path $target -Recurse -Force
                Write-Host "  [OK] Eliminado: $target" -ForegroundColor Green
                $removed++
            }
        }
    }

    if ($removed -eq 0) {
        Write-Host "  [AVISO] No se encontraron entradas para eliminar." -ForegroundColor Yellow
    } else {
        Write-Host "`n[OK] Desinstalacion completada. $removed entrada(s) eliminada(s)." -ForegroundColor Green
    }
}

# ============================================================
# Main
# ============================================================
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  vMK Context Menu Installer" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

switch ($Action) {
    "install"   { Install-ContextMenu }
    "uninstall" { Uninstall-ContextMenu }
}
