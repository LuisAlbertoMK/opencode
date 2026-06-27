param(
  [switch]$Audit,
  [switch]$Cleanup,
  [switch]$Auto
)

if ($Audit -or $Auto) {
  Write-Output "=== PROCESOS OPENCODE ==="
  $all = Get-CimInstance Win32_Process -Filter "Name LIKE '%opencode%' OR Name LIKE '%engram%'" | Select-Object ProcessId, Name, @{N='RAM(MB)';E={[math]::Round($_.WorkingSetSize/1MB,1)}}, @{N='CPU(s)';E={[math]::Round($_.KernelModeTime/10000000,1)}}, CommandLine

  foreach ($p in $all) {
    $src = if ($p.CommandLine -match 'opencode-vMK') { "vMK (fork)" }
           elseif ($p.CommandLine -match 'AppData.*npm') { "npm (original)" }
           elseif ($p.CommandLine -match 'engram') { "engram MCP" }
           else { "unknown" }
    Write-Output "PID $($p.ProcessId) | $($p.Name) | $($p.'RAM(MB)')MB | $src"
  }

  $total = ($all | Measure-Object -Property 'RAM(MB)' -Sum).Sum
  Write-Output "---"
  Write-Output "RAM total opencode+engram: $([math]::Round($total,1))MB"

  $npmProcesses = $all | Where-Object { $_.CommandLine -match 'AppData.*npm' }
  $vmkProcesses = $all | Where-Object { $_.CommandLine -match 'opencode-vMK' }
  if ($npmProcesses) {
    $npmRAM = ($npmProcesses | Measure-Object -Property 'RAM(MB)' -Sum).Sum
    Write-Output "ADVERTENCIA: $($npmProcesses.Count) instancias de opencode ORIGINAL (npm)"
    Write-Output "RAM desperdiciada: ~$([math]::Round($npmRAM,1))MB"
    Write-Output "Sugerencia: .\scripts\process-audit.ps1 -Cleanup para liberar"
  }
  if ($vmkProcesses) {
    $vmkRAM = ($vmkProcesses | Measure-Object -Property 'RAM(MB)' -Sum).Sum
    Write-Output "NOTA: $($vmkProcesses.Count) instancias de opencode-vMK (fork)"
    Write-Output "RAM usada: ~$([math]::Round($vmkRAM,1))MB"
    Write-Output "Sugerencia: .\scripts\process-audit.ps1 -Cleanup para liberar (incluye vMK)"
  }
}

if ($Cleanup -or $Auto) {
  Write-Output "=== LIMPIEZA ==="
  # Reuse audit query if available, otherwise query fresh
  if (-not $all) {
    $all = Get-CimInstance Win32_Process -Filter "Name LIKE '%opencode%' OR Name LIKE '%engram%'" | Select-Object ProcessId, Name, @{N='RAM(MB)';E={[math]::Round($_.WorkingSetSize/1MB,1)}}, @{N='CPU(s)';E={[math]::Round($_.KernelModeTime/10000000,1)}}, CommandLine
  }
  $npm = $all | Where-Object { $_.CommandLine -match 'AppData.*npm' -and $_.Name -eq 'opencode.exe' }
  $vmk = $all | Where-Object { $_.CommandLine -match 'opencode-vMK' -and $_.Name -eq 'opencode-vMK.exe' }
  foreach ($p in $npm) {
    $processPid = $p.ProcessId
    $ram = [math]::Round($p.WorkingSetSize/1MB,1)
    try {
      Stop-Process -Id $processPid -Force
      Write-Output "Kill PID $processPid (original npm opencode) - liberados ~${ram}MB"
    } catch {
      Write-Output ("No se pudo matar PID " + $processPid + ": " + $_ )
    }
  }
  foreach ($p in $vmk) {
    $processPid = $p.ProcessId
    $ram = [math]::Round($p.WorkingSetSize/1MB,1)
    try {
      Stop-Process -Id $processPid -Force
      Write-Output "Kill PID $processPid (vMK fork) - liberados ~${ram}MB"
    } catch {
      Write-Output ("No se pudo matar PID " + $processPid + ": " + $_ )
    }
  }
}

if (-not $Audit -and -not $Cleanup -and -not $Auto) {
  Write-Output "Uso: .\scripts\process-audit.ps1 -Audit | -Cleanup | -Auto"
}