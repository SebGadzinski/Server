/**
 * @file Controller for application needs
 * @author Sebastian Gadzinski
 */
import { randomUUID } from 'crypto';
import { DateTime } from 'luxon';
import mongoose from 'mongoose';
import Stripe from 'stripe';
import Result from '../classes/Result';
import config from '../config';
import { Category, Meetings, Token, User, Work } from '../models';
import { IUser } from '../models/User';
import { IWork } from '../models/Work';
import EmailService from '../services/EmailService';
import SecurityService from '../services/SecurityService';
import ZoomMeetingService from '../services/ZoomMeetingService';

const stripe = {
  software: new Stripe(config.stripe.software, {
    apiVersion: '2023-10-16'
  }),
  photography: new Stripe(config.stripe.photography, {
    apiVersion: '2023-10-16'
  }),
  videography: new Stripe(config.stripe.videography, {
    apiVersion: '2023-10-16'
  })
};

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
    this.getViewComponent = this.getViewComponent.bind(this);
    this.getWorkEditorPageData = this.getWorkEditorPageData.bind(this);
    this.upsertWork = this.upsertWork.bind(this);
    this.getWorkComponent = this.getWorkComponent.bind(this);
    this.getUserPageData = this.getUserPageData.bind(this);
    this.getProfile = this.getProfile.bind(this);
    this.saveProfile = this.saveProfile.bind(this);
    this.accessDenied = this.accessDenied.bind(this); // This was the initial method with issues
    this.generatePaymentIntent = this.generatePaymentIntent.bind(this);
    this.confirmPaymentIntent = this.confirmPaymentIntent.bind(this);
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

  // _Category
  public async getCategoryPageData(req: any, res: any) {
    try {
      const data = await Category.aggregate([
        { $match: { slug: req.body.categorySlug } },
        { $project: { services: 1, _id: 0 } },
        { $unwind: '$services' },
        {
          $project: {
            name: '$services.name',
            description: '$services.description',
            thumbnailImg: '$services.thumbnailImg',
            slug: '$services.slug'
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
        { 'services.$': 1 }
      ).lean();

      if (!category || !category.services) {
        return res.send(
          new Result({ message: 'Service not found', success: false })
        );
      }

      // Extract the matched service
      const service = category.services[0];

      res.send(new Result({ data: service, success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  // _Meetings

  public async getMeetingPageData(req: any, res: any) {
    try {
      const date = new Date(req.body.date);

      // if not admin
      let userId = null;
      if (req?.user?.data.roles.includes('admin')) {
        userId = req.user.id;
      }

      const category = await Category.aggregate([
        { $match: { slug: req.body.categorySlug } },
        { $unwind: '$services' },
        { $match: { 'services.slug': req.body.serviceSlug } },
        { $project: { 'name': 1, 'services.name': 1 } }
      ]).exec();
      const unavailablePeriods = await Meetings.findUnavailableDurations(date);

      res.send(
        new Result({
          data: {
            unavailablePeriods,
            category: category[0].name,
            service: category[0].services.name
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
      const { categorySlug, serviceSlug } = req.body;
      const startDate = new Date(req.body.startDate);
      const users: string[] = [];

      if (!req?.user?.data?.id) throw new Error('Sign Up Required');
      // if (!req.user.data.emailConfirmed) throw new Error('Email Confirmed Required');

      users.push(req.user.data.id);

      // Validate input
      if (!categorySlug || !serviceSlug || users.length === 0 || !startDate) {
        throw new Error('Missing required fields');
      }

      // Check for time conflicts
      const endDate: Date = new Date(startDate.getTime());
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

      const { join_url, meetingId } = await ZoomMeetingService.createMeeting(
        `${req?.user.data.email}: ${categorySlug} - ${serviceSlug}`,
        startDate,
        30
      );

      newMeeting.link = join_url;
      newMeeting.zoomMeetingId = meetingId;

      await newMeeting.save();

      // Create new work object and attach meeting
      const newWork = new Work({
        userId: req.user.data.id,
        meetingId: newMeeting._id,
        categorySlug,
        serviceSlug,
        workItems: [],
        paymentItems: [],
        subscription: [],
        initialPayment: 0,
        initialPaymentStatus: 'Unset',
        cancellationPayment: 0,
        cancellationPaymentStatus: 'Unset',
        status: 'Meeting',
        paymentHistory: [],
        createdDate: new Date(),
        createdBy: req.user.data.id,
        updatedBy: req.user.data.id
      });
      await newWork.save();

      // Send Email
      const category = await Category.aggregate([
        { $match: { slug: req.body.categorySlug } },
        { $unwind: '$services' },
        { $match: { 'services.slug': req.body.serviceSlug } },
        { $project: { 'name': 1, 'services.name': 1 } }
      ]).exec();

      // Convert and format dates for email using Luxon
      const timeZone = 'America/New_York';
      const formattedStartDate = DateTime.fromJSDate(startDate)
        .setZone(timeZone)
        .toFormat('MMMM dd, yyyy HH:mm:ss');
      const formattedEndDate = DateTime.fromJSDate(endDate)
        .setZone(timeZone)
        .toFormat('HH:mm:ss');

      await EmailService.sendNotificationEmail(
        config.sendGrid.email.alert,
        'New Meeting',
        `${req?.user.data.email} Wants To Talk!`,
        `${req?.user.data.email} wants to talk about work in ${category[0].name} - ${category[0].services.name}`,
        `${config.frontEndDomain}/work/${newWork._id}`,
        'View On Site'
      );
      await EmailService.sendNotificationEmail(
        req?.user.data.email,
        'New Meeting',
        `Meeting has been set`,
        `Your meeting is set for ${formattedStartDate} - ${formattedEndDate} Eastern Time. Click on button below and hit the actions drop down and click 'Go To Meeting'`,
        `${config.frontEndDomain}/work/${newWork._id}`,
        'View On Site'
      );

      res.send(new Result({ data: newMeeting, success: true }));
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
        { $unwind: '$meetingDetails' },
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
            meetingLink: '$meetingDetails.link',
            createdDate: '$createdAt',
            subscription: {
              $ifNull: [
                { $arrayElemAt: [{ $slice: ['$subscription', -1] }, 0] },
                { payment: 0, interval: 'N/A', paymentsMade: 0 }
              ]
            }
          }
        }
      ]);

      const workData = await workAggregation.exec();

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
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async confirmWork(req: any, res: any) {
    try {
      if (!req?.body?.workId) throw new Error('Work ID is required');

      const work = await Work.findOne({ _id: req?.body?.workId });
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

      work.status = 'User Accepted';
      work.initialPaymentStatus = 'Completed';
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
      await EmailService.sendNotificationEmail(
        email,
        'Work Confirmed',
        `${theUser} Confirm Work`,
        `${theUser} has confirmed the work id ${work._id}`,
        `${config.frontEndDomain}/work/${work._id}`,
        'View On Site'
      );
    }
  }

  public async generatePaymentIntent(req: any, res: any) {
    try {
      if (!req?.body?.workId) throw new Error('Work ID is required');

      const work = await Work.findOne({ _id: req.body.workId });

      // if not admin and not this user send an error
      if (
        !req.user.data.roles.includes('admin') &&
        req.user.data.id !== work.userId.toString()
      ) {
        await this.accessDenied(req.ip);
        return;
      }

      let amount = 0;
      let name = '';
      const currency = 'cad';
      const paymentCompletedMsg = `Payment already completed`;

      if (req.body.type === 'confirmation') {
        if (work.initialPaymentStatus === 'Completed') {
          throw new Error(paymentCompletedMsg);
        }
        amount = work.initialPayment;
        name = 'Initial Payment for Work ID ' + req.body.workId;
      } else if (req.body.type === 'paymentItem' && req.body.paymentItemId) {
        // Get the payment item and add it name
        const paymentItem = work.paymentItems.find(
          (x) => x._id.toString() === req.body.paymentItemId
        );
        if (!paymentItem) {
          throw new Error(`No payment item found ${req.body.paymentItemId}`);
        }
        if (paymentItem.status === 'Completed') {
          throw new Error(paymentCompletedMsg);
        }
        name = `Payment '${paymentItem.name}' for Work ID ${req.body.workId}`;
        amount = paymentItem.payment;
      } else if (req.body.type === 'full') {
        const unpaidPaymentItems = work.paymentItems.filter(
          (x) => x.status !== 'Completed'
        );
        if (unpaidPaymentItems.length === 0) {
          throw new Error(paymentCompletedMsg);
        }
        amount = unpaidPaymentItems.reduce((total, currentItem) => {
          return total + currentItem.payment;
        }, 0);
        name = 'Complete Payment for Work ID ' + req.body.workId;
      } else if (req.body.type === 'cancellation') {
        if (work.cancellationPaymentStatus === 'Completed') {
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

      // Create a Stripe Checkout Session for the payment
      const session = await stripe[work.categorySlug].checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency,
              product_data: {
                name
              },
              unit_amount: amount * 100
            },
            quantity: 1
          }
        ],
        mode: 'payment',
        success_url: `${config.frontEndDomain}/work/pay/confirm/${newPaymentHistory._id}`,
        cancel_url: `${config.frontEndDomain}/work`
      });

      newPaymentHistory.sessionId = session.id;
      work.paymentHistory.push(newPaymentHistory);
      work.save();

      res.send(new Result({ data: { sessionId: session.id }, success: true }));
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

      const checkoutSession = await stripe[
        work.categorySlug
      ].checkout.sessions.retrieve(paymentHistory.sessionId);

      if (checkoutSession.payment_status !== 'paid') {
        throw new Error('Payment not successful');
      }

      paymentHistory.status = 'Completed';

      // Update the statuses of content of work
      if (paymentHistory.type === 'confirmation') {
        work.status = 'User Accepted';
        work.initialPaymentStatus = 'Completed';
        await this.sendConfirmWorkEmails(false, work, workUser);
      } else if (
        paymentHistory.type === 'paymentItem' &&
        paymentHistory?.paymentItemId
      ) {
        const paymentItem = work.paymentItems.find(
          (pi) => pi._id.toString() === paymentHistory.paymentItemId
        );
        if (paymentItem) {
          paymentItem.status = 'Completed';
        }
      } else if (paymentHistory.type === 'full') {
        work.paymentItems.map((x) => {
          x.status = 'Completed';
          return x;
        });
      } else if (paymentHistory.type === 'cancellation') {
        work.status = 'Cancelled';
        work.cancellationPaymentStatus = 'Completed';
        await this.sendCancelWorkEmails(false, work, workUser);
      } else {
        throw new Error(`Type ${paymentHistory.type} not found`);
      }

      await work.save();
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
      if (!req?.body?.workId) throw new Error('Work ID is required');

      const work = await Work.findOne({ _id: req?.body?.workId });
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
      work.status = 'Cancelled';
      work.cancellationPaymentStatus = 'Completed';
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
      await EmailService.sendNotificationEmail(
        email,
        'Work Cancelled',
        `${theUser} Cancelled Work`,
        `${theUser} has cancelled work ${work._id}`,
        `${config.frontEndDomain}/work/${work._id}`,
        'View On Site'
      );
    }
  }

  public async getViewComponent(req: any, res: any) {
    try {
      if (!req?.body?.workId) throw new Error('Work ID is required');

      const work = await Work.getViewComponent(req?.body.workId);

      // if not admin and not this user send a error
      if (
        !req?.user?.data.roles.includes('admin') &&
        req?.user?.id !== work.user.userId
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
      if (!req?.body?.workId) throw new Error('Work ID is required');

      // Have to be a editor to be here
      if (!req?.user?.data.roles.includes('admin')) {
        await this.accessDenied(req.ip);
      }

      const data = {
        usersOptions: (await User.find({}, { email: 1 })).map((x) => x.email),
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
        workStatusOptions: [
          'Meeting',
          'Completed',
          'Confirmation Required',
          'User Accepted',
          'Needs Attention',
          'N/A',
          'Cancellation Set Up'
        ],
        paymentStatusOptions: [
          'Some Completed',
          'Completed',
          'N/A',
          'Unset',
          'Incomplete'
        ],
        subscriptionIntervalOptions: ['N/A', '7 Days', '1 Months', '1 Years'],
        work: await Work.getViewComponent(req?.body.workId)
      };

      res.send(new Result({ data, success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async upsertWork(req: any, res: any) {
    try {
      // Extracting data from request body
      const {
        _id,
        workItems,
        paymentItems,
        initialPaymentStatus,
        cancellationPaymentStatus,
        status,
        user,
        category,
        service,
        payment,
        updateMessage,
        sendEmail
      } = req.body;

      // Find the user based on the email
      const foundUser = await User.findOne({ email: user.email });
      if (!foundUser) throw new Error('User not found');

      // Find or create the work item
      let work = await Work.findOne({ _id });
      if (!work) {
        // If work not found, create a new one
        work = new Work({
          _id,
          userId: foundUser._id /* other required fields */,
          subscription: []
        });
      }

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
      work.categorySlug = myCategory.slug;
      work.serviceSlug = myServiceSlug;
      work.initialPayment = payment.initialPayment;
      work.cancellationPayment = payment.cancellationPayment;

      const subIndex: number = work.subscription.length - 1;
      if (payment.subscription.interval === 'N/A') {
        payment.subscription.payment = 0;
      }
      if (subIndex < 0) {
        payment.subscription.paymentsMade = 0;
        work.subscription = [payment.subscription];
      } else if (
        work.subscription[subIndex].interval !==
          payment.subscription.interval ||
        work.subscription[subIndex].payment !== payment.subscription.payment
      ) {
        work.subscription.push(payment.subscription);
      }

      await work.save();

      if (sendEmail) {
        await EmailService.sendNotificationEmail(
          user.email,
          'Work Update',
          'Admin Updated Work',
          updateMessage,
          `${config.frontEndDomain}/work/${work._id}`,
          'View On Site'
        );
      }

      res.send(new Result({ success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async getWorkComponent(req: any, res: any) {
    try {
      if (!req?.body?.workId) throw new Error('Work ID is required');

      const work = await Work.getViewComponent(req?.body.workId);

      // if not admin and not this user send an error
      if (
        !req?.user?.data.roles.includes('admin') &&
        req?.user?.data.id !== work.user.userId
      ) {
        await this.accessDenied(req.ip);
      }

      res.send(new Result({ data: work, success: true }));
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
        // Calculate monthly subscription costs

        for (let y = 0; y < users[i].works.length; y++) {
          // initial payment
          if (users[i].works[y].initialPaymentStatus === 'Completed') {
            totalPaymentsMadeCost += users[i].works[y].initialPayment;
          }

          // subscription
          if (users[i].works[y].subscription.length > 0) {
            for (let t = 0; t < users[i].works[y].subscription.length; t++) {
              totalPaymentsMadeCost +=
                users[i].works[y].subscription[t].paymentsMade *
                users[i].works[y].subscription[t].payment;
            }

            const currentSub =
              users[i].works[y].subscription[
                users[i].works[y].subscription.length - 1
              ];
            if (currentSub.interval === '7 Days') {
              monthlyCost += currentSub.payment * 4;
            } else if (currentSub.interval === '1 Months') {
              monthlyCost += currentSub.payment;
            } else if (currentSub.interval === '1 Years') {
              monthlyCost += currentSub.payment / 12;
            }
          }

          // each payment item
          for (let z = 0; z < users[i].works[y].paymentItems.length; z++) {
            if (users[i].works[y].paymentItems[z].status === 'Completed') {
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
        email: req.body.user.email,
        phoneNumber: req.body.user.phoneNumber
      };

      if (req?.user?.data.roles.includes('admin')) {
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

  public async accessDenied(ip: string) {
    await security.checkAndBlockIP(ip);
    throw new Error('Access Denied');
  }
}

export default new DataController();
