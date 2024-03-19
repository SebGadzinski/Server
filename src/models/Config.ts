/**
 * @author Sebastian Gadzinski
 */

import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IConfig extends Document {
  _id: Schema.Types.ObjectId;
  name: string;
  value: any;
}

interface IConfigModel extends Model<IConfig> { }

const ConfigSchema: Schema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    value: { type: Object, required: true, default: 0 }
  },
  {
    timestamps: true
  }
);

const Config: IConfigModel = mongoose.model<IConfig, IConfigModel>(
  'Config',
  ConfigSchema
);

export default Config;
