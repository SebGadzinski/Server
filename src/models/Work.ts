/**
 * @author Sebastian Gadzinski
 */
import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { c } from '../config';
import StripeService from '../services/StripeService';
import SubscriptionService from '../services/SubscriptionService';
import { transform } from '../utils/transform';
import Worker from './Worker';

export interface IPaymentHistory {
  _id: Schema.Types.ObjectId;
  type: string;
  sessionId?: string;
  intentId?: string;
  paymentItemId?: string;
  status: string;
  createdDate: Date;
}

interface ISubscription extends Document {
  _id: Schema.Types.ObjectId;
  payment: number;
  interval: string;
  paymentHistory: [{
    _id: Schema.Types.ObjectId;
    paymentIntentId: string;
    status: string;
  }];
  nextPayment: Date;
  paymentMethodId?: string;
  createdDate: Date;
  dateActivated: Date;
  dateDisabled?: Date;
}

export interface IWork extends Document {
  _id: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  workerIds?: Schema.Types.ObjectId[];
  meetingId?: Schema.Types.ObjectId;
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
  subscription: ISubscription[];
  initialPayment: number;
  initialPaymentStatus: string;
  cancellationPayment: number;
  cancellationPaymentStatus: string;
  status: string;
  paymentHistory: [
    {
      _id: Schema.Types.ObjectId;
      type: string;
      sessionId?: string;
      intentId?: string;
      paymentItemId: string;
      status: string;
      createdDate: Date;
    }
  ];
  alertedForMeeting?: boolean;
  alertedForClassMeetingAt?: Date;
  completeSubscription?: boolean;
  classType?: string;
  createdBy: string;
  updatedBy: string;
}

interface IWorkModel extends Model<IWork> {
  getViewComponent(workId: string): Promise<any>;
  getMoreSubPaymentHistory(workId: string, indexSlip: number, amount: number): Promise<any>;
}

const subscriptionSchema = new Schema({
  payment: { type: Number, required: true },
  interval: { type: String, required: true },
  paymentHistory: [{
    paymentIntentId: { type: String, required: true },
    status: { type: String, required: true }
  }],
  nextPayment: { type: Date, required: false },
  createdDate: { type: Date },
  dateActivated: { type: Date, required: false },
  dateDisabled: { type: Date },
  paymentMethodId: { type: String }
});

