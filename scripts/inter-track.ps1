param(
  [switch]$Increment,
  [switch]$Status,
  [string]$Message = ""
)

$trackDir = Split-Path $PSScriptRoot -Parent
$trackFile = Join-Path $trackDir ".inter-track.json"
if (-not (Test-Path $trackFile)) {
  @{ inter = 0; log = @() } | ConvertTo-Json | Set-Content $trackFile -Encoding UTF8
}

$data = Get-Content $trackFile -Raw | ConvertFrom-Json

if ($Increment) {
  $data.inter = [int]$data.inter + 1
  $entry = @{
    ts = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    n = $data.inter
    msg = $Message
  }
  $data.log += @($entry)
  $data | ConvertTo-Json -Depth 10 | Set-Content $trackFile -Encoding UTF8
  Write-Output -InputObject "inter: $($data.inter)/30 - $Message"
}

if ($Status) {
  Write-Output "=== INTER-TRACK STATUS ==="
  Write-Output "Iteraciones: $($data.inter)/30"
  Write-Output "Últimas entradas:"
  $data.log | Select-Object -Last 5 | ForEach-Object { Write-Output ("  #" + $_.n + ": " + $_.ts + " - " + $_.msg) }
}
