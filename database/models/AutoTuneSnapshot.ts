import { Schema, model, models, type Document } from 'mongoose';

export interface IAutoTuneSnapshot extends Document {
  userId: string;
  symbol: string;
  tf: string;
  trainDays: number;
  trials: number;
  objective: string;
  bestParams: Record<string, unknown>;
  metrics: { netReturn: number; maxDD: number; trades: number; score: number };
}

const AutoTuneSnapshotSchema = new Schema<IAutoTuneSnapshot>(
  {
    userId: { type: String, required: true, index: true },
    symbol: { type: String, required: true, uppercase: true, trim: true, index: true },
    tf: { type: String, required: true },
    trainDays: { type: Number, required: true },
    trials: { type: Number, required: true },
    objective: { type: String, required: true },
    bestParams: { type: Schema.Types.Mixed, required: true },
    metrics: {
      netReturn: { type: Number, required: true },
      maxDD: { type: Number, required: true },
      trades: { type: Number, required: true },
      score: { type: Number, required: true },
    },
  },
  { timestamps: true }
);

AutoTuneSnapshotSchema.index({ userId: 1, symbol: 1, tf: 1, createdAt: -1 });

const AutoTuneSnapshot =
  models.AutoTuneSnapshot || model<IAutoTuneSnapshot>('AutoTuneSnapshot', AutoTuneSnapshotSchema, 'auto_tune_snapshots');

export default AutoTuneSnapshot;
