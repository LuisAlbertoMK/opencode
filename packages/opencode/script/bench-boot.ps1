param(
  [Parameter(Mandatory = $true)][string]$Target,
  [int]$Runs = 8,
  [int]$SampleMs = 200
)

# Boot bench harness — median wall time + peak RAM per run.
# Protocol: exit code validated on EVERY run; any failure invalidates the metric
# (lesson from the -1112% false bench on 2026-09-02).
# Warmup: run 0 is discarded. Target "dev" = bun run src/index.ts --version.

$times = @()
$rams = @()
$failures = 0
$pkgDir = Split-Path -Parent $PSCommandPath

for ($i = 0; $i -le $Runs; $i++) {
  $isWarmup = ($i -eq 0)
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
  runs = $sorted.Count
  median_ms = [math]::Round($sorted[$medIdx], 1)
  median_peak_ram_mb = [math]::Round($ramSorted[$medIdx], 1)
  min_ms = [math]::Round($sorted[0], 1)
  max_ms = [math]::Round($sorted[-1], 1)
} | ConvertTo-Json -Compress
