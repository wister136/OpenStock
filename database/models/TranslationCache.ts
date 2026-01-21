import { Schema, model, models, type Document } from 'mongoose';

export interface ITranslationCache extends Document {
  key: string;
  fromLang: string;
  toLang: string;
  srcText: string;
  dstText: string;
  provider: 'baidu' | 'aliyun' | 'none';
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

const TranslationCacheSchema = new Schema<ITranslationCache>(
  {
    key: { type: String, required: true, unique: true, index: true },
    fromLang: { type: String, required: true, default: 'zh' },
    toLang: { type: String, required: true, default: 'en' },
    srcText: { type: String, required: true },
    dstText: { type: String, required: true },
    provider: { type: String, required: true, default: 'none' },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

TranslationCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const TranslationCache =
  models.TranslationCache || model<ITranslationCache>('TranslationCache', TranslationCacheSchema, 'translation_cache');

export default TranslationCache;
