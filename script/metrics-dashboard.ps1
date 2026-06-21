#!/usr/bin/env powershell
<#
.SYNOPSIS
  Genera dashboard de metricas desde METRICAS.md + BITACORA.md
.PARAMETER MetricsPath
  Ruta a METRICAS.md. Default: D:\opencode\METRICAS.md
.PARAMETER BitacoraPath
  Ruta a BITACORA.md. Default: D:\opencode\BITACORA.md
.PARAMETER OutputPath
  Ruta de salida (opcional). Si se omite, escribe a consola.
#>

param(
  [string]$MetricsPath = (Join-Path (Split-Path $PSScriptRoot -Parent) "METRICAS.md"),
  [string]$BitacoraPath = (Join-Path (Split-Path $PSScriptRoot -Parent) "BITACORA.md"),
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $MetricsPath)) { Write-Error "No existe: $MetricsPath"; exit 1 }
if (-not (Test-Path $BitacoraPath)) { Write-Error "No existe: $BitacoraPath"; exit 1 }

# --- 1. Leer METRICAS ---
$mContent = Get-Content $MetricsPath -Raw

# Extraer secciones de rondas
$rounds = [regex]::Matches($mContent, '(?m)^##\s+(Ronda|Rondas)\s+[\d-]+\s*')

# Extraer mejoras (lineas de tabla con formato | # | Mejora | ... |)
$improvements = [regex]::Matches($mContent, '(?m)^\|\s*\d+\s*\|[^|]+\|[^|]+\|[^|]+\|')

# --- 2. Leer BITACORA ---
$bContent = Get-Content $BitacoraPath -Raw
$dates = [regex]::Matches($bContent, '\d{4}-\d{2}-\d{2}')

# --- 3. Construir dashboard ---
$output = @"
# Dashboard de Metricas - opencode fork

> Generado: $(Get-Date -Format 'yyyy-MM-dd HH:mm')

## Resumen general

| Metrica | Valor |
|---------|-------|
| Rondas documentadas | $($rounds.Count) |
| Mejoras cuantificadas | $($improvements.Count) |
| Entradas con fecha en BITACORA | $($dates.Count) |

## Ultimas 5 mejoras

"@

$recent = @($improvements) | Select-Object -Last 5
foreach ($m in $recent) {
  $cells = $m.Value -split '\|' | ForEach-Object { $_.Trim() }
  if ($cells.Count -ge 4) {
    $output += "| $($cells[1]) | $($cells[2]) | $($cells[3]) |`n"
  }
}

$output += @"

## Rondas detectadas

"@

foreach ($r in $rounds) {
  $output += "- $($r.Value.Trim())`n"
}

$output += @"

## Tendencias

- **ROI mas alto**: Context Engineering (-63.9% tokens, +91.6% accuracy)
- **Area con mas mejoras**: Optimizacion de contexto/tokens
- **Windows optimizations**: WSL2, HAGS, GPU Priority, Defender, PS7

"@

if ($OutputPath) {
  $output | Set-Content -Path $OutputPath -Encoding UTF8
  Write-Host "[metrics-dashboard] Dashboard guardado en: $OutputPath" -ForegroundColor Green
} else {
  Write-Host $output
}
exit 0
