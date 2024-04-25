/**
 * @file Controller for Application Data needs
 * @author Sebastian Gadzinski
 */
import _ from 'lodash';
import { DateTime } from 'luxon';
import mongoose from 'mongoose';
import Notification from '../classes/Notification';
import Result from '../classes/Result';
import config, { c } from '../config';
import {
  Category, Classes, Config, Meetings, Stats, UnivailableDates,
  User, VMStatusReport, Work, Worker, WorkTemplate
} from '../models';
import { IUser } from '../models/User';
import { IWork } from '../models/Work';
import ClassService from '../services/ClassService';
import EmailService from '../services/EmailService';
import fileService from '../services/FileService';
import SecurityService from '../services/SecurityService';
import StripeService from '../services/StripeService';
import SubscriptionService from '../services/SubscriptionService';
import ZoomMeetingService from '../services/ZoomMeetingService';

const security = SecurityService.getInstance();

class DataController {
  private static readonly publicCollections = {
    category: Category
  };

  constructor() {
    this.sendCancelWorkEmails = this.sendCancelWorkEmails.bind(this);
    this.sendConfirmWorkEmails = this.sendConfirmWorkEmails.bind(this);
    // Binding all methods to ensure the correct context of `this`
    this.getCollection = this.getCollection.bind(this);
    this.getHomePageData = this.getHomePageData.bind(this);
    this.getCategoryPageData = this.getCategoryPageData.bind(this);
    this.getServicePageData = this.getServicePageData.bind(this);
    this.getMeetingPageData = this.getMeetingPageData.bind(this);
    this.findUnavailableDurations = this.findUnavailableDurations.bind(this);
    this.bookMeeting = this.bookMeeting.bind(this);
    this.getWorkPageData = this.getWorkPageData.bind(this);
    this.getWorkConfirmationPageData =
      this.getWorkConfirmationPageData.bind(this);
    this.confirmWork = this.confirmWork.bind(this); // Already bound in your original code
    this.getWorkCancelPageData = this.getWorkCancelPageData.bind(this);
    this.cancelWork = this.cancelWork.bind(this);
    this.getWorkEditorPageData = this.getWorkEditorPageData.bind(this);
    this.upsertWork = this.upsertWork.bind(this);
    this.getWorkComponent = this.getWorkComponent.bind(this);
    this.getUserPageData = this.getUserPageData.bind(this);
    this.getProfile = this.getProfile.bind(this);
    this.saveProfile = this.saveProfile.bind(this);
    this.accessDenied = this.accessDenied.bind(this); // This was the initial method with issues
    this.generatePaymentIntent = this.generatePaymentIntent.bind(this);
    this.confirmPaymentIntent = this.confirmPaymentIntent.bind(this);
    this.acceptingWork = this.acceptingWork.bind(this);
    this.saveWorkTemplate = this.saveWorkTemplate.bind(this);
    this.stripMongo = this.stripMongo.bind(this);
    this.enrollmentStatus = this.enrollmentStatus.bind(this);
    this.enroll = this.enroll.bind(this);
  }

