param(
  [switch]$Minify,
  [switch]$Baseline,
  [switch]$NoWebUi,
  [switch]$DryRun
)

$scriptDir = "D:\opencode\packages\opencode\script"

Write-Output "=== REBUILD OPENCODE-VMK OPTIMIZADO ==="
Write-Output "Target: vMK fork binary"
Write-Output ""

if (-not (Test-Path "$scriptDir\build.ts")) {
  Write-Output "ERROR: No se encuentra build.ts en $scriptDir"
  exit 1
}

if ($Minify) {
  Write-Output "Propuesta: Habilitar minify en build.ts (line 174: false -> true)"
  Write-Output "  Impacto: Reduce binario de ~161MB a ~120MB"
  Write-Output "  Riesgo: Minificacion puede ocultar errores en runtime"
  Write-Output "  Accion: Modificar packages/opencode/script/build.ts + rebuild"
}

if ($Baseline) {
  Write-Output "Propuesta: Build con flag --baseline"
  Write-Output "  Impacto: Binario compatible con CPUs sin AVX2"
  Write-Output "  Riesgo: Bajo (usar solo si hay crashes en CPU viejas)"
}

if ($NoWebUi) {
  Write-Output "Propuesta: Build con --skip-embed-web-ui"
  Write-Output "  Impacto: Omite embeber ~50MB de web UI en binario"
  Write-Output "  Riesgo: web UI no disponible (app/ escritorio)"
  Write-Output "  Accion: bun run build -- --skip-embed-web-ui"
}

$currentSize = (Get-Item "D:\opencode\packages\opencode\dist\opencode-windows-x64\bin\opencode-vMK.exe" -ErrorAction SilentlyContinue).Length
Write-Output ""
Write-Output "Tamano actual: $([math]::Round($currentSize/1MB,1))MB"

if ($DryRun) {
  Write-Output ""
  Write-Output "--- Dry Run: comandos que se ejecutarian ---"
  $cmds = @("cd packages/opencode")
  if ($NoWebUi) { $cmds += "bun run build -- --skip-embed-web-ui" }
  else { $cmds += "bun run build" }
  $cmds | ForEach-Object { "  $ $_" }
}

Write-Output ""
Write-Output "Para rebuild con todas las optimizaciones:"
Write-Output '  bun run --cwd packages/opencode build -- --skip-embed-web-ui'
