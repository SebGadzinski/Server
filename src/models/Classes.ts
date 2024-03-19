import { DateTime, DurationUnits } from 'luxon';
import mongoose, { Document, Model, Schema } from 'mongoose';
import Work from './Work';

export interface IClasses extends Document {
    _id: Schema.Types.ObjectId;
    serviceSlug: string;
    instructorIds: Schema.Types.ObjectId[];
    meetingPassword?: string;
    meetingLink?: string;
    updateLinkDate?: Date;
    duration: number;
    comeIn: boolean;
    occupancyCap: number;
}

interface IStudent {
    userId: Schema.Types.ObjectId;
    email: string;
    workId: Schema.Types.ObjectId;
    workClassType?: string;
    workStatus?: string;
}

interface IMeetingTime {
    meetingTime: DateTime;
    diff: number;
    isMeetingRunning: boolean;
}

interface IClassesModel extends Model<IClasses> {
    getStudents(serviceSlug: string): Promise<IStudent[]>;
    meetingTimeDifference(now: DateTime, durationOfMeeting: number, meetingTimeDate: Date, unit: DurationUnits)
        : IMeetingTime;
}

const ClassesSchema: Schema = new mongoose.Schema(
    {
        serviceSlug: { type: String, required: true },
        instructorIds: { type: [Schema.Types.ObjectId], required: true },
        meetingPassword: { type: String },
        meetingLink: { type: String },
        updateLinkDate: { type: Date },
        duration: { type: Number, required: true },
        comeIn: { type: Boolean, required: true },
        occupancyCap: { type: Number, required: true },
    },
    {
        timestamps: true,
        statics: {
            async getStudents(serviceSlug: string)
                : Promise<IStudent[]> {
                return await Work.aggregate([
                    {
                        $match: {
                            categorySlug: 'classes',
                            serviceSlug,
                            status: {
                                // Either user is a regular or a single sessioner can be notified
                                $in: ['Subscribed', 'User Accepted']
                            },
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
                        $unwind: '$userDetails'
                    },
                    {
                        $project: {
                            email: '$userDetails.email',
                            userId: '$userDetails._id',
                            workId: '$_id',
                            workClassType: '$classType',
                            workStatus: '$status',
                        }
                    }
                ]);
            },
            meetingTimeDifference(now: DateTime, durationOfMeeting: number, meetingTimeDate: Date, unit: DurationUnits)
                : IMeetingTime {
                let meetingTime = DateTime.fromJSDate(meetingTimeDate);

                // Extract the weekday from the original meeting time
                const meetingWeekday = meetingTime.weekday;

                // Reset the meetingTime to now, but keep the hour and minute from the original meeting time
                meetingTime = now.set({
                    hour: meetingTime.hour,
                    minute: meetingTime.minute, second: 0, millisecond: 0
                });

                // If today is past the meeting time or it's a different weekday
                // adjust to the next occurrence of that weekday
                if (now > meetingTime || now.weekday !== meetingWeekday) {
                    // Calculate how many days to add to get to the next occurrence of the meeting's weekday
                    const daysToAdd = (meetingWeekday - now.weekday + 7) % 7 || 7;
                    meetingTime = now.plus({ days: daysToAdd })
                        .set({
                            hour: meetingTime.hour, minute: meetingTime.minute,
                            second: 0, millisecond: 0
                        });
                }

                // Calculate meeting end time
                let isMeetingRunning = false;
                if (now.weekday === meetingWeekday) {
                    // Calculate meeting end time based on hours and minutes only
                    const meetingEndTime = meetingTime.plus({ minutes: durationOfMeeting });

                    // Compare current time's hour and minute to meeting's start and end times
                    // Convert times to a comparable format (e.g., hours * 60 + minutes) to simplify comparison
                    const nowTimeInMinutes = now.hour * 60 + now.minute;
                    const meetingStartTimeInMinutes = meetingTime.hour * 60 + meetingTime.minute;
                    const meetingEndTimeInMinutes = meetingEndTime.hour * 60 + meetingEndTime.minute;

                    // Check if now is within the meeting start and end times
                    if (nowTimeInMinutes >= meetingStartTimeInMinutes && nowTimeInMinutes <= meetingEndTimeInMinutes) {
                        isMeetingRunning = true;
                    }
                }

                return { meetingTime, diff: meetingTime.diff(now, unit)[unit.toString()], isMeetingRunning };
            }
        }
    }
);

const Config: IClassesModel = mongoose.model<IClasses, IClassesModel>(
    'Classes',
    ClassesSchema
);

export default Config;
