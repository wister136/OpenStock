import { Schema, model, models, type Document } from 'mongoose';

export type DecisionSnapshotRegime = 'TREND' | 'RANGE' | 'PANIC';
export type DecisionSnapshotAction = 'BUY' | 'SELL' | 'HOLD';

export interface IDecisionSnapshot extends Document {
  userId: string;
  symbol: string;
  timeframe: string;
  ts: number;
  regime: DecisionSnapshotRegime;
  strategy: string;
  action: DecisionSnapshotAction;
  confidence: number;
  position_cap: number;
  metrics?: Record<string, number>;
  external_signals?: Record<string, unknown>;
}

const DecisionSnapshotSchema = new Schema<IDecisionSnapshot>(
  {
    userId: { type: String, required: true, index: true },
    symbol: { type: String, required: true, uppercase: true, trim: true, index: true },
    timeframe: { type: String, required: true, index: true },
    ts: { type: Number, required: true, index: true },
    regime: { type: String, required: true },
    strategy: { type: String, required: true },
    action: { type: String, required: true },
    confidence: { type: Number, required: true },
    position_cap: { type: Number, required: true },
    metrics: { type: Schema.Types.Mixed, required: false },
    external_signals: { type: Schema.Types.Mixed, required: false },
  },
  { timestamps: true }
);

DecisionSnapshotSchema.index({ userId: 1, symbol: 1, timeframe: 1, ts: -1 });
DecisionSnapshotSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

const DecisionSnapshot =
  models.DecisionSnapshot || model<IDecisionSnapshot>('DecisionSnapshot', DecisionSnapshotSchema, 'decision_snapshots');

export default DecisionSnapshot;
