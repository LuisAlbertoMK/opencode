param(
  [Parameter(Mandatory = $true)][string]$Target,
  [int]$Runs = 0,
  [int]$SampleMs = 200
)

# Boot bench harness — median wall time + peak RAM per run.
# Protocol ciclo9 slice1: 1 warmup + N runs + mediana (N=3 piloto, N=7 oficial)
# Worktree: resuelve package dir vía PSCommandPath (sin hardcode D:\opencode)
# Env: BENCH_RUNS / BENCH_WARMUPS pueden sobreescribir defaults.
# Warmup: run 0 is discarded. Target "dev" = bun run src/index.ts --version.

# Env overrides (permiten BENCH_RUNS=3 en piloto sin tocar param)
if ($Runs -eq 0) {
  if ($env:BENCH_RUNS) { $Runs = [int]$env:BENCH_RUNS } else { $Runs = 7 }
}
$Warmups = 1
if ($env:BENCH_WARMUPS) { $Warmups = [int]$env:BENCH_WARMUPS }

$times = @()
$rams = @()
$failures = 0
$scriptDir = Split-Path -Parent $PSCommandPath
$pkgDir = Split-Path -Parent $scriptDir
# pkgDir is packages/opencode — worktree-safe (PSCommandPath points to worktree copy)

for ($i = 0; $i -lt ($Warmups + $Runs); $i++) {
  $isWarmup = ($i -lt $Warmups)
  $psi = [System.Diagnostics.ProcessStartInfo]::new()
  if ($Target -eq "dev") {
    $psi.FileName = "bun"
    $psi.Arguments = "run src/index.ts --version"
  }
  else {
    $psi.FileName = $Target
    $psi.Arguments = "--version"
  }
  $psi.WorkingDirectory = $pkgDir
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true

  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $p = [System.Diagnostics.Process]::Start($psi)
  $peak = 0
  while (-not $p.HasExited) {
    Start-Sleep -Milliseconds $SampleMs
    try {
      $ws = $p.WorkingSet64
      if ($ws -gt $peak) { $peak = $ws }
    } catch {}
  }
  $p.WaitForExit()
  $sw.Stop()
  $code = $p.ExitCode
  $null = $p.StandardOutput.ReadToEnd()
  $null = $p.StandardError.ReadToEnd()
  $p.Dispose()

  if ($code -ne 0) {
    $failures++
    Write-Warning "run $i failed (exit=$code)"
    continue
  }
  if (-not $isWarmup) {
    $times += $sw.Elapsed.TotalMilliseconds
    $rams += [math]::Round($peak / 1MB, 1)
  }
}

if ($failures -gt 0) {
  Write-Error "$failures run(s) failed — METRIC INVALID (protocol: exit code must be 0 on every run)"
  exit 1
}

$sorted = $times | Sort-Object
$medIdx = [int][Math]::Floor(($sorted.Count - 1) / 2)
$ramSorted = $rams | Sort-Object
[pscustomobject]@{
  target = $Target
  warmups = $Warmups
  runs = $sorted.Count
  median_ms = [math]::Round($sorted[$medIdx], 1)
  median_peak_ram_mb = [math]::Round($ramSorted[$medIdx], 1)
  min_ms = [math]::Round($sorted[0], 1)
  max_ms = [math]::Round($sorted[-1], 1)
} | ConvertTo-Json -Compress
