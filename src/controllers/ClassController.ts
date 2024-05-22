import _ from 'lodash';
import { DateTime } from 'luxon';
import { Result } from '../classes';
import config, { c } from '../config';
import {
    Category,
    Classes,
    User, Work,
    Worker
} from '../models';
import {
    ClassService,
    EmailService,
    SecurityService
} from '../services';

class ClassController {
    public async getClassesPageData(req: any, res: any) {
        try {
            const classes = await Work.aggregate([
                {
                    $match: {
                        $expr: {
                            $eq: ['$userId', { $toObjectId: req.user.data.id }]
                        },
                        status: {
                            $in: [
                                c.WORK_STATUS_OPTIONS.IN_USE,
                                c.WORK_STATUS_OPTIONS.SUBSCRIBED,
                                c.WORK_STATUS_OPTIONS.USER_ACCEPTED,
                            ]
                        }
                    },
                },
                {
                    $lookup: {
                        from: 'classes',
                        localField: 'serviceSlug',
                        foreignField: 'serviceSlug',
                        as: 'classDetails'
                    }
                },
                { $unwind: '$classDetails' },
                {
                    $lookup: {
                        from: 'workers',
                        localField: 'classDetails.instructorIds',
                        foreignField: '_id',
                        as: 'instructorDetails'
                    }
                },
                { $unwind: '$instructorDetails' },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'instructorDetails.userId',
                        foreignField: '_id',
                        as: 'userDetails'
                    }
                },
                { $unwind: '$userDetails' },
                {
                    $group: {
                        _id: '$_id',
                        workStatus: { $first: '$status' },
                        classDetails: { $first: '$classDetails' },
                        categorySlug: { $first: '$categorySlug' },
                        serviceSlug: { $first: '$serviceSlug' },
                        classType: { $first: '$classType' },
                        canJoin: { $first: '$canJoin' },
                        instructorInfo: {
                            $push: {
                                email: `$userDetails.email`,
                                fullName: `$userDetails.fullName`
                            }
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        workId: '$_id',
                        workStatus: 1,
                        duration: '$classDetails.duration',
                        serviceSlug: 1,
                        classType: 1,
                        canJoin: '$classDetails.comeIn',
                        instructorInfo: 1
                    }
                }
            ]).exec();

            let workClasses: any = [];
            if (req?.user?.data?.roles?.includes('worker')) {
                const workerIds = (await Worker.find({ categorySlug: 'classes', userId: req.user.data.id },
                    { _id: 1 }).lean()).map((x) => x._id);
                workClasses = await Classes.aggregate([
                    {
                        $match: {
                            instructorIds: { $in: workerIds }
                        }
                    },
                    {
                        $project: {
                            myClass: { $literal: true },
                            duration: 1,
                            serviceSlug: 1,
                            classType: c.CLASS_TYPE.PERPETUAL,
                            canJoin: 1
                        }
                    }
                ]);
                const studentPromises = workClasses.map(async (myClass) => {
                    const students = await Classes.getStudents(myClass.serviceSlug);
                    myClass.students = students;
                });

                await Promise.all(studentPromises);
            }

            classes.push(...workClasses);

            if (classes) {
                const setOfServiceSlugs = new Set();
                for (const aClass of classes) {
                    setOfServiceSlugs.add(aClass.serviceSlug);
                }

                // Apply thumbnails to classes
                const categoryThumbnails: any = await Category.aggregate([
                    {
                        $match: {
                            'slug': `classes`,
                            'services.slug': { $in: [...setOfServiceSlugs] }
                        }
                    },
                    {
                        $unwind: `$services`
                    },
                    {
                        $match: {
                            'services.slug': { $in: [...setOfServiceSlugs] }
                        }
                    },
                    {
                        $project: {
                            _id: 0, // Exclude the id field
                            serviceName: `$services.name`,
                            serviceSlug: `$services.slug`,
                            name: { $arrayElemAt: [`$services.slides.text`, 0] }
                        }
                    }
                ]).exec();

                const nameByServiceSlug = categoryThumbnails.map((x) => {
                    x.formattedName = x.name.toLowerCase()
                        .replace(/\s+/g, '-');
                    return x;
                }).reduce((acc, cur) => {
                    acc[cur.serviceSlug] = cur;
                    return acc;
                }, {});

                for (const aClass of classes) {
                    const { serviceName, formattedName } = nameByServiceSlug[aClass.serviceSlug];
                    aClass.name = serviceName;
                    aClass.thumbnailImg = `https://gadzy-work.com/images/classes/${aClass.serviceSlug}/desktop/${formattedName}.png`;
                }

                const meetingTimes = (await Category.find({
                    slug: 'classes'
                }, {
                    'services.slug': 1,
                    'services.meetingTimes': 1
                }).lean()).reduce((acc, cur) => {
                    cur.services.forEach((service) => {
                        acc[service.slug] = service.meetingTimes.sort((a, b) => a.getTime() - b.getTime());
                    });
                    return acc;
                }, {});
                const now = DateTime.local();
                for (const aClass of classes) {
                    if (!aClass.canJoin) {
                        let closestMeetingTime = null;
                        let smallestDiff = Infinity;

                        for (const t of meetingTimes[aClass.serviceSlug]) {
                            const { meetingTime, diff } = Classes
                                .meetingTimeDifference(now, aClass.duration,
                                    t, 'seconds');

                            if (diff > 0 && diff < smallestDiff) {
                                smallestDiff = diff;
                                closestMeetingTime = meetingTime;
                            }
                        }

                        if (closestMeetingTime) {
                            aClass.nextClass = closestMeetingTime.toJSDate();
                            aClass.secondsTillClass = smallestDiff;
                        }
                    }
                }
            }

            res.send(new Result({ data: { classes }, success: true }));
        } catch (err) {
            console.log(err);
            res.send(new Result({ message: err.message, success: false }));
        }
    }

    public async getJoinClassLink(req: any, res: any) {
        try {
            if (!req?.params?.workId) throw new Error('Work ID is required');

            const work = await Work.findOne({ _id: req?.params.workId }, { userId: 1, serviceSlug: 1, classType: 1 });

            // if not admin and not this user send an error
            if (
                !req?.user?.data.roles.includes('admin') &&
                req?.user?.data.id !== work.userId.toString()
            ) {
                await SecurityService.accessDenied(req.ip);
            }

            const myClass = await Classes.findOne({ serviceSlug: work.serviceSlug },
                { comeIn: 1, meetingLink: 1, meetingPassword: 1 }).lean();
            if (!myClass.comeIn) throw new Error('Cannot join class');
            if (!myClass.meetingLink) throw new Error('Class getting ready!');

            if (work.classType === c.CLASS_TYPE.SINGLE_SESSION) {
                work.status = c.WORK_STATUS_OPTIONS.IN_USE;
                await work.save();
            }

            const meetingId = myClass.meetingLink.match(/\/j\/(\d+)\?/)[1];

            res.send(new Result({
                data: {
                    comeIn: myClass.comeIn,
                    meetingLink: myClass.meetingLink,
                    meetingId,
                    meetingPassword: myClass?.meetingPassword
                }, success: true
            }));
        } catch (err) {
            console.error('Error in getWorkPageData:', err); // Improved error logging
            res
                .status(500)
                .send(new Result({ message: err.message, success: false }));
        }
    }

    public async dropClass(req: any, res: any) {
        try {
            if (!req?.params?.workId) throw new Error('Work ID is required');

            const work = await Work.findOne({ _id: req?.params.workId },
                {
                    categorySlug: 1, serviceSlug: 1, userId: 1, subscription: 1,
                    cancellationPaymentStatus: 1, cancellationPayment: 1
                });

            // if not admin and not this user send an error
            if (
                !req?.user?.data.roles.includes('admin') &&
                req?.user?.data.id !== work.userId.toString()
            ) {
                await SecurityService.accessDenied(req.ip);
            }

            if (work.cancellationPayment > 0 &&
                work.cancellationPaymentStatus !== c.PAYMENT_STATUS_OPTIONS.COMPLETED) {
                throw new Error('Cancellation Process Required');
            }

            work.status = c.WORK_STATUS_OPTIONS.CANCELLED;
            if (work?.subscription?.length > 0) {
                work.subscription[work.subscription.length - 1].dateDisabled = new Date();
            }

            work.cancellationPaymentStatus = c.PAYMENT_STATUS_OPTIONS.COMPLETED;
            await work.save();

            const workUser = await User.findById(work.userId);
            const workers = await Worker.getWorkers(work.categorySlug, work.serviceSlug);
            await EmailService.sendCancelWorkEmails(work, workUser, workers);

            res.send(new Result({
                success: true
            }));
        } catch (err) {
            console.error('Error in getWorkPageData:', err); // Improved error logging
            res
                .status(500)
                .send(new Result({ message: err.message, success: false }));
        }
    }
    public async enrollmentStatus(req: any, res: any) {
        try {
            if (!req?.user?.data?.id) throw new Error('Sign Up Required');

            const { status, template } = await ClassService.enrollmentStatus({
                userId: req.user.data.id, templateId: req.params.id
            });

            if (!status.allowed) {
                throw new Error(status.reason);
            }

            await Work.acceptingWork(template.categorySlug, template.serviceSlug);

            res.send(new Result({ data: status, success: true }));
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }

    public async enroll(req: any, res: any) {
        try {

            const { template, status } = await ClassService.enrollmentStatus({
                userId: req.user.data.id, templateId: req.params.id
            });

            if (!status.allowed) {
                throw new Error(status.reason);
            }

            await Work.acceptingWork(template.categorySlug, template.serviceSlug);

            // Create work and apply template
            const newWork: any = new Work({
                userId: req.user.data.id,
                meetingId: null,
                categorySlug: template.categorySlug,
                serviceSlug: template.serviceSlug,
                workItems: template.workItems,
                paymentItems: template.paymentItems,
                subscription: [],
                initialPayment: template.initialPayment,
                initialPaymentStatus: template.initialPaymentStatus,
                cancellationPayment: template.cancellationPayment,
                cancellationPaymentStatus: template.cancellationPaymentStatus,
                classType: template.classType,
                status: c.WORK_STATUS_OPTIONS.CONFIRMATION_REQUIRED,
                paymentHistory: [],
                createdDate: new Date(),
                createdBy: req.user.data.id,
                updatedBy: req.user.data.id
            });

            if (template?.subscription?.payment > 0) {
                newWork.subscription = [{
                    payment: template.subscription.payment,
                    interval: template.subscription.interval
                }];
                newWork.completeSubscription = true;
            }
            await newWork.save();

            res.send(new Result({ data: newWork._doc, success: true }));
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }

    public async useSingleSession(req: any, res: any) {
        try {
            const id = req?.params?.id; // Correctly access the id from path parameters

            const work = await Work.findById(id);

            // if not admin and not this user send a error
            if (
                !req?.user?.data.roles.includes('admin') &&
                req?.user?.data?.id !== work.userId.toString()
            ) {
                await SecurityService.accessDenied(req.ip);
            }

            if (work.status !== c.WORK_STATUS_OPTIONS.SUBSCRIBED) {
                throw new Error('Not subscribed');
            }

            work.status = c.WORK_STATUS_OPTIONS.IN_USE;

            // Query for classes where updateClassLink is within the last 30 minutes or in the next 30 minutes
            const myClass = await Classes.findOne({
                comeIn: true,
                serviceSlug: work.serviceSlug
            });

            if (!myClass) {
                throw new Error('Class doors have shut');
            }

            const names = await Category.getNames(work.categorySlug, work.serviceSlug);
            // Send meeting info via email
            await EmailService.sendNotificationEmail({
                to: req.user.data.email,
                title: `${names.service} - Meeting`,
                header: `Meeting Info`,
                body: `Password: ${myClass.meetingPassword}`,
                link: `${config.frontEndDomain}/work/${work._id}`,
                btnMessage: 'Go To Meeting Via Site',
                work
            });

            work.save();

            res.send(new Result({
                data: myClass.meetingLink,
                success: true
            }));
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }
}

export default new ClassController();
