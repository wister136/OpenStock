import type { StrategyConfig } from '@/lib/ashare/config';
import type { Bar } from '@/lib/ashare/indicators';

export type StrategyAction = 'BUY' | 'SELL' | 'HOLD';

export type StrategyDecision = {
  action: StrategyAction;
  reasons: string[];
};

export type StrategyContext = {
  bars: Bar[];
  config: StrategyConfig;
};
