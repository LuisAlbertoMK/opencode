<#
.SYNOPSIS
  vMK vs Original — side-by-side comparison benchmark.

.DESCRIPTION
  Runs the same battery of tests on both the original opencode binary
  (npm global install) and the vMK fork binary, then displays a
  side-by-side comparison table.

  Metrics:
    - Binary file size
    - Cold boot --help timing (avg of N runs)
    - --version output + exit code
    - providers list (timing + exit)
    - models (timing + exit + output check)
    - serve 3s alive test

  Results saved to docs/metricas/compare-{label}-{date}.json

.PARAMETER OriginalPath
  Path to original opencode.exe. Default: auto-detect in npm global.

.PARAMETER VmkPath
  Path to opencode-vMK.exe. Default: auto-detect in packages/opencode/dist/.

.PARAMETER Runs
  Number of cold-boot timing runs per binary (default: 3).

.PARAMETER Label
  Label for output filename (default: "baseline").

.PARAMETER Save
  Save results to docs/metricas/ (default: $true).

.PARAMETER Verbose
  Show per-run timings.

.EXAMPLE
  .\scripts\vmk-compare.ps1 -Runs 3 -Verbose

.EXAMPLE
  .\scripts\vmk-compare.ps1 -Label "post-cycle6" -Runs 5

.NOTES
  #vMK: Side-by-side comparison — original npm vs vMK fork
  ZONA ROJA: reads original binary but NEVER modifies it
#>

