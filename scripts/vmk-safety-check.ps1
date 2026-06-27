# ============================================================
# vMK Safety Check - Verificacion de Contencion
# ============================================================
# Uso: Ejecutar ANTES de builds o modificaciones importantes
#      .\scripts\vmk-safety-check.ps1 [-TargetFile "path"]
# ============================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$TargetFile,

    [Parameter(Mandatory=$false)]
    [switch]$CheckBuild,

    [Parameter(Mandatory=$false)]
    [switch]$CheckGlobal
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent

# --- Patrones de zona roja (NUNCA TOCAR) ---
$globalPatterns = @(
    @{ Pattern = "node_modules\\opencode-ai"; Description = "npm global install" },
    @{ Pattern = "AppData.*npm.*opencode"; Description = "npm binary path" },
    @{ Pattern = "\\.opencode\\bin\\opencode\\.exe"; Description = "global opencode binary" },
    @{ Pattern = "npm.*install.*-g.*opencode"; Description = "global install command" },
    @{ Pattern = "bun.*install.*-g.*opencode"; Description = "global bun install" }
)

# --- Patrones de zona amarilla (requieren documentacion) ---
$sharedPatterns = @(
    @{ Pattern = "packages\\opencode\\src\\"; Description = "shared source code" },
    @{ Pattern = "packages\\core\\src\\"; Description = "core library" },
    @{ Pattern = "packages\\tui\\src\\"; Description = "TUI library" },
    @{ Pattern = "build\\.ts"; Description = "build script" }
)

function Test-Violation {
    param([string]$Path, [array]$Patterns)

    foreach ($p in $Patterns) {
        if ($Path -match $p.Pattern) {
            return @{
                Match = $true
                Pattern = $p.Pattern
                Description = $p.Description
            }
        }
    }
    return @{ Match = $false }
}

# ============================================================
# MODO: Verificar archivo especifico
# ============================================================
if ($TargetFile) {
    Write-Host "`n=== vMK Safety Check ===" -ForegroundColor Cyan
    Write-Host "Archivo: $TargetFile`n"

    $globalResult = Test-Violation -Path $TargetFile -Patterns $globalPatterns
    if ($globalResult.Match) {
        Write-Host "ALERTA ROJA - NO MODIFICAR" -ForegroundColor Red
        Write-Host "   patron: $($globalResult.Pattern)" -ForegroundColor Yellow
        Write-Host "   razon: $($globalResult.Description)" -ForegroundColor Yellow
        Write-Host "   accion: STOP. Este archivo pertenece a la instalacion global.`n"
        exit 1
    }

    $sharedResult = Test-Violation -Path $TargetFile -Patterns $sharedPatterns
    if ($sharedResult.Match) {
        Write-Host "AVISO AMARILLO - Requiere documentacion" -ForegroundColor Yellow
        Write-Host "   patron: $($sharedResult.Pattern)" -ForegroundColor Gray
        Write-Host "   razon: $($sharedResult.Description)" -ForegroundColor Gray
        Write-Host "   accion: Documentar intencion vMK con tag // vMK:`n"
        exit 0
    }

    Write-Host "ZONA VERDE - Seguro para modificar`n" -ForegroundColor Green
    exit 0
}

# ============================================================
# MODO: Verificar build reciente
# ============================================================
if ($CheckBuild) {
    Write-Host "`n=== vMK Build Verification ===" -ForegroundColor Cyan

    $distPath = Join-Path $repoRoot "packages\opencode\dist"
    $binaries = Get-ChildItem -Path $distPath -Recurse -Filter "*.exe" -ErrorAction SilentlyContinue

    if (-not $binaries) {
        Write-Host "No se encontraron binarios en dist/" -ForegroundColor Yellow
        exit 0
    }

    foreach ($bin in $binaries) {
        if ($bin.Name -match "vMK") {
            Write-Host "[OK] $($bin.Name) - vMK binary correcto" -ForegroundColor Green
        } elseif ($bin.Name -match "opencode" -and $bin.Name -notmatch "vMK") {
            Write-Host "[PELIGRO] $($bin.Name) - Binary global detectado en dist/" -ForegroundColor Red
            Write-Host "   Esto NO deberia existir. Verificar el build.`n"
            exit 1
        }
    }
    exit 0
}

