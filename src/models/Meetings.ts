/**
 * @author Sebastian Gadzinski
 */
import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { transform } from '../utils/transform';
import UnivailableDates from './UnivailableDates';

export interface IMeetings extends Document {
  _id: Schema.Types.ObjectId;
  zoomMeetingId: string;
  // hostUserId: Schema.Types.ObjectId; ADVANCMENT
  categorySlug: string;
  serviceSlug: string;
  users: [Schema.Types.ObjectId];
  link: string;
  startDate: Date;
  endDate: Date;
  createdBy: string;
  updatedBy: string;
}

export interface IDateInterval {
  start: Date;
  end: Date;
}

interface IMeetingsModel extends Model<IMeetings> {
  // I need a method that can:
  // Find Next Time That I am available - (categorySlug, serviceSlug, fromDate: Date): Date
  findNextAvailableTime(
    categorySlug: string,
    serviceSlug: string,
    fromDate: Date
  ): Promise<Date>;
  findUnavailableDurations(date: Date): Promise<IDateInterval[]>;
  meetingAt(
    categorySlug: string,
    serviceSlug: string,
    date: string
  ): Promise<Date>;
}

const MeetingsSchema: Schema = new mongoose.Schema(
  {
    // hostUserId: { type: Schema.Types.ObjectId, ref: 'User' }, // Reference to User model
    zoomMeetingId: { type: String, required: true },
    categorySlug: { type: String, required: true },
    serviceSlug: { type: String, required: true },
    users: { type: [Schema.Types.ObjectId], required: true },
    link: { type: String, required: true },
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

      async findUnavailableDurations(date): Promise<IDateInterval[]> {
        // Fetch unavailable dates
        const unavailableDates = await UnivailableDates.find(
          {},
          { startDate: 1, endDate: 1 }
        )
          .lean()
          .exec();

        // Fetch meetings scheduled for or after the given date
        const meetings = await this.find({
          endDate: { $gt: date }
        })
          .lean()
          .exec();

        // Combine and sort meetings and unavailable dates
        const events = [...meetings, ...unavailableDates].sort(
          (a, b) => a.startDate.getTime() - b.startDate.getTime()
        );

        // Initialize the array to hold the unavailable durations
        const unavailableDurations = [];

        // Loop through the sorted events to build the list of unavailable durations
        for (const event of events) {
          unavailableDurations.push({
            start: event.startDate,
            end: event.endDate
          });
        }

        // Return the list of unavailable durations
        return unavailableDurations;
      }
    }
  }
);

const Meetings: IMeetingsModel = mongoose.model<IMeetings, IMeetingsModel>(
  'meetings',
  MeetingsSchema
);

export default Meetings;
