import { Schema, model, models, type Document } from 'mongoose';

export interface INewsItem extends Document {
  symbol: string;
  ts: number;
  title: string;
  summary?: string;
  url?: string;
  source: string;
  sentimentScore?: number;
  impactScore?: number;
  keywords?: string[];
  raw?: unknown;
}

const NewsItemSchema = new Schema<INewsItem>(
  {
    symbol: { type: String, required: true, uppercase: true, trim: true, index: true },
    ts: { type: Number, required: true, index: true },
    title: { type: String, required: true },
    summary: { type: String, required: false, default: undefined },
    url: { type: String, required: false, default: undefined },
    source: { type: String, required: true },
    sentimentScore: { type: Number, required: false, default: undefined },
    impactScore: { type: Number, required: false, default: undefined },
    keywords: { type: [String], required: false, default: undefined },
    raw: { type: Schema.Types.Mixed, required: false, default: undefined },
  },
  { timestamps: true }
);

NewsItemSchema.index({ symbol: 1, ts: -1 });

const NewsItem = models.NewsItem || model<INewsItem>('NewsItem', NewsItemSchema, 'news_items');

export default NewsItem;
