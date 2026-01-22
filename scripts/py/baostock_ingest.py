# scripts/py/baostock_ingest.py
# -*- coding: utf-8 -*-

import argparse
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

import baostock as bs
from pymongo import MongoClient, UpdateOne


# =========================
# Symbols / Frequency mapping
# =========================

# 站内统一用：SSE:603516 / SZSE:002317 这种格式
DEFAULT_SYMBOLS = ["SZSE:002317", "SSE:600226", "SSE:603516","SZSE:000933","SZSE:002785"]

# baostock 用：sz.002317 / sh.600226 / sh.603516 / sz.000933 / sz.002785
def to_baostock_code(symbol: str) -> str:
    s = symbol.strip().upper()
    if s.startswith("SZSE:"):
        return "sz." + s.split(":")[1]
    if s.startswith("SSE:"):
        return "sh." + s.split(":")[1]
    # 兼容纯数字：默认上交所
    if s.isdigit() and len(s) == 6:
        return "sh." + s
    raise ValueError(f"Unsupported symbol format: {symbol}")


FREQ_MAP = {
    "5m": "5",
    "15m": "15",
    "30m": "30",
    "60m": "60",
    "1d": "d",
}


# =========================
# Time parsing
# =========================
# baostock 分钟K的 time 可能长这样：20250716093500000  (yyyyMMddHHmmssSSS)
# 或者 20250716093500 (yyyyMMddHHmmss)
# 或者 HH:MM:SS / HHMMSS / HHMM
def parse_ts(date_str: str, time_str: Optional[str]) -> datetime:
    """
    Return UTC datetime (tz-aware) for Mongo storage.
    Interpret as Asia/Shanghai then convert to UTC.
    """
    tz_cn = timezone(timedelta(hours=8))

    ds = (date_str or "").strip()
    ts = (time_str or "").strip()

    # Some frequencies only have date, no time
    if not ts:
        dt_local = datetime.strptime(ds, "%Y-%m-%d").replace(tzinfo=tz_cn)
        return dt_local.astimezone(timezone.utc)

    # Case 1: numeric time strings
    # - yyyyMMddHHmmssSSS... (>=14, extra digits ignored)
    # - yyyyMMddHHmm (12)
    # - HHMMSS (6) with date_str
    # - HHMM (4) with date_str
    if ts.isdigit():
        if len(ts) >= 14:
            base = ts[:14]  # yyyyMMddHHmmss
            ms = ts[14:17] if len(ts) >= 17 else "000"
            dt_local = datetime.strptime(base, "%Y%m%d%H%M%S").replace(
                microsecond=int(ms) * 1000, tzinfo=tz_cn
            )
            return dt_local.astimezone(timezone.utc)

        if len(ts) == 12:
            dt_local = datetime.strptime(ts, "%Y%m%d%H%M").replace(tzinfo=tz_cn)
            return dt_local.astimezone(timezone.utc)

        if len(ts) == 6 and ds:
            dt_local = datetime.strptime(f"{ds} {ts}", "%Y-%m-%d %H%M%S").replace(tzinfo=tz_cn)
            return dt_local.astimezone(timezone.utc)

        if len(ts) == 4 and ds:
            dt_local = datetime.strptime(f"{ds} {ts}", "%Y-%m-%d %H%M").replace(tzinfo=tz_cn)
            return dt_local.astimezone(timezone.utc)

    # Case 2: HH:MM:SS or HH:MM
    if ":" in ts and ds:
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
            try:
                dt_local = datetime.strptime(f"{ds} {ts}", fmt).replace(tzinfo=tz_cn)
                return dt_local.astimezone(timezone.utc)
            except ValueError:
                pass

    # Last resort: concatenate date digits and time digits
    ds2 = ds.replace("-", "")
    if ds2.isdigit() and ts.isdigit():
        combo = ds2 + ts
        for fmt in ("%Y%m%d%H%M%S", "%Y%m%d%H%M"):
            try:
                dt_local = datetime.strptime(combo[: len(datetime.now().strftime(fmt))], fmt).replace(
                    tzinfo=tz_cn
                )
                return dt_local.astimezone(timezone.utc)
            except ValueError:
                pass

    raise ValueError(f"Unsupported time format: date='{date_str}' time='{time_str}'")
# =========================
# Mongo helpers
# =========================
def get_mongo_client() -> MongoClient:
    uri = (
        os.getenv("MONGODB_URI")
        or os.getenv("MONGODB_URL")
        or os.getenv("MONGO_URL")
        or "mongodb://127.0.0.1:27017/openstock"
    )
    return MongoClient(uri)


def get_db(client: MongoClient):
    # get_default_database 只有在 URI 带 /dbname 才能用，否则返回 None
    db = client.get_default_database()
    return db if db is not None else client["openstock"]


def ensure_indexes(col):
    # 唯一键：symbol + freq + ts
    try:
        col.create_index([("symbol", 1), ("freq", 1), ("ts", 1)], unique=True, background=True)
        col.create_index([("symbol", 1), ("freq", 1), ("ts", -1)], background=True)
    except Exception:
        pass


