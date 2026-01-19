#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import random
import time
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Any, Dict, Optional, Tuple, List

import requests
import xml.etree.ElementTree as ET

try:
    import akshare as ak
except Exception as exc:  # pragma: no cover
    raise SystemExit("Missing dependency: akshare. Run: pip install akshare requests") from exc


ENDPOINT = os.getenv("NEXTJS_API_URL", os.getenv("NEWS_INGEST_ENDPOINT", "http://localhost:3000/api/ashare/external/news"))
API_KEY = os.getenv("NEWS_INGEST_API_KEY", "")
CHECK_INTERVAL = os.getenv("CHECK_INTERVAL")
SYMBOL = os.getenv("SYMBOL", "GLOBAL")
POLL_MIN_SEC = 30
POLL_MAX_SEC = 60
BACKOFF_STEPS = [30, 60, 120, 300]
ONESHOT = os.getenv("NEWS_PUMP_ONESHOT") == "1"


POS_WORDS = ["beat", "growth", "upgrade", "surge", "profit", "strong", "rally", "bull"]
NEG_WORDS = ["crash", "panic", "default", "lawsuit", "fraud", "halt", "sanction", "loss", "down", "bear"]

RSS_URLS = [
    "https://rsshub.app/finance/cn/10jqka",
    "https://rsshub.app/finance/cn/sina/stock",
]


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
        pass
    try:
        dt = parsedate_to_datetime(s)
        return int(dt.timestamp() * 1000)
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


def fetch_news_df() -> Tuple[str, Any]:
    providers = []
    if hasattr(ak, "stock_news_em"):
        providers.append(("akshare_em", ak.stock_news_em))
    if hasattr(ak, "news_roll"):
        providers.append(("akshare_roll", ak.news_roll))
    if hasattr(ak, "stock_news_sina"):
        providers.append(("akshare_sina", ak.stock_news_sina))

    last_error: Optional[Exception] = None
    for name, fn in providers:
        try:
            df = fn()
            if df is None:
                continue
            return name, df
        except Exception as exc:
            last_error = exc
            print(f"Provider {name} failed: {exc}")
            continue

    if last_error:
        raise RuntimeError(f"All providers failed: {last_error}")
    raise RuntimeError("No supported AKShare news provider found (stock_news_em/news_roll/stock_news_sina).")


def build_payload(row: Dict[str, Any], last_ts: int) -> Optional[Dict[str, Any]]:
    title = pick_first(row, ["新闻标题", "标题", "title", "Title"])
    if not title:
        return None
    content = pick_first(row, ["新闻内容", "内容", "摘要", "summary", "Summary"])
    url = pick_first(row, ["新闻链接", "链接", "url", "URL"])
    source = pick_first(row, ["文章来源", "来源", "source", "Source"]) or "akshare"
    published_at = parse_ts(pick_first(row, ["发布时间", "时间", "publish_time", "publishedAt", "time"]))
    if published_at <= last_ts:
        return None
    sentiment = compute_sentiment(f"{title} {content or ''}")

    return {
        "symbol": SYMBOL,
        "title": title,
        "content": content,
        "url": url,
        "source": source,
        "publishedAt": published_at,
        "sentimentScore": sentiment,
        "confidence": 0.5 if sentiment != 0 else 0.2,
    }


def fetch_rss_entries() -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    headers = {"User-Agent": "OpenStock-NewsPump/1.0"}
    for url in RSS_URLS:
        try:
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code != 200:
                continue
            root = ET.fromstring(resp.text)
            for item in root.findall(".//item"):
                title = (item.findtext("title") or "").strip()
                link = (item.findtext("link") or "").strip()
                desc = (item.findtext("description") or "").strip()
                pub = (item.findtext("pubDate") or "").strip()
                published_at = parse_ts(pub)
                if not title:
                    continue
                items.append(
                    {
                        "title": title,
                        "content": desc,
                        "url": link,
                        "publishedAt": published_at,
                        "source": "rss",
                    }
                )
        except Exception as exc:
            print(f"RSS provider failed: {exc}")
            continue
    return items


def post_news(payload: Dict[str, Any]) -> Dict[str, Any]:
    headers = {"Content-Type": "application/json", "X-API-Key": API_KEY}
    resp = requests.post(ENDPOINT, json=payload, headers=headers, timeout=10)
    if resp.status_code != 200:
        raise RuntimeError(f"HTTP {resp.status_code}: {resp.text}")
    return resp.json()


def cursor_endpoint() -> str:
    env = os.getenv("NEWS_CURSOR_ENDPOINT")
    if env:
        return env
    if ENDPOINT.endswith("/external/news"):
        return ENDPOINT.replace("/external/news", "/external/news_cursor")
    return "http://localhost:3000/api/ashare/external/news_cursor"


def get_cursor(source: str, symbol: str) -> int:
    if not API_KEY:
        return 0
    url = cursor_endpoint()
    resp = requests.get(url, params={"source": source, "symbol": symbol}, headers={"X-API-Key": API_KEY}, timeout=10)
    if resp.status_code != 200:
        return 0
    data = resp.json()
    return int(data.get("lastTs") or 0)


