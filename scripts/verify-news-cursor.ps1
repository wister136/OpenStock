param(
  [string]$ApiKey = "your_key_here",
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Source = "akshare_em",
  [string]$Symbol = "GLOBAL"
)

$headers = @{ "X-API-Key" = $ApiKey; "Content-Type" = "application/json" }

Write-Host "GET cursor (before)..."
$before = Invoke-WebRequest -Uri "$BaseUrl/api/ashare/external/news_cursor?source=$Source&symbol=$Symbol" -Headers $headers -Method GET | Select-Object -ExpandProperty Content
Write-Host $before

Write-Host "Push one manual news..."
$body = @{
  symbol = "SSE:603516"
  title = "Cursor verify news"
  content = "Manual push from verify script"
  source = "manual"
  publishedAt = [int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
  sentimentScore = 0.2
  confidence = 0.6
} | ConvertTo-Json
Invoke-WebRequest -Uri "$BaseUrl/api/ashare/external/news" -Method POST -Headers $headers -Body $body | Out-Null

Write-Host "GET cursor (after)..."
$after = Invoke-WebRequest -Uri "$BaseUrl/api/ashare/external/news_cursor?source=$Source&symbol=$Symbol" -Headers $headers -Method GET | Select-Object -ExpandProperty Content
Write-Host $after

Write-Host "GET latest news list..."
Invoke-WebRequest -Uri "$BaseUrl/api/ashare/news?symbol=SSE:603516&limit=3" -Method GET | Select-Object -ExpandProperty Content
