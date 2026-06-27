#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Clean rebuild for vMK fork — kills processes, removes dist, rebuilds with safety checks.
.DESCRIPTION
    Automated workflow: Kill opencode/vMK processes → Clean dist (with lock retry) → Build → Verify.
    Follows vMK Containment Protocol (GREEN zone script).
.PARAMETER NoWebUi
    Skip embedding web UI (~50MB faster build).
.PARAMETER Channel
    Build channel (default: vMK-dev).
.PARAMETER SkipSafetyCheck
    Skip pre/post build safety verification (not recommended).
.EXAMPLE
    .\scripts\rebuild-vmk-clean.ps1 -NoWebUi
.EXAMPLE
    .\scripts\rebuild-vmk-clean.ps1 -Channel "vMK-test"
#>

param(
    [switch]$NoWebUi,
    [string]$Channel = "vMK-dev",
    [switch]$SkipSafetyCheck
)

$ErrorActionPreference = "Stop"
$scriptRoot = Split-Path $PSScriptRoot -Parent
$distPath = Join-Path $scriptRoot "packages\opencode\dist"
$buildScript = Join-Path $scriptRoot "packages\opencode\script\build.ts"
$safetyCheck = Join-Path $scriptRoot "scripts\vmk-safety-check.ps1"

function Write-Step { param([string]$Msg) Write-Host "`n=== $Msg ===" -ForegroundColor Cyan }
function Write-Ok   { param([string]$Msg) Write-Host "  [OK] $Msg" -ForegroundColor Green }
function Write-Warn { param([string]$Msg) Write-Host "  [WARN] $Msg" -ForegroundColor Yellow }
function Write-Err  { param([string]$Msg) Write-Host "  [ERR] $Msg" -ForegroundColor Red }

# --- 1. Pre-build Safety Check ---
if (-not $SkipSafetyCheck) {
    Write-Step "Pre-build Safety Check"
    & $safetyCheck -CheckGlobal
    if ($LASTEXITCODE -ne 0) { Write-Err "Safety check failed. Abort."; exit $LASTEXITCODE }
    Write-Ok "Environment verified"
}

# --- 2. Kill ALL opencode processes (npm + vMK) ---
Write-Step "Killing opencode processes"
$processes = Get-CimInstance Win32_Process -Filter "Name LIKE 'opencode%'" |
    Select-Object ProcessId, Name, CommandLine, @{N='RAM(MB)';E={[math]::Round($_.WorkingSetSize/1MB,1)}}

if ($processes) {
    foreach ($p in $processes) {
        $src = if ($p.CommandLine -match 'opencode-vMK') { "vMK (fork)" }
               elseif ($p.CommandLine -match 'AppData.*npm') { "npm (original)" }
               else { "unknown" }
        try {
            Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
            Write-Ok "Killed PID $($p.ProcessId) ($src) - freed ~$($p.'RAM(MB)')MB"
        } catch {
            Write-Warn "Could not kill PID $($p.ProcessId): $_"
        }
    }
    Start-Sleep -Seconds 1  # Allow file locks to release
} else {
    Write-Ok "No opencode processes running"
}

# --- 3. Clean dist folder (with lock retry) ---
Write-Step "Cleaning dist folder"
if (Test-Path $distPath) {
    $maxRetries = 5
    $retryDelay = 1
    for ($i = 1; $i -le $maxRetries; $i++) {
        try {
            Remove-Item -Path $distPath -Recurse -Force -ErrorAction Stop
            Write-Ok "Removed $distPath"
            break
        } catch {
            if ($i -eq $maxRetries) {
                Write-Err "Failed to remove dist after $maxRetries retries: $_"
                Write-Warn "Try manually: Remove-Item -Path '$distPath' -Recurse -Force"
                exit 1
            }
            Write-Warn "Dist locked (attempt $i/$maxRetries), waiting ${retryDelay}s..."
            Start-Sleep -Seconds $retryDelay
            $retryDelay *= 2
        }
    }
} else {
    Write-Ok "Dist folder already clean"
}

# --- 4. Build ---
Write-Step "Building vMK binary (Channel: $Channel)"
$env:OPENCODE_CHANNEL = $Channel
$bunArgs = @("run", "--cwd", "packages/opencode", "build")
if ($NoWebUi) { $bunArgs += "--", "--skip-embed-web-ui" }

Write-Host "  Running: bun $bunArgs"
& "bun" $bunArgs
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
    Write-Err "Build failed with exit code $exitCode"
    exit $exitCode
}
Write-Ok "Build completed"

# --- 5. Post-build Safety Check ---
if (-not $SkipSafetyCheck) {
    Write-Step "Post-build Safety Check"
    & $safetyCheck -CheckBuild
    if ($LASTEXITCODE -ne 0) { Write-Err "Build verification failed!"; exit $LASTEXITCODE }
    Write-Ok "Binary verified: only opencode-vMK.exe in dist/"
}

# --- 6. Summary ---
$binary = Join-Path $distPath "opencode-windows-x64\bin\opencode-vMK.exe"
if (Test-Path $binary) {
    $size = [math]::Round((Get-Item $binary).Length / 1MB, 1)
    Write-Step "Build Successful"
    Write-Ok "Binary: $binary ($size MB)"
    Write-Ok "Run with: .\vmk.cmd  (or dot-source vmk-alias.ps1 then 'vmk')"
} else {
    Write-Err "Binary not found at expected path: $binary"
    exit 1
}