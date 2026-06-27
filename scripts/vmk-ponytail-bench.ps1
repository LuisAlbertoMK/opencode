<#
.SYNOPSIS
  Ponytail Benchmark — mide compresion real vs claims teoricas
  de skills lean-context y karpathy-loop.

  Testea 3 escenarios de output (respuesta tecnica, explicacion,
  debug) y mide chars antes/despues de aplicar compresion.
  Reporta ratio real vs ratio claim.

.DESCRIPTION
  Escenarios simulados:
  1. Technical response (~800c)
  2. Explanation (~500c)
  3. Debug (~400c)

  Para cada escenario, se genera output LEAN, ULTRA, CAVEMAN-lite,
  CAVEMAN-full, CAVEMAN-ultra segun las reglas de lean-context.
  Se mide compresion relativa al baseline (LEAN).

.NOTES
  #vMK: Ponytail benchmark — evaluacion empirica de compresion
#>

$ErrorActionPreference = "Stop"

# ── Escenarios de prueba ─────────────────────────────────
$scenarios = @(
  @{
    Name = "technical-response"
    Full = @"
The answer to your question about configuring the authentication middleware
is that you need to set the JWT_SECRET environment variable in your .env file.
This secret is used to sign and verify the JSON Web Tokens that are generated
when a user logs into your application. Make sure that this secret is at least
256 bits long and that you never commit it to version control. I would also
recommend that you rotate this secret periodically, perhaps every 90 days,
and that you use different secrets for different environments like development,
staging, and production. Additionally, you should consider implementing a
refresh token mechanism to improve the user experience.
"@
  }
  @{
    Name = "explanation"
    Full = @"
The reason why the container-presentational pattern is better than putting
all the logic directly into your components is that it separates concerns
in a very clean way. The container component handles all the business logic,
state management, and data fetching, while the presentational component
only deals with how things look on the screen. This makes your code much
easier to test because you can test the presentational component with mock
data and the container with mocked services. It also makes it easier to
reuse your components across different parts of your application.
"@
  }
  @{
    Name = "debug"
    Full = @"
I have looked at the error you provided and the issue seems to be related
to a missing dependency in your useEffect hook. When you use setInterval
inside a useEffect, you need to include the count variable in your
dependency array, otherwise the callback will capture a stale closure
and will always use the initial value of count. The fix for this is to
either add count to the dependency array or use a ref to store the
latest value without triggering a re-render. I recommend using the
functional update form of setCount to avoid this issue entirely.
"@
  }
)

# ── Compresores por nivel ───────────────────────────────
function Compress-LEAN {
  param([string]$text)
  # Drop disclaimers, transitions, unsolicited suggestions, closures
  $t = $text -replace '(?i)(I would |I recommend that you |you should consider |you need to |The answer to your question about |The reason why |I have looked at )', ''
  $t = $t -replace '(?i)(additionally|also)\s*,?\s*', ''
  $t = $t -replace '(?i)(\s*\.\s*Make sure|\.\s*I would also recommend|\.\s*(\n\s*)?Additionally)', '.'
  $t = $t -replace '(?i)(\. The fix for this|\. The solution|\. The best approach)', '.'
  return $t.Trim()
}

function Compress-ULTRA {
  param([string]$text)
  # LEAN + drop examples, background, "why", "as mentioned"
  $t = Compress-LEAN $text
  $t = $t -replace '(?i)(for example|for instance|such as|like\s+\w+\s+\w+)\s*,?\s*[^.]*\.', '.'
  $t = $t -replace '(?i)(as (mentioned|discussed|said|noted).*?)(\.|,)', '.'
  $t = $t -replace '(?i)(the\s+reason\s+(why|is)|because|due to the fact that)\s+', ''
  # Merge consecutive dots
  $t = $t -replace '\.\s*\.', '.'
  return $t.Trim()
}

function Compress-CAVEMAN-lite {
  param([string]$text)
  # ULTRA + no filler/hedging, sentences OK
  $t = Compress-ULTRA $text
  $t = $t -replace '(?i)\b(perhaps|maybe|probably|usually|generally|basically|essentially|actually|simply|just|very|quite|somewhat|slightly|a bit)\b\s*', ''
  $t = $t -replace '(?i)(in my opinion|from my experience|it seems that|it appears that|i think that|i believe)\s*', ''
  $t = $t -replace '\s+', ' '
  return $t.Trim()
}

function Compress-CAVEMAN-full {
  param([string]$text)
  # drop articles, fragments
  $t = Compress-CAVEMAN-lite $text
  $t = $t -replace '(?i)\b(a|an|the)\b\s*', ''
  $t = $t -replace '\s+', ' '
  return $t.Trim()
}

