/**
 * @file Controller for application needs
 * @author Sebastian Gadzinski
 */
import Result from '../classes/Result';
import config from '../config';
import { Category, Meetings, Token, User, Work } from '../models';

class DataController {
  private static readonly publicCollections = {
    category: Category
  };

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

      // Add Meeting
      const newMeeting = new Meetings({
        // Me for now
        // hostUserId,
        categorySlug,
        serviceSlug,
        users,
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
        initialPayment: 0,
        subscription: { payment: 0, interval: 'NA' },
        paymentStatus: 'Unset',
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
}

export default new DataController();
