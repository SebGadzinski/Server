/**
 * @file Defines a schema for the user collection.
 * @author Sebastian Gadzinski
 */
import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { transform } from '../utils/transform';
import Category from './Category';

export interface IWork extends Document {
  _id: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  meetingId: Schema.Types.ObjectId;
  categorySlug: string;
  serviceSlug: string;
  workItems: [
    {
      _id: Schema.Types.ObjectId;
      name: string;
      description: string;
      links: [{ name: string; url: string }];
      status: string;
    }
  ];
  paymentItems: [
    {
      _id: Schema.Types.ObjectId;
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
  createdBy: string;
  updatedBy: string;
}

interface IWorkModel extends Model<IWork> {
  getViewComponent(workId: string): Promise<any>;
}

const WorkSchema: Schema = new mongoose.Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    meetingId: { type: Schema.Types.ObjectId, required: true },
    categorySlug: { type: String, required: true },
    serviceSlug: { type: String, required: true },
    workItems: [
      {
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
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true }
  },
  {
    timestamps: true,
    toJSON: { transform },
    statics: {
      async getViewComponent(workId: string) {
        const workAggregation = Work.aggregate([
          {
            $match: {
              $expr: {
                $eq: ['$_id', { $toObjectId: workId }]
              }
            }
          },
          {
            $lookup: {
              from: 'users', // Replace with your users collection name
              localField: 'userId',
              foreignField: '_id',
              as: 'userDetails'
            }
          },
          {
            $lookup: {
              from: 'categories', // Replace with your categories collection name
              localField: 'categorySlug',
              foreignField: 'slug',
              as: 'categoryDetails'
            }
          },
          { $unwind: '$userDetails' },
          { $unwind: '$categoryDetails' },
          {
            $project: {
              'user.email': '$userDetails.email',
              'category': '$categoryDetails.name',
              'service': {
                $let: {
                  vars: {
                    serviceArray: {
                      $filter: {
                        input: '$categoryDetails.services',
                        as: 'service',
                        cond: { $eq: ['$$service.slug', '$serviceSlug'] }
                      }
                    }
                  },
                  in: { $arrayElemAt: ['$$serviceArray.name', 0] }
                }
              }, // Assuming this corresponds to the service name
              'status': 1,
              'workItems': 1,
              'paymentItems': 1,
              'payment': {
                initialPayment: '$initialPayment',
                subscription: '$subscription'
              },
              'paymentStatus': 1
            }
          }
        ]);

        const workData = await workAggregation.exec();

        if (!workData.length) throw new Error('Work not found');

        return workData[0];
      }
    }
  }
);

const Work: IWorkModel = mongoose.model<IWork, IWorkModel>('work', WorkSchema);

export default Work;
