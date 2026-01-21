import { Schema, model, models, type Document } from 'mongoose';

export interface IUsageLedger extends Document {
  date: string;
  provider: 'deepseek';
  model: string;
  inputTokens: number;
  outputTokens: number;
  calls: number;
  costRmb: number;
  updatedAt: number;
}

const UsageLedgerSchema = new Schema<IUsageLedger>(
  {
    date: { type: String, required: true, index: true },
    provider: { type: String, required: true, default: 'deepseek' },
    model: { type: String, required: true },
    inputTokens: { type: Number, required: true, default: 0 },
    outputTokens: { type: Number, required: true, default: 0 },
    calls: { type: Number, required: true, default: 0 },
    costRmb: { type: Number, required: true, default: 0 },
    updatedAt: { type: Number, required: true, default: 0 },
  },
  { timestamps: false }
);

UsageLedgerSchema.index({ date: 1, model: 1, provider: 1 }, { unique: true });

const UsageLedger = models.UsageLedger || model<IUsageLedger>('UsageLedger', UsageLedgerSchema, 'usage_ledger');

export default UsageLedger;
