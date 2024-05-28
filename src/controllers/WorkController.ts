/**
 * @file Controller for Work Pages
 * @author Sebastian Gadzinski
 */

import _ from 'lodash';
import { Notification, Result } from '../classes';
import config, { c } from '../config';
import {
    Category, Classes, Config, Meetings, User, Work, Worker
} from '../models';
import {
    EmailService,
    SecurityService,
    SubscriptionService,
    ZoomMeetingService
} from '../services';

class WorkController {

    public async getWorkComponent(req: any, res: any) {
        try {
            if (!req?.params?.id) throw new Error('Work ID is required');

            const work = await Work.getViewComponent(req?.params.id);

            // if not admin and not this user send a error
            if (
                !req?.user?.data.roles.includes('admin') &&
                req?.user?.data?.id !== work.user.userId
            ) {
                await SecurityService.accessDenied(req.ip);
            }

            res.send(new Result({ data: work, success: true }));
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }

    public async getWorkPageData(req: any, res: any) {
        try {
            const query: any = {};
            const isAdmin = req?.user?.data.roles.includes('admin');

            if (!isAdmin) {
                query.userId = req.user.data.id;
            }

            const matchQuery: any = !isAdmin
                ? {
                    $expr: {
                        $eq: ['$userId', { $toObjectId: query.userId }]
                    }
                }
                : {};

            const workAggregation = Work.aggregate([
                {
                    $match: matchQuery
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
                        from: 'categories',
                        localField: 'categorySlug',
                        foreignField: 'slug',
                        as: 'categoryDetails'
                    }
                },
                {
                    $lookup: {
                        from: 'meetings',
                        localField: 'meetingId',
                        foreignField: '_id',
                        as: 'meetingDetails'
                    }
                },
                { $unwind: '$userDetails' },
                { $unwind: '$categoryDetails' },
                {
                    $project: {
                        workId: '$_id',
                        email: '$userDetails.email',
                        category: '$categoryDetails.name',
                        service: {
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
                        status: 1,
                        paymentItems: 1,
                        meetingLink: {
                            $ifNull: [
                                { $arrayElemAt: ['$meetingDetails.link', 0] },
                                null
                            ]
                        },
                        createdDate: '$createdAt',
                        initialPayment: '$initialPayment',
                        cancellationPayment: '$cancellationPayment',
                        subscription: {
                            $ifNull: [
                                { $arrayElemAt: [{ $slice: ['$subscription', -1] }, 0] },
                                {
                                    payment: 0, interval: c.SUBSCRIPTION_INTERVAL_OPTIONS.NA, paymentsMade: 0,
                                    nextPayment: null, isEnabled: false,
                                    dateActivated: null, dateDisabled: null,
                                    noSub: true,
                                }
                            ]
                        }
                    }
                }
            ]);

            const workData = await workAggregation.exec();

            // Query for classes where updateClassLink is within the last 30 minutes or in the next 30 minutes
            const classes = await Classes.find({
                comeIn: true
            });

            workData.map((x) => {
                x.subscription.isEnabled = SubscriptionService.isEnabled(x.subscription);
                const myClass = classes.find((cl) => cl.serviceSlug === cl.serviceSlug);
                if (myClass) {
                    // Make them use the single session
                    if (x?.classType === c.CLASS_TYPE.SINGLE_SESSION) {
                        x.useSingleSessionLink = `${process.env.DOMAIN}/work/class/use/single-session/${x.workId}`;
                    } else {
                        x.classLink = myClass.meetingLink;
                    }
                }
                if (!x.status.includes('Cancel') && x.paymentItems.some((y) => y.status !== 'Completed')) {
                    x.paymentsRequired = true;
                }
                delete x.paymentItems;
                return x;
            });

            res.send(new Result({ data: { work: workData }, success: true }));
        } catch (err) {
            console.error('Error in getWorkPageData:', err); // Improved error logging
            res
                .status(500)
                .send(new Result({ message: err.message, success: false }));
        }
    }

    public async getWorkConfirmationPageData(req: any, res: any) {
        try {
            if (!req?.params?.id) throw new Error('Work ID is required');

            const work = await Work.getViewComponent(req?.params.id);

            // if not admin and not this user send an error
            if (
                !req?.user?.data.roles.includes('admin') &&
                req?.user?.data.id !== work.user.userId.toString()
            ) {
                await SecurityService.accessDenied(req.ip);
            }

            res.send(new Result({ data: work, success: true }));
        } catch (err) {
            console.log(err);
            res.send(new Result({ message: err.message, success: false }));
        }
    }

    public async confirmWork(req: any, res: any) {
        try {
            if (!req?.params?.id) throw new Error('Work ID is required');

            const work = await Work.findOne({ _id: req?.params?.id });
            if (!work) throw new Error('Work not found');

            const workUser = await User.findOne({ _id: work.userId });
            if (!workUser) throw new Error('User not found');

            // if not admin and not this user send a error
            const isAdmin = req?.user?.data.roles.includes('admin');
            if (!isAdmin && req?.user?.data.id !== work.userId.toString()) {
                await SecurityService.accessDenied(req.ip);
            }

            // You cannot confirm work this way if there is a initial payment
            if (work.initialPayment > 0) throw new Error('Payment must be made');

            // If there is a subscription, user should have saved a card
            if (work?.subscription?.length > 0
                && work.subscription[work.subscription.length - 1].payment > 0
                && !work.subscription[work.subscription.length - 1].paymentMethodId) {
                throw new Error('Please Fill out card information');
            }

            // Update subscription
            if (work?.completeSubscription && work?.subscription?.length > 0) {
                let sub = work.subscription[work.subscription.length - 1];
                sub = SubscriptionService.completeSubscription(sub);
                work.status = c.WORK_STATUS_OPTIONS.SUBSCRIBED;
                work.completeSubscription = undefined;
            } else if (work?.classType === c.CLASS_TYPE.SINGLE_SESSION) {
                work.status = c.WORK_STATUS_OPTIONS.SUBSCRIBED;
            } else {
                work.status = c.WORK_STATUS_OPTIONS.USER_ACCEPTED;
            }

            work.initialPaymentStatus = c.PAYMENT_STATUS_OPTIONS.COMPLETED;
            work.save();

            const workers = await Worker.getWorkers(work.categorySlug, work.serviceSlug);
            await EmailService.sendConfirmWorkEmails(work, workUser, workers);

            res.send(new Result({ success: true }));
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }

    public async getWorkCancelPageData(req: any, res: any) {
        try {
            if (!req?.params?.id) throw new Error('Work ID is required');

            const work = await Work.getViewComponent(req?.params?.id);

            // if not admin and not this user send a error
            if (
                !req?.user?.data.roles.includes('admin') &&
                req?.user?.data.id !== work.user.userId.toString()
            ) {
                await SecurityService.accessDenied(req.ip);
            }

            const data = {
                work
            };

            res.send(new Result({ data, success: true }));
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }

    public async cancelWork(req: any, res: any) {
        try {
            if (!req?.params?.id) throw new Error('Work ID is required');

            const work = await Work.findOne({ _id: req?.params?.id });
            if (!work) throw new Error('Work not found');

            const workUser = await User.findOne({ _id: work.userId });
            if (!workUser) throw new Error('User not found');

            // if not admin and not this user send a error
            const isAdmin = req?.user?.data.roles.includes('admin');
            if (!isAdmin && req?.user?.data.id !== work.userId.toString()) {
                await SecurityService.accessDenied(req.ip);
            }

            // You cannot confirm work this way if there is a initial payment
            if (work.cancellationPayment > 0) throw new Error('Payment must be made');

            try {
                const meeting = await Meetings.findOne({ _id: work.meetingId });
                await Meetings.deleteOne({ _id: work.meetingId });
                await ZoomMeetingService.cancelMeeting(config.zoomMeetingEmail, meeting.zoomMeetingId);
            } catch (err) {
                console.log(`Issue cancelling meeting for work: ${work._id}`);
            }

            // If some payment items got completed do this but it can be done by
            // admin anyway w editing
            work.status = c.WORK_STATUS_OPTIONS.CANCELLED;
            work.cancellationPaymentStatus = c.PAYMENT_STATUS_OPTIONS.COMPLETED;
            work.save();

            const workers = await Worker.getWorkers(work.categorySlug, work.serviceSlug);
            await EmailService.sendCancelWorkEmails(work, workUser, workers);

            res.send(new Result({ success: true }));
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }

    public async getWorkEditorPageData(req: any, res: any) {
        try {
            // Have to be a editor to be here
            if (!req?.user?.data.roles.includes('admin')) {
                await SecurityService.accessDenied(req.ip);
            }

            const data: any = {
                usersOptions: (await User.find({}, { email: 1 })).map((x) => x.email),
                categoryOptions: (await Category.find({}, { name: 1 })).map(
                    (x) => x.name
                ),
                servicesOptions: await Category.getCategoryServiceOptions(true),
                workersOptions: (await Worker.aggregate([
                    {
                        $lookup: {
                            from: 'users', // Replace with your users collection name
                            localField: 'userId',
                            foreignField: '_id',
                            as: 'userDetails'
                        }
                    },
                    { $unwind: '$userDetails' },
                    {
                        $project: {
                            categorySlug: 1,
                            serviceSlug: 1,
                            email: '$userDetails.email'
                        }
                    }
                ])).reduce(async (acc, worker) => {
                    const { categorySlug, serviceSlug, email } = worker;

                    if (!acc[categorySlug]) {
                        acc[categorySlug] = {};
                    }

                    if (!acc[categorySlug][serviceSlug]) {
                        acc[categorySlug][serviceSlug] = [];
                    }

                    acc[categorySlug][serviceSlug].push(email);

                    return acc;
                }, {}),
                workStatusOptions: _.values(c.WORK_STATUS_OPTIONS),
                classTypeOptions: _.values(c.CLASS_TYPE),
                paymentStatusOptions: _.values(c.PAYMENT_STATUS_OPTIONS),
                subscriptionIntervalOptions: _.values(c.SUBSCRIPTION_INTERVAL_OPTIONS),
            };

            data.work = !req?.params?.id
                ?
                {
                    user: {
                        userId: '',
                        email: ''
                    },
                    category: data.categoryOptions[0],
                    service: '',
                    serviceSlug: '',
                    status: c.WORK_STATUS_OPTIONS.NA,
                    workItems: [],
                    paymentItems: [],
                    workers: [],
                    payment: {
                        initialPayment: 0,
                        cancellationPayment: 0,
                        subscription: {
                            payment: 0,
                            interval: c.SUBSCRIPTION_INTERVAL_OPTIONS.NA,
                            paymentsMade: 0,
                            nextPayment: null,
                            isEnabled: false,
                            dateActivated: null,
                            dateDisabled: null,
                            paymentHistory: [],
                            noSub: true
                        }
                    },
                    initialPaymentStatus: c.PAYMENT_STATUS_OPTIONS.NA,
                    cancellationPaymentStatus: c.PAYMENT_STATUS_OPTIONS.NA,
                }
                : await Work.getViewComponent(req?.params?.id);

            res.send(new Result({ data, success: true }));
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }

    public async upsertWork(req: any, res: any) {
        try {
            // Extracting data from request body
            const {
                isNew,
                _id,
                workItems,
                paymentItems,
                initialPaymentStatus,
                cancellationPaymentStatus,
                status,
                user,
                category,
                classType,
                service,
                payment,
                updateMessage,
                sendEmail,
                workers
            } = req.body;

            // Find the user based on the email
            const foundUser = await User.findOne({ email: user.email });
            if (!foundUser) throw new Error('User not found');
            if (!isNew && !_id) throw new Error('No Work Id Found');

            const slugs = await Category.getSlugs(category, service);

            // Find or create the work item
            const work = isNew
                ?
                new Work({
                    userId: foundUser._id,
                    meetingId: undefined,
                    categorySlug: slugs.categorySlug,
                    serviceSlug: slugs.serviceSlug,
                    workItems: [],
                    paymentItems: [],
                    subscription: [],
                    initialPayment: 0,
                    initialPaymentStatus: c.PAYMENT_STATUS_OPTIONS.UNSET,
                    classType,
                    cancellationPayment: 0,
                    cancellationPaymentStatus: c.PAYMENT_STATUS_OPTIONS.UNSET,
                    status: c.WORK_STATUS_OPTIONS.MEETING,
                    paymentHistory: [],
                    createdDate: new Date(),
                    createdBy: req.user.data.id,
                    updatedBy: req.user.data.id
                })
                : await Work.findOne({ _id });
            if (!work) throw new Error('No work found');

            work.userId = foundUser._id;

            const myCategory = await Category.findOne(
                {
                    name: category
                },
                {
                    slug: 1,
                    services: {
                        name: 1,
                        slug: 1
                    }
                }
            ).lean();
            const myServiceSlug = myCategory.services.find(
                (x) => x.name === service
            ).slug;

            // Add workers
            if (workers) {
                const workerIds = (await User.find(
                    { email: { $in: workers } },
                    { _id: 1 }
                )).map((x) => x._id);
                work.workerIds = workerIds;
            } else {
                work.workerIds = undefined;
            }

            // Map the data to the work model
            work.workItems = workItems.map((x) => {
                if (x._id.includes('new')) {
                    delete x._id;
                }
                return x;
            });
            work.paymentItems = paymentItems.map((x) => {
                if (x._id.includes('new')) {
                    delete x._id;
                }
                return x;
            });
            work.initialPaymentStatus = initialPaymentStatus;
            work.cancellationPaymentStatus = cancellationPaymentStatus;
            work.status = status;
            work.classType = classType;
            work.categorySlug = myCategory.slug;
            work.serviceSlug = myServiceSlug;
            work.initialPayment = payment.initialPayment;
            work.cancellationPayment = payment.cancellationPayment;

            const subIndex: number = work.subscription.length - 1;
            const newSubscription = _.omit(payment.subscription, ['isEnabled']);

            // Add new subscription
            const curDate = new Date();
            if (newSubscription.interval === c.SUBSCRIPTION_INTERVAL_OPTIONS.NA) {
                newSubscription.payment = 0;
            }
            // Ensure Next payment is a date
            if (newSubscription.nextPayment) {
                newSubscription.nextPayment = new Date(newSubscription.nextPayment);
            }
            if (subIndex < 0 && payment.subscription.isEnabled && payment.subscription.payment > 0) {
                // If the next payment is null, make it from today using the interval
                if (!newSubscription.nextPayment) {
                    newSubscription.nextPayment = SubscriptionService.addIntervalToDate(
                        curDate, newSubscription.interval);
                }
                newSubscription.createdDate = curDate;
                newSubscription.dateActivated = curDate;
                newSubscription.paymentHistory = [];
                work.subscription = [newSubscription];
            } else if (subIndex >= 0) {
                const sub = work.subscription[subIndex];
                const isEnabled = !sub.dateDisabled || sub.dateActivated > sub.dateDisabled;
                const subDetailsChanged = sub.interval !== payment.subscription.interval
                    || sub.payment !== payment.subscription.payment;
                let newSubAdded = false;
                // If the subscription was enabled and is now disabled
                if (isEnabled && !payment.subscription.isEnabled) {
                    sub.dateDisabled = curDate;
                    if (subDetailsChanged && sub.paymentHistory.length > 0) {
                        newSubscription.createdDate = curDate;
                        work.subscription.push(newSubscription);
                        newSubAdded = true;
                    }
                } else if (!isEnabled && payment.subscription.isEnabled) {
                    sub.dateActivated = curDate;
                    if (subDetailsChanged && sub.paymentHistory.length > 0) {
                        newSubscription.createdDate = curDate;
                        work.subscription.push(newSubscription);
                        newSubAdded = true;
                    }
                }

                // New subscription will only be added to the list of subs if there
                // was a history of payments on the last one
                if (!newSubAdded) {
                    sub.nextPayment = newSubscription.nextPayment;
                    sub.interval = newSubscription.interval;
                    sub.payment = newSubscription.payment;
                }
            }

            await work.save();

            if (sendEmail) {
                await EmailService.sendNotificationEmail({
                    to: user.email,
                    title: 'Work Update',
                    header: 'Admin Updated Work',
                    body: updateMessage,
                    link: `${config.frontEndDomain}/work/${work._id}`,
                    btnMessage: 'View On Site',
                    appNotification: {
                        id: work.userId,
                        notification: new Notification(
                            'Work Update',
                            'Admin Updated Work',
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
                                        path: `/work/${work._id}`
                                    }
                                }
                            }
                        )
                    },
                    work
                }
                );
            }

            res.send(new Result({ success: true }));
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }

    // Payments

}

export default new WorkController();