param(
  [string]$OriginalPath = "",
  [string]$VmkPath = "",
  [int]$Runs = 3,
  [string]$Label = "baseline",
  [switch]$Save = $true,
  [switch]$Verbose
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path "$PSScriptRoot/.."

# ── Known paths ────────────────────────────────────────
$knownOriginals = @(
  "$env:APPDATA\npm\node_modules\opencode-ai\bin\opencode.exe",
  "$env:APPDATA\npm\nnode_modules\opencode-ai\opencode.exe"
)
$knownVmk = @(
  "packages/opencode/dist/opencode-windows-x64/bin/opencode-vMK.exe"
)

# ── Helpers ─────────────────────────────────────────────
function Format-Duration($ms) {
  if ($ms -ge 1000) { return "$([math]::Round($ms, 0)) ms" }
  return "$([math]::Round($ms, 1)) ms"
}

function Test-BinaryExists {
  param([string]$Path)
  if (-not $Path -or -not (Test-Path $Path)) { return $null }
  return (Resolve-Path $Path).Path
}

function Get-BinaryInfo {
  param([string]$Path)
  $fi = Get-Item $Path
  return @{
    Path = $fi.FullName
    SizeMB = [math]::Round($fi.Length / 1MB, 2)
    SizeBytes = $fi.Length
  }
}

function Measure-ColdBoot {
  param([string]$Path, [int]$Runs, [switch]$Verbose)
  $timings = @()
  for ($i = 1; $i -le $Runs; $i++) {
    if ($Verbose) { Write-Host "    Run $i/$Runs..." -NoNewline -ForegroundColor Yellow }
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $null = Start-Process -FilePath $Path -ArgumentList "--help" -Wait -WindowStyle Hidden -PassThru `
      -RedirectStandardOutput "$env:TEMP\vmk-cmp-stdout-$i.txt" `
      -RedirectStandardError "$env:TEMP\vmk-cmp-stderr-$i.txt" `
      -ErrorAction SilentlyContinue
    $sw.Stop()
    Remove-Item "$env:TEMP\vmk-cmp-stdout-$i.txt" -ErrorAction SilentlyContinue
    Remove-Item "$env:TEMP\vmk-cmp-stderr-$i.txt" -ErrorAction SilentlyContinue
    $timings += [math]::Round($sw.Elapsed.TotalMilliseconds, 1)
    if ($Verbose) { Write-Host " $($timings[-1])ms" -ForegroundColor Green }
  }
  $avg = [math]::Round(($timings | Measure-Object -Average).Average, 1)
  $min = [math]::Round(($timings | Measure-Object -Minimum).Minimum, 1)
  $max = [math]::Round(($timings | Measure-Object -Maximum).Maximum, 1)
  return @{ Avg = $avg; Min = $min; Max = $max; Runs = $timings }
}

function Run-CliCommand {
  param([string]$Path, [string[]]$ArgumentList)
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $output = & $Path $ArgumentList 2>&1
  $exitCode = $LASTEXITCODE
  $sw.Stop()
  $stdout = ($output | Out-String).Trim()
  return @{
    ElapsedMs = [math]::Round($sw.Elapsed.TotalMilliseconds, 1)
    ExitCode = $exitCode
    Stdout = $stdout
  }
}

function Test-ServeAlive {
  param([string]$Path)
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $proc = Start-Process -FilePath $Path -ArgumentList "serve" -PassThru -WindowStyle Hidden
  $exited = $proc.WaitForExit(3000)
  $elapsed = [math]::Round($sw.Elapsed.TotalMilliseconds, 0)
  if (-not $exited) {
    $proc.Kill($true)
    return @{ Alive = $true; DurationMs = $elapsed }
  }
  return @{ Alive = $false; DurationMs = $elapsed; ExitCode = $proc.ExitCode }
}

# ── Auto-detect binaries ───────────────────────────────
if (-not $OriginalPath) {
  foreach ($p in $knownOriginals) {
    $resolved = Test-BinaryExists $p
    if ($resolved) { $OriginalPath = $resolved; break }
  }
}
if (-not $VmkPath) {
  foreach ($p in $knownVmk) {
    $resolved = Test-BinaryExists (Join-Path $repoRoot $p)
    if ($resolved) { $VmkPath = $resolved; break }
  }
}

# Fallback: search npm global root
if (-not $OriginalPath) {
  $npmRoot = npm root -g 2>$null
  if ($npmRoot) {
    $candidate = Join-Path $npmRoot "opencode-ai\bin\opencode.exe"
    $resolved = Test-BinaryExists $candidate
    if ($resolved) { $OriginalPath = $resolved }
  }
}
if (-not $OriginalPath) {
  # Try the current PATH opencode
  $fromPath = (Get-Command opencode -ErrorAction SilentlyContinue)?.Source
  if ($fromPath -and (Test-Path $fromPath)) { $OriginalPath = (Resolve-Path $fromPath).Path }
}

if (-not $OriginalPath) { Write-Error "Original binary not found. Build original or specify -OriginalPath."; exit 1 }
if (-not $VmkPath) { Write-Error "vMK binary not found. Build vMK first or specify -VmkPath."; exit 1 }

# ── Header ──────────────────────────────────────────────
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  vMK vs Original — Comparison Benchmark" -ForegroundColor Cyan
Write-Host "  Label: $Label  |  Runs: $Runs" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan

$origInfo = Get-BinaryInfo $OriginalPath
$vmkInfo = Get-BinaryInfo $VmkPath

Write-Host "`nOriginal:  $($origInfo.Path)" -ForegroundColor Gray
Write-Host "           $($origInfo.SizeMB) MB"
Write-Host "vMK:       $($vmkInfo.Path)" -ForegroundColor Gray
Write-Host "           $($vmkInfo.SizeMB) MB"
Write-Host ""

# ── Results accumulator ─────────────────────────────────
$results = @{
  date    = (Get-Date -Format "o")
  label   = $Label
  branch  = (& git -C $repoRoot rev-parse --abbrev-ref HEAD 2>$null) ?? "unknown"
  bun     = (bun --version 2>$null) ?? "unknown"
  os      = [System.Runtime.InteropServices.RuntimeInformation]::OSDescription
  original = @{}
  vmk      = @{}
}

# ═══════════════════════════════════════════════════════
#  1. BINARY SIZE
# ═══════════════════════════════════════════════════════
$sizeDelta = $vmkInfo.SizeMB - $origInfo.SizeMB
$sizePct = [math]::Round(($vmkInfo.SizeMB / $origInfo.SizeMB - 1) * 100, 1)
$sizeArrow = if ($sizeDelta -lt 0) { "DOWN" } elseif ($sizeDelta -gt 0) { "UP" } else { "SAME" }

Write-Host "--- [1] Binary Size ---" -ForegroundColor Cyan
Write-Host "  Original  $($origInfo.SizeMB) MB"
Write-Host "  vMK       $($vmkInfo.SizeMB) MB  $sizeArrow ${sizeDelta}MB ($sizePct%)"

$results.original.Size = $origInfo
$results.vmk.Size = $vmkInfo

# ═══════════════════════════════════════════════════════
#  2. COLD BOOT --help
# ═══════════════════════════════════════════════════════
Write-Host "`n--- [2] Cold Boot (--help, ${Runs} runs) ---" -ForegroundColor Cyan

Write-Host "  Original..."
$origBoot = Measure-ColdBoot -Path $OriginalPath -Runs $Runs -Verbose:$Verbose
Write-Host "    Avg: $($origBoot.Avg) ms  Min: $($origBoot.Min) ms  Max: $($origBoot.Max) ms"

Write-Host "  vMK..."
$vmkBoot = Measure-ColdBoot -Path $VmkPath -Runs $Runs -Verbose:$Verbose
Write-Host "    Avg: $($vmkBoot.Avg) ms  Min: $($vmkBoot.Min) ms  Max: $($vmkBoot.Max) ms"

$bootDelta = $vmkBoot.Avg - $origBoot.Avg
$bootPct = [math]::Round(($vmkBoot.Avg / $origBoot.Avg - 1) * 100, 1)
$bootArrow = if ($bootDelta -lt 0) { "faster" } elseif ($bootDelta -gt 0) { "slower" } else { "same" }

Write-Host "  Difference: $bootArrow ($bootDelta ms, $bootPct%)" -ForegroundColor $(
  if ($bootDelta -lt 0) { "Green" } elseif ($bootDelta -gt 0) { "Red" } else { "Gray" }
)

$results.original.ColdBoot = $origBoot
$results.vmk.ColdBoot = $vmkBoot

# ═══════════════════════════════════════════════════════
#  3. --version
# ═══════════════════════════════════════════════════════
Write-Host "`n--- [3] --version ---" -ForegroundColor Cyan

$origVer = Run-CliCommand -Path $OriginalPath -ArgumentList @("--version")
$vmkVer  = Run-CliCommand -Path $VmkPath -ArgumentList @("--version")

$origVerStr = if ($origVer.Stdout) { $origVer.Stdout.Trim() } else { "(no output)" }
$vmkVerStr  = if ($vmkVer.Stdout) { $vmkVer.Stdout.Trim() } else { "(no output)" }

Write-Host "  Original  exit=$($origVer.ExitCode)  version=[$origVerStr]"
Write-Host "  vMK       exit=$($vmkVer.ExitCode)  version=[$vmkVerStr]"

if ($origVer.ExitCode -ne 0 -or $vmkVer.ExitCode -ne 0) {
  Write-Host "  -> Exit code issue (orig=$($origVer.ExitCode) vmk=$($vmkVer.ExitCode))" -ForegroundColor Yellow
} elseif ($origVerStr -eq $vmkVerStr) {
  Write-Host "  -> Same version string" -ForegroundColor Green
} else {
  Write-Host "  -> Different version strings" -ForegroundColor Yellow
}

$results.original.Version = @{ ExitCode = $origVer.ExitCode; Output = $origVerStr }
$results.vmk.Version = @{ ExitCode = $vmkVer.ExitCode; Output = $vmkVerStr }

# ═══════════════════════════════════════════════════════
#  4. providers list
# ═══════════════════════════════════════════════════════
Write-Host "`n--- [4] providers list ---" -ForegroundColor Cyan

$origProv = Run-CliCommand -Path $OriginalPath -ArgumentList @("providers", "list")
$vmkProv  = Run-CliCommand -Path $VmkPath -ArgumentList @("providers", "list")

Write-Host "  Original  exit=$($origProv.ExitCode)  $($origProv.ElapsedMs)ms  output=$($origProv.Stdout.Length) chars"
Write-Host "  vMK       exit=$($vmkProv.ExitCode)  $($vmkProv.ElapsedMs)ms  output=$($vmkProv.Stdout.Length) chars"

$provDelta = $vmkProv.ElapsedMs - $origProv.ElapsedMs
$provArrow = if ($provDelta -lt -100) { "🔽 faster" } elseif ($provDelta -gt 100) { "🔼 slower" } else { "➡️ similar" }
Write-Host "  Difference: $provArrow ($provDelta ms)" -ForegroundColor $(
  if ($provDelta -lt -100) { "Green" } elseif ($provDelta -gt 100) { "Red" } else { "Gray" }
)

$results.original.ProvidersList = @{ ExitCode = $origProv.ExitCode; ElapsedMs = $origProv.ElapsedMs; OutputLength = $origProv.Stdout.Length }
$results.vmk.ProvidersList = @{ ExitCode = $vmkProv.ExitCode; ElapsedMs = $vmkProv.ElapsedMs; OutputLength = $vmkProv.Stdout.Length }

# ═══════════════════════════════════════════════════════
#  5. models
# ═══════════════════════════════════════════════════════
Write-Host "`n--- [5] models ---" -ForegroundColor Cyan

$origModels = Run-CliCommand -Path $OriginalPath -ArgumentList @("models")
$vmkModels  = Run-CliCommand -Path $VmkPath -ArgumentList @("models")

$origModelLines = ($origModels.Stdout -split "`n").Count
$vmkModelLines = ($vmkModels.Stdout -split "`n").Count

Write-Host "  Original  exit=$($origModels.ExitCode)  $($origModels.ElapsedMs)ms  $origModelLines lines"
Write-Host "  vMK       exit=$($vmkModels.ExitCode)  $($vmkModels.ElapsedMs)ms  $vmkModelLines lines"

$modelsDelta = $vmkModels.ElapsedMs - $origModels.ElapsedMs
$modelsArrow = if ($modelsDelta -lt -200) { "🔽 faster" } elseif ($modelsDelta -gt 200) { "🔼 slower" } else { "➡️ similar" }
Write-Host "  Difference: $modelsArrow ($modelsDelta ms)" -ForegroundColor $(
  if ($modelsDelta -lt -200) { "Green" } elseif ($modelsDelta -gt 200) { "Red" } else { "Gray" }
)

$results.original.Models = @{ ExitCode = $origModels.ExitCode; ElapsedMs = $origModels.ElapsedMs; Lines = $origModelLines }
$results.vmk.Models = @{ ExitCode = $vmkModels.ExitCode; ElapsedMs = $vmkModels.ElapsedMs; Lines = $vmkModelLines }

# ═══════════════════════════════════════════════════════
#  6. serve alive
# ═══════════════════════════════════════════════════════
Write-Host "`n--- [6] serve (3s alive) ---" -ForegroundColor Cyan

$origServe = Test-ServeAlive $OriginalPath
$vmkServe  = Test-ServeAlive $VmkPath

$origServeStr = if ($origServe.Alive) { "ALIVE $($origServe.DurationMs)ms ✅" } else { "DIED exit $($origServe.ExitCode)" }
$vmkServeStr  = if ($vmkServe.Alive) { "ALIVE $($vmkServe.DurationMs)ms ✅" } else { "DIED exit $($vmkServe.ExitCode)" }

Write-Host "  Original  $origServeStr"
Write-Host "  vMK       $vmkServeStr"

$results.original.Serve = $origServe
$results.vmk.Serve = $vmkServe

# ═══════════════════════════════════════════════════════
#  SUMMARY TABLE
# ═══════════════════════════════════════════════════════
Write-Host "`n═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  SUMMARY" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$rows = @(
  @{ Metric = "Binary Size"; Orig = "$($origInfo.SizeMB) MB"; Vmk = "$($vmkInfo.SizeMB) MB"; Diff = "$sizePct%" }
  @{ Metric = "Cold Boot (avg)"; Orig = "$($origBoot.Avg) ms"; Vmk = "$($vmkBoot.Avg) ms"; Diff = "$($bootDelta) ms ($bootPct%)" }
  @{ Metric = "--version exit"; Orig = "$($origVer.ExitCode) [$origVerStr]"; Vmk = "$($vmkVer.ExitCode) [$vmkVerStr]"; Diff = if ($origVer.ExitCode -eq $vmkVer.ExitCode) { "same" } else { "DIFF" } }
  @{ Metric = "providers list"; Orig = "$($origProv.ElapsedMs)ms exit=$($origProv.ExitCode)"; Vmk = "$($vmkProv.ElapsedMs)ms exit=$($vmkProv.ExitCode)"; Diff = "$($provDelta) ms" }
  @{ Metric = "models"; Orig = "$($origModels.ElapsedMs)ms $origModelLines lines"; Vmk = "$($vmkModels.ElapsedMs)ms $vmkModelLines lines"; Diff = "$($modelsDelta) ms" }
  @{ Metric = "serve 3s"; Orig = "$($origServeStr)"; Vmk = "$($vmkServeStr)"; Diff = if ($origServe.Alive -eq $vmkServe.Alive) { "same" } else { "DIFF" } }
)

# Column widths
$mLen = ($rows | ForEach-Object { $_.Metric.Length } | Measure-Object -Maximum).Maximum
$oLEn = ($rows | ForEach-Object { $_.Orig.Length } | Measure-Object -Maximum).Maximum
$vLen = ($rows | ForEach-Object { $_.Vmk.Length } | Measure-Object -Maximum).Maximum

$header = "  Metric".PadRight($mLen + 2) + "Original".PadRight($oLEn + 2) + "vMK".PadRight($vLen + 2) + "Δ Difference"
$sep = "  " + ("-" * ($mLen + $oLEn + $vLen + 20))

Write-Host $header -ForegroundColor Yellow
Write-Host $sep -ForegroundColor Gray

foreach ($row in $rows) {
  $line = "  " +
    $row.Metric.PadRight($mLen + 2) +
    $row.Orig.PadRight($oLEn + 2) +
    $row.Vmk.PadRight($vLen + 2) +
    $row.Diff
  Write-Host $line
}

# ── Verdict ──────────────────────────────────────────
Write-Host ""
$differences = 0
$improvements = 0
$regressions = 0

if ($sizeDelta -lt 0) { $improvements++ } elseif ($sizeDelta -gt 0) { $regressions++ }
if ($bootDelta -lt 0) { $improvements++ } elseif ($bootDelta -gt 50) { $regressions++ }
if ($origVer.ExitCode -ne $vmkVer.ExitCode) { $differences++ }
if ($origProv.ExitCode -ne $vmkProv.ExitCode) { $differences++ }
if ($origModels.ExitCode -ne $vmkModels.ExitCode) { $differences++ }

if ($differences -eq 0 -and $regressions -eq 0) {
  Write-Host "  [OK] vMK compatible — no regressions. $improvements improvements detected." -ForegroundColor Green
} elseif ($differences -gt 0) {
  Write-Host "  [!] vMK has $differences behavioral difference(s). Review flagged metrics." -ForegroundColor Yellow
}
if ($regressions -gt 0) {
  Write-Host "  [FAIL] $regressions regression(s) detected." -ForegroundColor Red
}

# ═══════════════════════════════════════════════════════
#  SAVE
# ═══════════════════════════════════════════════════════
if ($Save) {
  $outputDir = Join-Path $repoRoot "docs/metricas"
  if (-not (Test-Path $outputDir)) { New-Item -ItemType Directory -Path $outputDir -Force | Out-Null }

  $outputFile = Join-Path $outputDir "compare-${Label}-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
  $results | ConvertTo-Json -Depth 10 | Set-Content -Path $outputFile -Encoding UTF8
  Write-Host "`n  Saved: $outputFile" -ForegroundColor Gray
  Write-Host "  JSON:  $((Get-Item $outputFile).Length) bytes" -ForegroundColor Gray
}

# ── Return JSON for programmatic use ─────────────────
$results | ConvertTo-Json -Depth 10
