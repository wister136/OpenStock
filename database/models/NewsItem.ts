import { Schema, model, models, type Document } from 'mongoose';

export interface INewsItem extends Document {
  symbol: string;
  publishedAt: number;
  title: string;
  content?: string;
  url?: string;
  source: string;
  fingerprint: string;
  sentimentScore?: number;
  confidence?: number;
}

const NewsItemSchema = new Schema<INewsItem>(
  {
    symbol: { type: String, required: true, uppercase: true, trim: true, index: true, default: 'GLOBAL' },
    publishedAt: { type: Number, required: true, index: true },
    title: { type: String, required: true },
    content: { type: String, required: false, default: undefined },
    url: { type: String, required: false, default: undefined },
    source: { type: String, required: true },
    fingerprint: { type: String, required: true, unique: true, index: true },
    sentimentScore: { type: Number, required: false, default: undefined },
    confidence: { type: Number, required: false, default: undefined },
  },
  { timestamps: true }
);

NewsItemSchema.index({ symbol: 1, publishedAt: -1 });

const NewsItem = models.NewsItem || model<INewsItem>('NewsItem', NewsItemSchema, 'news_items');

export default NewsItem;
