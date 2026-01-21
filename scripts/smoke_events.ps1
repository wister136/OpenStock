param(
  [string]$ApiKey = "",
  [string]$BaseUrl = "http://127.0.0.1:3000",
  [string]$Symbol = "SSE:603516",
  [int]$Count = 6,
  [switch]$OpenUI
)

function Get-EnvValueFromFile {
  param(
    [string]$Path,
    [string]$Key
  )
  if (-not (Test-Path $Path)) { return $null }
  $pattern = "^\s*$([Regex]::Escape($Key))\s*=\s*(.*)\s*$"
  foreach ($line in Get-Content $Path) {
    if ($line -match '^\s*#') { continue }
    if ($line -match $pattern) {
      $value = $Matches[1]
      if ($value.StartsWith('"') -and $value.EndsWith('"')) {
        return $value.Trim('"')
      }
      if ($value.StartsWith("'") -and $value.EndsWith("'")) {
        return $value.Trim("'")
      }
      return $value
    }
  }
  return $null
}

if (-not $ApiKey) {
  $ApiKey = $env:NEWS_INGEST_API_KEY
}
if (-not $ApiKey) {
  $ApiKey = Get-EnvValueFromFile -Path ".env" -Key "NEWS_INGEST_API_KEY"
}
if (-not $ApiKey) {
  $ApiKey = "demo_key"
}

$headers = @{ "X-API-Key" = $ApiKey; "Content-Type" = "application/json; charset=utf-8" }
$now = [int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
$source = "manual-batch"
$timeoutSec = 8

Write-Host "Batch insert -> $BaseUrl (symbol=$Symbol, count=$Count)"
for ($i = 0; $i -lt $Count; $i++) {
  $ts = $now - ($i * 30000)
  $score = if ($i % 3 -eq 0) { 0.6 } elseif ($i % 3 -eq 1) { -0.4 } else { 0.0 }
  $body = @{
    symbol = $Symbol
    title = "Smoke event $i for $Symbol"
    content = "Batch insert for event stream UI."
    source = $source
    publishedAt = $ts
    sentimentScore = $score
    confidence = 0.7
    impactScore = 0.8
    eventType = "test"
    entities = @($Symbol)
  } | ConvertTo-Json -Depth 4
  $bodyBytes = [Text.Encoding]::UTF8.GetBytes($body)

  try {
    $res = Invoke-WebRequest -Uri "$BaseUrl/api/ashare/external/news" -Method POST -Headers $headers -Body $bodyBytes -TimeoutSec $timeoutSec
    if ($res.StatusCode -ne 200) {
      Write-Host "Insert FAIL (HTTP $($res.StatusCode))"
      exit 1
    }
  } catch {
    Write-Host "Insert FAIL: $($_.Exception.Message)"
    exit 1
  }
}

Write-Host "Feed check..."
try {
  $feed = Invoke-WebRequest -Uri "$BaseUrl/api/ashare/events/feed?symbol=$Symbol&limit=20" -Method GET -TimeoutSec $timeoutSec
  $json = $feed.Content | ConvertFrom-Json
  if (-not $json.ok) {
    Write-Host "Feed FAIL: invalid response"
    exit 1
  }
  $count = $json.items.Count
  Write-Host "Feed OK (items=$count)"
  if ($count -gt 0) {
    $first = $json.items[0]
    Write-Host ("Top event: type={0}, ts={1}, title={2}" -f $first.type, $first.ts, $first.title)
  }
} catch {
  Write-Host "Feed FAIL: $($_.Exception.Message)"
  exit 1
}

$uiUrl = "$BaseUrl/stocks/$Symbol"
Write-Host "UI check -> $uiUrl"
try {
  $ui = Invoke-WebRequest -Uri $uiUrl -Method GET -TimeoutSec $timeoutSec
  if ($ui.StatusCode -eq 200) {
    Write-Host "UI OK (HTTP 200)"
  } else {
    Write-Host "UI FAIL (HTTP $($ui.StatusCode))"
    exit 1
  }
} catch {
  Write-Host "UI FAIL: $($_.Exception.Message)"
  exit 1
}

if ($OpenUI) {
  Start-Process $uiUrl
}
