import * as React from 'react';
// Shared types & defaults for AshareKlinePanel

export type AllowedFreq = '1m' | '5m' | '15m' | '30m' | '60m' | '1d';

export type StrategyKey =
  | 'none'
  | 'maCross'
  | 'emaTrend'
  | 'macdCross'
  | 'rsiReversion'
  | 'rsiMomentum'
  | 'bollingerBreakout'
  | 'bollingerReversion'
  | 'channelBreakout'
  | 'supertrend'
  | 'atrBreakout'
  | 'turtle'
  | 'ichimoku'
  | 'kdj';


export type IndicatorKey = 'ma5' | 'ma10' | 'ma20' | 'ema20' | 'bbands' | 'rsi14' | 'macd';

// =========================
// Backtest config（回测口径统一定义）
// =========================

// 成交模型
export const BACKTEST_MODEL = 'next_open' as const;

// 初始资金（UI 默认值，不是强制）
export const DEFAULT_INITIAL_CAPITAL = 100_000;

// A 股 1 手 = 100 股
export const LOT = 100;

// 成本模型（当前阶段 = 0）
export const FEE_BPS = 0;        // 手续费（bps，万分之一）
export const SLIPPAGE_BPS = 0;   // 滑点（bps）

// 仓位规则
export const ALLOW_PYRAMIDING = false;       // 是否允许加仓
export const ALLOW_SAME_DIR_REPEAT = false;  // 是否允许同方向重复信号

// 分批加仓参数（每次固定手数 + 最多分几次进入）
export const ORDER_LOTS = 1;      // 每次买入/加仓手数（默认 1 手）
export const MAX_ENTRIES = 4;     // 最多分批进入次数（含首次，默认 4 次）

// 回测结束时是否强制平仓（仅用于统计）
export const FORCE_CLOSE_AT_END = true;


export const FREQ_OPTIONS: Array<{ key: AllowedFreq; labelKey: string; disabled?: boolean }> = [
  { key: '1m', labelKey: 'ashare.freq.1m', disabled: true },
  { key: '5m', labelKey: 'ashare.freq.5m' },
  { key: '15m', labelKey: 'ashare.freq.15m' },
  { key: '30m', labelKey: 'ashare.freq.30m' },
  { key: '60m', labelKey: 'ashare.freq.60m' },
  { key: '1d', labelKey: 'ashare.freq.1d' },
];

export const STRATEGY_OPTIONS: Array<{ key: StrategyKey; label: string; note?: string }> = [
  { key: 'none', label: '无策略', note: '仅展示行情与指标' },

  // 经典/常用
  { key: 'maCross', label: '均线交叉', note: 'MA5 上穿/下穿 MA20 → 买入/卖出' },
  { key: 'emaTrend', label: 'EMA 趋势跟随', note: '收盘价上穿/下穿 EMA20 → 买入/卖出' },
  { key: 'macdCross', label: 'MACD 金叉/死叉', note: 'MACD 线与信号线金叉/死叉 → 买入/卖出' },

  // 震荡/均值回归
  { key: 'rsiReversion', label: 'RSI 均值回归', note: 'RSI14 上穿 30 / 下穿 70 → 买入/卖出' },
  { key: 'rsiMomentum', label: 'RSI 动量', note: 'RSI14 上穿/下穿 50 → 买入/卖出' },
  { key: 'bollingerReversion', label: '布林带均值回归', note: '跌破下轨买入；回到中轨卖出' },

  // 突破类
  { key: 'bollingerBreakout', label: '布林带突破', note: '收盘价突破上/下轨 → 买入/卖出' },
  { key: 'channelBreakout', label: '通道突破', note: '突破 20 根最高/最低 → 买入/卖出' },

  // 更主流的趋势/突破策略（新增）
  { key: 'supertrend', label: 'SuperTrend', note: '基于 ATR 的趋势反转：趋势由空转多/由多转空 → 买入/卖出' },
  { key: 'atrBreakout', label: 'ATR Breakout', note: '突破（唐奇安通道 + ATR 缓冲）→ 买入/卖出' },
  { key: 'turtle', label: '海龟交易', note: '20 日突破入场，10 日突破反向出场（简化版）' },
  { key: 'ichimoku', label: '一目均衡表', note: '收盘价穿越云层且转强/转弱 → 买入/卖出（简化版）' },
  { key: 'kdj', label: 'KDJ', note: 'K 上穿 D 且低位 → 买入；K 下穿 D 且高位 → 卖出（简化版）' },
];





