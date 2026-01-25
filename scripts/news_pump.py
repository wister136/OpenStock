#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import random
import time
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Any, Dict, Optional, List

import re
import html as html_lib

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
ENABLE_MOCK = os.getenv("NEWS_PUMP_ENABLE_MOCK", "0") == "1"
STATUS_ENDPOINT = os.getenv("NEWS_INGEST_STATUS_ENDPOINT")
SLEEP_WHEN_DISABLED = int(os.getenv("NEWS_INGEST_DISABLED_SLEEP_SEC", "30"))


POS_WORDS = ["beat", "growth", "upgrade", "surge", "profit", "strong", "rally", "bull"]
NEG_WORDS = ["crash", "panic", "default", "lawsuit", "fraud", "halt", "sanction", "loss", "down", "bear"]

# RSS feed sources (CN-friendly defaults).
# You can override via env var RSS_URLS (comma-separated).
# Example (PowerShell):
#   $env:RSS_URLS="https://rss.sina.com.cn/finance/stock.xml,https://rsshub.app/cls/telegraph"
# RSS feed sources (CN-friendly defaults).
# You can override via env var RSS_URLS (comma-separated).
# Example (PowerShell):
#   $env:RSS_URLS="https://36kr.com/feed,http://www.huxiu.com/rss/0.xml"
RSS_URLS = [u.strip() for u in os.getenv("RSS_URLS", "").split(",") if u.strip()] or [
    # 36Kr / Huxiu (direct)
    "https://36kr.com/feed",
    "http://www.huxiu.com/rss/0.xml",

    # Optional: RSSHub mirrors (public rsshub.app is often 403 in CN)
    "https://rsshub.rssforever.com/cls/telegraph",
    "https://rsshub.rssforever.com/36kr/newsflashes",

    # Optional: stable proxy RSS (third-party)
    "https://rss.aishort.top/?type=36kr",
    "https://rss.aishort.top/?type=huxiu",

    # Global finance/news RSS
    "https://feeds.reuters.com/reuters/businessNews",
    "https://feeds.reuters.com/reuters/marketsNews",
    "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
    "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    "https://www.ft.com/?format=rss",
    "https://feeds.marketwatch.com/marketwatch/topstories/",
    "https://finance.yahoo.com/news/rssindex",
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


def build_providers() -> List[Dict[str, Any]]:
    providers: List[Dict[str, Any]] = []
    if hasattr(ak, "stock_telegraph_cls"):
        providers.append({"key": "CLS", "name": "akshare_cls", "fn": ak.stock_telegraph_cls, "source": "CLS"})
    if hasattr(ak, "stock_news_sina"):
        providers.append({"key": "SINA", "name": "akshare_sina", "fn": ak.stock_news_sina, "source": "SINA"})
    if hasattr(ak, "stock_news_em"):
        providers.append({"key": "EM", "name": "akshare_em", "fn": ak.stock_news_em, "source": "EM"})
    if hasattr(ak, "news_roll"):
        providers.append({"key": "THS", "name": "akshare_roll", "fn": ak.news_roll, "source": "THS"})
    return providers


def build_payload(row: Dict[str, Any], last_ts: int, default_source: str) -> Optional[Dict[str, Any]]:
    title = pick_first(row, ["新闻标题", "标题", "title", "Title"])
    if not title:
        return None
    content = pick_first(row, ["新闻内容", "内容", "摘要", "summary", "Summary"])
    url = pick_first(row, ["新闻链接", "链接", "url", "URL"])
    source = pick_first(row, ["文章来源", "来源", "source", "Source"]) or default_source
    published_at = parse_ts(pick_first(row, ["发布时间", "时间", "publish_time", "publishedAt", "time", "日期", "date"]))
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


def strip_html_desc(s: str) -> str:
    """Strip HTML tags from RSS <description> and keep plain text."""
    if not s:
        return ""
    s = html_lib.unescape(str(s))
    # remove script/style blocks
    s = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", s)
    # replace common breaks
    s = re.sub(r"(?is)<br\s*/?>", "\n", s)
    s = re.sub(r"(?is)</p\s*>", "\n", s)
    # drop images first
    s = re.sub(r"(?is)<img[^>]*>", " ", s)
    # strip remaining tags
    s = re.sub(r"(?is)<[^>]+>", " ", s)
    # normalize whitespace/newlines
    s = re.sub(r"[ \t\r\f\v]+", " ", s)
    s = re.sub(r"\n\s*\n+", "\n", s)
    return s.strip()

def fetch_rss_entries() -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    headers = {
        "User-Agent": "OpenStock-NewsPump/1.0",
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    }
    timeout = int(os.getenv("RSS_TIMEOUT_SEC", "15"))
    for url in RSS_URLS:
        try:
            resp = requests.get(url, headers=headers, timeout=timeout)
            if resp.status_code != 200:
                # keep quiet unless debug is enabled
                if os.getenv("RSS_DEBUG", "0") == "1":
                    print(f"RSS HTTP {resp.status_code}: {url}")
                continue

            # Use bytes to respect XML encoding declarations (gb2312/utf-8/etc.)
            raw = resp.content or b""
            if not raw.strip():
                if os.getenv("RSS_DEBUG", "0") == "1":
                    print(f"RSS empty body: {url}")
                continue

            root = ET.fromstring(raw)

            # RSS 2.0: <item> ; Atom: <entry>
            feed_title = (root.findtext(".//channel/title") or root.findtext(".//{*}title") or "").strip()
            feed_title = strip_html_desc(feed_title)
            feed_items = root.findall(".//item")
            feed_entries = root.findall(".//{*}entry")

            if not feed_items and not feed_entries:
                if os.getenv("RSS_DEBUG", "0") == "1":
                    print(f"RSS parse OK but no <item>/<entry>: {url} (len={len(raw)})")
                continue

            # --- RSS items ---
            for it in feed_items:
                title = (it.findtext("title") or "").strip()
                link = (it.findtext("link") or "").strip()
                desc = (it.findtext("description") or "").strip()
                desc_text = strip_html_desc(desc)
                pub = (it.findtext("pubDate") or "").strip()
                published_at = parse_ts(pub)
                if title:
                    items.append(
                        {
                            "title": title,
                            "content": desc_text,
                            "url": link,
                            "publishedAt": published_at,
                            "source": feed_title or "RSS",
                            "provider": url,
                            "feedName": feed_title or "",
                            "feedId": url,
                        }
                    )

            # --- Atom entries ---
            for en in feed_entries:
                title = (en.findtext("{*}title") or "").strip()
                link_el = en.find("{*}link")
                link = ""
                if link_el is not None:
                    link = (link_el.attrib.get("href") or "").strip()
                summary = (en.findtext("{*}summary") or en.findtext("{*}content") or "").strip()
                summary_text = strip_html_desc(summary)
                pub = (en.findtext("{*}updated") or en.findtext("{*}published") or "").strip()
                published_at = parse_ts(pub)
                if title:
                    items.append(
                        {
                            "title": title,
                            "content": summary_text,
                            "url": link,
                            "publishedAt": published_at,
                            "source": feed_title or "RSS",
                            "provider": url,
                            "feedName": feed_title or "",
                            "feedId": url,
                        }
                    )
        except Exception as exc:
            # provider-level exception should not kill the loop
            if os.getenv("RSS_DEBUG", "0") == "1":
                print(f"RSS provider failed: {exc} ({url})")
            continue

    # Sort newest first
    items.sort(key=lambda x: int(x.get("publishedAt") or 0), reverse=True)

    # Optional cap
    cap = int(os.getenv("RSS_MAX_ITEMS", "50"))
    return items[:cap]



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


def status_endpoint() -> str:
    if STATUS_ENDPOINT:
        return STATUS_ENDPOINT
    if "/api/ashare/external/news" in ENDPOINT:
        return ENDPOINT.replace("/api/ashare/external/news", "/api/system/news-ingest/status")
    return ENDPOINT.rstrip("/") + "/api/system/news-ingest/status"


def ingest_enabled() -> bool:
    try:
        resp = requests.get(status_endpoint(), timeout=8)
        if resp.status_code != 200:
            return True
        data = resp.json()
        if isinstance(data, dict) and "enabled" in data:
            return bool(data.get("enabled"))
    except Exception:
        return True
    return True
    return "http://localhost:3000/api/ashare/external/news_cursor"


def get_cursor(key: str) -> int:
    url = cursor_endpoint()
    headers = {"X-API-Key": API_KEY} if API_KEY else None
    resp = requests.get(url, params={"key": key}, headers=headers, timeout=10)
    if resp.status_code != 200:
        return 0
    data = resp.json()
    return int(data.get("lastTs") or 0)


def update_cursor(key: str, last_ts: int) -> None:
    if not API_KEY:
        return
    url = cursor_endpoint()
    payload = {"key": key, "lastTs": int(last_ts)}
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
        title = f"[MOCK] News {i + 1} for dev pipeline"
        content = "Mock news generated for fallback validation."
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


def push_rows(provider_key: str, rows: List[Dict[str, Any]], default_source: str) -> int:
    if not API_KEY:
        print("Missing NEWS_INGEST_API_KEY, skip pushing.")
        return 0
    key = f"{SYMBOL}|{provider_key}"
    last_ts = 0 if os.getenv("NEWS_PUMP_DISABLE_CURSOR", "0") == "1" else get_cursor(key)
    if os.getenv("RSS_DEBUG", "0") == "1":
        print(f"Cursor key={key} last_ts={last_ts} rows={len(rows)}")
    sent = 0
    max_published = last_ts
    for row in rows:
        payload = build_payload(row, last_ts, default_source)
        if not payload:
            continue
        res = post_news(payload)
        if res.get("ok") and res.get("status") == "inserted":
            sent += 1
            if payload["publishedAt"] > max_published:
                max_published = payload["publishedAt"]
    if max_published > last_ts:
        update_cursor(key, max_published)
    return sent


def push_rss(rows: List[Dict[str, Any]]) -> int:
    if not API_KEY:
        print("Missing NEWS_INGEST_API_KEY, skip pushing.")
        return 0
    key = f"{SYMBOL}|RSS"
    last_ts = 0 if os.getenv("NEWS_PUMP_DISABLE_CURSOR", "0") == "1" else get_cursor(key)
    if os.getenv("RSS_DEBUG", "0") == "1":
        print(f"Cursor key={key} last_ts={last_ts} rows={len(rows)}")
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
            "source": row.get("source") or "RSS",
            "publishedAt": published_at,
            "sentimentScore": compute_sentiment(f"{row.get('title','')} {row.get('content','')}"),
            "confidence": 0.4,
        }
        if not payload["title"]:
            continue
        res = post_news(payload)
        if res.get("ok") and res.get("status") == "inserted":
            sent += 1
            if published_at > max_published:
                max_published = published_at
    if max_published > last_ts:
        update_cursor(key, max_published)
    return sent


