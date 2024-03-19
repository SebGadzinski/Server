/**
 * @author Sebastian Gadzinski
 */
import mongoose, { Document, Model, Schema } from 'mongoose';
import { transform } from '../utils/transform';

export interface IUser extends Document {
  _id: Schema.Types.ObjectId;
  email: string;
  emailConfirmed: boolean;
  fullName: string;
  password: string;
  phoneNumber?: string;
  mfa: boolean;
  roles: string[];
  claims: Array<{ name: string; value: any }>;
  refreshToken: string;
  salt: string;
  createdBy: string;
  updatedBy: string;
  // Add any instance methods here if needed
}

interface IUserModel extends Model<IUser> {
  // Add any static methods here if needed
}

const UserSchema: Schema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true },
    emailConfirmed: { type: Boolean, required: true },
    fullName: { type: String, required: true },
    password: { type: String, required: true },
    phoneNumber: { type: String, required: false },
    mfa: { type: Boolean, required: true },
    roles: {
      type: [String],
      default: []
    },
    claims: {
      type: [
        {
          name: { type: String, required: true },
          value: { type: Schema.Types.Mixed, required: true }
        }
      ],
      default: []
    },
    refreshToken: { type: String, required: true },
    salt: { type: String, required: true },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true }
  },
  {
    timestamps: true,
    toJSON: { transform }
  }
);

const User: IUserModel = mongoose.model<IUser, IUserModel>('user', UserSchema);
export default User;
