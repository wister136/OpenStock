import assert from "node:assert";

import { scoreSignals, resolveConfig } from "../lib/ta/scoring";
import type { SignalResult, TrendFilterResult } from "../types/resonance";

const dailyTrend: TrendFilterResult = {
  trend: "SIDEWAYS",
  bullishAllowed: false,
  bearishAllowed: true,
  metrics: { adx: 10, ema20: 100, close: 98 },
  reasons: ["Test trend gate"],
};

const buySignal: SignalResult = {
  action: "BUY",
  score: 80,
  reasons: ["Test buy"],
  debug: { close: 101, ema20: 100, atrPct: 0.02 },
};

const config = resolveConfig();

const { candidates, recommendation } = scoreSignals(
  dailyTrend,
  [{ timeframe: "5m", strategy: "rsi_reversion", signal: buySignal }],
  config
);

assert.strictEqual(candidates[0].gatedAction, "HOLD", "BUY should be gated to HOLD");
assert.ok(
  recommendation.score >= 0 && recommendation.score <= 100,
  "Recommendation score should be within 0..100"
);

console.log("resonance-selftest: OK");
