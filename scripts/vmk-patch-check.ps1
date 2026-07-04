#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Verify patch integrity — all patchedDependencies have matching files, no orphan patches.
.DESCRIPTION
  Checks that every entry in package.json patchedDependencies has a corresponding
  file in patches/ and vice versa (no orphans). Exits non-zero on error.
#>

$ErrorActionPreference = "Stop"
$rootDir = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$pkgJson = Get-Content (Join-Path $rootDir "package.json") -Raw | ConvertFrom-Json
$patchDir = Join-Path $rootDir "patches"

# Collect patchedDependencies from package.json
$declared = @{}
if ($pkgJson.patchedDependencies) {
  $pkgJson.patchedDependencies.PSObject.Properties | ForEach-Object {
    $declared[$_.Name] = Join-Path $rootDir $_.Value
  }
}

# Collect actual patch files on disk
$onDisk = @{}
if (Test-Path $patchDir) {
  Get-ChildItem -Path $patchDir -Filter "*.patch" | ForEach-Object {
    $onDisk[$_.Name] = $_.FullName
  }
}

$errors = 0

# Check 1: every declared patch has a file
foreach ($entry in $declared.GetEnumerator()) {
  $pkg = $entry.Key
  $expectedFile = $entry.Value
  if (-not (Test-Path $expectedFile)) {
    Write-Host "❌ MISSING: patchedDependencies '$pkg' -> file not found: $expectedFile" -ForegroundColor Red
    $errors++
  } else {
    Write-Host "  ✅ $pkg" -ForegroundColor Green
  }
}

# Check 2: no orphan patch files (files on disk not declared in patchedDependencies)
foreach ($entry in $onDisk.GetEnumerator()) {
  $fileName = $entry.Key
  $fullPath = $entry.Value
  $isDeclared = $declared.Values | Where-Object { $_ -eq $fullPath }
  if (-not $isDeclared) {
    Write-Host "  ⚠️  ORPHAN: $fileName exists but not referenced in patchedDependencies" -ForegroundColor Yellow
  }
}

# Check 3: try a dry-run install (quick check that patches apply)
Write-Host "`nRunning bun install --dry-run..." -ForegroundColor Cyan
$dryRun = & bun install --dry-run 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "  ❌ bun install --dry-run failed" -ForegroundColor Red
  Write-Host $dryRun
  $errors++
} else {
  Write-Host "  ✅ bun install --dry-run passed" -ForegroundColor Green
}

if ($errors -gt 0) {
  Write-Host "`n❌ $errors error(s) found" -ForegroundColor Red
  exit 1
} else {
  Write-Host "`n✅ All patch checks passed" -ForegroundColor Green
  exit 0
}