# ============================================================
# MODO: Verificar entorno global
# ============================================================
if ($CheckGlobal) {
    Write-Host "`n=== vMK Global Environment Check ===" -ForegroundColor Cyan

    # Verificar npm global
    $npmVersion = npm list -g opencode-ai 2>$null | Select-String "opencode-ai@(\d+\.\d+\.\d+)" | ForEach-Object { $_.Matches[0].Groups[1].Value }
    if ($npmVersion) {
        Write-Host "[OK] npm global: opencode-ai@$npmVersion" -ForegroundColor Green
    } else {
        Write-Host "[AVISO] No se pudo determinar la version global de opencode" -ForegroundColor Yellow
    }

    # Verificar directorios de aislamiento
    $dirs = @(
        @{ Path = Join-Path $repoRoot ".vmk-config"; Name = ".vmk-config" },
        @{ Path = Join-Path $repoRoot ".vmk-data"; Name = ".vmk-data" },
        @{ Path = Join-Path $repoRoot ".vmk-cache"; Name = ".vmk-cache" }
    )

    foreach ($d in $dirs) {
        if (Test-Path $d.Path) {
            Write-Host "[OK] $($d.Name) existe" -ForegroundColor Green
        } else {
            Write-Host "[AVISO] $($d.Name) no existe - crearlo primero" -ForegroundColor Yellow
        }
    }

    # Verificar vmk.cmd
    if (Test-Path (Join-Path $repoRoot "vmk.cmd")) {
        Write-Host "[OK] vmk.cmd existe" -ForegroundColor Green
    } else {
        Write-Host "[PELIGRO] vmk.cmd no existe" -ForegroundColor Red
    }

    exit 0
}

# ============================================================
# MODO: Verificar dependencias vMK (Catalog integrity)
# ============================================================
function Check-CatalogIntegrity {
    Write-Host "`n=== Catalog Integrity Check ===" -ForegroundColor Cyan
    $issues = 0

    # Verificar que @opentui/core NO este pinned en packages/opencode
    $opencodePkg = Join-Path $repoRoot "packages\opencode\package.json"
    if (Test-Path $opencodePkg) {
        $content = Get-Content $opencodePkg -Raw
        if ($content -match '"@opentui/core":\s*"(?!catalog:)') {
            Write-Host "[PELIGRO] @opentui/core esta PINNEADO en packages/opencode (NO catalog:)" -ForegroundColor Red
            Write-Host "         Esto causa typecheck errors en TUI (dos versiones de @opentui/keymap)" -ForegroundColor Red
            Write-Host "         Fix: cambiar a 'catalog:' en packages/opencode/package.json" -ForegroundColor Yellow
            $issues++
        } else {
            Write-Host "[OK] @opentui/core usa catalog: en packages/opencode" -ForegroundColor Green
        }
    }

    # Verificar todos los packages que usan @opentui
    Get-ChildItem (Join-Path $repoRoot "packages") -Recurse -Depth 0 -Filter "package.json" | ForEach-Object {
        $pkgContent = Get-Content $_.FullName -Raw
        if ($pkgContent -match '"@opentui/[a-z]+":\s*"(?!catalog:)([^"]+)"') {
            Write-Host "[AVISO] $($_.FullName): @opentui/$($Matches[1]) pinneado" -ForegroundColor Yellow
            $issues++
        }
    }

    if ($issues -eq 0) {
        Write-Host "[OK] Todos los @opentui/* usan catalog:" -ForegroundColor Green
    } else {
        Write-Host "[WARN] $issues issue(s) de integridad de catalog encontrados" -ForegroundColor Yellow
    }
}

# ============================================================
# MODO: Verificacion completa (sin parametros)
# ============================================================
Write-Host "`n=== vMK Containment Status ===" -ForegroundColor Cyan

# Verificar entorno
& $PSCommandPath -CheckGlobal

# Verificar binarios
& $PSCommandPath -CheckBuild

# Verificar integridad de catalog
Check-CatalogIntegrity

Write-Host "`n=== Uso ===" -ForegroundColor Gray
Write-Host "  .\vmk-safety-check.ps1 -TargetFile 'path\to\file'  # Verificar archivo"
Write-Host "  .\vmk-safety-check.ps1 -CheckBuild                 # Verificar build"
Write-Host "  .\vmk-safety-check.ps1 -CheckGlobal                # Verificar entorno"
Write-Host "  .\vmk-safety-check.ps1                             # Verificacion completa`n"
