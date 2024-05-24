/**
 * @file Controller for Browse Pages
 * @author Sebastian Gadzinski
 */

import { DateTime } from 'luxon';
import { Notification, Result } from '../classes';
import config, { c } from '../config';
import {
    Category, Meetings, UnivailableDates,
    User, Work, WorkTemplate
} from '../models';
import {
    EmailService,
    StripeService,
    ZoomMeetingService
} from '../services';

class MeetingController {
    public async getMeetingPageData(req: any, res: any) {
        try {
            const date = new Date(req.body.date);

            // if not admin
            let userId;
            if (req?.user?.data.roles.includes('admin')) {
                userId = req.user.id;
            }

            const category = await Category.aggregate([
                { $match: { slug: req.body.categorySlug } },
                { $unwind: '$services' },
                { $match: { 'services.slug': req.body.serviceSlug } },
                { $project: { 'name': 1, 'services.name': 1, 'services.bookMeetingIntervals': 1 } }
            ]).exec();
            const unavailablePeriods = await Meetings.findUnavailableDurations(date);

            res.send(
                new Result({
                    data: {
                        unavailablePeriods,
                        category: category[0].name,
                        service: category[0].services.name,
                        bookMeetingIntervals: category[0].services.bookMeetingIntervals
                    },
                    success: true
                })
            );
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }

    public async bookMeeting(req, res) {
        try {
            const { categorySlug, serviceSlug, templateId } = req.body;

            let workTemplate;
            if (templateId) {
                workTemplate = await WorkTemplate.findById(templateId).lean();
                workTemplate.workItems = workTemplate.workItems.map((x) => {
                    delete x._id;
                    return x;
                });
                workTemplate.paymentItems = workTemplate.paymentItems.map((x) => {
                    delete x._id;
                    return x;
                });
                if (!workTemplate) {
                    throw new Error(`Cannot find template with id: ${templateId}`);
                }
            }

            // TODO: Implement route stat counter here based off category/service

            await Work.acceptingWork(categorySlug, serviceSlug);
            const startDate = new Date(req.body.startDate);
            const endDate: Date = new Date(startDate.getTime());
            const users: string[] = [];

            if (!req?.user?.data?.id) throw new Error('Sign Up Required');
            // if (!req.user.data.emailConfirmed) throw new Error('Email Confirmed Required');

            users.push(req.user.data.id);

            // Validate input
            if (!categorySlug || !serviceSlug || users.length === 0 || !startDate) {
                throw new Error('Missing required fields');
            }

            // Verify time is within the acceptable times
            const category = await Category.aggregate([
                { $match: { slug: categorySlug } },
                { $unwind: '$services' },
                { $match: { 'services.slug': req.body.serviceSlug } },
                { $project: { 'name': 1, 'services.name': 1, 'services.bookMeetingIntervals': 1 } }
            ]).exec();

            // Convert startDate to a Luxon DateTime for easier manipulation
            const luxonStartDate = DateTime.fromJSDate(startDate);
            let isDateAcceptable = false;

            // Assuming there's only one category and one service as per your logic
            for (const interval of category[0].services.bookMeetingIntervals) {
                const intervalStart = DateTime.fromJSDate(interval.start);
                const intervalEnd = DateTime.fromJSDate(interval.end);

                // Adjust interval dates to match the week of luxonStartDate
                const adjustedIntervalStart = luxonStartDate.startOf('week')
                    .plus({
                        days: intervalStart.weekday - 1,
                        hours: intervalStart.hour, minutes: intervalStart.minute
                    });
                const adjustedIntervalEnd = luxonStartDate.startOf('week')
                    .plus({ days: intervalEnd.weekday - 1, hours: intervalEnd.hour, minutes: intervalEnd.minute });

                // Check if luxonStartDate falls within the adjusted interval
                if (luxonStartDate >= adjustedIntervalStart && luxonStartDate <= adjustedIntervalEnd) {
                    isDateAcceptable = true;
                    break; // Exit the loop if a suitable interval is found
                }
            }

            if (!isDateAcceptable) throw new Error('Date not within range');

            // Validate for univaliable dates
            const conflictingDates = await UnivailableDates.find({
                $or: [
                    { startDate: { $lt: endDate, $gte: startDate } },
                    { endDate: { $gt: startDate, $lte: endDate } }
                ],
            });

            if (conflictingDates.length > 0) {
                throw new Error('Time slot is not available');
            }

            // Check for time conflicts
            endDate.setMinutes(30);
            const conflictingMeetings = await Meetings.find({
                $or: [
                    { startDate: { $lt: endDate, $gte: startDate } },
                    { endDate: { $gt: startDate, $lte: endDate } }
                ],
                users: { $in: users }
            });

            if (conflictingMeetings.length > 0) {
                throw new Error('Time slot is not available');
            }

            const newMeeting = new Meetings({
                // Me for now
                // hostUserId,
                categorySlug,
                serviceSlug,
                users,
                startDate,
                endDate
            });

            // All meetings go to me for now
            const { join_url, meetingId, password } = await ZoomMeetingService.createMeeting(config.zoomMeetingEmail, {
                topic: `${req?.user.data.email}: ${categorySlug} - ${serviceSlug}`,
                startDate,
                duration: 30,
            }
            );

            newMeeting.link = join_url;
            newMeeting.zoomMeetingId = meetingId;

            await newMeeting.save();

            let newWork;
            if (workTemplate) {
                newWork = new Work({
                    userId: req.user.data.id,
                    meetingId: newMeeting._id,
                    categorySlug,
                    serviceSlug,
                    workItems: workTemplate.workItems,
                    paymentItems: workTemplate.paymentItems,
                    subscription: [],
                    initialPayment: workTemplate.initialPayment,
                    initialPaymentStatus: c.PAYMENT_STATUS_OPTIONS.UNSET,
                    cancellationPayment: workTemplate.cancellationPayment,
                    cancellationPaymentStatus: c.PAYMENT_STATUS_OPTIONS.UNSET,
                    status: c.WORK_STATUS_OPTIONS.MEETING,
                    paymentHistory: [],
                    classType: workTemplate.classType,
                    createdDate: new Date(),
                    createdBy: req.user.data.email,
                    updatedBy: req.user.data.email
                });
                if (workTemplate.subscription && workTemplate.subscription.payment > 0) {
                    newWork.subscription = [{
                        payment: workTemplate.subscription.payment,
                        interval: workTemplate.subscription.interval,
                        paymentHistory: [],
                        nextPayment: new Date(),
                        createdDate: new Date(),
                        dateActivated: new Date(),
                        dateDisabled: new Date(),
                    }];
                }
            } else {
                newWork = new Work({
                    userId: req.user.data.id,
                    meetingId: newMeeting._id,
                    categorySlug,
                    serviceSlug,
                    workItems: [],
                    paymentItems: [],
                    subscription: [],
                    initialPayment: 0,
                    initialPaymentStatus: c.PAYMENT_STATUS_OPTIONS.UNSET,
                    cancellationPayment: 0,
                    cancellationPaymentStatus: c.PAYMENT_STATUS_OPTIONS.UNSET,
                    status: c.WORK_STATUS_OPTIONS.MEETING,
                    paymentHistory: [],
                    createdDate: new Date(),
                    createdBy: req.user.data.email,
                    updatedBy: req.user.data.email
                });
            }
            await newWork.save();

            const user = await User.findById(req.user.data.id).lean();
            // Set up stripe account if not set up
            await StripeService.createCustomer(user, categorySlug);

            // Convert and format dates for email using Luxon
            const timeZone = 'America/New_York';
            const formattedStartDate = DateTime.fromJSDate(startDate)
                .setZone(timeZone)
                .toFormat('MMMM dd, yyyy HH:mm:ss');
            const formattedEndDate = DateTime.fromJSDate(endDate)
                .setZone(timeZone)
                .toFormat('HH:mm:ss');

            await EmailService.sendNotificationEmail({
                to: config.sendGrid.email.alert,
                title: 'New Meeting',
                header: `${req?.user.data.email} Wants To Talk!`,
                body: `${req?.user.data.email} wants to talk about work in ${category[0].name} - ${category[0].services.name}.
            <br/><br/> ${req.body?.bookingMessage ?? 'No Message'}<br/><br/>${password ? `Password for joining: ${password}` : ''}`,
                link: `${config.frontEndDomain}/work/${newWork._id}`,
                btnMessage: 'Go To Meeting Via Site',
                work: newWork
            }
            );
            await EmailService.sendNotificationEmail({
                to: req?.user.data.email,
                title: 'New Meeting',
                header: `Meeting has been set`,
                body: `Your meeting is set for ${formattedStartDate} - ${formattedEndDate} Eastern Time.
            Click on button below and hit the actions drop down and click 'Go To Meeting'.<br/><br/>${password ? `Password for joining: ${password}` : ''}`,
                link: `${config.frontEndDomain}/work/${newWork._id}`,
                btnMessage: 'Go To Meeting Via Site',
                appNotification: {
                    id: req.user.data.id,
                    notification: new Notification(
                        'New Meeting',
                        `Meeting has been set`,
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
                                    path: `/work/${newWork._id}`
                                }
                            }
                        }
                    )
                },
                work: newWork
            }
            );

            res.send(new Result({ data: newMeeting, success: true }));
        } catch (err) {
            console.log(err);
            res.send(new Result({ message: err.message, success: false }));
        }
    }
}

export default new MeetingController();