const WorkSchema: Schema = new mongoose.Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    workerIds: { type: [Schema.Types.ObjectId], required: false },
    meetingId: { type: Schema.Types.ObjectId, required: false },
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
    subscription: [
      subscriptionSchema
    ],
    initialPayment: { type: Number, required: true },
    initialPaymentStatus: { type: String, required: true },
    cancellationPayment: { type: Number, required: true },
    cancellationPaymentStatus: { type: String, required: true },
    status: { type: String, required: true },
    paymentHistory: [
      {
        type: { type: String, required: true },
        sessionId: { type: String, required: false },
        intentId: { type: String, required: false },
        paymentItemId: { type: String, required: false },
        status: { type: String, required: true },
        createdDate: { type: Date, required: true }
      }
    ],
    alertedForMeeting: { type: Boolean },
    alertedForClassMeetingAt: { type: Date },
    completeSubscription: { type: Boolean },
    classType: { type: String },
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
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'userDetails'
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: 'workerIds',
              foreignField: '_id',
              as: 'workerDetails'
            }
          },
          {
            $lookup: {
              from: 'categories',
              localField: 'categorySlug',
              foreignField: 'slug',
              as: 'categoryDetails'
            }
          },
          {
            $lookup: {
              from: 'meetings',
              localField: 'meetingId', // Adjust this field name based on your schema
              foreignField: '_id',
              as: 'meetingInfo'
            }
          },
          {
            $addFields: {
              meetingWithinThreeHours: {
                $filter: {
                  input: '$meetingInfo',
                  as: 'meeting',
                  cond: {
                    $and: [
                      { $gte: ['$$meeting.startDate', new Date()] },
                      {
                        $lte: ['$$meeting.startDate',
                          new Date(+new Date() + 3 * 60 * 60 * 1000)]
                      } // Adds 3 hours to the current time
                    ]
                  }
                }
              }
            }
          },
          {
            $addFields: {
              meetingLink: { $ifNull: [{ $arrayElemAt: ['$meetingWithinThreeHours.link', 0] }, ''] }
            }
          },
          { $unwind: '$userDetails' },
          { $unwind: '$categoryDetails' },
          {
            $project: {
              'user.userId': {
                $toString: '$userDetails._id'
              },
              'user.email': '$userDetails.email',
              'category': '$categoryDetails.name',
              'categorySlug': '$categoryDetails.slug',
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
              },
              'serviceSlug': 1,
              'status': 1,
              'workItems': 1,
              'paymentItems': 1,
              'classType': 1,
              'workers': {
                $map: {
                  input: '$workerDetails',
                  as: 'worker',
                  in: {
                    id: '$$worker._id',
                    email: '$$worker.email'
                  }
                }
              },
              'payment': {
                initialPayment: '$initialPayment',
                cancellationPayment: '$cancellationPayment',
                subscription: {
                  $ifNull: [
                    { $arrayElemAt: [{ $slice: ['$subscription', -1] }, 0] },
                    {
                      payment: 0, interval: 'NA', paymentsMade: 0,
                      nextPayment: null, isEnabled: false,
                      dateActivated: null, dateDisabled: null,
                      noSub: true
                    }
                  ]
                }
              },
              'initialPaymentStatus': 1,
              'cancellationPaymentStatus': 1,
              'meetingLink': 1 // Include meeting link if within 3 hours
            }
          }
        ]);

        const workData = await workAggregation.exec();

        if (!workData.length) throw new Error('Work not found');

        if (workData[0].categorySlug === 'classes') {
          const workers = (await Worker.aggregate(
            [
              {
                $match: {
                  categorySlug: 'classes',
                  serviceSlug: workData[0].serviceSlug
                }
              },
              {
                $lookup: {
                  from: 'users',
                  localField: 'userId',
                  foreignField: '_id',
                  as: 'userDetails'
                }
              },
              { $unwind: '$userDetails' },
              {
                $project: {
                  id: '$userDetails._id',
                  email: '$userDetails.email'
                }
              }
            ]
          )).map((x) => {
            return {
              email: x.email,
              id: x.id
            };
          });
          workData[0].workers = workers;
        }

        workData[0].payment.subscription.isEnabled = SubscriptionService.isEnabled(workData[0].payment.subscription);

        try {
          workData[0].payment.subscription.last4Digits = await StripeService.getLast4DigitsOfCard(
            workData[0].categorySlug, workData[0].payment.subscription.paymentMethodId);
        } catch (e) {
          // User just does not have any payment set up yet
        }

        return workData[0];
      },
      async getMoreSubPaymentHistory(workId: string, indexSlip: number, amount: number) {
        indexSlip = 2;
        const result = await this.aggregate([
          // Match the specific work document
          {
            $match: {
              $expr: {
                $eq: ['$_id', { $toObjectId: workId }]
              }
            }
          },
          // Unwind the subscription array to process each subscription individually
          { $unwind: '$subscription' },
          // Calculate the start and end indexes for the slice
          {
            $project: {
              startIdx: {
                $max: [
                  0,
                  { $subtract: [{ $size: '$subscription.paymentHistory' }, { $add: [indexSlip, amount] }] }
                ]
              },
              endIdx: {
                $max: [
                  0,
                  { $subtract: [{ $size: '$subscription.paymentHistory' }, indexSlip] }
                ]
              },
              paymentHistory: '$subscription.paymentHistory'
            }
          },
          // Conditionally slice the paymentHistory array
          {
            $project: {
              paymentHistorySlice: {
                $cond: {
                  if: { $eq: ['$startIdx', '$endIdx'] },
                  then: [],
                  else: { $slice: ['$paymentHistory', '$startIdx', { $subtract: ['$endIdx', '$startIdx'] }] }
                }
              }
            }
          },
          // Group the results back together
          {
            $group: {
              _id: '$_id',
              paymentHistory: { $push: '$paymentHistorySlice' }
            }
          },
          // Flatten the array of payment history arrays
          {
            $project: {
              paymentHistory: {
                $reduce: {
                  input: '$paymentHistory',
                  initialValue: [],
                  in: { $concatArrays: ['$$value', '$$this'] }
                }
              }
            }
          }
        ]);

        return result[0] ? result[0].paymentHistory : [];
      }
    }
  }
);

const Work: IWorkModel = mongoose.model<IWork, IWorkModel>('work', WorkSchema);

export default Work;
