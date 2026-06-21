param(
  [switch]$Apply,
  [switch]$Revert
)

# Resolves power plan GUID by name as fallback (portable across locales)
function Get-PowerPlanGuid {
  param([string]$Name)
  $plans = powercfg /LIST
  foreach ($line in $plans) {
    if ($line -match "GUID de plan de energía:\s+(\S+)\s+\($Name\)") { return $matches[1] }
    if ($line -match "Power Scheme GUID:\s+(\S+)\s+\($Name\)") { return $matches[1] }
  }
  return $null
}

$GUID_HIGH_PERF = (Get-PowerPlanGuid "Alto rendimiento"), (Get-PowerPlanGuid "High performance"), "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c" | Where-Object { $_ } | Select-Object -First 1
$GUID_BALANCED  = (Get-PowerPlanGuid "Equilibrado"), (Get-PowerPlanGuid "Balanced"), "381b4222-f694-41f0-9685-ff5bb260df2e" | Where-Object { $_ } | Select-Object -First 1

if (-not $Apply -and -not $Revert) {
  Write-Output "Uso: .\scripts\optimize-system.ps1 -Apply | -Revert"
  Write-Output ""
  Write-Output "Status actual:"
  $p = Get-Process -Name "opencode-vMK" -ErrorAction SilentlyContinue
  if ($p) {
    Write-Output "  opencode-vMK: PID $($p.Id) | Prio: $($p.PriorityClass) | RAM: $([math]::Round($p.WorkingSet64/1MB,1))MB"
  } else {
    Write-Output "  opencode-vMK: No running"
  }
  $scheme = powercfg /GETACTIVESCHEME
  Write-Output "  Power plan: $scheme"
  return
}

if ($Apply) {
  Write-Output "=== Aplicando optimización de recursos ==="

  # 1. High priority for opencode-vMK
  $p = Get-Process -Name "opencode-vMK" -ErrorAction SilentlyContinue
  if ($p) {
    try { $p.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::High; Write-Output "✅ opencode-vMK → High priority" } catch { Write-Output "⚠️ No se pudo cambiar prioridad: $_" }
  } else {
    Write-Output "⚠️ opencode-vMK no está corriendo (se aplicará al próximo inicio)"
  }

  # 2. Also for current opencode session
  $p2 = Get-Process -Name "opencode" -ErrorAction SilentlyContinue
  if ($p2) {
    try { $p2.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::High; Write-Output "✅ opencode (session) → High priority" } catch { Write-Output "⚠️ No se pudo cambiar prioridad opencode: $_" }
  }

  # 3. High performance power plan (resolved by name for portability)
  if ($GUID_HIGH_PERF) {
    try {
      powercfg /SETACTIVE $GUID_HIGH_PERF | Out-Null
      Write-Output "✅ Power plan → High Performance ($GUID_HIGH_PERF)"
    } catch {
      Write-Output "⚠️ No se pudo cambiar power plan (admin required)"
    }
  } else {
    Write-Output "⚠️ No se encontró plan High Performance en el sistema"
  }

  # 4. CPU min/max 100%
  try {
    powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMIN 100 | Out-Null
    powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMAX 100 | Out-Null
    Write-Output "✅ CPU throttling → 100% (no throttling)"
  } catch {
    Write-Output "⚠️ No se pudo ajustar CPU throttling"
  }

  # 5. Disable animations for GPU savings
  try {
    Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects" -Name "VisualFXSetting" -Value 2 -ErrorAction SilentlyContinue
    Write-Output "✅ Visual effects → Performance mode"
  } catch { Write-Output "⚠️ No se pudo cambiar efectos visuales" }

  # Summary
  Write-Output ""
  Write-Output "=== Resumen ==="
  $p = Get-Process -Name "opencode-vMK" -ErrorAction SilentlyContinue
  if ($p) { Write-Output "opencode-vMK: $([math]::Round($p.WorkingSet64/1MB,1))MB @ $($p.PriorityClass)" }
  powercfg /GETACTIVESCHEME
}

if ($Revert) {
  Write-Output "=== Revirtiendo a valores normales ==="
  $p = Get-Process -Name "opencode-vMK" -ErrorAction SilentlyContinue
  if ($p) { $p.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::Normal; Write-Output "✅ opencode-vMK → Normal priority" }
  $p2 = Get-Process -Name "opencode" -ErrorAction SilentlyContinue
  if ($p2) { $p2.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::Normal }
  if ($GUID_BALANCED) {
    try {
      powercfg /SETACTIVE $GUID_BALANCED | Out-Null
      Write-Output "✅ Power plan → Balanced ($GUID_BALANCED)"
    } catch { Write-Output "⚠️ No se pudo revertir power plan" }
  } else {
    Write-Output "⚠️ No se encontró plan Balanced en el sistema"
  }
  try {
    Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects" -Name "VisualFXSetting" -Value 1 -ErrorAction SilentlyContinue
  } catch { Write-Output "⚠️ No se pudo revertir efectos visuales" }
  Write-Output "✅ Revertido a configuración normal"
}
