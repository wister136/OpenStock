import { Schema, model, models, type Document } from 'mongoose';

export interface INewsCursor extends Document {
  source: string;
  symbol: string;
  lastTs: number;
}

const NewsCursorSchema = new Schema<INewsCursor>(
  {
    source: { type: String, required: true, trim: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    lastTs: { type: Number, required: true },
  },
  { timestamps: true }
);

NewsCursorSchema.index({ source: 1, symbol: 1 }, { unique: true });

const NewsCursor = models.NewsCursor || model<INewsCursor>('NewsCursor', NewsCursorSchema, 'news_cursors');

export default NewsCursor;
