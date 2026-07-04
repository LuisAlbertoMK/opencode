# Categorize untagged source files by change type
$untagged = git diff origin/dev --name-only 2>$null | Where-Object {
  $_ -match '^packages/[^/]+/src/' -or $_ -match '^packages/opencode/script/build\.ts$'
} | ForEach-Object {
  $full = Join-Path "D:\opencode" $_
  if (Test-Path $full) {
    $c = Get-Content $full -Raw
    if ($c -notmatch '// vMK:') { $_ }
  }
}

foreach ($f in $untagged) {
  $diff = git diff origin/dev -- $f 2>$null
  $hasDefect = $diff -match 'Schema\.Defect\b'
  $hasNonNull = $diff -match '!\s*$'
  $hasLogic = $diff -match '(endpoint|OAUTH_CALLBACK_HOST|class McpOAuthPendingProvider|languageModel|ToolResultValueSchema|debug_view|isTokenExpired|CopilotEndpoint|unsub|onCleanup)'
  $isNew = $diff -match 'new file mode'
  if ($isNew) {
    Write-Host "NEW: $f"
  } elseif ($hasLogic) {
    Write-Host "LOGIC: $f"
  } elseif ($hasDefect -and !$hasNonNull) {
    Write-Host "DEFECT: $f"
  } elseif ($hasNonNull -and !$hasDefect) {
    Write-Host "NONNUL: $f"
  } elseif ($hasDefect -and $hasNonNull) {
    Write-Host "MIXED: $f"
  } else {
    Write-Host "OTHER: $f"
  }
}
