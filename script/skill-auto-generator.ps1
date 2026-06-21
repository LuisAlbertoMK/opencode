#!/usr/bin/env powershell
<#
.SYNOPSIS
  Auto-genera skills desde patrones repetidos en BITACORA.md
.DESCRIPTION
  Escanea BITACORA.md, extrae conceptos técnicos mencionados en >=2 entradas
  y genera un stub de skill en ~/.config/opencode/skills/<nombre>/SKILL.md
.PARAMETER BitacoraPath
  Ruta a BITACORA.md. Default: D:\opencode\BITACORA.md
.PARAMETER OutputDir
  Directorio de skills destino. Default: ~/.config/opencode/skills
.PARAMETER MinFrequency
  Minimo de repeticiones para generar skill. Default: 2
.PARAMETER DryRun
  Solo mostrar que skills se generarian, sin escribirlas
#>

param(
  [string]$BitacoraPath = (Join-Path (Split-Path $PSScriptRoot -Parent) "BITACORA.md"),
  [string]$OutputDir = "$env:USERPROFILE\.config\opencode\skills",
  [int]$MinFrequency = 2,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BitacoraPath)) {
  Write-Error "BITACORA no encontrada: $BitacoraPath"
  exit 1
}

Write-Host "[skill-auto-generator] Escaneando $BitacoraPath ..." -ForegroundColor Cyan

# --- 1. Parsear BITACORA en entradas ---
$content = Get-Content $BitacoraPath -Raw
$entries = $content -split '(?=^## )' | Where-Object { $_ -match 'Ronda \d+' -or $_ -match '^\*\*' }

# --- 2. Extraer conceptos clave (palabras tecnicas comunes) ---
$conceptCount = @{}
$entryConcepts = @{}

$keywords = @('typecheck','lint','compile','benchmark','refactor','optimize','debug',
              'WSL','Windows','PS7','SDD','GPU','CPU','RAM','CLI','TUI','API',
              'tree-sitter','ripgrep','simdjson','hypergrep','ast-grep','engram',
              'bitacora','turbo','CoT','Focus','Reflexion','HAGS','Defender',
              'schema','validation','hook','pre-commit','pre-push','metrics')

foreach ($entry in $entries) {
  $entryKey = ($entry -split "`n")[0].Trim()
  $found = @{}
  $entryLower = $entry.ToLower()
  
  foreach ($kw in $keywords) {
    if ($entryLower -match [regex]::Escape($kw.ToLower())) {
      if (-not $conceptCount.ContainsKey($kw)) { $conceptCount[$kw] = 0 }
      $conceptCount[$kw]++
      $found[$kw] = $true
    }
  }
  
  if ($found.Keys.Count -gt 0) {
    $entryConcepts[$entryKey] = $found.Keys
  }
}

# --- 3. Filtrar conceptos con frecuencia >= MinFrequency ---
$recurring = $conceptCount.GetEnumerator() | Where-Object { $_.Value -ge $MinFrequency } | Sort-Object Name

if ($recurring.Count -eq 0) {
  Write-Host "[skill-auto-generator] No se encontraron patrones recurrentes (min=$MinFrequency)" -ForegroundColor Yellow
  exit 0
}

Write-Host "[skill-auto-generator] Patrones recurrentes encontrados:" -ForegroundColor Green
$recurring | ForEach-Object { Write-Host "  $($_.Name): $($_.Value)x" }

# --- 4. Generar skills ---
$generated = 0
foreach ($item in $recurring) {
  $concept = $item.Name
  $skillName = $concept.ToLower() -replace '[^a-z0-9-]', '-'
  $skillDir = Join-Path -Path $OutputDir -ChildPath $skillName
  $skillFile = Join-Path -Path $skillDir -ChildPath "SKILL.md"
  
  $mentions = @($entryConcepts.GetEnumerator() | Where-Object { $_.Value -contains $concept } | ForEach-Object { $_.Key })
  $context = ($mentions -join '; ')
  if ($context.Length -gt 200) { $context = $context.Substring(0, 200) }
  
  if ($DryRun) {
    Write-Host "  [DRY-RUN] Generaria skill '$skillName' -> $skillFile" -ForegroundColor Magenta
    $generated++
    continue
  }
  
  if (Test-Path $skillFile) {
    Write-Host "  [SKIP] $skillName ya existe" -ForegroundColor DarkGray
    continue
  }
  
  New-Item -ItemType Directory -Path $skillDir -Force | Out-Null
  
  $today = Get-Date -Format 'yyyy-MM-dd'
  $desc = "Auto-generado desde BITACORA. Concepto: $concept ($($item.Value) ocurrencias)."
  
$content = @"
---
name: $skillName
description: "$desc"
triggers: "$concept, $skillName"
license: Apache-2.0
metadata: auto-generated: true, source: BITACORA, frequency: $($item.Value), date: "$today"
---

# $skillName

Auto-generado desde BITACORA. Basado en $($item.Value) ocurrencias del concepto `$concept`.

## Entradas relacionadas

"@

  foreach ($m in $mentions) {
    $content += "- $m`n"
  }
  
  $content += @"

## TODO: Completar con logica especifica del skill
"@
  
  Set-Content -Path $skillFile -Value $content -Encoding UTF8
  Write-Host "  [GENERATED] $skillName -> $skillFile" -ForegroundColor Green
  $generated++
}

Write-Host "[skill-auto-generator] Completado: $generated skills procesadas" -ForegroundColor Cyan
