import { connectToDatabase } from '@/database/mongoose';
import AshareBar from '@/database/models/ashareBar.model';
import RealtimeTapeSnapshot from '@/database/models/RealtimeTapeSnapshot';

import type { RealtimeProvider, RealtimeSignal } from './types';

const DEFAULT_LOOKBACK = 20;
const CACHE_TTL_MS = 15_000;

export class BarsRealtimeProvider implements RealtimeProvider {
  private lookback: number;

  constructor(lookback = DEFAULT_LOOKBACK) {
    this.lookback = Math.max(5, Math.min(200, lookback));
  }

  async getRealtimeSignal(args: { symbol: string; timeframe: '1m' | '5m' }): Promise<RealtimeSignal | null> {
    const { symbol, timeframe } = args;
    const now = Date.now();

    try {
      await connectToDatabase();
      const cached = await RealtimeTapeSnapshot.findOne({ symbol, timeframe }).sort({ ts: -1 }).lean();
      if (cached && now - cached.ts < CACHE_TTL_MS) {
        return { volSurprise: cached.volSurprise, amtSurprise: cached.amtSurprise, ts: cached.ts };
      }

      const bars = await AshareBar.find({ symbol, freq: timeframe })
        .sort({ ts: -1 })
        .limit(this.lookback + 1)
        .lean();

      if (bars.length < this.lookback + 1) {
        return null;
      }

      const sorted = bars.reverse();
      const latest = sorted[sorted.length - 1];
      const prev = sorted.slice(0, -1);

      const avgVol = prev.reduce((sum, b: any) => sum + Number(b.volume || 0), 0) / prev.length;
      const avgAmt = prev.reduce((sum, b: any) => sum + Number(b.amount || 0), 0) / prev.length;

      if (!(avgVol > 0)) {
        return null;
      }

      const volume = Number(latest.volume || 0);
      const amount = Number(latest.amount || 0);
      const volSurprise = volume / avgVol - 1;
      const safeAvgAmt = avgAmt > 0 ? avgAmt : amount > 0 ? amount : 1;
      const amtSurprise = safeAvgAmt > 0 ? amount / safeAvgAmt - 1 : 0;

      const ts = latest.ts instanceof Date ? latest.ts.getTime() : new Date(latest.ts as any).getTime();
      const safeTs = Number.isFinite(ts) ? ts : Date.now();

      await RealtimeTapeSnapshot.create({
        symbol,
        timeframe,
        ts: safeTs,
        volume,
        amount,
        expectedVolume: avgVol,
        expectedAmount: safeAvgAmt,
        volSurprise,
        amtSurprise,
      });

      return { volSurprise, amtSurprise, ts: safeTs };
    } catch {
      return null;
    }
  }
}
