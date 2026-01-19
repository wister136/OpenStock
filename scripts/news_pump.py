#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import random
import time
from datetime import datetime
from typing import Any, Dict, Optional

import requests

try:
    import akshare as ak
except Exception as exc:  # pragma: no cover
    raise SystemExit("Missing dependency: akshare. Run: pip install akshare requests") from exc


ENDPOINT = os.getenv("NEWS_INGEST_ENDPOINT", "http://localhost:3000/api/ashare/external/news")
API_KEY = os.getenv("NEWS_INGEST_API_KEY", "")
POLL_MIN_SEC = 30
POLL_MAX_SEC = 60
BACKOFF_SEC = 120


POS_WORDS = ["beat", "growth", "upgrade", "surge", "profit", "strong", "rally", "bull"]
NEG_WORDS = ["crash", "panic", "default", "lawsuit", "fraud", "halt", "sanction", "loss", "down", "bear"]


def parse_ts(text: Any) -> int:
    if text is None:
        return int(time.time() * 1000)
    if isinstance(text, (int, float)):
        return int(float(text))
    s = str(text).strip()
    if not s:
        return int(time.time() * 1000)
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
        "%Y-%m-%d",
        "%Y/%m/%d",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(s, fmt)
            return int(dt.timestamp() * 1000)
        except Exception:
            continue
    try:
        return int(datetime.fromisoformat(s).timestamp() * 1000)
    except Exception:
        return int(time.time() * 1000)


def compute_sentiment(text: str) -> float:
    if not text:
        return 0.0
    lower = text.lower()
    score = 0
    for w in POS_WORDS:
        if w in lower:
            score += 1
    for w in NEG_WORDS:
        if w in lower:
            score -= 1
    if score == 0:
        return 0.0
    return max(-1.0, min(1.0, score / 3.0))


def pick_first(row: Dict[str, Any], keys: list[str]) -> Optional[str]:
    for k in keys:
        v = row.get(k)
        if v is None:
            continue
        s = str(v).strip()
        if s:
            return s
    return None


def fetch_news_df():
    if hasattr(ak, "stock_news_em"):
        return ak.stock_news_em()
    if hasattr(ak, "news_roll"):
        return ak.news_roll()
    raise RuntimeError("No supported AKShare news provider found (stock_news_em/news_roll).")


def build_payload(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    title = pick_first(row, ["新闻标题", "标题", "title", "Title"])
    if not title:
        return None
    content = pick_first(row, ["新闻内容", "内容", "摘要", "summary", "Summary"])
    url = pick_first(row, ["新闻链接", "链接", "url", "URL"])
    source = pick_first(row, ["文章来源", "来源", "source", "Source"]) or "akshare"
    published_at = parse_ts(pick_first(row, ["发布时间", "时间", "publish_time", "publishedAt", "time"]))
    sentiment = compute_sentiment(f"{title} {content or ''}")

    return {
        "symbol": "GLOBAL",
        "title": title,
        "content": content,
        "url": url,
        "source": source,
        "publishedAt": published_at,
        "sentimentScore": sentiment,
        "confidence": 0.5 if sentiment != 0 else 0.2,
    }


def post_news(payload: Dict[str, Any]) -> None:
    headers = {"Content-Type": "application/json", "X-API-Key": API_KEY}
    resp = requests.post(ENDPOINT, json=payload, headers=headers, timeout=10)
    if resp.status_code != 200:
        raise RuntimeError(f"HTTP {resp.status_code}: {resp.text}")


def main() -> None:
    if not API_KEY:
        print("Missing NEWS_INGEST_API_KEY, set it before running.")
    print(f"News pump -> {ENDPOINT}")

    while True:
        try:
            df = fetch_news_df()
            rows = df.to_dict(orient="records") if hasattr(df, "to_dict") else []
            sent = 0
            for row in rows:
                payload = build_payload(row)
                if not payload:
                    continue
                if not API_KEY:
                    print("Skip post: missing NEWS_INGEST_API_KEY.")
                    break
                post_news(payload)
                sent += 1
            print(f"Sent {sent} news items.")
            time.sleep(random.randint(POLL_MIN_SEC, POLL_MAX_SEC))
        except Exception as exc:
            print(f"News pump error: {exc}")
            time.sleep(BACKOFF_SEC)


if __name__ == "__main__":
    main()
