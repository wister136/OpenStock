import { Schema, model, models, type Document } from 'mongoose';

export interface ISystemSetting extends Document {
  key: string;
  value: boolean;
  updatedAt?: Date;
  createdAt?: Date;
}

const SystemSettingSchema = new Schema<ISystemSetting>(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Boolean, required: true },
  },
  { timestamps: true }
);

const SystemSetting = models.SystemSetting || model<ISystemSetting>('SystemSetting', SystemSettingSchema, 'system_settings');

export default SystemSetting;
