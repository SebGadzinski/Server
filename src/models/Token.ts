/**
 * @author Sebastian Gadzinski
 */
import mongoose, { Document, Model, Schema } from 'mongoose';
import { transform } from '../utils/transform';

export interface IToken extends Document {
  _id: Schema.Types.ObjectId;
  referenceId: string;
  reason: string;
  value: string;
  expiration: Date;
  createdBy: string;
  updatedBy: string;
  // Add any instance methods here if needed
}

interface ITokenModel extends Model<IToken> {
  // Add any static methods here if needed
}

const TokenSchema: Schema = new mongoose.Schema(
  {
    // Reference ID can be a user id, can be a id for a group or tag or anything.
    // purpose is to make this token collection usable for any type of need
    referenceId: { type: String, required: true },
    reason: { type: String, required: true },
    value: { type: String, required: true },
    expiration: { type: Date, required: true }
  },
  {
    timestamps: true,
    toJSON: { transform }
  }
);

const Token: ITokenModel = mongoose.model<IToken, ITokenModel>(
  'token',
  TokenSchema
);
export default Token;
