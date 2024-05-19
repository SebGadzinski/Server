/**
 * @author Sebastian Gadzinski
 */

import { DateTime } from 'luxon';
import Notification from '../classes/Notification';
import config, { c } from '../config';
import { Category, Classes, User, Work, Worker } from '../models';
import EmailService from '../services/EmailService';
import ZoomMeetingService from '../services/ZoomMeetingService';
import CronProcess from './_CronProcess';

class ClassMaintence extends CronProcess {
    constructor() {
        super('ClassMaintence', {
            func: async () => {
                await this.setUpZoomMeetings();
            },
            interval: '0 */15 * * * *',
        }, {
            connectToDb: true,
            startMessage: 'Class Maintence started...'
        });
    }

    public async setUpZoomMeetings() {
        const now = DateTime.local();
        const past = now.minus({ minutes: c.CLASS_OPEN_BEFORE_MIN }).toJSDate();

        // Step 1: Identify relevant services in Category documents
        const classes = await Category.findOne({ slug: 'classes' }).select('services').lean();
        for (const service of classes.services) {
            let stopSearching = false;

            for (const meetingTimeDate of service?.meetingTimes) {
                if (stopSearching) break;
                const classToUpdate = await Classes.findOne({
                    serviceSlug: service.slug,
                    $or: [
                        { updateLinkDate: { $exists: false } },
                        { updateLinkDate: { $lte: past } }
                    ]
                });
                if (classToUpdate) {
                    const { meetingTime, diff, isMeetingRunning } = Classes
                        .meetingTimeDifference(now, classToUpdate.duration,
                            meetingTimeDate, 'minutes');
                    if (diff <= c.CLASS_OPEN_BEFORE_MIN) {
                        if (classToUpdate) {
                            const subscribedUsers = await Classes.getStudents(service.slug);
                            if (subscribedUsers.length === 0) {
                                stopSearching = true;
                                continue;
                            }
                            // Send email to instructors
                            const instructors = await Worker.aggregate([
                                {
                                    $match: {
                                        _id: { $in: classToUpdate.instructorIds }
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
                                    $project: { _id: '$userDetails._id', email: '$userDetails.email' }
                                }
                            ]
                            ).exec();

                            const meeting = await ZoomMeetingService
                                .createMeeting(instructors[0].email[0], {
                                    topic: `${service.name} Class`,
                                    startDate: meetingTime.toJSDate(),
                                    duration: classToUpdate.duration,
                                    // alternativeHosts = instuctor accounts
                                    // Unleash once
                                });
                            classToUpdate.meetingPassword = meeting.password;
                            classToUpdate.meetingLink = meeting.join_url;
                            classToUpdate.updateLinkDate = new Date();
                            classToUpdate.comeIn = true;
                            stopSearching = true;
                            classToUpdate.save();

                            // Iterate over each subscribed user and send an email notification
                            for (const user of subscribedUsers) {
                                const passwordInfo = user?.workClassType !== c.CLASS_TYPE.SINGLE_SESSION
                                    ? `</br>Password: ${meeting.password}` : ``;
                                const title = `${service.name} Open`;
                                const header = `Don't Miss Your Next Class!`;
                                const body = `Class is now open, instructor will be there shortly.${passwordInfo}`;
                                const route = `/my-classes?name=${encodeURIComponent(service.name)}`;
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
                            }

                            for (const instructor of instructors) {
                                // Prepare app notification details if needed
                                const emailTitle = `Your class "${service.name}" is now open`;
                                const appNotificationDetails = {
                                    id: instructor._id,
                                    notification: new Notification(
                                        emailTitle,
                                        'Check your email for link',
                                        {
                                            dotdotdot: {
                                                progress: false,
                                                color: 'accent',
                                                position: 'center'
                                            },
                                        }
                                    )
                                };
                                await EmailService.sendNotificationEmail({
                                    to: instructor.email,
                                    title: `Your class "${service.name}" is now open`,
                                    header: `Don't Miss Your Next Class!`,
                                    body: `Class is now open. </br></br>Password ${meeting.password}`,
                                    link: `${meeting.join_url}`,
                                    btnMessage: `Go To Class!`,
                                    appNotification: appNotificationDetails
                                }).catch((err) => console.error(`Failed to send email to ${instructor.email}:`, err));
                            }
                        }
                    } else {
                        classToUpdate.comeIn = isMeetingRunning;
                        stopSearching = classToUpdate.comeIn;
                        if (!isMeetingRunning) {
                            classToUpdate.meetingLink = undefined;
                            classToUpdate.meetingPassword = undefined;
                            await Work.updateMany({
                                status: 'In Use',
                                categorySlug: 'classes',
                                serviceSlug: classToUpdate.serviceSlug,
                                classType: c.CLASS_TYPE.SINGLE_SESSION
                            }, {
                                $set: {
                                    status: c.WORK_STATUS_OPTIONS.COMPLETED,
                                }
                            });
                        }
                        classToUpdate.save();
                    }
                }

            }
        }
    }

}

const classMaintence = new ClassMaintence();
classMaintence.test();