export type StrategyFilters = {
  /** Enable extra filters to reduce false signals (recommended ON). */
  enable: boolean;

  /** Trend filter (EMA). */
  trendEmaLen: number;
  requireAboveEma: boolean;
  requireEmaSlopeUp: boolean;
  emaSlopeLookback: number;

  /** Volume confirmation. */
  volLookback: number;
  volMult: number;

  /** Soft volume floor as % of avg volume (0 disables). */
  volFloorPct: number;

  /** ADX trend strength filter (0 disables). */
  adxLen: number;
  minAdx: number;

  /** Avoid over-trading in very choppy markets. */
  minBarsBetweenBuys: number;

  /** Volatility regime filter using ATR% (ATR / Close * 100).
   *  - Too low ATR% -> choppy/noise (low PF)
   *  - Too high ATR% -> panic spikes (high drawdown)
   */
  atrLen: number;
  minAtrPct: number;
  maxAtrPct: number;
};

export type StrategyParams = {
  supertrend: { atrLen: number; mult: number };
  atrBreakout: { donLen: number; atrLen: number; atrMult: number };
  turtle: { entryLen: number; exitLen: number };
  filters: StrategyFilters;
};

export const DEFAULT_STRATEGY_PARAMS: StrategyParams = {
  supertrend: { atrLen: 10, mult: 3 },
  atrBreakout: { donLen: 20, atrLen: 14, atrMult: 1 },
  turtle: { entryLen: 20, exitLen: 10 },
  // Mild defaults: confirm trend & volume without killing all trades
  filters: {
    enable: true,
    // Stricter trend confirmation improves PF and reduces whipsaws.
    trendEmaLen: 50,
    requireAboveEma: true,
    requireEmaSlopeUp: true,
    emaSlopeLookback: 5,
    volLookback: 20,
    volMult: 1.1,

    // Soft floor to avoid missing/zero volume bars blocking all signals.
    volFloorPct: 5,

    // ADX filter (trend strength). Set to 0 to disable.
    adxLen: 14,
    minAdx: 0,
    minBarsBetweenBuys: 5,

    // ATR% regime (mild, helps reduce drawdown and improve PF)
    atrLen: 14,
    minAtrPct: 0.6,
    maxAtrPct: 5.2,
  },
};

export const INDICATOR_OPTIONS: Array<{
  key: IndicatorKey;
  name: string;
  category: '趋势' | '震荡' | '波动';
  location: 'overlay' | 'pane';
  desc: string;
}> = [
  { key: 'ma5', name: 'MA 5', category: '趋势', location: 'overlay', desc: '5 周期简单移动平均线' },
  { key: 'ma10', name: 'MA 10', category: '趋势', location: 'overlay', desc: '10 周期简单移动平均线' },
  { key: 'ma20', name: 'MA 20', category: '趋势', location: 'overlay', desc: '20 周期简单移动平均线' },
  { key: 'ema20', name: 'EMA 20', category: '趋势', location: 'overlay', desc: '20 周期指数移动平均线' },
  { key: 'bbands', name: '布林带', category: '波动', location: 'overlay', desc: '20 周期，2σ 上/中/下轨' },
  { key: 'rsi14', name: 'RSI 14', category: '震荡', location: 'pane', desc: '相对强弱指标（副图）' },
  { key: 'macd', name: 'MACD', category: '震荡', location: 'pane', desc: '12/26/9（副图）' },
];

