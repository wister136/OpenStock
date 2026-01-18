import { Schema, model, models, type Document } from 'mongoose';

export interface INewsSentimentSnapshot extends Document {
  symbol?: string;
  ts: number;
  score: number;
  confidence: number;
  sources: string[];
  topKeywords?: string[];
  rawCount?: number;
}

const NewsSentimentSnapshotSchema = new Schema<INewsSentimentSnapshot>(
  {
    symbol: { type: String, required: false, uppercase: true, trim: true, index: true, default: 'GLOBAL' },
    ts: { type: Number, required: true, index: true },
    score: { type: Number, required: true },
    confidence: { type: Number, required: true },
    sources: { type: [String], required: true, default: [] },
    topKeywords: { type: [String], required: false, default: undefined },
    rawCount: { type: Number, required: false, default: undefined },
  },
  { timestamps: true }
);

NewsSentimentSnapshotSchema.index({ symbol: 1, ts: 1 });

const NewsSentimentSnapshot =
  models.NewsSentimentSnapshot ||
  model<INewsSentimentSnapshot>('NewsSentimentSnapshot', NewsSentimentSnapshotSchema, 'news_sentiment_snapshots');

export default NewsSentimentSnapshot;
