param(
  [string]$ApiKey = "demo_key",
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Symbol = "GLOBAL"
)

$headers = @{ "X-API-Key" = $ApiKey; "Content-Type" = "application/json" }
$now = [int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())

Write-Host "Receiver test..."
$body = @{
  symbol = $Symbol
  source = "MOCK"
  title = "Smoke test news"
  content = "Smoke test content"
  ts = $now
  score = 0.2
  confidence = 0.5
  isMock = $true
} | ConvertTo-Json

try {
  $res = Invoke-WebRequest -Uri "$BaseUrl/api/ashare/external/news" -Method POST -Headers $headers -Body $body
  if ($res.StatusCode -eq 200) {
    Write-Host "Receiver OK"
  } else {
    Write-Host "Receiver FAIL (HTTP $($res.StatusCode))"
    exit 1
  }
} catch {
  Write-Host "Receiver FAIL: $($_.Exception.Message)"
  exit 1
}

Write-Host "Feed test..."
try {
  $feed = Invoke-WebRequest -Uri "$BaseUrl/api/ashare/news/feed?symbol=$Symbol&limit=5" -Method GET
  $json = $feed.Content | ConvertFrom-Json
  if ($json.items.Count -gt 0) {
    Write-Host "Feed OK (items>0)"
  } else {
    Write-Host "Feed FAIL (items=0)"
    exit 1
  }
} catch {
  Write-Host "Feed FAIL: $($_.Exception.Message)"
  exit 1
}

Write-Host "UI verification: start python news pump, open /stocks/$Symbol, ensure news ticker scrolls."
