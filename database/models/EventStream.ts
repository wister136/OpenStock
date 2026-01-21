import { Schema, model, models, type Document } from 'mongoose';

export type EventType = 'news' | 'market' | 'system';
export type MarketTrigger = 'breakout' | 'breakdown' | 'volume_spike' | 'gap' | 'limit_up' | 'limit_down';
export type EventLevel = 'info' | 'warn' | 'error';
export type MarketTimeframe = '1m' | '5m' | '15m' | '30m' | '1d';

export interface IEventStream extends Document {
  type: EventType;
  symbol: string;
  ts: number;
  source: string;
  isMock?: boolean;
  sentimentScore?: number;
  confidence?: number;
  score?: number;
  title?: string;
  title_en?: string;
  publishedAt?: number;
  summary?: string;
  eventType?: string;
  entities?: string[];
  url?: string;
  l2Reason?: string;
  timeframe?: MarketTimeframe;
  trigger?: MarketTrigger;
  price?: number;
  changePct?: number;
  volRatio?: number;
  detail?: Record<string, unknown>;
  level?: EventLevel;
  message?: string;
  fingerprint: string;
  createdAt: Date;
  updatedAt: Date;
}

const EventStreamSchema = new Schema<IEventStream>(
  {
    type: { type: String, required: true, index: true },
    symbol: { type: String, required: true, uppercase: true, trim: true, index: true },
    ts: { type: Number, required: true, index: true },
    source: { type: String, required: true },
    isMock: { type: Boolean, required: false, default: undefined },
    sentimentScore: { type: Number, required: false, default: undefined },
    confidence: { type: Number, required: false, default: undefined },
    score: { type: Number, required: false, default: undefined },
    title: { type: String, required: false, default: undefined },
    title_en: { type: String, required: false, default: undefined },
    publishedAt: { type: Number, required: false, default: undefined },
    summary: { type: String, required: false, default: undefined },
    eventType: { type: String, required: false, default: undefined },
    entities: { type: [String], required: false, default: undefined },
    url: { type: String, required: false, default: undefined },
    l2Reason: { type: String, required: false, default: undefined },
    timeframe: { type: String, required: false, default: undefined },
    trigger: { type: String, required: false, default: undefined },
    price: { type: Number, required: false, default: undefined },
    changePct: { type: Number, required: false, default: undefined },
    volRatio: { type: Number, required: false, default: undefined },
    detail: { type: Schema.Types.Mixed, required: false, default: undefined },
    level: { type: String, required: false, default: undefined },
    message: { type: String, required: false, default: undefined },
    fingerprint: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true }
);

EventStreamSchema.index({ symbol: 1, ts: -1 });
EventStreamSchema.index({ type: 1, ts: -1 });

const EventStream = models.EventStream || model<IEventStream>('EventStream', EventStreamSchema, 'events');

export default EventStream;