function Compress-CAVEMAN-ultra {
  param([string]$text)
  # CAVEMAN-full + abbreviations
  $t = Compress-CAVEMAN-full $text
  $replacements = @{
    '(?i)\byou\b' = 'u'
    '(?i)\byour\b' = 'ur'
    '(?i)\bare\b' = 'r'
    '(?i)\bconfiguration\b' = 'cfg'
    '(?i)\bconfigure\b' = 'cfg'
    '(?i)\bauthentication\b' = 'auth'
    '(?i)\bapplication\b' = 'app'
    '(?i)\bcomponent\b' = 'cmp'
    '(?i)\bfunction\b' = 'fn'
    '(?i)\bimplementation\b' = 'impl'
    '(?i)\bdependency\b' = 'dep'
    '(?i)\benvironment\b' = 'env'
    '(?i)\bvariable\b' = 'var'
    '(?i)\bdevelop(a|e)r\b' = 'dev'
    '(?i)\bmanage(r|ment)\b' = 'mgmt'
    '(?i)\bmiddleware\b' = 'mw'
    '(?i)\bparameter\b' = 'param'
    '(?i)\bprocess\b' = 'proc'
    '(?i)\brequest\b' = 'req'
    '(?i)\bresponse\b' = 'res'
    '(?i)\bserver\b' = 'srv'
    '(?i)\bstandard\b' = 'std'
    '(?i)\btoken\b' = 'tkn'
  }
  foreach ($pattern in $replacements.Keys) {
    $t = $t -replace $pattern, $replacements[$pattern]
  }
  $t = $t -replace '\s+', ' '
  return $t.Trim()
}

# ── Runner ───────────────────────────────────────────────
$levels = @("LEAN", "ULTRA", "CAVEMAN-lite", "CAVEMAN-full", "CAVEMAN-ultra")
$compressors = @{
  "LEAN"          = ${function:Compress-LEAN}
  "ULTRA"         = ${function:Compress-ULTRA}
  "CAVEMAN-lite"  = ${function:Compress-CAVEMAN-lite}
  "CAVEMAN-full"  = ${function:Compress-CAVEMAN-full}
  "CAVEMAN-ultra" = ${function:Compress-CAVEMAN-ultra}
}

Write-Host "=== vMK Ponytail Benchmark ===" -ForegroundColor Cyan
Write-Host "Midiendo compresion real vs claims de lean-context`n" -ForegroundColor Gray

Write-Host "Claims teoricos:"
Write-Host "  LEAN:          ~30-50%"
Write-Host "  ULTRA:         ~50-70%"
Write-Host "  CAVEMAN-lite:  ~60-75%"
Write-Host "  CAVEMAN-full:  ~75-85%"
Write-Host "  CAVEMAN-ultra: ~85-95% (with abbreviations)"
Write-Host ""

foreach ($scenario in $scenarios) {
  Write-Host "--- Escenario: $($scenario.Name) ---" -ForegroundColor Yellow
  $full = $scenario.Full
  $baselineLen = $full.Length
  Write-Host "  Baseline: $baselineLen chars"

  foreach ($level in $levels) {
    $compressed = & $compressors[$level] $full
    $compressedLen = $compressed.Length
    $savings = [math]::Round((1 - $compressedLen / $baselineLen) * 100, 1)
    Write-Host "  $($level.PadRight(16)) $compressedLen chars  ($savings% saved)" -ForegroundColor Green
  }
  Write-Host ""
}

# ── Summary table ───────────────────────────────────────
Write-Host "=== RESUMEN: Claims vs Realidad ===" -ForegroundColor Cyan
Write-Host "Nivel          Claim(Range)  Real(tec) Real(exp)  Real(deb)  Verdict"
Write-Host ("-" * 75)

$levelsSummary = @(
  @{Level="LEAN";          Low=30; High=50}
  @{Level="ULTRA";         Low=50; High=70}
  @{Level="CAVEMAN-lite";  Low=60; High=75}
  @{Level="CAVEMAN-full";  Low=75; High=85}
  @{Level="CAVEMAN-ultra"; Low=85; High=95}
)

foreach ($entry in $levelsSummary) {
  $level = $entry.Level
  $claimLow = $entry.Low
  $claimHigh = $entry.High
  $compressor = $compressors[$level]

  $results = @()
  foreach ($s in $scenarios) {
    $len = (& $compressor $s.Full).Length
    $results += [math]::Round((1 - $len / $s.Full.Length) * 100, 1)
  }

  $avg = [math]::Round(($results | Measure-Object -Average).Average, 1)

  if ($avg -ge $claimLow -and $avg -le $claimHigh) {
    $verdict = "MATCH"
    $color = "Green"
  } elseif ($avg -lt $claimLow) {
    $verdict = "UNDER ($avg less than ${claimLow})"
    $color = "Yellow"
  } else {
    $verdict = "OVER ($avg more than ${claimHigh})"
    $color = "Red"
  }

  Write-Host ("{0,-15} {1,3}-{2,3}%    {3,6}%   {4,6}%   {5,6}%   {6}" -f $level,$claimLow,$claimHigh,$results[0],$results[1],$results[2],$verdict) -ForegroundColor $color
}

Write-Host "`nBenchmark completo." -ForegroundColor Cyan
