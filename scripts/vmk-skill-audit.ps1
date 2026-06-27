#!/usr/bin/env pwsh
<#
.SYNOPSIS
  vMK SkillOpt — audita skills instaladas, las scorea y sugiere poda.
.DESCRIPTION
  Lee todas las skills de ~/.config/opencode/skills/, las evalua en
  4 dimensiones objetivas y genera un reporte con:
  - Score individual (0-10)
  - Ranking
  - Sugerencias de poda (skills con score < 5.0)
  - Lista de skills recomendadas para denegar via AGENTS.md
.PARAMETER ScoreThreshold
  Score minimo para considerar una skill aceptable (default: 5.0)
.PARAMETER ReportOnly
  Solo mostrar reporte, sin modificar nada.
.PARAMETER Apply
  Generar archivo .vmk-config/skill-deny.txt con skills a denegar.
.EXAMPLE
  .\scripts\vmk-skill-audit.ps1
  .\scripts\vmk-skill-audit.ps1 -ScoreThreshold 6.0 -Apply
#>

param(
  [double]$ScoreThreshold = 5.0,
  [switch]$ReportOnly,
  [switch]$Apply
)

$ErrorActionPreference = "Stop"
$skillDir = "$env:USERPROFILE\.config\opencode\skills"

if (-not (Test-Path $skillDir)) {
  Write-Error "Skills directory not found: $skillDir"
  exit 1
}

# Dimension weights for total score
$weights = @{
  description = 0.35   # Does the skill clearly state what it does?
  freshness   = 0.20   # Is the content recent / well-maintained?
  density     = 0.25   # Is it concise? (skills >5KB lose points)
  structure   = 0.20   # Does it have proper frontmatter and structure?
}

function Score-Description {
  param([string]$desc)
  if ([string]::IsNullOrWhiteSpace($desc)) { return 0 }
  $score = 5.0
  # Length penalty: too short (< 10 chars) or too long (> 200 chars)
  if ($desc.Length -lt 10) { $score -= 3.0 }
  elseif ($desc.Length -gt 200) { $score -= 1.0 }
  # Action verb bonus (starts with verb like "Audit", "Create", "Fix")
  if ($desc -match '^(Audit|Create|Fix|Build|Design|Run|Optimize|Score|Test|Verify|Check|Apply|Capture)') { $score += 1.5 }
  # Vague words penalty
  if ($desc -match '\b(thing|stuff|various|some|nice|simple|easy)\b') { $score -= 1.0 }
  # Specificity bonus (contains keywords about what it actually does)
  if ($desc -match '\b(for|using|with|via)\b') { $score += 1.0 }
  return [Math]::Min(10.0, [Math]::Max(0.0, $score))
}

function Score-Freshness {
  param([string]$content)
  # Check for changelog entries with dates
  $dateMatches = [regex]::Matches($content, '\d{4}-\d{2}-\d{2}')
  if ($dateMatches.Count -eq 0) { return 3.0 }  # No dates = old or unmaintained
  $latestDate = $dateMatches | ForEach-Object { [datetime]::ParseExact($_.Value, 'yyyy-MM-dd', $null) } | Sort-Object -Descending | Select-Object -First 1
  $daysOld = [int]((Get-Date) - $latestDate).TotalDays
  if ($daysOld -lt 7) { return 10.0 }
  if ($daysOld -lt 30) { return 8.0 }
  if ($daysOld -lt 90) { return 6.0 }
  if ($daysOld -lt 180) { return 4.0 }
  return 2.0
}

function Score-Density {
  param([string]$content)
  $lines = $content -split "`n" | Where-Object { $_.Trim() -ne "" }
  if ($lines.Count -eq 0) { return 0 }
  $totalLength = $content.Length
  # Skills > 5KB are over-engineered
  if ($totalLength -gt 5000) { return 2.0 }
  # Skills < 500 bytes are too sparse
  if ($totalLength -lt 500) { return 4.0 }
  # Ideal range: 1-3KB
  if ($totalLength -ge 1000 -and $totalLength -le 3000) { return 9.0 }
  if ($totalLength -gt 3000) { return 6.0 }
  return 7.0
}

function Score-Structure {
  param([string]$content)
  $score = 5.0
  # Frontmatter check (---name:...---)
  if ($content -match '^---[\s\S]*?---') { $score += 2.0 } else { $score -= 3.0 }
  # Has description in frontmatter
  if ($content -match 'description:\s*["'']?.+["'']?') { $score += 1.0 }
  # Has sections (##)
  $sections = [regex]::Matches($content, '^##\s').Count
  if ($sections -ge 2) { $score += 1.0 }
  # Has trigger keywords
  if ($content -match '(?:Trigger|Use when|Purpose|Goal)') { $score += 1.0 }
  return [Math]::Min(10.0, [Math]::Max(0.0, $score))
}

