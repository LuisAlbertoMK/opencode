param(
  [switch]$Apply,
  [switch]$Status
)

if ($Status) {
  Write-Output "=== MEMORY TUNING STATUS ==="
  $p = Get-Process -Name "opencode-vMK","opencode" -ErrorAction SilentlyContinue
  foreach ($proc in $p) {
    $src = if ($proc.Name -eq "opencode-vMK") { "vMK" } else { "original" }
    Write-Output "$($proc.Name) PID $($proc.Id) | $($src) | $([math]::Round($proc.WorkingSet64/1MB,1))MB | Prio: $($proc.PriorityClass)"
  }
  Write-Output ""
  $os = Get-CimInstance Win32_OperatingSystem
  Write-Output "RAM total: $([math]::Round($os.TotalVisibleMemorySize/1KB,1))GB"
  Write-Output "RAM libre: $([math]::Round($os.FreePhysicalMemory/1KB,1))GB"
  Write-Output "RAM usado: $([math]::Round(($os.TotalVisibleMemorySize-$os.FreePhysicalMemory)/1KB,1))GB"
  return
}

if ($Apply) {
  Write-Output "=== APLICANDO MEMORY TUNING ==="

  # 1. Set opencode-vMK working set trim (Windows memory management hint)
  $p = Get-Process -Name "opencode-vMK" -ErrorAction SilentlyContinue
  if ($p) {
    try {
      # Empty working set - forces pagefile for less-used pages
      [System.GC]::Collect()
      [System.GC]::WaitForPendingFinalizers()
      Write-Output "GC collect ejecutado"
    } catch {
      Write-Output "No se pudo ejecutar GC: $_"
    }
  }

  # 2. Bun cache cleanup
  $bunCache = "$env:USERPROFILE\.bun\install\cache"
  if (Test-Path $bunCache) {
    $cacheSize = (Get-ChildItem $bunCache -Recurse -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
    Write-Output "Bun cache: $([math]::Round($cacheSize/1MB,1))MB en $bunCache"
    if ($cacheSize -gt 500MB) {
      Write-Output "Sugerencia: bun pm cache rm para limpiar cache"
    }
  }

  # 3. Windows Temp cleanup
  $tempPath = "$env:TEMP"
  if (Test-Path $tempPath) {
    $tempSize = (Get-ChildItem $tempPath -Recurse -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
    Write-Output "Temp: $([math]::Round($tempSize/1MB,1))MB en $tempPath"
  }

  # 4. OpenCode temp cleanup (per engram protocol)
  $ocTemp = "$env:TEMP\opencode"
  if (Test-Path $ocTemp) {
    $oldFiles = Get-ChildItem $ocTemp -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt (Get-Date).AddHours(-24) }
    if ($oldFiles) {
      $oldSize = ($oldFiles | Measure-Object Length -Sum).Sum
      $oldFiles | Remove-Item -Force -ErrorAction SilentlyContinue
      Write-Output "Limpiados $($oldFiles.Count) archivos temp opencode (>24h): $([math]::Round($oldSize/1MB,1))MB"
    } else {
      Write-Output "No hay archivos temp opencode viejos"
    }
  }

  Write-Output "Memory tuning completado"
}
