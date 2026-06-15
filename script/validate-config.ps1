#!/usr/bin/env powershell
<#
.SYNOPSIS
  Valida la configuracion personal de opencode contra el schema JSON.
.PARAMETER ConfigPath
  Ruta al opencode.json. Default: ~/.config/opencode/opencode.json
.PARAMETER SchemaPath
  Ruta al schema JSON. Default: junto al script / opencode-config-schema.json
#>

param(
  [string]$ConfigPath = "$env:USERPROFILE\.config\opencode\opencode.json",
  [string]$SchemaPath = ""
)

$ErrorActionPreference = "Stop"

if (-not $SchemaPath) {
  $SchemaPath = Join-Path -Path $PSScriptRoot -ChildPath "opencode-config-schema.json"
}

if (-not (Test-Path $ConfigPath)) { Write-Error "Config no encontrado: $ConfigPath"; exit 1 }
if (-not (Test-Path $SchemaPath)) { Write-Error "Schema no encontrado: $SchemaPath"; exit 1 }

Write-Host "[validate-config] Validando: $ConfigPath" -ForegroundColor Cyan
Write-Host "[validate-config] Contra schema: $SchemaPath" -ForegroundColor Cyan

# Validacion manual (PS 5.1 compatible)
try {
  $configText = Get-Content $ConfigPath -Raw
  $errors = @()

  # Verificar que existe "agent"
  if ($configText -notmatch '"agent"') {
    $errors += "Falta campo requerido: 'agent'"
  }

  # Verificar que existe "skills"
  if ($configText -notmatch '"skills"') {
    $errors += "Falta campo requerido: 'skills'"
  }

  # Verificar skills.paths
  if ($configText -match '"paths"\s*:\s*\[') {
    $start = $configText.IndexOf('"paths"')
    $bracketStart = $configText.IndexOf('[', $start)
    $bracketEnd = $configText.IndexOf(']', $bracketStart)
    $pathsStr = $configText.Substring($bracketStart, $bracketEnd - $bracketStart + 1)
    
    $pathMatches = [regex]::Matches($pathsStr, '"([^"]+)"')
    foreach ($pm in $pathMatches) {
      $p = $pm.Groups[1].Value
      # Expandir variables de entorno
      $expanded = [Environment]::ExpandEnvironmentVariables($p)
      if (-not (Test-Path $expanded)) {
        $errors += "skills.paths: ruta no encontrada: $p (expandido: $expanded)"
      }
    }
  } else {
    $errors += "skills: falta 'paths'"
  }

  # Verificar compaction.reserved si existe
  if ($configText -match '"reserved"\s*:\s*(\d+)') {
    $val = [int]$Matches[1]
    if ($val -lt 1024 -or $val -gt 65536) {
      $errors += "compaction.reserved debe estar entre 1024 y 65536 (actual: $val)"
    }
  }

  if ($errors.Count -eq 0) {
    Write-Host "[validate-config] CONFIGURACION VALIDA" -ForegroundColor Green
    exit 0
  } else {
    Write-Host "[validate-config] ERRORES ENCONTRADOS:" -ForegroundColor Red
    foreach ($e in $errors) { Write-Host "  - $e" -ForegroundColor Red }
    exit 1
  }
}
catch {
  Write-Host "[validate-config] Error inesperado: $_" -ForegroundColor Red
  exit 1
}
