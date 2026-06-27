# ============================================================
# vMK Containment — PowerShell Alias para Invocacion Segura
# ============================================================
# Uso: Dot-source en tu PowerShell Profile
#      . "D:\opencode\scripts\vmk-alias.ps1"
# Luego simplemente: vmk [args]
# Funciona desde CUALQUIER directorio.
# ============================================================

# Raiz del repo = directorio padre del script
$script:vmkRepoRoot = Resolve-Path "$PSScriptRoot\.."

# --- Auto-habilitar ANSI VT processing (Windows 10+) ---
# Evita que binarios con colores/ANSI (como opencode-vMK) muestren
# escapes crudos tipo [I[555;...] en PowerShell 5.1/CMD clasico.
# Funciona sin registry ni terminal moderno.
$script:ansiEnabled = $false
function Enable-ANSIConsole {
    if ($script:ansiEnabled) { return }
    try {
        $script:ansiCode = @'
using System;
using System.Runtime.InteropServices;
public static class ConsoleANSI {
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool SetConsoleMode(IntPtr hConsoleHandle, uint dwMode);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool GetConsoleMode(IntPtr hConsoleHandle, out uint lpMode);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr GetStdHandle(uint nStdHandle);
}
'@
        if (-not ('ConsoleANSI' -as [type])) {
            Add-Type -TypeDefinition $script:ansiCode -ErrorAction Stop
        }
        $handle = [ConsoleANSI]::GetStdHandle(0xFFFFFFF5) # STD_OUTPUT_HANDLE
        $mode = 0
        if ([ConsoleANSI]::GetConsoleMode($handle, [ref]$mode)) {
            $mode = $mode -bor 0x0004 # ENABLE_VIRTUAL_TERMINAL_PROCESSING
            [ConsoleANSI]::SetConsoleMode($handle, $mode) | Out-Null
        }
        $script:ansiEnabled = $true
    } catch {
        # Si falla (entorno restringido), continuar sin ANSI
        $script:ansiEnabled = $false
    }
}

function Invoke-vMK {
    <#
    .SYNOPSIS
        Ejecuta opencode-vMK con aislamiento completo vs global.
    .DESCRIPTION
        Establece todas las env vars necesarias para aislar
        la configuracion, base de datos y cache de vMK
        respecto a la instalacion global de opencode.
        Funciona desde cualquier directorio.
    .PARAMETER args
        Argumentos pasados directamente a opencode-vMK.
    .EXAMPLE
        vmk
        vmk --help
        vmk session list
    #>
    [CmdletBinding()]
    param(
        [Parameter(ValueFromRemainingArguments)]
        [string[]]$args
    )

    $root = $script:vmkRepoRoot

    # --- Aislamiento de Config/Data/Cache ---
    $env:OPENCODE_CONFIG_DIR = Join-Path $root ".vmk-config"
    $env:OPENCODE_DB = Join-Path $root ".vmk-data\opencode.db"
    $env:OPENCODE_CACHE_DIR = Join-Path $root ".vmk-cache"

    # --- Optimizaciones de memoria vMK ---
    $env:OPENCODE_AUTO_HEAP_SNAPSHOT = "true"
    $env:OPENCODE_DISABLE_MODELS_FETCH = "true"
    $env:OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER = "true"
    $env:OPENCODE_DISABLE_EMBEDDED_WEB_UI = "true"

    # --- Canal de desarrollo vMK ---
    $env:OPENCODE_CHANNEL = "vMK-dev"

    # --- Auto-descubrir binario vMK ---
    $searchPaths = @(
        Join-Path $root "packages\opencode\dist"
        Join-Path $root "packages"
    )

    $vmkExe = $null
    foreach ($sp in $searchPaths) {
        $vmkExe = Get-ChildItem -Path $sp -Recurse -Filter "opencode-vMK.exe" -ErrorAction SilentlyContinue |
            Select-Object -First 1 -ExpandProperty FullName
        if ($vmkExe) { break }
    }

    if (-not $vmkExe) {
        Write-Host "ERROR: opencode-vMK.exe no encontrado en $root" -ForegroundColor Red
        Write-Host "Compila primero:" -ForegroundColor Cyan
        Write-Host "  `$env:OPENCODE_CHANNEL=`"vMK-dev`"; bun run --cwd packages/opencode build -- --skip-embed-web-ui" -ForegroundColor Gray
        return
    }

    # Activar ANSI VT processing para que el TUI del binario se vea bien
    Enable-ANSIConsole

    Write-Host "[vMK] Usando: $vmkExe" -ForegroundColor DarkGray
    & $vmkExe @args
}

# Alias para uso rapido
Set-Alias -Name vmk -Value Invoke-vMK

Write-Host "Alias vMK cargado. Usa 'vmk' desde cualquier directorio." -ForegroundColor Green
