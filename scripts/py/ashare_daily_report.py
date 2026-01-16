"""ashare_daily_report.py

A股收盘邮件日报（基于 MongoDB 中的日K数据）。

本项目阶段目标：先跑通链路（入库、UI、切周期、指标、日报、新闻预留位）。
日报这里给你一个“可直接运行”的脚本：
  - 从 MongoDB 读取 3 只股票的日K
  - 计算：收盘价/涨跌幅、MA5/10/20、RSI14
  - 生成 HTML 报告
  - 可选：通过 SMTP 发到你的邮箱

用法:
  python scripts/py/ashare_daily_report.py --print
  python scripts/py/ashare_daily_report.py --send

环境变量:
  MONGODB_URI=mongodb://127.0.0.1:27017/openstock

  # 发送邮件（--send 时需要）
  SMTP_HOST=smtp.qq.com
  SMTP_PORT=465
  SMTP_USER=your@qq.com
  SMTP_PASS=你的SMTP授权码
  EMAIL_FROM=your@qq.com
  EMAIL_TO=your@qq.com
"""

from __future__ import annotations

import argparse
import os
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, List, Optional, Tuple

from dateutil import tz
from pymongo import MongoClient


SUPPORTED_SYMBOLS = [
    ("SZSE:002317", "众生药业"),
    ("SSE:600226", "亨通股份"),
    ("SSE:603516", "淳中科技"),
]


def get_mongo() -> MongoClient:
    uri = os.getenv("MONGODB_URI") or "mongodb://127.0.0.1:27017/openstock"
    return MongoClient(uri)


def sma(values: List[float], period: int) -> Optional[float]:
    if period <= 0 or len(values) < period:
        return None
    return sum(values[-period:]) / period


def rsi(values: List[float], period: int = 14) -> Optional[float]:
    if period <= 0 or len(values) < period + 1:
        return None
    gains = 0.0
    losses = 0.0
    for i in range(len(values) - period, len(values)):
        diff = values[i] - values[i - 1]
        if diff >= 0:
            gains += diff
        else:
            losses += -diff
    avg_gain = gains / period
    avg_loss = losses / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))


def fmt(n: Optional[float], digits: int = 2) -> str:
    if n is None:
        return "--"
    return f"{n:.{digits}f}"


