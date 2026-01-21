import { Schema, model, models, type Document } from 'mongoose';

export interface INewsAnalysisCache extends Document {
  key: string;
  symbol: string;
  source: string;
  title: string;
  publishedAt: number;
  provider: 'deepseek' | 'none';
  model?: string;
  status: 'ok' | 'fallback' | 'skipped';
  sentimentScore?: number;
  confidence?: number;
  impactScore?: number;
  summary?: string;
  eventType?: string;
  entities?: string[];
  inputTokens?: number;
  outputTokens?: number;
  costRmb?: number;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NewsAnalysisCacheSchema = new Schema<INewsAnalysisCache>(
  {
    key: { type: String, required: true, unique: true, index: true },
    symbol: { type: String, required: true, uppercase: true, trim: true, index: true },
    source: { type: String, required: true },
    title: { type: String, required: true },
    publishedAt: { type: Number, required: true, index: true },
    provider: { type: String, required: true, default: 'none' },
    model: { type: String, required: false, default: undefined },
    status: { type: String, required: true, default: 'fallback' },
    sentimentScore: { type: Number, required: false, default: undefined },
    confidence: { type: Number, required: false, default: undefined },
    impactScore: { type: Number, required: false, default: undefined },
    summary: { type: String, required: false, default: undefined },
    eventType: { type: String, required: false, default: undefined },
    entities: { type: [String], required: false, default: undefined },
    inputTokens: { type: Number, required: false, default: undefined },
    outputTokens: { type: Number, required: false, default: undefined },
    costRmb: { type: Number, required: false, default: undefined },
    reason: { type: String, required: false, default: undefined },
  },
  { timestamps: true }
);

const NewsAnalysisCache =
  models.NewsAnalysisCache || model<INewsAnalysisCache>('NewsAnalysisCache', NewsAnalysisCacheSchema, 'news_analysis_cache');

export default NewsAnalysisCache;
