<#
.SYNOPSIS
  Cross-compile opencode-vMK for all supported platforms.

.DESCRIPTION
  Wraps build.ts --skip-embed-web-ui to build for all platforms.
  Uses --skip-embed-web-ui by default (web UI requires full checkout).
  For platform-specific build (fast), use vmk.cmd or --single.

.PARAMETER Single
  Build only for the current platform (alias for vmk.cmd).

.PARAMETER IncludeWebUI
  Include the embedded web UI in the binary (requires full web build).

.PARAMETER Sourcemaps
  Include sourcemaps in the binary (useful for debugging crashes).

.EXAMPLE
  .\scripts\vmk-cross-compile.ps1
  Builds for all targets: linux/arm64 linux/x64 darwin/arm64 darwin/x64 windows/x64 windows/arm64

.EXAMPLE
  .\scripts\vmk-cross-compile.ps1 -Single
  Builds only for the current platform (same as vmk.cmd).

.EXAMPLE
  .\scripts\vmk-cross-compile.ps1 -IncludeWebUI
  Full cross-compile with embedded web UI.
#>

param(
  [switch]$Single,
  [switch]$IncludeWebUI,
  [switch]$Sourcemaps
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$env:OPENCODE_CHANNEL = "vMK-dev"

$flags = @()
if (-not $IncludeWebUI) { $flags += "--skip-embed-web-ui" }
if ($Single) { $flags += "--single" }
if ($Sourcemaps) { $flags += "--sourcemaps" }

Write-Host "🔨 Building opencode-vMK (channel: $env:OPENCODE_CHANNEL)" -ForegroundColor Cyan
if ($flags.Count -gt 0) {
  Write-Host "   Flags: $($flags -join ' ')" -ForegroundColor Gray
}
Write-Host "   Targets: $(if($Single){'current platform'}else{'all platforms (linux/darwin/win32 × arm64/x64)'})" -ForegroundColor Gray

Push-Location $RepoRoot
try {
  $buildArgs = "build"
  if ($flags.Count -gt 0) { $buildArgs += " -- $($flags -join ' ')" }
  & "bun" "run" "--cwd" "packages/opencode" $buildArgs

  if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build complete!" -ForegroundColor Green
    Get-ChildItem packages/opencode/dist -Directory | ForEach-Object {
      $binPath = Join-Path $_.FullName "bin"
      if (Test-Path $binPath) {
        Get-ChildItem $binPath | ForEach-Object {
          Write-Host "   📦 $($_.FullName)" -ForegroundColor DarkGray
        }
      }
    }
  } else {
    Write-Host "❌ Build failed (exit: $LASTEXITCODE)" -ForegroundColor Red
    exit $LASTEXITCODE
  }
} finally {
  Pop-Location
}
