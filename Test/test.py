import tushare as ts

ts.set_token("11e7b7f3da25f3a6cd46307f2b9e3c2319ccec60d5856e0988c9669c")
pro = ts.pro_api()

# 例：淳中科技 603516.SH（上交所）
df = ts.pro_bar(
    ts_code="603516.SH",
    asset="E",
    freq="1min",
    start_date="2026-01-10 09:30:00",
    end_date="2026-01-10 10:30:00",
)

print(df.head())
print("rows =", 0 if df is None else len(df))