def update_cursor(source: str, symbol: str, last_ts: int) -> None:
    if not API_KEY:
        return
    url = cursor_endpoint()
    payload = {"source": source, "symbol": symbol, "lastTs": int(last_ts)}
    resp = requests.post(url, json=payload, headers={"X-API-Key": API_KEY}, timeout=10)
    if resp.status_code != 200:
        raise RuntimeError(f"Cursor update failed: HTTP {resp.status_code}: {resp.text}")


def next_interval() -> int:
    if CHECK_INTERVAL:
        try:
            v = int(float(CHECK_INTERVAL))
            if v > 0:
                return v
        except Exception:
            pass
    return random.randint(POLL_MIN_SEC, POLL_MAX_SEC)


def generate_mock_news(n: int) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    now_ms = int(time.time() * 1000)
    for i in range(max(1, min(3, n))):
        ts = now_ms - i * 60_000
        title = f"Mock news {i + 1} for dev pipeline"
        content = "Mock news generated for local validation."
        items.append(
            {
                "title": title,
                "content": content,
                "url": None,
                "source": "MOCK",
                "publishedAt": ts,
            }
        )
    return items


def main() -> bool:
    try:
        provider, df = fetch_news_df()
        rows = df.to_dict(orient="records") if hasattr(df, "to_dict") else []
        last_ts = get_cursor(provider, SYMBOL)
        sent = 0
        max_published = last_ts
        for row in rows:
            payload = build_payload(row, last_ts)
            if not payload:
                continue
            if not API_KEY:
                print("Skip post: missing NEWS_INGEST_API_KEY.")
                break
            res = post_news(payload)
            if res.get("ok"):
                sent += 1
                if payload["publishedAt"] > max_published:
                    max_published = payload["publishedAt"]
        print(f"Sent {sent} news items.")
        if max_published > last_ts:
            update_cursor(provider, SYMBOL, max_published)
        return sent > 0
    except Exception as exc:
        print(f"AKShare error: {exc}")
        try:
            provider = "rss"
            rows = fetch_rss_entries()
            last_ts = get_cursor(provider, SYMBOL)
            sent = 0
            max_published = last_ts
            for row in rows:
                published_at = int(row.get("publishedAt") or 0)
                if published_at <= last_ts:
                    continue
                payload = {
                    "symbol": SYMBOL,
                    "title": row.get("title") or "",
                    "content": row.get("content"),
                    "url": row.get("url"),
                    "source": row.get("source") or "rss",
                    "publishedAt": published_at,
                    "sentimentScore": compute_sentiment(f"{row.get('title','')} {row.get('content','')}"),
                    "confidence": 0.4,
                }
                if not payload["title"]:
                    continue
                res = post_news(payload)
                if res.get("ok"):
                    sent += 1
                    if published_at > max_published:
                        max_published = published_at
            print(f"RSS sent {sent} news items.")
            if sent == 0:
                raise RuntimeError("RSS returned no items")
            if max_published > last_ts:
                update_cursor(provider, SYMBOL, max_published)
            return sent > 0
        except Exception as exc2:
            print(f"RSS error: {exc2}")
            try:
                provider = "MOCK"
                rows = generate_mock_news(3)
                last_ts = get_cursor(provider, SYMBOL)
                sent = 0
                max_published = last_ts
                for row in rows:
                    published_at = int(row.get("publishedAt") or 0)
                    if published_at <= last_ts:
                        continue
                    payload = {
                        "symbol": SYMBOL,
                        "title": row.get("title") or "",
                        "content": row.get("content"),
                        "url": row.get("url"),
                        "source": "MOCK",
                        "publishedAt": published_at,
                        "sentimentScore": compute_sentiment(f"{row.get('title','')} {row.get('content','')}"),
                        "confidence": 0.3,
                        "isMock": True,
                    }
                    if not payload["title"]:
                        continue
                    res = post_news(payload)
                    if res.get("ok"):
                        sent += 1
                        if published_at > max_published:
                            max_published = published_at
                print(f"MOCK sent {sent} news items.")
                if max_published > last_ts:
                    update_cursor(provider, SYMBOL, max_published)
                return sent > 0
            except Exception as exc3:
                print(f"News pump error: {exc3}")
                return False


def success_interval() -> int:
    if CHECK_INTERVAL:
        try:
            v = int(float(CHECK_INTERVAL))
            if v > 0:
                return v
        except Exception:
            pass
    return 30


if __name__ == "__main__":
    if not API_KEY:
        print("Missing NEWS_INGEST_API_KEY, set it before running.")
    print(f"News pump -> {ENDPOINT}")
    fail_count = 0

    while True:
        ok = main()
        if ok:
            fail_count = 0
            if ONESHOT:
                break
            time.sleep(success_interval())
            continue

        fail_count += 1
        backoff = BACKOFF_STEPS[min(fail_count - 1, len(BACKOFF_STEPS) - 1)]
        time.sleep(backoff)
