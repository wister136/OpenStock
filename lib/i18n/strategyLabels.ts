type TranslateFn = (key: string, params?: Record<string, any>) => string;

const STRATEGY_LABEL_KEYS: Record<string, string> = {
  MEAN_REVERSION: 'ashare.strategy.meanReversion',
  TSMOM: 'ashare.strategy.tsmom',
  RISK_OFF: 'ashare.strategy.riskOff',
  TREND_FOLLOW: 'ashare.strategy.trendFollow',
  BREAKOUT: 'ashare.strategy.breakout',
  RANGE: 'ashare.strategy.range',
  NONE: 'ashare.strategy.none',
};

const ACTION_LABEL_KEYS: Record<string, string> = {
  BUY: 'action.buy',
  SELL: 'action.sell',
  HOLD: 'action.hold',
};

const REGIME_LABEL_KEYS: Record<string, string> = {
  TREND: 'ashare.regime.trend',
  RANGE: 'ashare.regime.range',
  PANIC: 'ashare.regime.panic',
};

export function tStrategyLabel(t: TranslateFn, key?: string | null) {
  if (!key) return '--';
  const labelKey = STRATEGY_LABEL_KEYS[key];
  return labelKey ? t(labelKey) : key;
}

export function tActionLabel(t: TranslateFn, key?: string | null) {
  if (!key) return '--';
  const labelKey = ACTION_LABEL_KEYS[key];
  return labelKey ? t(labelKey) : key;
}

export function tRegimeLabel(t: TranslateFn, key?: string | null) {
  if (!key) return '--';
  const labelKey = REGIME_LABEL_KEYS[key];
  return labelKey ? t(labelKey) : key;
}