$results = @()
$dirs = Get-ChildItem -LiteralPath $skillDir -Directory | Sort-Object Name

foreach ($dir in $dirs) {
  $skillName = $dir.Name
  $skillFile = Join-Path $dir.FullName "SKILL.md"

  if (-not (Test-Path $skillFile)) {
    Write-Warning "No SKILL.md found in $($dir.FullName)"
    continue
  }

  $content = Get-Content -LiteralPath $skillFile -Raw -ErrorAction SilentlyContinue
  if (-not $content) {
    Write-Warning "Cannot read $skillFile"
    continue
  }

  # Extract frontmatter description
  $desc = ""
  if ($content -match '^---\s*\n([\s\S]*?)\n---') {
    $frontmatter = $Matches[1]
    # Match description line: description: "value" or description: 'value' or description: value
    if ($frontmatter -match 'description:\s*"([^"]+)"') {
      $desc = $Matches[1]
    } elseif ($frontmatter -match "description:\s*'([^']+)'") {
      $desc = $Matches[1]
    } elseif ($frontmatter -match 'description:\s*(\S[^\n]*)') {
      $desc = $Matches[1]
    }
  }

  $sDesc = Score-Description -desc $desc
  $sFresh = Score-Freshness -content $content
  $sDensity = Score-Density -content $content
  $sStruct = Score-Structure -content $content

  $total = [Math]::Round(
    $sDesc * $weights.description +
    $sFresh * $weights.freshness +
    $sDensity * $weights.density +
    $sStruct * $weights.structure,
    1
  )

  $results += [PSCustomObject]@{
    Skill       = $skillName
    Score       = $total
    Description = $sDesc
    Freshness   = $sFresh
    Density     = $sDensity
    Structure   = $sStruct
    SizeKB      = [Math]::Round($content.Length / 1024, 1)
    Status      = if ($total -lt $ScoreThreshold) { "PODAR" } else { "OK" }
  }
}

# Report
$sorted = $results | Sort-Object Score
$toPrune = $sorted | Where-Object { $_.Status -eq "PODAR" }

Write-Host "`n=== vMK SkillOpt Report ===" -ForegroundColor Cyan
Write-Host "Score threshold: $ScoreThreshold/10"
Write-Host "Skills audited: $($results.Count)"
Write-Host "Skills to prune: $($toPrune.Count)`n"

$sorted | Format-Table -Property @{L='Skill';E={$_.Skill}}, @{L='Score';E={$_.Score}}, @{L='Desc';E={$_.Description}}, @{L='Fresh';E={$_.Freshness}}, @{L='Dense';E={$_.Density}}, @{L='Struct';E={$_.Structure}}, @{L='KB';E={$_.SizeKB}}, Status -AutoSize

if ($toPrune.Count -gt 0) {
  Write-Host "`n=== Skills recomendadas para denegar ===" -ForegroundColor Yellow
  Write-Host "Agrega estas al AGENTS.md en la seccion de permission del agente:`n"
  Write-Host "# skill-deny.txt - Generado por vmk-skill-audit.ps1" -ForegroundColor Gray
  foreach ($s in $toPrune) {
    Write-Host "  deny skill:$($s.Skill)" -ForegroundColor Yellow
  }

  if ($Apply) {
    $denyFile = Join-Path (Split-Path $skillDir -Parent) ".vmk-config\skill-deny.txt"
    $null = New-Item -ItemType Directory -Path (Split-Path $denyFile -Parent) -Force -ErrorAction SilentlyContinue
    @("# vMK SkillOpt - Generated $(Get-Date -Format 'yyyy-MM-dd HH:mm')", "# Add these to AGENTS.md agent permission:") + ($toPrune | ForEach-Object { "deny skill:$($_.Skill)" }) |
      Set-Content -LiteralPath $denyFile -Encoding UTF8
    Write-Host "`nSaved to: $denyFile" -ForegroundColor Green
  }
}

Write-Host "`n=== Top 5 skills ===" -ForegroundColor Green
$sorted | Sort-Object Score -Descending | Select-Object -First 5 | Format-Table Skill, Score, Status -AutoSize

Write-Host "=== Bottom 5 skills ===" -ForegroundColor Red
$sorted | Select-Object -First 5 | Format-Table Skill, Score, Status -AutoSize
