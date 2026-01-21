import { Schema, model, models, type Document } from 'mongoose';

export interface INewsItem extends Document {
  symbol: string;
  publishedAt: number;
  title: string;
  title_en?: string;
  content?: string;
  url?: string;
  source: string;
  fingerprint: string;
  sentimentScore?: number;
  confidence?: number;
  impactScore?: number;
  summary?: string;
  eventType?: string;
  entities?: string[];
  tags?: string[];
  l2Reason?: string;
  isMock?: boolean;
}

const NewsItemSchema = new Schema<INewsItem>(
  {
    symbol: { type: String, required: true, uppercase: true, trim: true, index: true, default: 'GLOBAL' },
    publishedAt: { type: Number, required: true, index: true },
    title: { type: String, required: true },
    title_en: { type: String, required: false, default: undefined },
    content: { type: String, required: false, default: undefined },
    url: { type: String, required: false, default: undefined },
    source: { type: String, required: true },
    fingerprint: { type: String, required: true, unique: true, index: true },
    sentimentScore: { type: Number, required: false, default: undefined },
    confidence: { type: Number, required: false, default: undefined },
    impactScore: { type: Number, required: false, default: undefined },
    summary: { type: String, required: false, default: undefined },
    eventType: { type: String, required: false, default: undefined },
    entities: { type: [String], required: false, default: undefined },
    tags: { type: [String], required: false, default: undefined },
    l2Reason: { type: String, required: false, default: undefined },
    isMock: { type: Boolean, required: false, default: undefined },
  },
  { timestamps: true }
);

NewsItemSchema.index({ symbol: 1, publishedAt: -1 });

const NewsItem = models.NewsItem || model<INewsItem>('NewsItem', NewsItemSchema, 'news_items');

export default NewsItem;
