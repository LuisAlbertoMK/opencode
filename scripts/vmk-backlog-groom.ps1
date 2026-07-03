# ============================================================
# vMK Backlog Groom - Validacion de Definition of Ready
# ============================================================
# Uso: .\scripts\vmk-backlog-groom.ps1 [-Strict] [-File "path\BACKLOG.md"]
# ============================================================

param(
    [Parameter(Mandatory=$false)]
    [switch]$Strict,

    [Parameter(Mandatory=$false)]
    [string]$File = "$PSScriptRoot\..\BACKLOG.md"
)

$ErrorActionPreference = "Stop"

Write-Host "`n=== vMK Backlog Groom ===" -ForegroundColor Cyan
Write-Host "Archivo: $File`n" -ForegroundColor Gray

if (-not (Test-Path $File)) {
    Write-Host "[ERROR] BACKLOG.md no encontrado en: $File" -ForegroundColor Red
    exit 1
}

$content = Get-Content $File -Raw

# Parsear tabla "Abierto" (entre "## Abierto" y "## Completado" o EOF)
$openSection = $content -split '## Abierto' | Select-Object -Last 1
$openSection = $openSection -split '## Completado' | Select-Object -First 1

# Extraer filas de tabla markdown
$rows = $openSection -split "`n" | Where-Object { $_ -match '^\|.*\|.*\|' } | Where-Object { $_ -notmatch '^\|[:-:]+' }

$items = @()
$inProgressCount = 0
$inProgressWithDoR = 0
$totalWithDoR = 0
$totalItems = 0
$itemsWithoutCycle = 0
$itemsWithoutEstimation = 0

foreach ($row in $rows) {
    # Parse: | # | Item | Estado | Ciclo | Prioridad | DoR | Estimación | Notas |
    $cells = $row.Trim('| ') -split '\s*\|\s*'
    if ($cells.Count -lt 8) { continue }  # Header o fila malformada

    $num = $cells[0].Trim()
    $item = $cells[1].Trim()
    $estado = $cells[2].Trim()
    $ciclo = $cells[3].Trim()
    $prioridad = $cells[4].Trim()
    $dor = $cells[5].Trim()
    $estimacion = $cells[6].Trim()
    $notas = $cells[7].Trim()

    if (-not ($num -match '^\d+$')) { continue }  # Saltar header

    $totalItems++
    $hasDoR = $dor -eq '✅'
    $hasCycle = $ciclo -notmatch '^—$|^$'
    $hasEstimation = $estimacion -match '^[SML]$'

    if ($hasDoR) { $totalWithDoR++ }
    if (-not $hasCycle) { $itemsWithoutCycle++ }
    if (-not $hasEstimation) { $itemsWithoutEstimation++ }

    if ($estado -match 'En progreso|🔶') {
        $inProgressCount++
        if ($hasDoR) { $inProgressWithDoR++ }
        else {
            Write-Host "[WARN] Item #$num '$item' está 'En progreso' PERO DoR = $dor" -ForegroundColor Yellow
        }
    }

    $items += @{
        Num = $num
        Item = $item
        Estado = $estado
        Ciclo = $ciclo
        Prioridad = $prioridad
        DoR = $dor
        Estimacion = $estimacion
        HasDoR = $hasDoR
        HasCycle = $hasCycle
        HasEstimation = $hasEstimation
    }
}

# Métricas
$pctDoR = if ($totalItems -gt 0) { [math]::Round(($totalWithDoR / $totalItems) * 100, 1) } else { 0 }
$pctCycle = if ($totalItems -gt 0) { [math]::Round((($totalItems - $itemsWithoutCycle) / $totalItems) * 100, 1) } else { 0 }
$pctEstimation = if ($totalItems -gt 0) { [math]::Round((($totalItems - $itemsWithoutEstimation) / $totalItems) * 100, 1) } else { 0 }

Write-Host "=== Resumen Backlog ===" -ForegroundColor Cyan
Write-Host "Total items abiertos: $totalItems" -ForegroundColor White
Write-Host "Items con DoR ✅: $totalWithDoR / $totalItems ($pctDoR%)" -ForegroundColor $(if ($pctDoR -ge 80) { "Green" } else { "Yellow" })
Write-Host "Items con Ciclo asignado: $(($totalItems - $itemsWithoutCycle)) / $totalItems ($pctCycle%)" -ForegroundColor $(if ($pctCycle -ge 80) { "Green" } else { "Yellow" })
Write-Host "Items con Estimación (S/M/L): $(($totalItems - $itemsWithoutEstimation)) / $totalItems ($pctEstimation%)" -ForegroundColor $(if ($pctEstimation -ge 80) { "Green" } else { "Yellow" })
Write-Host "Items 'En progreso': $inProgressCount (DoR ✅: $inProgressWithDoR)" -ForegroundColor White

if ($inProgressCount -gt 0 -and $inProgressWithDoR -lt $inProgressCount) {
    Write-Host "`n[FAIL] Hay items 'En progreso' SIN DoR ✅" -ForegroundColor Red
    $exitCode = 1
} elseif ($pctDoR -lt 80 -and $Strict) {
    Write-Host "`n[FAIL -Strict] DoR coverage $pctDoR% < 80% target" -ForegroundColor Red
    $exitCode = 1
} elseif ($pctDoR -lt 80) {
    Write-Host "`n[WARN] DoR coverage $pctDoR% < 80% target (use -Strict para fallar)" -ForegroundColor Yellow
    $exitCode = 0
} else {
    Write-Host "`n[PASS] Backlog health OK" -ForegroundColor Green
    $exitCode = 0
}

# Detalle items sin DoR
$noDoR = $items | Where-Object { -not $_.HasDoR }
if ($noDoR.Count -gt 0) {
    Write-Host "`nItems SIN DoR:" -ForegroundColor Yellow
    $noDoR | ForEach-Object { Write-Host "  #$($_.Num) $($_.Item) [$($_.Estado)]" -ForegroundColor Gray }
}

# Detalle items sin Ciclo
$noCycle = $items | Where-Object { -not $_.HasCycle }
if ($noCycle.Count -gt 0) {
    Write-Host "`nItems SIN Ciclo asignado:" -ForegroundColor Gray
    $noCycle | ForEach-Object { Write-Host "  #$($_.Num) $($_.Item)" -ForegroundColor Gray }
}

Write-Host "`n=== Fin ===" -ForegroundColor Cyan
exit $exitCode