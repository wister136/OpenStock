export type NewsSignal = {
  score: number;
  confidence: number;
  ts: number;
  sources: string[];
  sourceType?: 'items_rolling' | 'snapshot' | 'none';
  explain?: { topTitles: string[]; n: number; avgImpact: number };
};
export type RealtimeSignal = { volSurprise: number; amtSurprise: number; ts: number };

export interface NewsProvider {
  getNewsSignal(args: { symbol: string }): Promise<NewsSignal | null>;
}

export interface RealtimeProvider {
  getRealtimeSignal(args: { symbol: string; timeframe: '1m' | '5m' }): Promise<RealtimeSignal | null>;
}
