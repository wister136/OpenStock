import { connectToDatabase } from '@/database/mongoose';
import AshareBar from '@/database/models/ashareBar.model';
import RealtimeTapeSnapshot from '@/database/models/RealtimeTapeSnapshot';
import { normalizeSymbol } from '@/lib/ashare/symbol';

import type { RealtimeProvider, RealtimeSignal } from './types';

const DEFAULT_LOOKBACK = 20;
const CACHE_TTL_MS = 15_000;
const OPENING_FILTER_MINUTES = 30;

function isOpeningWindow(ts: Date): boolean {
  // MVP: use server local time for CN market open window (09:30-10:00).
  const h = ts.getHours();
  const m = ts.getMinutes();
  return h === 9 && m < 30 + OPENING_FILTER_MINUTES;
}

export class BarsRealtimeProvider implements RealtimeProvider {
  private lookback: number;

  constructor(lookback = DEFAULT_LOOKBACK) {
    this.lookback = Math.max(5, Math.min(200, lookback));
  }

  async getRealtimeSignal(args: { symbol: string; timeframe: '1m' | '5m' }): Promise<RealtimeSignal | null> {
    const symbol = normalizeSymbol(args.symbol);
    const { timeframe } = args;
    const now = Date.now();

    try {
      await connectToDatabase();
      const cached = await RealtimeTapeSnapshot.findOne({ symbol, timeframe }).sort({ ts: -1 }).lean();
      if (cached && now - cached.ts < CACHE_TTL_MS) {
        if (Number.isFinite(cached.volSurprise) || Number.isFinite(cached.amtSurprise)) {
          return {
            volSurprise: cached.volSurprise ?? 0,
            amtSurprise: cached.amtSurprise ?? 0,
            ts: cached.ts,
          };
        }
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
      const latestDate = latest.ts instanceof Date ? latest.ts : new Date(latest.ts as any);
      if (isOpeningWindow(latestDate)) {
        return null;
      }

      const filtered = prev.filter((b: any) => {
        const dt = b.ts instanceof Date ? b.ts : new Date(b.ts as any);
        return !isOpeningWindow(dt);
      });
      const base = filtered.length >= Math.max(5, this.lookback / 2) ? filtered : prev;

      const avgVol = base.reduce((sum, b: any) => sum + Number(b.volume || 0), 0) / base.length;
      const avgAmt = base.reduce((sum, b: any) => sum + Number(b.amount || 0), 0) / base.length;

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
