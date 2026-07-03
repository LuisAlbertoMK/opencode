<#
.SYNOPSIS
  vMK Binary Benchmark — cold boot timing + binary size + smoke test
  for opencode-vMK.exe compiled binaries.

.DESCRIPTION
  Measures:
    - Binary file size (bytes + MB)
    - Cold boot --help time (avg of $Runs runs)
    - Smoke test: --version exit code
    - OS/branch/Bun version metadata

  Saves results to docs/metricas/bench-{label}-{branch}.json

.PARAMETER BinaryPath
  Path to opencode-vMK.exe. Default: auto-detect in dist/

.PARAMETER Runs
  Number of cold-boot timing runs (default: 5)

.PARAMETER Label
  Label for output file (e.g. "baseline", "post-opt"). Default: "post-opt"

.PARAMETER Save
  Save results to docs/metricas/ (default: $true)

.PARAMETER Verbose
  Show per-run timings

.EXAMPLE
  .\scripts\vmk-bench.ps1 -Label "post-cycle6" -Runs 3 -Verbose

.NOTES
  #vMK: Binary performance benchmark — cold boot, binary size, smoke test
#>

param(
  [string]$BinaryPath = "",
  [int]$Runs = 5,
  [int]$WarmupRuns = 3,
  [string]$Label = "post-opt",
  [switch]$Save = $true,
  [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# ── Auto-detect binary ──────────────────────────────────
if (-not $BinaryPath) {
  $candidates = @(
    "packages/opencode/dist/opencode-windows-x64/bin/opencode-vMK.exe",
    "dist/opencode-windows-x64/bin/opencode-vMK.exe"
  )
  $repoRoot = Resolve-Path "$PSScriptRoot/.."
  foreach ($rel in $candidates) {
    $full = Join-Path $repoRoot $rel
    if (Test-Path $full) { $BinaryPath = $full; break }
  }
}

if (-not $BinaryPath -or -not (Test-Path $BinaryPath)) {
  Write-Error "Binary not found. Specify -BinaryPath or build first."
  exit 1
}

$BinaryPath = Resolve-Path $BinaryPath

# ── Git / env metadata ─────────────────────────────────
$branch = (& git -C $(Split-Path $BinaryPath -Parent) rev-parse --abbrev-ref HEAD 2>$null) ?? "unknown"
$bunVer = (bun --version 2>$null) ?? "unknown"
$osInfo = [System.Runtime.InteropServices.RuntimeInformation]::OSDescription

# ── Binary size ─────────────────────────────────────────
$fileInfo = Get-Item $BinaryPath
$sizeBytes = $fileInfo.Length
$sizeMB = [math]::Round($sizeBytes / 1MB, 2)

# ── Cold boot --help timing ─────────────────────────────
Write-Host "=== vMK Binary Benchmark ===" -ForegroundColor Cyan
Write-Host "Binary: $BinaryPath" -ForegroundColor Gray
Write-Host "Size:   ${sizeMB} MB ($sizeBytes bytes)"
Write-Host "Branch: $branch"
Write-Host "Bun:    $bunVer"
Write-Host "OS:     $osInfo"
Write-Host "Runs:   $Runs (warmup: $WarmupRuns)`n"

$timings = @()

# Warmup runs (not counted in stats)
if ($WarmupRuns -gt 0) {
  Write-Host "  Warmup runs ($WarmupRuns)..." -ForegroundColor Yellow
  for ($w = 1; $w -le $WarmupRuns; $w++) {
    $null = Start-Process -FilePath $BinaryPath -ArgumentList "--help" -Wait -WindowStyle Hidden -RedirectStandardOutput "$env:TEMP\vmk-bench-warmup-$w-out.txt" -RedirectStandardError "$env:TEMP\vmk-bench-warmup-$w-err.txt"
    Remove-Item "$env:TEMP\vmk-bench-warmup-$w-out.txt" -ErrorAction SilentlyContinue
    Remove-Item "$env:TEMP\vmk-bench-warmup-$w-err.txt" -ErrorAction SilentlyContinue
  }
  Write-Host "  Warmup complete" -ForegroundColor Green
}

for ($i = 1; $i -le $Runs; $i++) {
  Write-Host "  Run $i/$Runs..." -NoNewline -ForegroundColor Yellow
  
  # Force GC between runs to reduce noise
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
  [System.GC]::Collect()
  
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $proc = Start-Process -FilePath $BinaryPath -ArgumentList "--help" -Wait -WindowStyle Hidden -PassThru -RedirectStandardOutput "$env:TEMP\vmk-bench-stdout-$i.txt" -RedirectStandardError "$env:TEMP\vmk-bench-stderr-$i.txt"
  $sw.Stop()
  Remove-Item "$env:TEMP\vmk-bench-stdout-$i.txt" -ErrorAction SilentlyContinue
  Remove-Item "$env:TEMP\vmk-bench-stderr-$i.txt" -ErrorAction SilentlyContinue

  if ($proc.ExitCode -ne 0) {
    Write-Host " FAIL (exit $($proc.ExitCode))" -ForegroundColor Red
  } else {
    $ms = [math]::Round($sw.Elapsed.TotalMilliseconds, 1)
    $timings += $ms
    if ($Verbose) {
      Write-Host " ${ms}ms" -ForegroundColor Green
    } else {
      Write-Host " OK" -ForegroundColor Green
    }
  }
}

# ── Smoke test: --version ──────────────────────────────
Write-Host "`n  Smoke test (--version)..." -NoNewline
$verProc = Start-Process -FilePath $BinaryPath -ArgumentList "--version" -Wait -WindowStyle Hidden -PassThru -RedirectStandardOutput "$env:TEMP\vmk-bench-ver-out.txt" -RedirectStandardError "$env:TEMP\vmk-bench-ver-err.txt"
Remove-Item "$env:TEMP\vmk-bench-ver-out.txt" -ErrorAction SilentlyContinue
Remove-Item "$env:TEMP\vmk-bench-ver-err.txt" -ErrorAction SilentlyContinue
$smokeOK = $verProc.ExitCode -eq 0
if ($smokeOK) {
  Write-Host " PASS (exit $($verProc.ExitCode))" -ForegroundColor Green
} else {
  Write-Host " FAIL (exit $($verProc.ExitCode))" -ForegroundColor Red
}

# ── Compute stats ──────────────────────────────────────
$avgMs = [math]::Round(($timings | Measure-Object -Average).Average, 1)
$minMs = [math]::Round(($timings | Measure-Object -Minimum).Minimum, 1)
$maxMs = [math]::Round(($timings | Measure-Object -Maximum).Maximum, 1)
$spreadMs = [math]::Round($maxMs - $minMs, 1)

# Median
$sorted = $timings | Sort-Object
$count = $sorted.Count
if ($count % 2 -eq 0) {
  $medianMs = [math]::Round(($sorted[($count/2)-1] + $sorted[$count/2]) / 2, 1)
} else {
  $medianMs = [math]::Round($sorted[[math]::Floor($count/2)], 1)
}

# p95
$p95Index = [math]::Ceiling($count * 0.95) - 1
$p95Ms = [math]::Round($sorted[$p95Index], 1)

Write-Host "`n── Results ──" -ForegroundColor Cyan
Write-Host "  Avg:    ${avgMs}ms"
Write-Host "  Median: ${medianMs}ms"
Write-Host "  p95:    ${p95Ms}ms"
Write-Host "  Min:    ${minMs}ms"
Write-Host "  Max:    ${maxMs}ms"
Write-Host "  Spread: ${spreadMs}ms"
Write-Host "  Binary: ${sizeMB}MB"
Write-Host "  Smoke:  $(if ($smokeOK) { 'PASS' } else { 'FAIL' })"

# ── Save results ────────────────────────────────────────
if ($Save) {
  $repoRoot = Resolve-Path "$PSScriptRoot/.."
  $outputDir = Join-Path $repoRoot "docs/metricas"
  if (-not (Test-Path $outputDir)) { New-Item -ItemType Directory -Path $outputDir -Force | Out-Null }

  $output = @{
    date        = (Get-Date -Format "o")
    branch      = $branch
    label       = $Label
    build       = @{
      bun      = $bunVer
      platform = "win32-x64"
    }
    binary      = @{
      path       = $BinaryPath
      size_bytes = $sizeBytes
      size_mb    = $sizeMB
    }
    performance = @{
      cold_boot_help_ms = @{
        avg    = $avgMs
        median = $medianMs
        p95    = $p95Ms
        min    = $minMs
        max    = $maxMs
        spread = $spreadMs
        runs   = $timings
        n      = $timings.Count
      }
    }
    smoke       = @{
      version = $smokeOK
      exit_code = $verProc.ExitCode
    }
    timestamp   = (Get-Date -Format "o")
  }

  $outputFile = Join-Path $outputDir "bench-${Label}-${branch}.json"
  $output | ConvertTo-Json -Depth 10 | Set-Content -Path $outputFile -Encoding UTF8
  Write-Host "`n  Saved: $outputFile" -ForegroundColor Gray
}

# ── Return as JSON for programmatic use ────────────────
$output | ConvertTo-Json -Depth 10