function tvChartUrl(symbol: string) {
  // Use TradingView chart view so it feels closer to the user's expectation.
  // Symbol already includes exchange prefix like SSE:603516 / SZSE:002317
  return `https://cn.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;
}


function safeLocalStorageSet(key: string, value: any) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

function fmt(n: number | null | undefined, digits = 2) {
  if (n == null || !Number.isFinite(n)) return '--';
  return n.toFixed(digits);
}

function Sparkline({ values, height = 42, stroke = 'rgba(255,255,255,0.85)' }: { values: number[]; height?: number; stroke?: string }) {
  const w = 240;
  const h = height;
  if (!values || values.length < 2) {
    return React.createElement('div', { className: 'text-xs text-gray-500' }, '--');
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const xStep = (w - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = pad + i * xStep;
    const y = pad + (h - pad * 2) * (1 - (v - min) / span);
    return [x, y];
  });
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
  return React.createElement(
    'svg',
    { className: "block w-full h-full", width: "100%", height: "100%", viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: "none",
    },
    React.createElement('path', { d: d, fill: "none", stroke: stroke, strokeWidth: "1.5" })
  );
}

export type Marker = {
  time: number;
  position: 'aboveBar' | 'belowBar';
  shape: 'arrowUp' | 'arrowDown';
  color: string;
  text: string;
  side: 'BUY' | 'SELL';
  reason?: string;
};

export type OverlayMarker = Marker & {
  x: number;
  y: number;
  side: 'BUY' | 'SELL';
  key: string;
};

export type StrategySignal = {
  index: number; // signal is generated at bar[index] close
  side: 'BUY' | 'SELL';
  reason: string;
};

export type BacktestTrade = {
  entryIndex: number;
  exitIndex: number;
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPct: number;
  barsHeld: number;
  open: boolean; // true when force-closed at last close for mark-to-market
  entryFills: number; // 第几次入场/加仓（该笔交易累计）
  lots: number; // 出场时总手数
  shares: number; // 出场时总股数
  avgCost: number; // 平均成本（每股）

  /** Why the position was exited (helps debugging PF & DD). */
  exitReason?: 'Stop' | 'Take' | 'Trail' | 'Time' | 'Signal' | 'Force' | 'DdStop';
};

export type BacktestResult = {
  ok: boolean;
  error?: string;
  initialCapital: number;
  finalEquity: number;
  netProfit: number;
  netProfitPct: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  trades: BacktestTrade[];
  winRate: number;
  profitFactor: number | null;
  avgTradePct: number | null;
  buyHoldPct: number | null;
  grossProfit: number;
  grossLoss: number;
  // Backtest model & assumptions
  model: 'next_open';
  lotSize: number; // A-share: 100 shares per lot
  feeBps: number; // fee in basis points (0 = free)
  slippageBps: number; // slippage in basis points (0 = none)
  allowPyramiding: boolean; // allow adding to position
  allowSameDirectionRepeat: boolean; // allow repeating same-direction signals while in position
  orderLots: number; // lots per entry/add
  maxEntries: number; // maximum number of entry fills (incl. first)
  forceCloseAtEnd: boolean; // whether to force-close at the end for reporting
  barCount: number; // total bars in sample
  validBarCount: number; // bars with valid OHLC time
  tradeCount: number; // number of trades (including forced close)
  reliabilityLevel: string;
  reliabilityNotes: string[];
  buyHoldFinalEquity: number | null;
  buyHoldCagrPct: number | null;
  exposurePct: number;
  avgWinPct: number | null;
  avgLossPct: number | null;
  expectancyPct: number | null;
  avgBarsHeld: number | null;
  maxBarsHeld: number | null;
  maxConsecWins: number | null;
  maxConsecLosses: number | null;
  equityCurve: number[];
  drawdownPctCurve: number[];
  cagrPct: number | null;
  sharpe: number | null;
  calmar: number | null;
  annualVolPct: number | null;
  sortino: number | null;
  ulcerIndex: number | null;
  recoveryFactor: number | null;
  maxDdDurationDays: number | null;
  maxDdStart: string | null;
  maxDdEnd: string | null;
  sampleStart: string | null;
  sampleEnd: string | null;
  sampleDays: number | null;
  monthlyReturns: { month: string; retPct: number }[];
};

export type BacktestRiskConfig = {
  /** Enable risk management layer (recommended ON for trend/breakout). */
  enable: boolean;

  /** ATR length used for stops / trailing. */
  atrLen: number;

  /** Hard stop loss = entry - stopAtr * ATR */
  stopAtr: number;

  /** Take profit = entry + takeAtr * ATR (0 disables TP) */
  takeAtr: number;

  /** Trailing stop = highestClose - trailAtr * ATR (0 disables trailing) */
  trailAtr: number;

  /** Move stop to breakeven after price moved breakevenAtr * ATR in favor (0 disables). */
  breakevenAtr: number;

  /** Time stop: force exit after N bars (0 disables). */
  maxHoldBars: number;

  /** Cooldown after an exit before allowing next entry. */
  cooldownBars: number;

  /** Extra cooldown when a StopLoss was hit (reduces consecutive losses in choppy markets). */
  cooldownAfterStopBars: number;

  /** After a scale-out, tighten trailing stop to lock profits (0 = keep base trailAtr). */
  trailAtrAfterScale1: number;
  trailAtrAfterScale2: number;

  /** After scale-out, protect profit by raising stop above breakeven (in ATR multiples). */
  protectProfitAfterScale1Atr: number;
  protectProfitAfterScale2Atr: number;

  /** Circuit breaker: pause new entries when drawdown exceeds threshold (0 disables). */
  maxDdCircuitPct: number;
  circuitPauseBars: number;

  /** Smart pyramiding: only add when price moved in favor by X*ATR since last add (0 disables). */
  addOnlyAfterAtr: number;
  minBarsBetweenAdds: number;

  /** Cap exposure as % of equity (prevents over-sizing). */
  maxExposurePct: number;

  /**
   * HARD max-drawdown kill-switch (percent).
   * If equity drawdown (peak→current) >= hardMaxDdPct, we force-close at next open and pause entries.
   * Set 0 to disable.
   */
  hardMaxDdPct: number;

  /** After hard DD stop triggered, pause entries for N bars (0 = no extra pause). */
  hardDdPauseBars: number;

  /**
   * Dynamic position sizing (recommended ON when targeting low drawdown).
   * Size each entry based on riskPerTradePct and stopAtr*ATR distance.
   */
  dynamicSizing: boolean;

  /** Risk per trade in % of equity (e.g., 0.35 = 0.35% equity risk). */
  riskPerTradePct: number;

  /** Clamp dynamic sizing lots. */
  dynMinLots: number;
  dynMaxLots: number;

  /**
   * Scale-out take profit (boost profit factor):
   * When price moves in favor by X*ATR, sell Y% of current position at next open.
   * Set pct=0 to disable.
   */
  scaleOut1Atr: number;
  scaleOut1Pct: number;
  scaleOut2Atr: number;
  scaleOut2Pct: number;
};

export type BacktestConfig = {
  model: typeof BACKTEST_MODEL;
  lotSize: number;

  /** Entry sizing mode. FIXED = use orderLots; ALL_IN = use (cash * 99%) / price. */
  entryMode?: BacktestEntryMode;

  /** Optional date range filter (YYYY-MM-DD). Used by UI backtest only. */
  dateFrom?: string;
  dateTo?: string;

  /** Initial capital (UI binding). Optional to stay backward compatible. */
  capital?: number;

  // 成本/摩擦
  feeBps: number;
  slippageBps: number;

  // 仓位规则
  allowPyramiding: boolean;
  allowSameDirectionRepeat: boolean;

  // 分批固定手数进入
  orderLots: number; // 每次买入/加仓手数
  maxEntries: number; // 最多分批进入次数（含首次）

  // 风控层（可选）
  risk?: BacktestRiskConfig;

  // 统计口径
  forceCloseAtEnd: boolean;
};

// Position sizing / entry mode
export type BacktestEntryMode = 'FIXED' | 'ALL_IN';

export const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  model: BACKTEST_MODEL,
  lotSize: LOT,

  entryMode: 'FIXED',

  // Backtest date range (UI). Empty means "use full sample".
  dateFrom: undefined,
  dateTo: undefined,

  // UI will override this, but keep a safe default
  capital: DEFAULT_INITIAL_CAPITAL,

  feeBps: FEE_BPS,
  slippageBps: SLIPPAGE_BPS,

  allowPyramiding: ALLOW_PYRAMIDING,
  allowSameDirectionRepeat: ALLOW_SAME_DIR_REPEAT,

  orderLots: ORDER_LOTS,
  maxEntries: MAX_ENTRIES,

  risk: {
    enable: true,
    atrLen: 14,
    // Tighter stop + tighter trail, plus dynamic sizing (below) -> low drawdown.
    stopAtr: 1.6,
    takeAtr: 0, // let winners run by default
    trailAtr: 2.2,
    breakevenAtr: 1.0,
    maxHoldBars: 0,
    cooldownBars: 4,
    cooldownAfterStopBars: 10,

    // After partial take-profit, tighten trailing and protect profit
    trailAtrAfterScale1: 1.8,
    trailAtrAfterScale2: 1.4,
    protectProfitAfterScale1Atr: 0.4,
    protectProfitAfterScale2Atr: 1.0,

    // Drawdown circuit breaker (pause new entries to protect equity)
    // Aggressive drawdown guard.
    maxDdCircuitPct: 4.2,
    circuitPauseBars: 50,

    // Smart pyramiding (only add in favorable move)
    addOnlyAfterAtr: 1.1,
    minBarsBetweenAdds: 8,
    // With <=25% exposure, even a ~18-20% adverse move is ~4.5-5% equity drawdown.
    maxExposurePct: 25,

    // Hard DD kill-switch (target <=5%)
    hardMaxDdPct: 5.0,
    hardDdPauseBars: 999999,

    // Dynamic sizing: keep each stopout small to protect equity & improve PF
    dynamicSizing: true,
    riskPerTradePct: 0.3,
    dynMinLots: 1,
    dynMaxLots: 10,

    // Profit-factor booster (safe defaults)
    scaleOut1Atr: 1.1,
    scaleOut1Pct: 0.45,
    scaleOut2Atr: 2.1,
    scaleOut2Pct: 0.25,
  },

  forceCloseAtEnd: FORCE_CLOSE_AT_END,
};



// Backward-compatible aliases (older code expects PYRAMID_* names)
export const PYRAMID_ORDER_LOTS = ORDER_LOTS;
export const PYRAMID_MAX_ENTRIES = MAX_ENTRIES;

// === 在文件末尾追加以下代码 ===

export type MarketRegime = 'TREND_UP' | 'TREND_DOWN' | 'RANGE' | 'HIGH_VOL' | 'UNCERTAIN';

export type MarketRegimeInfo = {
  regime: MarketRegime;
  adx: number;       // 趋势强度
  atrPct: number;    // 波动率 (ATR/Close %)
  maTrend: number;   // 1=Bull, -1=Bear, 0=Neutral (EMA20 vs EMA50)
  description: string;
  timestamp: number;
};

export type StrategyRecommendation = {
  key: StrategyKey;
  label: string;
  score: number;        // 综合评分
  reason: string;       // 推荐理由
  winRate: number;      // 回测胜率
  netProfitPct: number; // 回测净收益
  pf: number;           // 盈亏比
  drawdown: number;     // 最大回撤
};
