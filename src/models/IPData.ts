/**
 * @author Sebastian Gadzinski
 */
import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IIPData extends Document {
  ipAddress: string;
  count: number;
  isBlocked: boolean;
}

interface IIPDataModel extends Model<IIPData> { }

const IPDataSchema: Schema = new mongoose.Schema(
  {
    ipAddress: { type: String, required: true, unique: true },
    count: { type: Number, required: true, default: 0 },
    isBlocked: { type: Boolean, required: true, default: false }
  },
  {
    timestamps: true
  }
);

const IPData: IIPDataModel = mongoose.model<IIPData, IIPDataModel>(
  'IPData',
  IPDataSchema
);

export default IPData;
