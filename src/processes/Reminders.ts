/**
 * @author Sebastian Gadzinski
 */

import { DateTime } from 'luxon';
import Notification from '../classes/Notification';
import config, { c } from '../config';
import { Category, Classes, Work } from '../models';
import EmailService from '../services/EmailService';
import CronProcess from './_CronProcess';

class Reminders extends CronProcess {
    private readonly REMIND_ME_BEFORE_HOURS = 3;

    constructor() {
        super('Reminders', {
            func: async () => {
                await this.heyYouGotAMeetingSoon();
                await this.classesStart();
            },
            interval: '0 0 */1 * * *',
        }, {
            connectToDb: true,
            startMessage: 'Reminders started...'
        });
    }

    public async heyYouGotAMeetingSoon() {
        const now = DateTime.local();
        const remindTimeWindow = now.plus({ hours: this.REMIND_ME_BEFORE_HOURS });

        const worksWithMeetings = await Work.aggregate([
            {
                $lookup: {
                    from: 'meetings', // The collection to join
                    localField: 'meetingId', // Field from the Work collection
                    foreignField: '_id', // Field from the Meetings collection
                    as: 'meetingInfo' // Output array field
                }
            },
            { $unwind: '$meetingInfo' }, // Deconstructs the array field from the joined collection
            {
                $match: {
                    'alertedForMeeting': { $in: [false, null] },
                    'meetingInfo.startDate': {
                        $gte: now.toJSDate(),
                        $lte: remindTimeWindow.toJSDate()
                    }
                }
            },
            {
                $project: {
                    id: '$_id',
                    userId: '$userId',
                    categorySlug: 1,
                    serviceSlug: 1,
                    meetingStartDate: '$meetingInfo.startDate'
                }
            }
        ]);

        // Process each Work item with its associated meeting
        for (const work of worksWithMeetings) {
            await this.sendMeetingReminder(work);
            await Work.updateOne({ _id: work.id }, { alertedForMeeting: true });
        }
    }

    public async classesStart() {
        const now = DateTime.local();
        const classes = await Category.findOne({ slug: 'classes' }).select('services').lean();

        for (const service of classes.services) {
            // see if current time is REMIND_ME_BEFORE_HOURS for that services (class) meeting time
            for (const meetingTimeDate of service?.meetingTimes) {
                const myClass = await Classes.findOne({
                    serviceSlug: service.slug
                });
                const { meetingTime, diff } = Classes.meetingTimeDifference(now, myClass.duration,
                    meetingTimeDate, 'hours');
                if (diff <= this.REMIND_ME_BEFORE_HOURS) {
                    const remindTimeThreshold = meetingTime.minus({ hours: this.REMIND_ME_BEFORE_HOURS }).toJSDate();
                    const subscribedUsers = await Work.aggregate([
                        {
                            $match: {
                                categorySlug: 'classes',
                                serviceSlug: service.slug,
                                status: 'Subscribed',
                                $or: [
                                    { alertedForClassMeetingAt: { $exists: false } },
                                    { alertedForClassMeetingAt: { $lt: remindTimeThreshold } }
                                ]
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
                                workId: '$_id'
                            }
                        }
                    ]);

                    // Iterate over each subscribed user and send an email notification
                    for (const user of subscribedUsers) {
                        const title = `Upcoming ${service.name} class`;
                        const header = `Don't Miss Your Next Class!`;
                        const body = `Just a friendly reminder that your next class is coming up soon. Make sure you're prepared and on time to make the most of it.`;
                        const route = `/my-classes`;
                        const link = `${config.frontEndDomain}${route}`; // Adjust the link as needed
                        const btnMessage = `Go To Class`;

                        // Prepare app notification details if needed
                        const appNotification = {
                            id: user.userId,
                            notification: new Notification(
                                title,
                                body,
                                {
                                    dotdotdot: {
                                        progress: false,
                                        color: 'accent',
                                        position: 'center'
                                    },
                                    to: {
                                        label: 'VISIT',
                                        color: 'primary',
                                        route: {
                                            path: route,
                                        }
                                    }
                                }
                            )
                        };

                        // Send the email
                        await EmailService.sendNotificationEmail({
                            to: user.email,
                            title,
                            header,
                            body,
                            link,
                            btnMessage,
                            appNotification
                        }).catch((err) => console.error(`Failed to send email to ${user.email}:`, err));

                        await Work.updateOne(
                            { _id: user.workId }, // Filter to identify the document
                            { $set: { alertedForClassMeetingAt: new Date() } } // Set the current date and time
                        );
                    }
                }
            }
        }
    }

    private async sendMeetingReminder(work: any) {
        const msg = `Your meeting at ${work.meetingStartDate}`;
        await EmailService.sendNotificationEmail({
            // Replace with the email of the meeting participant
            to: config.sendGrid.email.alert,
            title: 'Upcoming Meeting Reminder',
            header: `Reminder: Your meeting is scheduled soon`,
            body: msg,
            // Replace with the actual URL to the meeting or related page
            link: `${config.frontEndDomain}/work`,
            btnMessage: 'Go To Work',
            appNotification: {
                id: work.userId, // Replace with the actual ID of the user
                notification: new Notification(
                    'Upcoming Meeting Reminder',
                    msg,
                    {
                        dotdotdot: {
                            progress: false,
                            color: 'accent',
                            position: 'center'
                        },
                        to: {
                            label: 'VISIT',
                            color: 'primary',
                            route: {
                                path: `/work`
                            }
                        }
                    }
                )
            }
        });
    }

}

const reminders = new Reminders();
reminders.run();
