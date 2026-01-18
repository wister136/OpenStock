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
  if (bars.length < 120) return [];

  // 使用最近 N 根K线作为验证集，同时叠加多窗口表现（更稳定）
  const maxLookback = Math.min(lookbackBars, bars.length);
  const windows = [maxLookback, Math.floor(maxLookback * 0.6), Math.floor(maxLookback * 0.3)]
    .map((n) => Math.max(80, Math.min(n, bars.length)))
    .filter((n, idx, arr) => arr.indexOf(n) === idx)
    .filter((n) => n <= bars.length);

  if (!windows.length) return [];

  const cfg: BacktestConfig = {
    ...DEFAULT_BACKTEST_CONFIG,
    capital,
    entryMode: 'ALL_IN',
    risk: { ...DEFAULT_BACKTEST_CONFIG.risk, enable: true }
  };

  const results: StrategyRecommendation[] = [];

  const weights = windows.map((_, idx) => (idx === 0 ? 0.5 : idx === 1 ? 0.3 : 0.2));
  const weightSum = weights.slice(0, windows.length).reduce((a, b) => a + b, 0) || 1;
  const normWeights = weights.slice(0, windows.length).map((w) => w / weightSum);

  for (const opt of STRATEGY_OPTIONS) {
    if (opt.key === 'none') continue;

    const windowStats = windows.map((w) => {
      const evalBars = bars.slice(-w);
      const res = runBacktestNextOpen(opt.key, evalBars, capital, cfg, stParams);
      if (!res.ok) return null;

      const pf = res.profitFactor ?? 1;
      const net = res.netProfitPct;
      const mdd = res.maxDrawdownPct;
      const trades = res.tradeCount;

      let score = (pf * 25) + (net * 1.5) - (mdd * 2.5);
      if (trades < 3) score -= 30;
      if (trades > 60) score -= 5;

      if (regime === 'TREND_UP') {
        if (['supertrend', 'atrBreakout', 'turtle', 'emaTrend'].includes(opt.key)) score += 20;
      } else if (regime === 'RANGE') {
        if (['rsiReversion', 'bollingerReversion', 'kdj'].includes(opt.key)) score += 20;
        if (['supertrend', 'turtle'].includes(opt.key)) score -= 15;
      } else if (regime === 'HIGH_VOL') {
        if (['atrBreakout', 'kdj'].includes(opt.key)) score += 10;
      }

      return { score, pf, net, mdd, trades, winRate: res.winRate };
    }).filter(Boolean) as Array<{ score: number; pf: number; net: number; mdd: number; trades: number; winRate: number }>;

    if (!windowStats.length) continue;

    const weightedScore = windowStats.reduce((sum, stat, i) => sum + stat.score * (normWeights[i] ?? 0), 0);
    const weightedNet = windowStats.reduce((sum, stat, i) => sum + stat.net * (normWeights[i] ?? 0), 0);
    const weightedPf = windowStats.reduce((sum, stat, i) => sum + stat.pf * (normWeights[i] ?? 0), 0);
    const weightedMdd = windowStats.reduce((sum, stat, i) => sum + stat.mdd * (normWeights[i] ?? 0), 0);
    const weightedWin = windowStats.reduce((sum, stat, i) => sum + stat.winRate * (normWeights[i] ?? 0), 0);
    const weightedTrades = windowStats.reduce((sum, stat, i) => sum + stat.trades * (normWeights[i] ?? 0), 0);

    const netMean = windowStats.reduce((sum, stat) => sum + stat.net, 0) / windowStats.length;
    const netVar = windowStats.reduce((sum, stat) => sum + Math.pow(stat.net - netMean, 2), 0) / windowStats.length;
    const netStd = Math.sqrt(netVar);
    const stabilityPenalty = Math.min(20, netStd * 0.8);

    results.push({
      key: opt.key,
      label: opt.label,
      score: weightedScore - stabilityPenalty,
      reason: generateReason(weightedPf, weightedNet, weightedMdd, weightedTrades, regime, opt.key, netStd),
      winRate: weightedWin,
      netProfitPct: weightedNet,
      pf: weightedPf,
      drawdown: weightedMdd
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

function generateReason(pf: number, net: number, mdd: number, trades: number, regime: MarketRegime, key: string, netStd: number): string {
  if (trades < 3) return '近期交易过少';
  let parts = [];
  if (pf > 1.5) parts.push(`盈亏比优秀(${pf.toFixed(1)})`);
  else if (pf > 1.2) parts.push(`盈亏比尚可(${pf.toFixed(1)})`);

  if (net > 5) parts.push(`近期高收益`);
  if (mdd < 3) parts.push(`低回撤`);
  if (Number.isFinite(netStd) && netStd < 5) parts.push('多窗口稳定');
  if (Number.isFinite(netStd) && netStd > 12) parts.push('波动偏大');

  if (regime === 'TREND_UP' && ['supertrend', 'turtle', 'atrBreakout'].includes(key)) parts.push('契合趋势');
  if (regime === 'RANGE' && ['rsiReversion', 'bollingerReversion'].includes(key)) parts.push('契合震荡');

  return parts.length ? parts.join('，') : '表现平稳';
}
