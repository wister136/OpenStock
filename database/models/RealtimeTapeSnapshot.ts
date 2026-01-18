import { Schema, model, models, type Document } from 'mongoose';

export type RealtimeTimeframe = '1m' | '5m';

export interface IRealtimeTapeSnapshot extends Document {
  symbol: string;
  ts: number;
  timeframe: RealtimeTimeframe;
  volume: number;
  amount: number;
  expectedVolume?: number;
  expectedAmount?: number;
  volSurprise?: number;
  amtSurprise?: number;
}

const RealtimeTapeSnapshotSchema = new Schema<IRealtimeTapeSnapshot>(
  {
    symbol: { type: String, required: true, uppercase: true, trim: true, index: true },
    ts: { type: Number, required: true, index: true },
    timeframe: { type: String, required: true, trim: true },
    volume: { type: Number, required: true },
    amount: { type: Number, required: true },
    expectedVolume: { type: Number, required: false, default: undefined },
    expectedAmount: { type: Number, required: false, default: undefined },
    volSurprise: { type: Number, required: false, default: undefined },
    amtSurprise: { type: Number, required: false, default: undefined },
  },
  { timestamps: true }
);

RealtimeTapeSnapshotSchema.index({ symbol: 1, ts: 1 });
RealtimeTapeSnapshotSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

const RealtimeTapeSnapshot =
  models.RealtimeTapeSnapshot ||
  model<IRealtimeTapeSnapshot>('RealtimeTapeSnapshot', RealtimeTapeSnapshotSchema, 'realtime_tape_snapshots');

export default RealtimeTapeSnapshot;
