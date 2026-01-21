import { Schema, model, models, type Document } from 'mongoose';

export interface ITranslationStat extends Document {
  dateKey: string;
  total: number;
  cached: number;
  durationMs: number;
  providers: Record<string, number>;
  reasons: Record<string, number>;
  createdAt: Date;
}

const TranslationStatSchema = new Schema<ITranslationStat>(
  {
    dateKey: { type: String, required: true, unique: true, index: true },
    total: { type: Number, required: true, default: 0 },
    cached: { type: Number, required: true, default: 0 },
    durationMs: { type: Number, required: true, default: 0 },
    providers: { type: Schema.Types.Mixed, required: true, default: {} },
    reasons: { type: Schema.Types.Mixed, required: true, default: {} },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false }
);

const TranslationStat =
  models.TranslationStat || model<ITranslationStat>('TranslationStat', TranslationStatSchema, 'translation_stats');

export default TranslationStat;
