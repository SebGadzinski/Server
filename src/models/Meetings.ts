/**
 * @file Defines a schema for the user collection.
 * @author Sebastian Gadzinski
 */
import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { transform } from '../utils/transform';
import UnivailableDates from './UnivailableDates';

export interface IMeetings extends Document {
  _id: Schema.Types.ObjectId;
  hostUserId: Schema.Types.ObjectId;
  categorySlug: string;
  serviceSlug: string;
  users: [Schema.Types.ObjectId];
  startDate: Date;
  endDate: Date;
  createdBy: string;
  updatedBy: string;
}

interface IMeetingsModel extends Model<IMeetings> {
  // I need a method that can:
  // Find Next Time That I am available - (categorySlug, serviceSlug, fromDate: Date): Date
  findNextAvailableTime(
    categorySlug: string,
    serviceSlug: string,
    fromDate: Date
  ): Promise<Date>;
  findAvailableDurations(hostUserId: string, month, year): Promise<Date>;
  meetingAt(
    categorySlug: string,
    serviceSlug: string,
    date: string
  ): Promise<Date>;
}

const MeetingsSchema: Schema = new mongoose.Schema(
  {
    hostUserId: { type: Schema.Types.ObjectId, ref: 'User' }, // Reference to User model
    categorySlug: { type: String, required: true },
    serviceSlug: { type: String, required: true },
    users: { type: [Schema.Types.ObjectId], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true }
  },
  {
    timestamps: true,
    toJSON: { transform },
    statics: {
      async meetingAt(categorySlug, serviceSlug, date) {
        const targetDate = new Date(date);

        const result = await this.findOne({
          categorySlug,
          serviceSlug,
          startDate: { $lte: targetDate },
          endDate: { $gte: targetDate }
        }).exec();

        return result || null;
      },

      async findNextAvailableTime(categorySlug, serviceSlug, fromDate) {
        const result = await this.find({
          categorySlug,
          serviceSlug,
          startDate: { $gt: fromDate }
        })
          .sort({ startDate: 1 })
          .limit(1)
          .exec();

        return result[0]?.startDate || null;
      },

      async findAvailableDurations(hostUserId, month, year) {
        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 0);
        const unavailableDates = await UnivailableDates.find(
          {},
          { startDate: 1, endDate: 1 }
        )
          .lean()
          .exec();

        const meetings = await (hostUserId
          ? this.find({
              hostUserId,
              startDate: { $lte: endOfMonth },
              endDate: { $gte: startOfMonth }
            })
          : this.find({
              startDate: { $lte: endOfMonth },
              endDate: { $gte: startOfMonth }
            })
        )
          .lean()
          .exec();

        const events = [...meetings, ...unavailableDates].sort(
          (a, b) => a.startDate.getTime() - b.startDate.getTime()
        );
        const availableDurations = [];
        let lastEndDate = startOfMonth;

        for (const event of events) {
          if (lastEndDate < event.startDate) {
            availableDurations.push({
              start: lastEndDate,
              end: new Date(event.startDate.getTime() - 1000) // 1 second before the meeting starts
            });
          }
          lastEndDate = new Date(event.endDate.getTime() + 1000); // 1 second after the meeting ends
        }

        // Check for availability after the last meeting
        if (lastEndDate < endOfMonth) {
          availableDurations.push({ start: lastEndDate, end: endOfMonth });
        }

        return availableDurations;
      }
    }
  }
);

const Meetings: IMeetingsModel = mongoose.model<IMeetings, IMeetingsModel>(
  'meetings',
  MeetingsSchema
);

export default Meetings;