# =========================
# Baostock fetch
# =========================
def fetch_bars(bs_code: str, freq_key: str, start: str, end: str) -> List[Dict]:
    """
    Fetch bars from baostock.
    start/end: YYYY-MM-DD
    """
    fk = freq_key.lower()
    if fk not in FREQ_MAP:
        raise ValueError(f"Unsupported freq: {freq_key}")

    bs_freq = FREQ_MAP[fk]

    # 分钟K建议带 time 字段；日K不一定有 time
    if bs_freq == "d":
        fields = "date,code,open,high,low,close,volume,amount"
    else:
        fields = "date,time,code,open,high,low,close,volume,amount"

    rs = bs.query_history_k_data_plus(
        bs_code,
        fields,
        start_date=start,
        end_date=end,
        frequency=bs_freq,
        adjustflag="3",  # 不复权：3；你也可以改成 1/2
    )
    if rs.error_code != "0":
        raise RuntimeError(f"baostock error {rs.error_code}: {rs.error_msg}")

    out: List[Dict] = []
    while rs.next():
        row = rs.get_row_data()
        # 根据 fields 顺序取值
        if bs_freq == "d":
            date_str, _code, o, h, l, c, v, amt = row
            time_str = ""
        else:
            date_str, time_str, _code, o, h, l, c, v, amt = row

        ts_utc = parse_ts(date_str, time_str)

        def to_f(x: str) -> float:
            try:
                return float(x) if x not in ("", None) else 0.0
            except Exception:
                return 0.0

        out.append(
            {
                "ts": ts_utc,
                "open": to_f(o),
                "high": to_f(h),
                "low": to_f(l),
                "close": to_f(c),
                "volume": to_f(v),
                "amount": to_f(amt),
            }
        )

    return out


def upsert_bars(col, symbol: str, freq: str, bars: List[Dict], source: str = "baostock") -> int:
    if not bars:
        return 0

    ops = []
    for b in bars:
        ops.append(
            UpdateOne(
                {"symbol": symbol, "freq": freq, "ts": b["ts"]},
                {
                    "$set": {
                        "symbol": symbol,
                        "freq": freq,
                        "ts": b["ts"],
                        "open": b["open"],
                        "high": b["high"],
                        "low": b["low"],
                        "close": b["close"],
                        "volume": b["volume"],
                        "amount": b["amount"],
                        "source": source,
                        "updatedAt": datetime.now(timezone.utc),
                    },
                    "$setOnInsert": {"createdAt": datetime.now(timezone.utc)},
                },
                upsert=True,
            )
        )

    res = col.bulk_write(ops, ordered=False)
    return int(res.upserted_count + res.modified_count)


# =========================
# CLI
# =========================
def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--all", action="store_true", help="Ingest default 3 A-share symbols")
    p.add_argument("--symbol", action="append", help="One symbol like SSE:603516 (repeatable)")
    p.add_argument(
        "--freq",
        nargs="+",
        default=["1d"],
        help="Frequencies: 5m 15m 30m 60m 1d (space separated)",
    )
    p.add_argument("--days", type=int, default=180, help="Lookback days (ignored if --start/--end set)")
    p.add_argument("--start", default="", help="Start date YYYY-MM-DD")
    p.add_argument("--end", default="", help="End date YYYY-MM-DD")
    return p.parse_args()


def main() -> int:
    args = parse_args()

    freqs = [f.lower() for f in args.freq]
    for f in freqs:
        if f not in FREQ_MAP:
            raise SystemExit(f"Unsupported --freq {f}. Use one of: {', '.join(FREQ_MAP.keys())}")

    if args.all:
        symbols = list(DEFAULT_SYMBOLS)
    else:
        symbols = args.symbol or []
    if not symbols:
        raise SystemExit("No symbols provided. Use --all or --symbol SSE:603516")

    # date range
    if args.start and args.end:
        start = args.start
        end = args.end
    else:
        end_dt = datetime.now().date()
        start_dt = end_dt - timedelta(days=int(args.days))
        start = start_dt.strftime("%Y-%m-%d")
        end = end_dt.strftime("%Y-%m-%d")

    # login
    lg = bs.login()
    if lg.error_code != "0":
        raise SystemExit(f"baostock login failed {lg.error_code}: {lg.error_msg}")
    print("login success!")

    client = get_mongo_client()
    db = get_db(client)

    # 统一写入这个集合（前端/后端你再按需要读）
    col = db["market_bars"]
    ensure_indexes(col)

    total = 0
    try:
        for sym in symbols:
            bs_code = to_baostock_code(sym)
            for fk in freqs:
                print(f"[baostock] {sym} ({bs_code}) freq={fk} {start}..{end}")
                bars = fetch_bars(bs_code, fk, start, end)
                n = upsert_bars(col, sym.upper(), fk, bars, source="baostock")
                print(f"  -> upserted/updated ~{n} records (fetched {len(bars)})")
                total += n
    finally:
        bs.logout()
        print("logout success!")

    print(f"done. total changed ~{total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
