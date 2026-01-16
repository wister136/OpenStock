import { Schema, model, models, type Document } from 'mongoose';

/**
 * A-share OHLCV bars stored in MongoDB.
 *
 * Conventions:
 * - symbol: UI symbol format, e.g. "SSE:603516", "SZSE:002317"
 * - freq: "5m" | "15m" | "30m" | "60m" | "1d" ("1m" reserved for TuShare rt_min)
 * - ts: bar start time
 */

export type AshareBarFreq = '1m' | '5m' | '15m' | '30m' | '60m' | '1d';

export interface IAshareBar extends Document {
  symbol: string;
  freq: AshareBarFreq;
  ts: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount?: number;
  source: 'baostock' | 'tushare';
}

const AshareBarSchema = new Schema<IAshareBar>(
  {
    symbol: { type: String, required: true, uppercase: true, trim: true, index: true },
    freq: { type: String, required: true, trim: true, index: true },
    ts: { type: Date, required: true, index: true },
    open: { type: Number, required: true },
    high: { type: Number, required: true },
    low: { type: Number, required: true },
    close: { type: Number, required: true },
    volume: { type: Number, required: true },
    amount: { type: Number, required: false },
    source: { type: String, required: true, default: 'baostock' },
  },
  { timestamps: true }
);

// One bar per (symbol,freq,ts)
AshareBarSchema.index({ symbol: 1, freq: 1, ts: 1 }, { unique: true });

// IMPORTANT:
// Historical Python ingesters in this repo write A-share bars into the MongoDB collection "market_bars".
// If we let Mongoose use the default collection ("asharebars"), the API will return 0 rows.
// Bind the model to "market_bars" so the UI can read the ingested data.
const AshareBar = models.AshareBar || model<IAshareBar>('AshareBar', AshareBarSchema, 'market_bars');

export default AshareBar;
