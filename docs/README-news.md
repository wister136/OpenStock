# 实时新闻接入

本指南帮助你在 10 分钟内看到 UI 实时新闻滚动。

## 1. 配置环境变量

在 `.env` 中设置：

```
NEWS_INGEST_API_KEY=your_key_here
```

## 2. 启动 Next.js

```
npm run dev
```

## 3. 启动 Python news_pump

安装依赖：

```
pip install akshare requests
```

启动：

```
python scripts/news_pump.py
```

## 4. PowerShell 手动推送测试

```
$headers = @{ "X-API-Key" = "your_key_here"; "Content-Type" = "application/json" }
$body = @{
  symbol = "SSE:603516"
  title = "Manual test news"
  content = "Manual push from PowerShell"
  source = "manual"
  publishedAt = [int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
  sentimentScore = 0.2
  confidence = 0.6
} | ConvertTo-Json
Invoke-WebRequest -Uri "http://localhost:3000/api/ashare/external/news" -Method POST -Headers $headers -Body $body
```

## 5. 验证结果

1) MongoDB 校验：

- `news_items` 会新增记录
- `news_sentiment_snapshots` 在 >=3 条带 `sentimentScore` 新闻后产生最新快照

2) API 校验：

```
Invoke-WebRequest -Uri "http://localhost:3000/api/ashare/news?symbol=SSE:603516&limit=10" -Method GET
```

3) UI 校验：

- 进入股票详情页外部信号区域
- 新闻滚动面板出现最新新闻
