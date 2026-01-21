export function translateReason(t: (key: string) => string, reason: string): string {
  const map: Record<string, string> = {
    'News sentiment indicates panic risk': 'ashare.reason.newsPanic',
    'News sentiment supports trend': 'ashare.reason.newsTrend',
    'Realtime surprise confirms trend direction': 'ashare.reason.realtimeTrend',
    'Realtime surprise indicates downside risk': 'ashare.reason.realtimeDownside',
    'Hysteresis hold: confidence below threshold': 'ashare.reason.hysteresisHold',
    'News signal unavailable (missing or stale) -> fallback to Kline': 'ashare.reason.newsUnavailable',
    'Realtime signal unavailable (missing or stale) -> fallback to Kline': 'ashare.reason.realtimeUnavailable',
    'RSI neutral zone': 'ashare.reason.rsiNeutral',
    'RSI oversold': 'ashare.reason.rsiOversold',
    'RSI overbought': 'ashare.reason.rsiOverbought',
    'Price above EMA20/EMA60 with positive slope': 'ashare.reason.tsmomUp',
    'Price below EMA20': 'ashare.reason.tsmomDown',
    'TSMOM neutral signal': 'ashare.reason.tsmomNeutral',
    'Risk-off: price below EMA20': 'ashare.reason.riskOffSell',
    'Risk-off: hold cash': 'ashare.reason.riskOffHold',
    'PANIC regime: BUY disabled': 'ashare.reason.panicNoBuy',
    'Cooldown active: hold to avoid over-trading': 'ashare.reason.cooldown',
    'Cost filter: low volume regime, hold': 'ashare.reason.costHold',
    'Rolling news sentiment negative': 'ashare.reason.newsRollingNegative',
    'Rolling news sentiment positive': 'ashare.reason.newsRollingPositive',
    'Rolling news sentiment neutral': 'ashare.reason.newsRollingNeutral',
  };
  const key = map[reason];
  if (key) return t(key);
  const rollingMatch = reason.match(
    /^Rolling news sentiment (negative|positive|neutral) \(([-0-9.]+)\) contributes to regime(?:, top: (.*))?$/
  );
  if (rollingMatch) {
    const dir = rollingMatch[1];
    const score = rollingMatch[2];
    const titles = rollingMatch[3] ?? '';
    const dirKey =
      dir === 'negative'
        ? 'ashare.reason.newsRollingNegative'
        : dir === 'positive'
          ? 'ashare.reason.newsRollingPositive'
          : 'ashare.reason.newsRollingNeutral';
    const titleLabel = titles ? ` ${t('ashare.reason.newsRollingTop')}${titles}` : '';
    return `${t(dirKey)} (${score})${titleLabel}`;
  }
  return reason;
}