def build_report(db) -> str:
    col = db["asharebars"]
    rows = []
    for symbol, name in SUPPORTED_SYMBOLS:
        docs = list(
            col.find({"symbol": symbol, "freq": "1d"}, {"_id": 0, "ts": 1, "close": 1})
            .sort("ts", 1)
            .limit(400)
        )
        closes = [float(d.get("close") or 0) for d in docs if d.get("close") is not None]
        if len(closes) < 2:
            rows.append((symbol, name, None, None, None, None, None, None))
            continue

        last = closes[-1]
        prev = closes[-2]
        change = last - prev
        pct = (change / prev) * 100 if prev else None
        ma5 = sma(closes, 5)
        ma10 = sma(closes, 10)
        ma20 = sma(closes, 20)
        r14 = rsi(closes, 14)
        rows.append((symbol, name, last, change, pct, ma5, ma10, ma20, r14))

    now = datetime.now(tz.gettz("Asia/Shanghai")).strftime("%Y-%m-%d")
    # 红涨绿跌
    def colorize(v: Optional[float]) -> Tuple[str, str]:
        if v is None:
            return ("--", "#9ca3af")
        if v > 0:
            return (f"+{fmt(v)}", "#ef4444")
        if v < 0:
            return (fmt(v), "#22c55e")
        return (fmt(v), "#e5e7eb")

    trs = []
    for symbol, name, last, change, pct, ma5, ma10, ma20, r14 in rows:
        ch_txt, ch_color = colorize(change)
        pct_txt, pct_color = colorize(pct)
        trs.append(
            f"""
            <tr>
              <td style=\"padding:10px;border-top:1px solid #222;color:#e5e7eb\">{symbol}</td>
              <td style=\"padding:10px;border-top:1px solid #222;color:#e5e7eb\">{name}</td>
              <td style=\"padding:10px;border-top:1px solid #222;color:#e5e7eb\">{fmt(last)}</td>
              <td style=\"padding:10px;border-top:1px solid #222;color:{ch_color};font-weight:600\">{ch_txt}</td>
              <td style=\"padding:10px;border-top:1px solid #222;color:{pct_color};font-weight:600\">{pct_txt}%</td>
              <td style=\"padding:10px;border-top:1px solid #222;color:#e5e7eb\">{fmt(ma5)}</td>
              <td style=\"padding:10px;border-top:1px solid #222;color:#e5e7eb\">{fmt(ma10)}</td>
              <td style=\"padding:10px;border-top:1px solid #222;color:#e5e7eb\">{fmt(ma20)}</td>
              <td style=\"padding:10px;border-top:1px solid #222;color:#e5e7eb\">{fmt(r14,1)}</td>
            </tr>
            """
        )

    html = f"""
    <div style=\"font-family:ui-sans-serif,system-ui,-apple-system; background:#0b0b0b; color:#e5e7eb; padding:24px\">
      <h2 style=\"margin:0 0 8px 0\">A股收盘日报 · {now}</h2>
      <div style=\"color:#9ca3af; font-size:13px; margin-bottom:16px\">
        数据源：baostock（日K/分钟K 5/15/30/60） · 1分钟待 TuShare rt_min
      </div>

      <table style=\"width:100%; border-collapse:collapse; border:1px solid #222; border-radius:12px; overflow:hidden\">
        <thead>
          <tr style=\"background:#111\">
            <th style=\"text-align:left;padding:10px;color:#cbd5e1\">代码</th>
            <th style=\"text-align:left;padding:10px;color:#cbd5e1\">名称</th>
            <th style=\"text-align:left;padding:10px;color:#cbd5e1\">收盘</th>
            <th style=\"text-align:left;padding:10px;color:#cbd5e1\">涨跌</th>
            <th style=\"text-align:left;padding:10px;color:#cbd5e1\">涨跌幅</th>
            <th style=\"text-align:left;padding:10px;color:#cbd5e1\">MA5</th>
            <th style=\"text-align:left;padding:10px;color:#cbd5e1\">MA10</th>
            <th style=\"text-align:left;padding:10px;color:#cbd5e1\">MA20</th>
            <th style=\"text-align:left;padding:10px;color:#cbd5e1\">RSI14</th>
          </tr>
        </thead>
        <tbody>
          {''.join(trs)}
        </tbody>
      </table>

      <div style=\"margin-top:16px; font-size:12px; color:#6b7280\">
        备注：本日报是“跑通链路”的最小可用版本，后续会补充：新闻摘要、事件标签、信号解释、盘中实时刷新。
      </div>
    </div>
    """
    return html


def send_email(subject: str, html: str) -> None:
    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT") or "465")
    user = os.getenv("SMTP_USER")
    pwd = os.getenv("SMTP_PASS")
    mail_from = os.getenv("EMAIL_FROM") or user
    mail_to = os.getenv("EMAIL_TO")

    if not all([host, user, pwd, mail_from, mail_to]):
        raise RuntimeError("SMTP/EMAIL env not fully set. Please set SMTP_HOST/SMTP_USER/SMTP_PASS/EMAIL_FROM/EMAIL_TO")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = mail_from
    msg["To"] = mail_to
    msg.attach(MIMEText(html, "html", "utf-8"))

    if port == 465:
        server = smtplib.SMTP_SSL(host, port)
    else:
        server = smtplib.SMTP(host, port)
        server.starttls()
    try:
        server.login(user, pwd)
        server.sendmail(mail_from, [mail_to], msg.as_string())
    finally:
        server.quit()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--print", action="store_true", help="print html to stdout")
    parser.add_argument("--send", action="store_true", help="send email via SMTP")
    args = parser.parse_args()

    mongo = get_mongo()
    db = mongo.get_database() if mongo.get_default_database() else mongo["openstock"]
    html = build_report(db)
    today = datetime.now(tz.gettz("Asia/Shanghai")).strftime("%Y-%m-%d")

    if args.print or not args.send:
        print(html)
    if args.send:
        send_email(subject=f"A股收盘日报 · {today}", html=html)
        print("✅ sent")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
