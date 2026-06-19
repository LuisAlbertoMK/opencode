param(
  [switch]$Increment,
  [switch]$Status,
  [switch]$Show,
  [string]$Message = ""
)

$repoRoot = Split-Path $PSScriptRoot -Parent
$trackFile = Join-Path $repoRoot ".inter-track.json"
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
  $remaining = [Math]::Max(0, 30 - [int]$data.inter)
  if ($remaining -le 0) {
    Write-Host "inter: $($data.inter)/30 ✅" -ForegroundColor Green
  } else {
    Write-Host "inter: $($data.inter)/30 ($remaining remaining)" -ForegroundColor Yellow
  }
}

if ($Status) {
  Write-Host "=== INTER-TRACK STATUS ===" -ForegroundColor Cyan
  Write-Host "Iteraciones: $($data.inter)/30"
  Write-Host "Últimas entradas:"
  $data.log | Select-Object -Last 5 | ForEach-Object { Write-Host ("  #" + $_.n + ": " + $_.ts + " - " + $_.msg) }
}

if ($Show -or ($Status -and $Show)) {
  $scorePath = Join-Path $repoRoot ".project.json"
  if (Test-Path $scorePath) {
    try {
      $scoreData = Get-Content $scorePath -Raw | ConvertFrom-Json
      Write-Host "Score: $($scoreData.score.current)/10 (trend: $($scoreData.score.trend))" -ForegroundColor Green
    } catch {
      Write-Debug "inter-track: cannot read score ($($_.Exception.Message))"
    }
  }
}

# Also show on plain call (no flags) like !cycle
if (-not $Increment -and -not $Status -and -not $Show) {
  Write-Host "inter: $($data.inter)/30" -ForegroundColor Cyan
  $scorePath = Join-Path $repoRoot ".project.json"
  if (Test-Path $scorePath) {
    try {
      $scoreData = Get-Content $scorePath -Raw | ConvertFrom-Json
      Write-Host "Score: $($scoreData.score.current)/10 (trend: $($scoreData.score.trend))" -ForegroundColor Green
    } catch {
      Write-Debug "inter-track: cannot read score ($($_.Exception.Message))"
    }
  }
}