def push_mock(rows: List[Dict[str, Any]]) -> int:
    if not API_KEY:
        print("Missing NEWS_INGEST_API_KEY, skip pushing.")
        return 0
    key = f"{SYMBOL}|MOCK"
    if os.getenv("RSS_DEBUG", "0") == "1":
        print(f"RSS cursor key={key} last_ts={last_ts}")
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
        if res.get("ok") and res.get("status") == "inserted":
            sent += 1
            if published_at > max_published:
                max_published = published_at
    if max_published > last_ts:
        update_cursor(key, max_published)
    return sent


def main() -> bool:
    sent_total = 0
    providers = build_providers()
    for p in providers:
        try:
            df = p["fn"]()
            rows = df.to_dict(orient="records") if hasattr(df, "to_dict") else []
            if not rows:
                raise RuntimeError("Provider returned empty rows")
            sent = push_rows(p["key"], rows, p["source"])
            print(f"{p['name']} sent {sent} news items.")
            if sent > 0:
                sent_total += sent
                return True
        except Exception as exc:
            print(f"Provider {p['name']} failed: {exc}")
            continue

    try:
        rows = fetch_rss_entries()
        if not rows:
            raise RuntimeError("RSS returned no items")
        sent = push_rss(rows)
        print(f"RSS sent {sent} news items.")
        if sent > 0:
            sent_total += sent
            return True
    except Exception as exc:
        print(f"RSS error: {exc}")

    if ENABLE_MOCK:
        mock_rows = generate_mock_news(3)
        print("Generating MOCK news...")
        sent = push_mock(mock_rows)
        print(f"MOCK sent {sent} news items.")
        sent_total += sent
    else:
        print("MOCK disabled (NEWS_PUMP_ENABLE_MOCK=0).")
    return sent_total > 0


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
        if not ingest_enabled():
            print("News ingest disabled. Sleeping...")
            time.sleep(SLEEP_WHEN_DISABLED)
            continue
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
