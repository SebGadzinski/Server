/**
 * @file Controller for application needs
 * @author Sebastian Gadzinski
 */
import Result from '../classes/Result';
import config from '../config';
import { Category, Meetings, Token, User, Work } from '../models';
import SecurityService from '../services/SecurityService';

const security = SecurityService.getInstance();

class DataController {
  private static readonly publicCollections = {
    category: Category
  };

  constructor() {
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

      if (!req?.user?.data.id) throw new Error('Sign Up Required');
      // if (!req.user.data.emailConfirmed) throw new Error('Email Confirmed Required');

      users.push(req.user.data.id);

      // Validate input
      if (!categorySlug || !serviceSlug || users.length === 0 || !startDate) {
        throw new Error('Missing required fields');
      }

      // Check for time conflicts
      const endDate: Date = new Date(startDate.getTime());
      endDate.setMinutes(45);
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

      // TODO: Get google meetings or zoom link
      const link =
        'https://ca.search.yahoo.com/search?fr=mcafee&type=E211CA885G0&p=meeting';

      // Add Meeting
      const newMeeting = new Meetings({
        // Me for now
        // hostUserId,
        categorySlug,
        serviceSlug,
        users,
        link,
        startDate,
        endDate
      });
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
        createdDate: new Date(),
        createdBy: req.user.data.id,
        updatedBy: req.user.data.id
      });
      await newWork.save();

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

      // if not admin and not this user send a error
      if (
        !req?.user?.data.roles.includes('admin') &&
        req?.user?.data.id !== work.userId.toString()
      ) {
        await this.accessDenied(req.ip);
      }

      // If some payment items got completed do this but it can be done by
      // admin anyway w editing
      work.status = 'User Accepted';
      work.initialPaymentStatus = 'Some Completed';
      work.cancellationPaymentStatus = 'Some Completed';
      work.save();

      res.send(new Result({ success: true }));
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

      // TODO: Determine cancellation fee
      // This should be based off of how long in the work process you are
      // in and what work had already been done

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

      // if not admin and not this user send a error
      if (
        !req?.user?.data.roles.includes('admin') &&
        req?.user?.data.id !== work.userId.toString()
      ) {
        await this.accessDenied(req.ip);
      }

      // If some payment items got completed do this but it can be done by
      // admin anyway w editing
      work.status = 'Cancelled';
      work.initialPaymentStatus = 'Completed';
      work.cancellationPaymentStatus = 'Some Completed';
      work.save();

      res.send(new Result({ success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
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
          'N/A'
        ],
        paymentStatusOptions: ['Some Completed', 'Completed', 'N/A', 'Unset'],
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
        payment
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
