/**
 * @author Sebastian Gadzinski
 */
import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { transform } from '../utils/transform';

export interface IUnivailableDates extends Document {
  _id: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  name: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  createdBy: string;
  updatedBy: string;
}

interface IUnivailableDatesModel extends Model<IUnivailableDates> { }

const UnivailableDatesSchema: Schema = new mongoose.Schema(
  {
    userId: { type: [Schema.Types.ObjectId], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true }
  },
  {
    timestamps: true,
    toJSON: { transform },
    statics: {}
  }
);

const UnivailableDates: IUnivailableDatesModel = mongoose.model<
  IUnivailableDates,
  IUnivailableDatesModel
>('univailable_dates', UnivailableDatesSchema);

export default UnivailableDates;
