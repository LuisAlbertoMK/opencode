# ============================================================
# vMK Token Audit - Analisis de Truncamiento MCP
# ============================================================
# Uso: .\scripts\vmk-token-audit.ps1 [-LogPath "path"] [-Since "YYYY-MM-DD"]
# ============================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$LogPath = "$PSScriptRoot\..\.vmk-data\logs",

    [Parameter(Mandatory=$false)]
    [string]$Since = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd"),

    [Parameter(Mandatory=$false)]
    [switch]$ShowVerbose
)

$ErrorActionPreference = "Stop"

Write-Host "`n=== vMK MCP Token Audit ===" -ForegroundColor Cyan
Write-Host "Log path: $LogPath" -ForegroundColor Gray
Write-Host "Since: $Since`n" -ForegroundColor Gray

if (-not (Test-Path $LogPath)) {
    Write-Host "[AVISO] Directorio de logs no existe: $LogPath" -ForegroundColor Yellow
    Write-Host "Ejecutando sin logs historicos (solo configuracion actual)...`n" -ForegroundColor Gray
}

# --- Cargar configuracion MCP actual ---
$mcpConfigPath = "$PSScriptRoot\..\.vmk-config\mcp.json"
$serverLimits = @{}

if (Test-Path $mcpConfigPath) {
    $mcpConfig = Get-Content $mcpConfigPath | ConvertFrom-Json
    if ($mcpConfig.mcpServers) {
        foreach ($server in $mcpConfig.mcpServers.PSObject.Properties) {
            $name = $server.Name
            $limit = $server.Value.truncateLimit
            $serverLimits[$name] = if ($limit) { $limit } else { 10240 }  # 10KB global default
        }
    }
}

Write-Host "=== Limites configurados por server ===" -ForegroundColor Cyan
foreach ($kv in $serverLimits.GetEnumerator()) {
    Write-Host "  $($kv.Key): $($kv.Value) bytes ($([math]::Round($kv.Value/1024,1)) KB)" -ForegroundColor White
}

# --- Analizar logs si existen ---
$truncations = @()
$totalTruncatedBytes = 0
$serverTruncations = @{}

if (Test-Path $LogPath) {
    $logFiles = Get-ChildItem -Path $LogPath -Filter "*.log" -Recurse | Where-Object { $_.LastWriteTime -ge [datetime]$Since }

    foreach ($file in $logFiles) {
        $content = Get-Content $file -Raw
        # Buscar patrones de truncamiento en logs MCP
        $matches = [regex]::Matches($content, 'truncat(?:ed|ion).*?(\d+)\s*(?:bytes|chars|lines)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        foreach ($m in $matches) {
            $bytes = [int]$m.Groups[1].Value
            $totalTruncatedBytes += $bytes
            $context = $m.Value.Substring(0, [math]::Min(100, $m.Value.Length))
        $truncations += @{ File = $file.Name; Bytes = $bytes; Context = $context }
        }
    }
}

# --- Resumen ---
Write-Host "`n=== Resumen de Truncamientos ===" -ForegroundColor Cyan
Write-Host "Total truncamientos detectados: $($truncations.Count)" -ForegroundColor White
Write-Host "Bytes totales truncados: $($totalTruncatedBytes) bytes ($([math]::Round($totalTruncatedBytes/1024,1)) KB)" -ForegroundColor White

if ($truncations.Count -gt 0) {
    Write-Host "`nDetalle:" -ForegroundColor Yellow
    $truncations | Group-Object File | ForEach-Object {
        $sum = ($_.Group | Measure-Object Bytes -Sum).Sum
        Write-Host "  $($_.Name): $($_.Count) truncamientos, $([math]::Round($sum/1024,1)) KB" -ForegroundColor White
    }

    # Top 5 mayores truncamientos
    $top5 = $truncations | Sort-Object Bytes -Descending | Select-Object -First 5
    Write-Host "`nTop 5 mayores truncamientos:" -ForegroundColor Yellow
    $top5 | ForEach-Object {
        Write-Host "  [$($_.File)] $($_.Bytes) bytes - $($_.Context)" -ForegroundColor Gray
    }
}

# --- Recomendaciones ---
Write-Host "`n=== Recomendaciones ===" -ForegroundColor Cyan

if ($truncations.Count -eq 0) {
    Write-Host "✅ Sin truncamientos detectados en el periodo." -ForegroundColor Green
} elseif ($truncations.Count -lt 5) {
    Write-Host "✅ Pocos truncamientos ($($truncations.Count)) - dentro de target (<5/sesion)." -ForegroundColor Green
} else {
    Write-Host "⚠️  ALERTA: $($truncations.Count) truncamientos exceden target (<5/sesion)." -ForegroundColor Yellow
    Write-Host "   Acciones sugeridas:" -ForegroundColor Yellow
    Write-Host "   1. Aumentar truncateLimit en servers afectados" -ForegroundColor Gray
    Write-Host "   2. Usar limites mas conservadores en parametros de herramientas" -ForegroundColor Gray
    Write-Host "   3. Implementar paginacion para queries grandes" -ForegroundColor Gray
}

if ($totalTruncatedBytes -gt 51200) {  # 50 KB
    Write-Host "`n⚠️  ALERTA: $([math]::Round($totalTruncatedBytes/1024,1)) KB truncados exceden target (<50 KB/sesion)." -ForegroundColor Yellow
}

# --- Verificar configuracion vs recomendaciones ---
Write-Host "`n=== Verificacion de Configuracion ===" -ForegroundColor Cyan

$recommended = @{
    "context7" = 8192
    "engram" = 4096
    "codebase-memory" = 16384
    "github" = 8192
}

foreach ($rec in $recommended.GetEnumerator()) {
    $current = $serverLimits[$rec.Key]
    if ($current) {
        if ($current -lt $rec.Value) {
            Write-Host "  [$($rec.Key)] ACTUAL: $($current)B ($([math]::Round($current/1024,1)) KB) | RECOMENDADO: $($rec.Value)B ($([math]::Round($rec.Value/1024,1)) KB) - SUBIR" -ForegroundColor Yellow
        } elseif ($current -gt $rec.Value * 2) {
            Write-Host "  [$($rec.Key)] ACTUAL: $($current)B ($([math]::Round($current/1024,1)) KB) | RECOMENDADO: $($rec.Value)B ($([math]::Round($rec.Value/1024,1)) KB) - POSIBLEMENTE ALTO" -ForegroundColor Gray
        } else {
            Write-Host "  [$($rec.Key)] ACTUAL: $($current)B ($([math]::Round($current/1024,1)) KB) | RECOMENDADO: $($rec.Value)B ($([math]::Round($rec.Value/1024,1)) KB) - OK" -ForegroundColor Green
        }
    } else {
        Write-Host "  [$($rec.Key)] NO CONFIGURADO - usar default global (10 KB) - RECOMENDADO: ${rec.Value}B" -ForegroundColor Yellow
    }
}

# Servers configurados sin recomendacion especifica
foreach ($kv in $serverLimits.GetEnumerator()) {
    if (-not $recommended.ContainsKey($kv.Key)) {
        Write-Host "  [$($kv.Key)] ACTUAL: $($kv.Value)B ($([math]::Round($kv.Value/1024,1)) KB) - Sin recomendacion especifica (default 5 KB sugerido)" -ForegroundColor Gray
    }
}

Write-Host "`n=== Fin del Auditoria ===" -ForegroundColor Cyan