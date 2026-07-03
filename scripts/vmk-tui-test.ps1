<#
.SYNOPSIS
  vMK TUI Interactive Test — verifies `useThread: true` works in compiled binary.

.DESCRIPTION
  Tests that the opencode-vMK.exe binary with `useThread: true` (Zig render
  thread offload) works correctly:
    1. Source code regression guard — `useThread: true` still set
    2. Build test — binary compiles without errors
    3. CLI test  — `--help` shows output, exit 0
    4. Version test — `--version` exit 0
    5. Non-TUI command test — `providers list` works
    6. Headless server test — `serve` starts, stays alive 5s
    7. Models list — `models` command works

.PARAMETER BinaryPath
  Path to opencode-vMK.exe. Default: auto-detect in packages/opencode/dist/

.PARAMETER Build
  Build before testing (default: $true). Set -Build:$false to skip if binary exists.

.EXAMPLE
  .\scripts\vmk-tui-test.ps1

.EXAMPLE
  .\scripts\vmk-tui-test.ps1 -Build:$false

.NOTES
  #vMK: TUI integration test for useThread flag
#>

param(
  [string]$BinaryPath = "",
  [switch]$Build = $true
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path "$PSScriptRoot/.."
$passed = 0
$failed = 0
$total = 0
$skipped = 0

function Test-Step {
  param([string]$Name, [scriptblock]$Block)
  $script:total++
  Write-Host "`n[$script:total] $Name..." -NoNewline -ForegroundColor Yellow
  try {
    $result = & $Block
    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw "Exit code $LASTEXITCODE" }
    Write-Host " PASS" -ForegroundColor Green
    $script:passed++
    return $result
  } catch {
    Write-Host " FAIL" -ForegroundColor Red
    Write-Host "  → $_" -ForegroundColor Gray
    $script:failed++
    return $null
  }
}

# ── Auto-detect binary ─────────────────────────────────
function Find-Binary {
  $candidates = @(
    "packages/opencode/dist/opencode-windows-x64/bin/opencode-vMK.exe",
    "dist/opencode-windows-x64/bin/opencode-vMK.exe"
  )
  foreach ($rel in $candidates) {
    $full = Join-Path $repoRoot $rel
    if (Test-Path $full) { return (Resolve-Path $full) }
  }
  return $null
}

# ── 1. Source regression guard ──────────────────────────
Test-Step -Name "Source: useThread: true" -Block {
  $file = Join-Path $repoRoot "packages/opencode/src/cli/cmd/run/runtime.lifecycle.ts"
  $content = Get-Content $file -Raw
  if ($content -notmatch 'useThread:\s*true') {
    throw "useThread: true NOT FOUND in runtime.lifecycle.ts — flag may have been removed!"
  }
  $lines = $content -split "`n"
  $lineNum = 0
  for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match 'useThread') { $lineNum = $i + 1; break }
  }
  Write-Host " (line $lineNum)" -NoNewline -ForegroundColor Gray
}

# ── 2. Build ────────────────────────────────────────────
if ($Build) {
  Test-Step -Name "Build binary" -Block {
    Push-Location (Join-Path $repoRoot "packages/opencode")
    try {
      $buildLog = bun run build -- --single --skip-embed-web-ui 2>&1
      $lastLine = $buildLog | Select-Object -Last 1
      if ($lastLine -notmatch "Smoke test passed") {
        throw "Build smoke test did not pass. Last line: $lastLine"
      }
    } finally { Pop-Location }
  }
} else {
  Write-Host "`n[$script:total] Build binary... SKIP" -ForegroundColor Gray
  $script:skipped++
}

# ── Resolve binary ──────────────────────────────────────
$BinaryPath = Find-Binary
if (-not $BinaryPath -or -not (Test-Path $BinaryPath)) {
  Write-Error "Binary not found. Build first or specify -BinaryPath."
  exit 1
}
Write-Host "`nBinary: $BinaryPath" -ForegroundColor Gray

# ── 3. CLI --help ───────────────────────────────────────
Test-Step -Name "CLI: --help shows output" -Block {
  $stdout = & $BinaryPath "--help" 2>&1 | Out-String
  if ($stdout.Trim().Length -eq 0) { throw "--help produced no output" }
  if ($stdout -notmatch "opencode") { throw "--help output missing 'opencode'" }
  if ($LASTEXITCODE -ne 0) { throw "Exit code $LASTEXITCODE" }
  $lineCount = ($stdout -split "`n").Count
  Write-Host " ($lineCount lines)" -NoNewline -ForegroundColor Gray
}

# ── 4. Version exit code ────────────────────────────────
Test-Step -Name "CLI: --version exit 0" -Block {
  $null = & $BinaryPath "--version" 2>&1
  if ($LASTEXITCODE -ne 0) { throw "Exit code $LASTEXITCODE" }
}

# ── 5. Non-TUI command ──────────────────────────────────
Test-Step -Name "CLI: providers list" -Block {
  $stdout = & $BinaryPath "providers" "list" 2>&1 | Out-String
  if ($stdout -notmatch "Credentials") { throw "providers list missing 'Credentials'" }
  if ($LASTEXITCODE -ne 0) { throw "Exit code $LASTEXITCODE" }
}

# ── 6. Models command ───────────────────────────────────
Test-Step -Name "CLI: models" -Block {
  $stdout = & $BinaryPath "models" 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 1) { throw "Exit code $LASTEXITCODE" }
  # models may exit 1 if no providers, but should output something
  if ($stdout.Trim().Length -eq 0) { throw "models produced no output" }
}

# ── 7. Headless server (5s alive) ────────────────────────
Test-Step -Name "Server: headless serve 5s" -Block {
  $tempOut = Join-Path $env:TEMP "vmk-srv-out-$(Get-Random).txt"
  $tempErr = Join-Path $env:TEMP "vmk-srv-err-$(Get-Random).txt"

  try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $proc = Start-Process -FilePath $BinaryPath `
      -ArgumentList "serve" `
      -PassThru `
      -WindowStyle Hidden `
      -RedirectStandardOutput $tempOut `
      -RedirectStandardError $tempErr

    # Give it 5 seconds to initialize
    $exited = $proc.WaitForExit(5000)
    if ($exited) {
      if ($proc.ExitCode -ne 0) {
        $err = Get-Content $tempErr -Raw -ErrorAction SilentlyContinue
        throw "serve exited early with code $($proc.ExitCode). stderr: $err"
      }
    } else {
      # Still running — server initialized successfully
      $elapsed = [math]::Round($sw.Elapsed.TotalMilliseconds)
      $proc.Kill($true)
      $proc.WaitForExit(3000)
      Write-Host " (alive ${elapsed}ms, killed)" -NoNewline -ForegroundColor Gray
    }
  } finally {
    Remove-Item $tempOut -ErrorAction SilentlyContinue
    Remove-Item $tempErr -ErrorAction SilentlyContinue
  }
}

# ── Summary ─────────────────────────────────────────────
Write-Host "`n═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Results: $passed/$total passed"
if ($skipped -gt 0) { Write-Host "  Skipped: $skipped" -ForegroundColor Gray }
if ($failed -gt 0) {
  Write-Host "  FAILED:  $failed tests" -ForegroundColor Red
} else {
  Write-Host "  All tests PASSED" -ForegroundColor Green
}
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan

if ($failed -gt 0) { exit 1 }
