import type { OHLCVBar } from '@/lib/indicators';
import { adx, atr, ema } from '@/lib/indicators';
import type { MarketRegime, MarketRegimeInfo, StrategyKey, StrategyRecommendation, StrategyParams, BacktestConfig } from '../types';
import { STRATEGY_OPTIONS, DEFAULT_BACKTEST_CONFIG } from '../types';
import { runBacktestNextOpen } from './backtest';

const REGIME_PARAMS = {
  adxPeriod: 14,
  adxThreshold: 25,
  highVolThreshold: 3.5 // ATR% > 3.5%
};

/** 识别市场状态 */
export function detectMarketRegime(bars: OHLCVBar[]): MarketRegimeInfo {
  if (bars.length < 60) {
    return { regime: 'UNCERTAIN', adx: 0, atrPct: 0, maTrend: 0, description: '数据不足', timestamp: 0 };
  }

  const closes = bars.map(b => b.c);
  const highs = bars.map(b => b.h);
  const lows = bars.map(b => b.l);
  const lastIdx = bars.length - 1;
  const lastBar = bars[lastIdx];

  const adxRes = adx(highs, lows, closes, REGIME_PARAMS.adxPeriod);
  const atrRes = atr(highs, lows, closes, 14);
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);

  const currAdx = adxRes.adx[lastIdx] ?? 0;
  const currAtr = atrRes[lastIdx] ?? 0;
  const currClose = closes[lastIdx];
  const currEma20 = ema20[lastIdx];
  const currEma50 = ema50[lastIdx];

  const atrPct = (Number.isFinite(currAtr) && currClose > 0) ? (currAtr / currClose) * 100 : 0;

  let maTrend = 0;
  if (currEma20 > currEma50 && currClose > currEma20) maTrend = 1;
  else if (currEma20 < currEma50 && currClose < currEma20) maTrend = -1;

  let regime: MarketRegime = 'RANGE';
  let description = '震荡市：建议高抛低吸';

  if (atrPct > REGIME_PARAMS.highVolThreshold) {
    regime = 'HIGH_VOL';
    description = '高波动：风险加剧，降低仓位';
  } else if (currAdx > REGIME_PARAMS.adxThreshold) {
    if (maTrend === 1) {
      regime = 'TREND_UP';
      description = '上涨趋势：适合趋势策略';
    } else if (maTrend === -1) {
      regime = 'TREND_DOWN';
      description = '下跌趋势：注意风险';
    } else {
      regime = 'HIGH_VOL';
      description = '趋势不明：强度高但方向混乱';
    }
  }

  return { regime, adx: currAdx, atrPct, maTrend, description, timestamp: lastBar.t };
}

/** 动态推荐策略 (滚动窗口回测 + 评分) */
export function recommendStrategies(
  bars: OHLCVBar[],
  capital: number,
  stParams: StrategyParams,
  regime: MarketRegime,
  lookbackBars = 1000
): StrategyRecommendation[] {
  if (bars.length < 100) return [];

  // 使用最近 N 根K线作为验证集
  const evalBars = bars.slice(-lookbackBars);
  if (evalBars.length < 50) return [];

  const cfg: BacktestConfig = {
    ...DEFAULT_BACKTEST_CONFIG,
    capital,
    entryMode: 'ALL_IN',
    risk: { ...DEFAULT_BACKTEST_CONFIG.risk, enable: true }
  };

  const results: StrategyRecommendation[] = [];

  for (const opt of STRATEGY_OPTIONS) {
    if (opt.key === 'none') continue;

    const res = runBacktestNextOpen(opt.key, evalBars, capital, cfg, stParams);
    if (!res.ok) continue;

    const pf = res.profitFactor ?? 1;
    const net = res.netProfitPct;
    const mdd = res.maxDrawdownPct;
    const trades = res.tradeCount;

    // 评分公式
    let score = (pf * 25) + (net * 1.5) - (mdd * 2.5);
    if (trades < 3) score -= 30;
    if (trades > 60) score -= 5;

    // 根据市场状态加权
    if (regime === 'TREND_UP') {
      if (['supertrend', 'atrBreakout', 'turtle', 'emaTrend'].includes(opt.key)) score += 20;
    } else if (regime === 'RANGE') {
      if (['rsiReversion', 'bollingerReversion', 'kdj'].includes(opt.key)) score += 20;
      if (['supertrend', 'turtle'].includes(opt.key)) score -= 15;
    } else if (regime === 'HIGH_VOL') {
      if (['atrBreakout', 'kdj'].includes(opt.key)) score += 10;
    }

    results.push({
      key: opt.key,
      label: opt.label,
      score,
      reason: generateReason(pf, net, mdd, trades, regime, opt.key),
      winRate: res.winRate,
      netProfitPct: net,
      pf: pf,
      drawdown: mdd
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

function generateReason(pf: number, net: number, mdd: number, trades: number, regime: MarketRegime, key: string): string {
  if (trades < 3) return '近期交易过少';
  let parts = [];
  if (pf > 1.5) parts.push(`盈亏比优秀(${pf.toFixed(1)})`);
  else if (pf > 1.2) parts.push(`盈亏比尚可(${pf.toFixed(1)})`);

  if (net > 5) parts.push(`近期高收益`);
  if (mdd < 3) parts.push(`低回撤`);

  if (regime === 'TREND_UP' && ['supertrend', 'turtle', 'atrBreakout'].includes(key)) parts.push('契合趋势');
  if (regime === 'RANGE' && ['rsiReversion', 'bollingerReversion'].includes(key)) parts.push('契合震荡');

  return parts.length ? parts.join('，') : '表现平稳';
}
