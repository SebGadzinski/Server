/**
 * @file Defines a schema for the user collection.
 * @author Sebastian Gadzinski
 */
import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { transform } from '../utils/transform';

export interface IWork extends Document {
  _id: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  meetingId: Schema.Types.ObjectId;
  categorySlug: string;
  serviceSlug: string;
  workItems: [
    {
      id: string;
      name: string;
      description: string;
      links: [{ name: string; url: string }];
      status: string;
    }
  ];
  paymentItems: [
    {
      id: string;
      name: string;
      description: string;
      payment: number;
      status: string;
    }
  ];
  initialPayment: number;
  subscription: { payment: number; interval: string };
  paymentStatus: string;
  status: string;
  createdDate: Date;
  createdBy: string;
  updatedBy: string;
}

interface IWorkModel extends Model<IWork> {}

const WorkSchema: Schema = new mongoose.Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    meetingId: { type: Schema.Types.ObjectId, required: true },
    categorySlug: { type: String, required: true },
    serviceSlug: { type: String, required: true },
    workItems: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        description: { type: String, required: true },
        links: [
          {
            name: { type: String, required: true },
            url: { type: String, required: true }
          }
        ],
        status: { type: String, required: true }
      }
    ],
    paymentItems: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        description: { type: String, required: true },
        payment: { type: Number, required: true },
        status: { type: String, required: true }
      }
    ],
    initialPayment: { type: Number, required: true },
    subscription: {
      payment: { type: Number, required: true },
      interval: { type: String, required: true }
    },
    paymentStatus: { type: String, required: true },
    status: { type: String, required: true },
    createdDate: { type: Date, required: true },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true }
  },
  {
    timestamps: true,
    toJSON: { transform },
    statics: {}
  }
);

const Work: IWorkModel = mongoose.model<IWork, IWorkModel>('work', WorkSchema);

export default Work;