  // _Generics
  public async getCollection(req: any, res: any) {
    try {
      const collectionName = req.body.name;
      const page = req.body.page || 1;
      const limit = req.body.limit || 10; // Number of items per page
      if (DataController.publicCollections[collectionName]) {
        const offset = (page - 1) * limit;
        const data = await DataController.publicCollections[collectionName]
          .find()
          .skip(offset)
          .limit(limit);

        res.send(new Result({ data, success: true }));
      } else {
        res.send(new Result({ success: false }));
      }
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  // _Home
  public async getHomePageData(req: any, res: any) {
    try {
      const data = await Category.find().select(
        'name slug thumbnailImg services.name services.description services.slug'
      );

      res.send(new Result({ data, success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async resetStats(req: any, res: any) {
    try {
      await Stats.deleteMany({});
      res.send(new Result({ success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  // _Category
  public async getCategoryPageData(req: any, res: any) {
    try {
      const data = await Category.aggregate([
        { $match: { slug: req.body.categorySlug } },
        {
          $project: {
            services: 1,
            watchMeImg: 1, // Keep watchMeImg for later stages
            watchMeLink: 1, // Keep watchMeImg for later stages
            _id: 0
          }
        },
        { $unwind: '$services' },
        {
          $project: {
            name: '$services.name',
            description: '$services.description',
            thumbnailImg: '$services.thumbnailImg',
            slug: '$services.slug',
            watchMeImg: 1, // Carry watchMeImg through projection
            watchMeLink: 1, // Keep watchMeImg for later stages
          }
        },
        {
          $group: {
            _id: null, // Group all documents together since we're only dealing with one category
            services: {
              $push: {
                name: '$name',
                description: '$description',
                thumbnailImg: '$thumbnailImg',
                slug: '$slug',
              }
            },
            watchMeImg: { $first: '$watchMeImg' },
            watchMeLink: { $first: '$watchMeLink' },
          }
        },
        {
          $project: {
            _id: 0,
            watchMeLink: 1,
            watchMeImg: 1,
            services: 1
          }
        }
      ]);

      if (!data || data.length === 0) {
        throw new Error(`No data for category ${req.body.categorySlug}`);
      }

      res.send(new Result({ data, success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  // _Category.Service
  public async getServicePageData(req: any, res: any) {
    try {
      const categorySlug = req.body.categorySlug;
      const serviceSlug = req.body.serviceSlug; // assuming the service slug is provided in the request

      // Find the category and project only the matching service
      const category = await Category.findOne(
        { slug: categorySlug, services: { $elemMatch: { slug: serviceSlug } } },
        { 'name': 1, 'services.$': 1 }
      ).lean();

      if (!category || !category.services) {
        return res.send(
          new Result({ message: 'Service not found', success: false })
        );
      }

      // Extract the matched service
      const service: any = category.services[0];
      // Get templates
      const workTemplates = await WorkTemplate.find(
        { category: category.name, service: service.name },
        { name: 1, _id: 1 }).lean();
      const workTemplatesToAttach = workTemplates.reduce((acc, template) => {
        // for each of the templates possible, add there info into
        acc[template._id.toString()] = {
          name: template.name, _id: template._id
        };
        return acc;
      }, {});
      // Find workers
      service.workers = [];
      const workers: any = await Worker.find({ categorySlug, serviceSlug }).lean();
      for (const worker of workers) {
        worker.name = (await User.findById(worker.userId)).fullName;
        if (category.name !== 'Classes') {
          // Add templates assigned to this worker
          const templates = [];
          for (const id of worker.templates) {
            if (workTemplatesToAttach[id.toString()]) {
              templates.push(workTemplatesToAttach[id.toString()]);
            }
          }
          worker.templates = templates;
        }

        service.workers.push(worker);
      }

      service.templates = workTemplates;

      res.send(new Result({ data: service, success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

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

  public async findUnavailableDurations(req: any, res: any) {
    try {
      const date = new Date(req.body.date);

      // if not admin
      let userId = null;
      if (req?.user?.data.roles.includes('admin')) {
        userId = req.user.id;
      }

      const unavailablePeriods = await Meetings.findUnavailableDurations(date);

      res.send(new Result({ data: unavailablePeriods, success: true }));
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

      await this.acceptingWork(categorySlug, serviceSlug);
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
          .plus({ days: intervalStart.weekday - 1, hours: intervalStart.hour, minutes: intervalStart.minute });
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

      const { join_url, meetingId, password } = await ZoomMeetingService.createMeeting({
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
            classDetails: { $first: '$classDetails' },
            categorySlug: { $first: '$categorySlug' },
            serviceSlug: { $first: '$serviceSlug' },
            classType: { $first: '$classType' },
            canJoin: { $first: '$canJoin' },
            instructorInfo: {
              $push: {
                email: `$userDetails.email`,
                fullName: `$userDetails.fullName` // Directly using the fullName field
              }
            }
          }
        },
        {
          $project: {
            _id: 0,
            workId: '$_id',
            duration: '$classDetails.duration',
            serviceSlug: 1,
            classType: 1,
            canJoin: '$classDetails.comeIn',
            instructorInfo: 1
          }
        }
      ]).exec();

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
            for (const t of meetingTimes[aClass.serviceSlug]) {
              // t is a date representing a date and time during the week
              const { meetingTime, diff } = Classes
                .meetingTimeDifference(now, aClass.duration,
                  t, 'seconds');
              aClass.nextClass = meetingTime.toJSDate();
              aClass.secondsTillClass = diff;
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
        await this.accessDenied(req.ip);
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
        { userId: 1, subscription: 1, cancellationPaymentStatus: 1, cancellationPayment: 1 });

      // if not admin and not this user send an error
      if (
        !req?.user?.data.roles.includes('admin') &&
        req?.user?.data.id !== work.userId.toString()
      ) {
        await this.accessDenied(req.ip);
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
      if (!req?.body?.workId) throw new Error('Work ID is required');

      const work = await Work.getViewComponent(req?.body.workId);

      // if not admin and not this user send an error
      if (
        !req?.user?.data.roles.includes('admin') &&
        req?.user?.data.id !== work.user.userId.toString()
      ) {
        await this.accessDenied(req.ip);
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
        await this.accessDenied(req.ip);
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

      await this.sendConfirmWorkEmails(isAdmin, work, workUser);

      res.send(new Result({ success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async sendConfirmWorkEmails(
    isAdmin: boolean,
    work: IWork,
    workUser: IUser
  ) {
    const theUser = isAdmin ? 'Admin' : workUser.fullName;
    const emailUsers = [workUser.email, config.sendGrid.email.alert];
    for (const email of emailUsers) {
      let appNotification: any = {};

      if (email === workUser.email) {
        appNotification = {
          id: workUser._id.toString(),
          notification: new Notification(
            'Work Confirmed',
            `${theUser} Confirmed Work`,
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
                  path: `/work/${work._id.toString()}`
                }
              }
            }
          )
        };
      }

      await EmailService.sendNotificationEmail(
        {
          to: email,
          title: 'Work Confirmed',
          header: `${theUser} Confirmed Work`,
          body: `${theUser} has confirmed the work id ${work._id}`,
          link: `${config.frontEndDomain}/work/${work._id}`,
          btnMessage: 'View On Site',
          appNotification,
          work
        }
      );
    }
  }

  public async acceptingWork(categorySlug?: string, serviceSlug?: string) {
    const acceptingWork = await Config.findOne({ name: 'acceptingWork' });
    if (!acceptingWork || !acceptingWork?.value) {
      throw new Error('Not Accepting Work');
    }

    if (categorySlug) {
      if (!acceptingWork.value[categorySlug]
        || !acceptingWork.value[categorySlug]?.accepting) {
        throw new Error('Not Accepting Work');
      }
      if (serviceSlug && acceptingWork.value[categorySlug]?.noService) {
        if (acceptingWork.value[categorySlug]?.noService.includes(serviceSlug)) {
          throw new Error('Not Accepting Work');
        }
      }
    }
  }

  public async generatePaymentIntent(req: any, res: any) {
    try {
      if (!req?.body?.workId) throw new Error('Work ID is required');

      const work = await Work.findOne({ _id: req.body.workId });
      await this.acceptingWork(work.categorySlug, work.serviceSlug);

      if (work?.subscription?.length > 0) {
        const sub = work.subscription[work.subscription.length - 1];
        if ((!sub.dateDisabled || sub.dateDisabled < sub.dateActivated)
          && !sub.paymentMethodId) {
          throw new Error('Please provide a payment method');
        }
      }

      if (
        !req.user.data.roles.includes('admin') &&
        req.user.data.id !== work.userId.toString()
      ) {
        // if not admin and not this user send an error
        await this.accessDenied(req.ip);
        return;
      }

      let amount = 0;
      let name = '';
      const currency = 'cad';
      const paymentCompletedMsg = `Payment already completed`;

      if (req.body.type === c.PAYMENT_HISTORY_TYPE.CONFIRMATION) {
        if (work.initialPaymentStatus === c.PAYMENT_STATUS_OPTIONS.COMPLETED) {
          throw new Error(paymentCompletedMsg);
        }
        amount = work.initialPayment;
        name = 'Initial Payment for Work ID ' + req.body.workId;
      } else if (req.body.type === c.PAYMENT_HISTORY_TYPE.PAYMENT_ITEM && req.body.paymentItemId) {
        // Get the payment item and add it name
        const paymentItem = work.paymentItems.find(
          (x) => x._id.toString() === req.body.paymentItemId
        );
        if (!paymentItem) {
          throw new Error(`No payment item found ${req.body.paymentItemId}`);
        }
        if (paymentItem.status === c.PAYMENT_STATUS_OPTIONS.COMPLETED) {
          throw new Error(paymentCompletedMsg);
        }
        name = `Payment '${paymentItem.name}' for Work ID ${req.body.workId}`;
        amount = paymentItem.payment;
      } else if (req.body.type === c.PAYMENT_HISTORY_TYPE.FULL) {
        const unpaidPaymentItems = work.paymentItems.filter(
          (x) => x.status !== c.PAYMENT_STATUS_OPTIONS.COMPLETED
        );
        if (unpaidPaymentItems.length === 0) {
          throw new Error(paymentCompletedMsg);
        }
        amount = unpaidPaymentItems.reduce((total, currentItem) => {
          return total + currentItem.payment;
        }, 0);
        name = 'Complete Payment for Work ID ' + req.body.workId;
      } else if (req.body.type === c.PAYMENT_HISTORY_TYPE.CANCELLATION) {
        if (work.cancellationPaymentStatus === c.PAYMENT_STATUS_OPTIONS.COMPLETED) {
          throw new Error(paymentCompletedMsg);
        }
        amount = work.cancellationPayment;
        name = 'Cancellation Payment for Work ID ' + req.body.workId;
      } else {
        throw new Error('Endpoint not found');
      }

      // Create a new Payment History
      const newPaymentHistory: any = {
        _id: new mongoose.Types.ObjectId(),
        type: req.body.type,
        sessionId: '',
        status: 'New',
        createdDate: new Date()
      };

      if (req.body.paymentItemId) {
        newPaymentHistory.paymentItemId = req.body.paymentItemId;
      }

      // TODO: Get Session ID Based off work Category
      let ipAddress = null;
      if (req?.ip?.startsWith('::ffff:')) {
        ipAddress = req.ip.substring(7);
      }

      const session = await StripeService.createCheckoutSession(work, currency, name, amount, newPaymentHistory);

      newPaymentHistory.sessionId = session.id;
      work.paymentHistory.push(newPaymentHistory);
      work.save();

      res.send(
        new Result({
          data: { sessionId: session.id, url: session.url },
          success: true
        })
      );
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async confirmPaymentIntent(req: any, res: any) {
    try {
      if (!req?.query?.id) throw new Error('Payement History ID is required');

      const matchQuery: any = {
        $expr: {
          $in: [
            { $toObjectId: req.query.id },
            {
              $map: {
                input: '$paymentHistory',
                as: 'payment',
                in: '$$payment._id'
              }
            }
          ]
        }
      };

      const work = await Work.findOne(matchQuery);
      if (!work) {
        throw new Error('No Work Found');
      }

      const workUser = await User.findOne({ _id: work.userId });
      if (!workUser) throw new Error('User not found');

      // Get the payment history object from the list
      const paymentHistory = work.paymentHistory.find(
        (ph) => ph._id.toString() === req.query.id
      );
      if (!paymentHistory) {
        throw new Error('Payment History Not Found');
      }

      const checkoutSession = await StripeService.getCheckoutSession(work.categorySlug, paymentHistory.sessionId);

      if (checkoutSession.payment_status !== 'paid') {
        throw new Error('Payment not successful');
      }

      paymentHistory.status = c.PAYMENT_STATUS_OPTIONS.COMPLETED;
      let transactionItems = [];

      // Update the statuses of content of work
      if (paymentHistory.type === c.PAYMENT_HISTORY_TYPE.CONFIRMATION) {
        work.status = c.WORK_STATUS_OPTIONS.USER_ACCEPTED;
        work.initialPaymentStatus = c.PAYMENT_STATUS_OPTIONS.COMPLETED;
        if (work?.subscription?.length > 0) {
          let sub = work?.subscription[work.subscription.length - 1];
          sub = SubscriptionService.completeSubscription(sub);
          work.status = c.WORK_STATUS_OPTIONS.SUBSCRIBED;
          work.completeSubscription = undefined;
        }

        transactionItems.push({
          name: 'Initial Payment',
          quantity: 1,
          price: `${work.initialPayment.toFixed(2)} CAD`
        });

        await this.sendConfirmWorkEmails(false, work, workUser);
      } else if (
        paymentHistory.type === c.PAYMENT_HISTORY_TYPE.PAYMENT_ITEM &&
        paymentHistory?.paymentItemId
      ) {
        const paymentItem = work.paymentItems.find(
          (pi) => pi._id.toString() === paymentHistory.paymentItemId
        );
        if (paymentItem) {
          paymentItem.status = c.PAYMENT_STATUS_OPTIONS.COMPLETED;
          transactionItems.push({
            name: paymentItem.name,
            quantity: 1,
            price: `${paymentItem.payment.toFixed(2)} CAD`
          });
        }
      } else if (paymentHistory.type === c.PAYMENT_HISTORY_TYPE.FULL) {
        work.paymentItems.map((x) => {
          x.status = c.PAYMENT_STATUS_OPTIONS.COMPLETED;
          return x;
        });
        transactionItems = work.paymentItems.map((pi) => ({
          name: pi.name,
          quantity: 1,
          price: `${pi.payment.toFixed(2)} CAD`
        }));
      } else if (paymentHistory.type === c.PAYMENT_HISTORY_TYPE.CANCELLATION) {
        work.status = c.WORK_STATUS_OPTIONS.CANCELLED;
        work.cancellationPaymentStatus = c.PAYMENT_STATUS_OPTIONS.COMPLETED;
        transactionItems.push({
          name: 'Cancellation',
          quantity: 1,
          price: `${work.cancellationPayment.toFixed(2)} CAD`
        });

        // if this is a subscription it should set to off
        const subsLength = work?.subscription?.length;
        if (subsLength > 0) {
          const sub = work.subscription[subsLength - 1];
          sub.dateDisabled = new Date();
        }

        await this.sendCancelWorkEmails(false, work, workUser);
      } else {
        throw new Error(`Type ${paymentHistory.type} not found`);
      }

      await work.save();

      const transactionDetails = {
        date: new Date().toISOString().split('T')[0], // Current date in YYYY-MM-DD format
        amount: checkoutSession.amount_total / 100, // Assuming amount_total is in cents
        items: transactionItems,
      };

      // Gather meta data
      const names = await Category.getNames(work.categorySlug, work.serviceSlug);
      const metaData = {
        workId: work._id,
        category: names.category,
        service: names.service
      };

      const card = await StripeService.getLast4DigitsOfCardFromSession(work.categorySlug, checkoutSession);

      // Send receipt email
      await EmailService.sendReceiptEmail({
        to: workUser.email,
        metaData,
        transactionDetails,
        paymentMethod: `**** **** **** ${card}`,
        transactionId: paymentHistory._id.toString()
      });

      res.send(new Result({ data: work._id, success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async getWorkCancelPageData(req: any, res: any) {
    try {
      if (!req?.body?.workId) throw new Error('Work ID is required');

      const work = await Work.getViewComponent(req?.body.workId);

      // if not admin and not this user send a error
      if (
        !req?.user?.data.roles.includes('admin') &&
        req?.user?.data.id !== work.user.userId.toString()
      ) {
        await this.accessDenied(req.ip);
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
        await this.accessDenied(req.ip);
      }

      // You cannot confirm work this way if there is a initial payment
      if (work.cancellationPayment > 0) throw new Error('Payment must be made');

      const meeting = await Meetings.findOne({ _id: work.meetingId });
      await Meetings.deleteOne({ _id: work.meetingId });
      await ZoomMeetingService.cancelMeeting(meeting.zoomMeetingId);

      // If some payment items got completed do this but it can be done by
      // admin anyway w editing
      work.status = c.WORK_STATUS_OPTIONS.CANCELLED;
      work.cancellationPaymentStatus = c.PAYMENT_STATUS_OPTIONS.COMPLETED;
      work.save();

      await this.sendCancelWorkEmails(isAdmin, work, workUser);

      res.send(new Result({ success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async sendCancelWorkEmails(
    isAdmin: boolean,
    work: IWork,
    workUser: IUser
  ) {
    const theUser = isAdmin ? 'Admin' : workUser.fullName;
    const emailUsers = [workUser.email, config.sendGrid.email.alert];
    for (const email of emailUsers) {
      let appNotification: any = {};

      if (email === workUser.email) {
        appNotification = {
          id: workUser._id.toString(),
          notification: new Notification(
            'Work Cancelled',
            `${theUser} Cancelled Work`,
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
                  path: `/work/${work._id.toString()}`
                }
              }
            }
          )
        };
      }

      await EmailService.sendNotificationEmail({
        to: email,
        title: 'Work Cancelled',
        header: `${theUser} Cancelled Work`,
        body: `${theUser} has cancelled work ${work._id}`,
        link: `${config.frontEndDomain}/work/${work._id}`,
        btnMessage: 'View On Site',
        work
      }
      );
    }
  }

  public async getWorkComponent(req: any, res: any) {
    try {
      if (!req?.params?.id) throw new Error('Work ID is required');

      const work = await Work.getViewComponent(req?.params.id);

      // if not admin and not this user send a error
      if (
        !req?.user?.data.roles.includes('admin') &&
        req?.user?.data?.id !== work.user.userId
      ) {
        await this.accessDenied(req.ip);
      }

      res.send(new Result({ data: work, success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async getWorkEditorPageData(req: any, res: any) {
    try {
      const isNew = req?.body?.isNew;

      if (!isNew && !req?.body?.workId) throw new Error('Work ID is required');

      // Have to be a editor to be here
      if (!req?.user?.data.roles.includes('admin')) {
        await this.accessDenied(req.ip);
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
              email: '$userDetails.email'
            }
          }
        ])).map((x) => x.email),
        workStatusOptions: _.values(c.WORK_STATUS_OPTIONS),
        classTypeOptions: _.values(c.CLASS_TYPE),
        paymentStatusOptions: _.values(c.PAYMENT_STATUS_OPTIONS),
        subscriptionIntervalOptions: _.values(c.SUBSCRIPTION_INTERVAL_OPTIONS),
      };

      data.work = isNew
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
        : await Work.getViewComponent(req?.body.workId);

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
        const workerIds = (await User.find({ email: { $in: workers } }, { _id: 1 })).map((x) => x._id);
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
          newSubscription.nextPayment = SubscriptionService.addIntervalToDate(curDate, newSubscription.interval);
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

  public async getUserPageData(req: any, res: any) {
    try {
      const users = await User.aggregate([
        {
          $lookup: {
            from: 'works', // Replace with your 'Work' collection name
            localField: '_id',
            foreignField: 'userId',
            as: 'works'
          }
        },
        {
          $project: {
            userId: '$_id',
            fullName: 1,
            email: 1,
            emailConfirmed: 1,
            phoneNumber: 1,
            mfa: 1,
            works: 1 // Include the array of work items
          }
        },
        {
          $addFields: {
            works: {
              $map: {
                input: '$works',
                as: 'work',
                in: {
                  workId: '$$work._id',
                  userId: '$$work.userId',
                  meetingId: '$$work.meetingId',
                  categorySlug: '$$work.categorySlug',
                  serviceSlug: '$$work.serviceSlug',
                  workItems: '$$work.workItems',
                  status: '$$work.status',
                  paymentItems: '$$work.paymentItems',
                  initialPayment: '$$work.initialPayment',
                  subscription: '$$work.subscription',
                  initialPaymentStatus: '$$work.initialPaymentStatus',
                  cancellationPaymentStatus: '$$work.cancellationPaymentStatus'
                }
              }
            }
          }
        }
      ]);

      // Get Users and data
      for (let i = 0; i < users.length; i++) {
        let monthlyCost = 0;
        let totalPaymentsMadeCost = 0;
        users[i].activeWorkItems = 0;
        users[i].completeWorkItems = 0;
        const notActiveWorkStatus = [
          c.WORK_STATUS_OPTIONS.CANCELLATION_SET_UP,
          c.WORK_STATUS_OPTIONS.MEETING,
          c.WORK_STATUS_OPTIONS.CANCELLED,
          c.WORK_STATUS_OPTIONS.COMPLETED];

        // Calculate monthly subscription costs
        for (let y = 0; y < users[i].works.length; y++) {
          // Valid Active/Completed Work Item
          if (!notActiveWorkStatus.some((x) => x === users[i].works[y].status)) {
            users[i].activeWorkItems++;
          } else if (users[i].works[y].status === c.WORK_STATUS_OPTIONS.COMPLETED) {
            users[i].completeWorkItems++;
          }
          // initial payment
          if (users[i].works[y].initialPaymentStatus === c.PAYMENT_STATUS_OPTIONS.COMPLETED) {
            totalPaymentsMadeCost += users[i].works[y].initialPayment;
          }

          // subscription
          if (users[i].works[y].subscription.length > 0) {
            for (let t = 0; t < users[i].works[y].subscription.length; t++) {
              const sub = users[i].works[y].subscription[t];
              const paymentsMade = sub.paymentHistory.filter((x) => x.status === 'Completed').length;
              totalPaymentsMadeCost +=
                paymentsMade *
                sub.payment;
            }

            const currentSub =
              users[i].works[y].subscription[
              users[i].works[y].subscription.length - 1
              ];
            if (currentSub.interval === c.SUBSCRIPTION_INTERVAL_OPTIONS.SEVEN_DAYS) {
              monthlyCost += currentSub.payment * 4;
            } else if (currentSub.interval === c.SUBSCRIPTION_INTERVAL_OPTIONS.ONE_MONTH) {
              monthlyCost += currentSub.payment;
            } else if (currentSub.interval === c.SUBSCRIPTION_INTERVAL_OPTIONS.ONE_YEAR) {
              monthlyCost += currentSub.payment / 12;
            }
          }

          // each payment item
          for (let z = 0; z < users[i].works[y].paymentItems.length; z++) {
            if (users[i].works[y].paymentItems[z].status === c.PAYMENT_STATUS_OPTIONS.COMPLETED) {
              totalPaymentsMadeCost +=
                users[i].works[y].paymentItems[z].payment;
            }
          }
        }

        users[i].monthlyCost = monthlyCost;
        users[i].totalCost = totalPaymentsMadeCost;
        delete users[i].works;
      }

      res.send(new Result({ data: users, success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async getVMStatusReports(req: any, res: any) {
    try {
      let reports: any = await VMStatusReport.find({}).lean();

      reports = reports.map((r) => {
        // Array of properties to check
        const propertiesToCheck = ['database', 'pm2', 'system'];
        let severity = 'ok'; // Default severity

        // Loop through each property
        for (const prop of propertiesToCheck) {
          if (r[prop].status.some((x) => x.severity === 'critical')) {
            severity = 'critical';
            break; // Stop checking further if any critical severity is found
          } else if (r[prop].status.some((x) => x.severity === 'warning') && severity !== 'critical') {
            severity = 'warning';
          }
        }
        const info = severity === 'critical' ? 'look at this' : '';
        return {
          id: r._id,
          section: 'main',
          name: 'getVMStatusReports',
          severity,
          info,
          date: r.createdAt
        };
      });
      reports.reverse();

      res.send(new Result({ success: true, data: reports }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async downloadVMStatusReport(req: any, res: any) {
    try {
      const report = await VMStatusReport.findById(req.body.id).lean();
      if (!report) {
        throw new Error('No report found');
      }

      const jsonFile = await fileService.toJsonFile(report, req.user.data.id);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Errors');
      // Set the response headers to indicate the file type and name.
      res.setHeader(
        'Content-Disposition',
        `attachment; ${jsonFile.file.originalname}`
      );
      res.setHeader('Content-Type', jsonFile.file.mimetype);

      // If you'd like to send the errors as part of headers (not a common approach, but it's doable)
      res.setHeader('X-Errors', JSON.stringify(jsonFile.errors));

      // Send the updated Excel file as the response body.
      res.end(jsonFile.file.buffer);
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async getProfile(req: any, res: any) {
    try {
      // if not admin
      const userId = req?.body?.userId;

      // If userId is a thing and its not the user who is on check for admin
      if (userId && !req?.user?.data.roles.includes('admin')) {
        await this.accessDenied(req.ip);
      }

      // If no userId then retrun the users own
      let user: any = {};
      const queryUserId = userId ?? req.user.data.id;
      const selectionQuery: any = {
        _id: 0,
        name: '$fullName',
        email: 1,
        phoneNumber: 1
      };
      if (req?.user?.data.roles.includes('admin')) {
        selectionQuery.emailConfirmed = 1;
      }

      user = await User.findOne({ _id: queryUserId }, selectionQuery);

      if (!user?.phoneNumber) {
        user.phoneNumber = '';
      }

      res.send(new Result({ data: user, success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async saveProfile(req: any, res: any) {
    try {
      // if not admin
      const userId = req?.body?.userId;

      // If userId is a thing and its not the user who is on check for admin
      if (userId && !req?.user?.data.roles.includes('admin')) {
        await this.accessDenied(req.ip);
      }

      const setQuery: any = {
        fullName: req.body.user.name, // New name value
        phoneNumber: req.body.user.phoneNumber
      };

      if (req?.user?.data.roles.includes('admin')) {
        setQuery.email = req.body.user.email;
        setQuery.emailConfirmed = req.body.user.emailConfirmed;
      }

      const queryUserId = userId ?? req.user.data.id;

      await User.updateOne(
        { _id: queryUserId }, // Filter to match the user to update
        {
          $set: setQuery
        }
      );

      res.send(new Result({ success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async getSubPaymentHistory(req: any, res: any) {
    try {
      if (!req?.body?.workId) throw new Error('Work ID is required');

      const work = await Work.findById(req.body.workId, { userId: 1, categorySlug: 1 });
      // if not admin and not this user send a error
      if (
        !req?.user?.data.roles.includes('admin') &&
        req?.user?.data?.id !== work.userId.toString()
      ) {
        await this.accessDenied(req.ip);
      }

      // Get more Payment History from the index if given one
      const indexSlip = req.body?.paymentHistoryIndex ?? 0;
      const paymentHistory = await Work.getMoreSubPaymentHistory(req?.body.workId,
        indexSlip, c.LOADING_MORE.PAYMENT_HISTORY);

      // TODO Make sure this works
      const data = await StripeService.getSubPaymentHistory(paymentHistory, work.categorySlug);

      res.send(new Result({ success: true, data }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async addCardToSubscription(req: any, res: any) {
    try {
      if (!req?.body?.workId) throw new Error('Work ID is required');
      if (!req?.body?.cardToken) throw new Error('Card Token is required');

      const work = await Work.findById(req.body.workId);
      // if not admin and not this user send a error
      if (
        !req?.user?.data.roles.includes('admin') &&
        req?.user?.data?.id !== work.userId.toString()
      ) {
        await this.accessDenied(req.ip);
      }

      const user = await User.findById(work.userId).lean();

      const paymentId = await StripeService.addCard(user, work.categorySlug, req.body.cardToken);
      work.subscription[work.subscription.length - 1].paymentMethodId = paymentId;
      await work.save();

      res.send(new Result({ success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async confirmSubPaymentIntent(req: any, res: any) {
    try {
      if (!req?.query?.id) throw new Error('Payement Intent ID is required');

      res.send(new Result({ data: 'Contact our developer team', success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async getWorkTemplates(req: any, res: any) {
    try {
      const { category, service } = req.body;
      const data: any[] = await WorkTemplate.find({ category, service }).lean();

      res.send(new Result({
        data, success: true
      }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  // TODO: make this work for objects w arrats
  public stripMongo(obj: any): any {
    return _.cloneDeepWith(obj, (value) => {
      if (_.isObject(value) && !_.isArray(value)) {
        // Directly omit the '_id' key from the object
        return _.omit(value, ['_id', 'updatedAt', 'createdAt']);
      }
    });
  }

  public async saveWorkTemplate(req: any, res: any) {
    try {
      if (!req?.body?.name) {
        throw new Error('Name Required');
      }

      const work = this.stripMongo(req.body.work ?? req?.body?.template);
      function deleteId(obj) {
        if (obj?._id) {
          delete obj._id;
        }
        return obj;
      }
      work.workItems = work.workItems.map((x) => deleteId(x));
      work.paymentItems = work.paymentItems.map((x) => deleteId(x));

      const saveBy = {
        name: req.body.name,
        category: work.category,
        service: work.service,
      };

      if (req?.body?.work) {
        if (work.payment?.subscription) {
          work.payment.subscription = deleteId(work.payment?.subscription);
        }
        await WorkTemplate.updateOne(
          saveBy,
          {
            name: req.body.name,
            category: work.category,
            service: work.service,
            workItems: work.workItems,
            paymentItems: work.paymentItems,
            subscription: work.payment?.subscription ? {
              payment: work.payment.subscription.payment,
              interval: work.payment.subscription.interval,
            } : null,
            initialPayment: work.payment.initialPayment,
            initialPaymentStatus: work.initialPaymentStatus,
            cancellationPayment: work.payment.cancellationPayment,
            cancellationPaymentStatus: work.cancellationPaymentStatus,
            status: work.status,
            classType: work.classType
          },
          { upsert: true });
      } else if (req?.body?.template) {
        if (work?.subscription) {
          work.subscription = deleteId(work.subscription);
        }
        work.name = req.body.name;
        await WorkTemplate.updateOne(
          saveBy,
          work,
          { upsert: true });
      } else {
        throw new Error('No object found');
      }

      res.send(new Result({ success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async getWorkTemplatePageData(req: any, res: any) {
    try {
      const templates = await WorkTemplate.find({}).lean();

      res.send(new Result({
        data: templates, success: true
      }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async getWorkTemplateComponent(req: any, res: any) {
    try {
      if (!req?.body?.id) {
        throw new Error('No id found');
      }

      const template: any = await WorkTemplate.findById(req.body.id).lean();

      const slugs = await Category.getSlugs(template.category, template.service);
      template.categorySlug = slugs.categorySlug;
      template.serviceSlug = slugs.serviceSlug;

      res.send(new Result({
        data: template, success: true
      }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async getWorkTemplateEditorPageData(req: any, res: any) {
    try {
      if (!req?.body?.isNew && !req?.body?.workTemplateId) {
        throw new Error('No Params');
      }
      // Have to be a editor to be here
      if (!req?.user?.data.roles.includes('admin')) {
        await this.accessDenied(req.ip);
      }

      const data: any = {
        categoryOptions: (await Category.find({}, { name: 1 })).map(
          (x) => x.name
        ),
        servicesOptions: await Category.aggregate([
          { $group: { _id: '$name', services: { $push: '$services.name' } } },
          { $project: { _id: 0, name: '$_id', services: 1 } }
        ]).then((results) => {
          // Create a dictionary from the results
          const servicesDict = {};
          results.forEach((item) => {
            servicesDict[item.name] = item.services;
          });
          return servicesDict;
        }),
        workStatusOptions: _.values(c.WORK_STATUS_OPTIONS),
        classTypeOptions: _.values(c.CLASS_TYPE),
        paymentStatusOptions: _.values(c.PAYMENT_STATUS_OPTIONS),
        subscriptionIntervalOptions: _.values(c.SUBSCRIPTION_INTERVAL_OPTIONS),
        work: {}
      };

      if (!req?.body?.workTemplateId) {
        if (req?.body?.isNew) {
          data.work = {
            name: 'new_template',
            category: data.categoryOptions[0],
            service: data.servicesOptions[data.categoryOptions[0]][0][0],
            workItems: [],
            paymentItems: [],
            subscription: {
              payment: 0,
              interval: c.SUBSCRIPTION_INTERVAL_OPTIONS.NA
            },
            initialPayment: 0,
            initialPaymentStatus: c.PAYMENT_STATUS_OPTIONS.UNSET,
            cancellationPayment: 0,
            classType: data.categoryOptions[0] === 'Classes' ? c.CLASS_TYPE.NA : undefined,
            cancellationPaymentStatus: c.PAYMENT_STATUS_OPTIONS.UNSET,
            status: c.WORK_STATUS_OPTIONS.NA
          };
        } else {
          throw new Error('Work ID is required');
        }
      } else {
        data.work = await WorkTemplate.findById(req.body.workTemplateId).lean();
      }

      res.send(new Result({ data, success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async deleteWorkTemplate(req: any, res: any) {
    try {
      const id = req.params.id; // Correctly access the id from path parameters
      await WorkTemplate.deleteOne({ _id: id }); // Use it in an object for the criteria

      res.send(new Result({
        success: true
      }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async accessDenied(ip: string) {
    await security.checkAndBlockIP(ip);
    throw new Error('Access Denied');
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

      await this.acceptingWork(template.categorySlug, template.serviceSlug);

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

      await this.acceptingWork(template.categorySlug, template.serviceSlug);

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
        await this.accessDenied(req.ip);
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

  public async deleteCard(req: any, res: any) {
    try {
      if (!req?.params?.id) throw new Error('Work ID is required');

      const work = await Work.findById(req.params.id);
      // if not admin and not this user send a error
      if (
        !req?.user?.data.roles.includes('admin') &&
        req?.user?.data?.id !== work.userId.toString()
      ) {
        await this.accessDenied(req.ip);
      }

      const sub = work.subscription[work.subscription.length - 1];
      await StripeService.removeCard(work.categorySlug, sub.paymentMethodId);
      sub.paymentMethodId = undefined;
      await work.save();

      res.send(new Result({ success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async getAcceptingWorkState(req: any, res: any) {
    try {
      const acceptingWorkConfig = await Config.findOne({ name: 'acceptingWork' });
      const acceptingWorkState = acceptingWorkConfig?.value ?? {
        name: 'acceptingWork',
        value: {
          classes: {
            accepting: false,
            noService: []
          },
          software: {
            accepting: false,
            noService: []
          },
          photography: {
            accepting: false,
            noService: []
          },
          videography: {
            accepting: false,
            noService: []
          }
        }
      };

      // Gather category service options
      const servicesOptions = await Category.getCategoryServiceOptions();

      res.send(new Result({
        data: { acceptingWorkState, servicesOptions },
        success: true
      }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async saveAcceptingWorkState(req: any, res: any) {
    try {
      if (!req?.body?.state) {
        throw new Error('No State Provided');
      }

      await Config.updateOne({ name: 'acceptingWork' }, {
        $set: {
          value: req.body.state
        }
      });

      res.send(new Result({ success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async generatePaymentReceipt(req: any, res: any) {
    try {
      const id = req?.params?.id; // Correctly access the id from path parameters
      const work = await Work.findById(id);

      if (!work) {
        throw new Error('No Work Found');
      }

      if (
        !req?.user?.data.roles.includes('admin') &&
        req?.user?.data?.id !== work.userId.toString()
      ) {
        await this.accessDenied(req.ip);
      }

      const names = await Category.getNames(work.categorySlug, work.serviceSlug);

      const receipt: any = {
        metaData: {
          workId: work._id,
          category: names.category,
          service: names.service,
          createdOn: new Date()
        },
        checkouts: [],
        subs: [],
        totals: {
          checkout: 0,
          sub: 0,
          toDate: 0
        },
      };

      // Generate payments from work.paymentHistory
      for (const payment of work.paymentHistory
        .filter((x) => x.status === c.PAYMENT_STATUS_OPTIONS.COMPLETED)) {
        const session = await StripeService
          .getCheckoutSession(work.categorySlug, payment.sessionId);
        const lineItemResponse: any = await StripeService
          .getLineItems(work.categorySlug, payment.sessionId);
        const items = lineItemResponse.data.map((x) => {
          const amount = Number((x.amount_total / 100).toFixed(2));
          return {
            description: x.description,
            total: `${amount.toFixed(2)} CAD`,
          };
        });
        if (session.payment_status === 'paid') {
          const amount = Number((session.amount_total / 100).toFixed(2));
          receipt.totals.checkout += amount;
          const paymentMethod = await StripeService
            .getLast4DigitsOfCardFromSession(work.categorySlug, session);
          receipt.checkouts.push({
            id: payment._id,
            payment: `${amount.toFixed(2)} CAD`,
            items,
            paymentMethod: `**** **** **** ${paymentMethod}`,
            date: payment.createdDate
          });
        }
      }

      if (work.subscription?.length > 0) {
        for (const sub of work.subscription) {
          const subPaymentData = await StripeService
            .getSubPaymentHistory(sub.paymentHistory, work.categorySlug);
          for (const paymentInfo of subPaymentData) {
            receipt.totals.sub += paymentInfo.cost;
            receipt.subs.push({
              id: paymentInfo.id,
              payment: `${paymentInfo.cost.toFixed(2)} CAD`,
              paymentMethod: `**** **** **** ${paymentInfo.last4Digits}`,
              date: paymentInfo.date
            });
          }
        }
      }

      receipt.totals.toDate = receipt.totals.checkout + receipt.totals.sub;

      receipt.totals.checkout = `${receipt.totals.checkout.toFixed(2)} CAD`;
      receipt.totals.sub = `${receipt.totals.sub.toFixed(2)} CAD`;
      receipt.totals.toDate = `${receipt.totals.toDate.toFixed(2)} CAD`;

      res.send(new Result({ data: receipt, success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }
}

export default new DataController();
